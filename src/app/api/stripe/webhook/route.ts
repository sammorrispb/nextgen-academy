import { NextRequest, NextResponse, after } from "next/server";
import { revalidatePath } from "next/cache";
import type Stripe from "stripe";
import { Resend } from "resend";
import { getStripe } from "@/lib/stripe";
import { incrementSessionRegistered } from "@/lib/notion-sessions";
import {
  createDropInRegistrationResult,
  findDropInByCheckoutId,
  type DropInRow,
} from "@/lib/notion-dropins";
import { sessionToSlug } from "@/lib/session-slug";
import { cancelDropIn } from "@/lib/cancel-dropin";
import { buildDropInIcs } from "@/lib/email/ics";
import {
  bookingConfirmationHtml,
  type ConfirmationFill,
} from "@/lib/email/booking-confirmation";
import { fillGoal, fillBar, fillLabel } from "@/lib/fill-meter";
import { whatsappInviteText } from "@/lib/email/whatsapp-invite";
import { sendSms, bookingConfirmationSms } from "@/lib/sms";
import { signCancelToken } from "@/lib/cancel-token";
import { processReferralReward } from "@/lib/referral-rewards";
import { syncPlayerFromDropIn } from "@/lib/notion-player-sync";
import {
  createClusterRegistrationResult,
  findClusterRegByCheckoutId,
} from "@/lib/notion-clusters";
import { ingestToOpenBrain } from "@/lib/open-brain-ingest";
import { attributedSource } from "@/lib/attribution";
import {
  findProcessedEvent,
  recordProcessedEvent,
} from "@/lib/notion-processed-events";

export const runtime = "nodejs";
// Acknowledge Stripe fast (critical row create only), then finish the
// best-effort comms via after() AFTER the response is sent. maxDuration keeps
// the function alive long enough for that background work to drain. The old
// code awaited every email/SMS/coupon-mint before 200'ing, which on a cold
// start blew past Stripe's webhook timeout → retry storm → ~50% error rate.
export const maxDuration = 60;

const ADMIN_EMAIL = "nextgenacademypb@gmail.com";
// Recipients for the real-time "new registration" admin notifications (drop-in
// + camp). Sam's personal inbox is included alongside the academy inbox so
// registrations surface where he actually reads. The parent-confirmation BCC
// stays academy-only (below) so he isn't double-emailed a copy of every receipt.
const ADMIN_NOTIFY = [ADMIN_EMAIL, "sam.morris2131@gmail.com"];
const FROM_EMAIL = "Next Gen PB Academy <noreply@nextgenpbacademy.com>";
const REPLY_TO = "nextgenacademypb@gmail.com";
const SITE_ORIGIN =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://nextgenpbacademy.com";

function metaString(meta: Stripe.Metadata, key: string): string {
  return typeof meta[key] === "string" ? meta[key] : "";
}

// The payer's email. Checkout Sessions created with a `customer_email` populate
// `session.customer_email`; Payment Links (the discount-link path) don't — the
// email the customer enters lands in `session.customer_details.email` while
// `customer_email` stays null. Read both so Payment Link registrations resolve
// the same as regular checkouts; an empty result would 400 the Notion row
// create and silently drop the registration.
function payerEmail(session: Stripe.Checkout.Session): string {
  return session.customer_details?.email ?? session.customer_email ?? "";
}

function formatLongDate(date: string): string {
  if (!date) return "";
  const d = new Date(`${date}T12:00:00Z`);
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

async function emailAdmin(session: Stripe.Checkout.Session) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("[stripe-webhook] RESEND_API_KEY missing — skipping admin email");
    return;
  }
  const resend = new Resend(apiKey);
  const m = session.metadata ?? {};
  const amount = ((session.amount_total ?? 0) / 100).toFixed(2);
  const birthYear = Number(metaString(m, "child_birth_year")) || 0;
  const childAgeStr = birthYear
    ? `${new Date().getFullYear() - birthYear}, born ${birthYear}`
    : "unknown";

  const subject = `New drop-in: ${metaString(m, "child_first_name")} — ${metaString(m, "session_title") || metaString(m, "session_date")}`;
  const lines = [
    `Parent: ${metaString(m, "parent_name")}`,
    `Email: ${payerEmail(session) || metaString(m, "parent_email")}`,
    `Phone: ${metaString(m, "parent_phone")}`,
    `Child: ${metaString(m, "child_first_name")} (age ${childAgeStr})`,
    "",
    `Session: ${metaString(m, "session_title")}`,
    `Date: ${metaString(m, "session_date")} ${metaString(m, "session_start")}`,
    `Location: ${metaString(m, "session_location")}`,
    "",
    `Paid: $${amount}`,
    `Stripe: ${session.id}`,
  ];

  const { error } = await resend.emails.send({
    from: FROM_EMAIL,
    to: ADMIN_NOTIFY,
    subject,
    text: lines.join("\n"),
  });
  if (error) {
    console.error("[stripe-webhook] Resend rejected admin email", error);
  }
}

async function emailParent(
  session: Stripe.Checkout.Session,
  fill: ConfirmationFill | null,
) {
  const apiKey = process.env.RESEND_API_KEY;
  const to = payerEmail(session);
  if (!apiKey) {
    console.warn("[stripe-webhook] RESEND_API_KEY missing — skipping parent email");
    return;
  }
  if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    console.warn("[stripe-webhook] no customer_email — skipping parent email");
    return;
  }

  const resend = new Resend(apiKey);
  const m = session.metadata ?? {};
  const amount = ((session.amount_total ?? 0) / 100).toFixed(2);
  const parentName = metaString(m, "parent_name");
  const parentFirst = parentName.split(/\s+/)[0] || "there";
  const childFirst = metaString(m, "child_first_name") || "your player";
  const sessionTitle = metaString(m, "session_title");
  const sessionDate = metaString(m, "session_date");
  const sessionStart = metaString(m, "session_start");
  const sessionEnd = metaString(m, "session_end");
  const sessionExact = metaString(m, "session_location");
  const sessionPublicArea = metaString(m, "session_public_area");
  // Locations are public (hidden-location retired 2026-06-05). Force false even
  // for in-flight checkouts created before the change. Show the exact venue,
  // falling back to the broad area only if the exact venue isn't filled in yet.
  const locationHidden = false;
  const sessionLocation = sessionExact || sessionPublicArea;

  const slug =
    sessionTitle && sessionDate
      ? sessionToSlug({ title: sessionTitle, date: sessionDate })
      : "";
  const detailUrl = slug ? `${SITE_ORIGIN}/schedule/${slug}` : `${SITE_ORIGIN}/schedule`;
  const sessionDateLong = formatLongDate(sessionDate);

  // Self-serve cancel URL — token signed with NGA_ADMIN_SECRET. If the secret
  // isn't set, the link is suppressed and the email falls back to the "reply
  // or text Sam" copy.
  const cancelToken = signCancelToken(session.id);
  const cancelUrl = cancelToken
    ? `${SITE_ORIGIN}/schedule/cancel?token=${encodeURIComponent(cancelToken)}`
    : undefined;

  const subject = `You're registered — ${sessionTitle || sessionDateLong}`;

  const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(sessionLocation)}`;

  // Plain-text fallback for clients that hide HTML.
  const text = [
    `Hi ${parentFirst},`,
    "",
    `${childFirst} is confirmed for an NGA drop-in:`,
    "",
    `${sessionTitle}`,
    `${sessionDateLong} · ${sessionStart}${sessionEnd ? `–${sessionEnd}` : ""}`,
    `${sessionLocation}`,
    locationHidden
      ? `We'll email the exact location 24 hours before start.`
      : `Directions: ${mapsUrl}`,
    "",
    `Paid: $${amount}. We attached an .ics calendar invite — tap it to add the session to your calendar.`,
    ...(fill && fill.goal > 0
      ? [
          "",
          `You moved the meter: ${fillBar(fill.registered, fill.goal)} — with ${childFirst} in, this session is ${fillLabel(fill.registered, fill.goal)}. Full courts make the best games — know a teammate who'd love it? Share: ${detailUrl}`,
        ]
      : []),
    "",
    `What to bring:`,
    `- Water bottle`,
    `- Court shoes (no flat-soled sneakers)`,
    `- A paddle if you have one. We have loaners.`,
    "",
    cancelUrl
      ? `If something comes up, cancel your reservation so the next player can grab the seat: ${cancelUrl}\nDrop-ins are non-refundable, but the swap helps the whole community.`
      : `If something comes up, reply to this email or text 301-325-4731 so we can open the seat. Drop-ins are non-refundable, but the swap helps the whole community.`,
    "",
    `Session link: ${detailUrl}`,
    "",
    whatsappInviteText(),
    "",
    `See you on the court — better than yesterday, together.`,
    `Coach Sam · Next Gen Pickleball Academy`,
  ].join("\n");

  const html = bookingConfirmationHtml({
    parentFirst,
    childFirst,
    sessionTitle,
    sessionDateLong,
    sessionStart,
    sessionEnd: sessionEnd || "",
    sessionLocation,
    locationHidden,
    amountPaid: amount,
    detailUrl,
    cancelUrl,
    fill,
  });

  // Attach a one-shot .ics calendar invite. End time may be missing in
  // metadata for older sessions — skip the attachment in that case rather
  // than guessing a duration.
  const ics =
    sessionStart && sessionEnd && sessionDate
      ? buildDropInIcs({
          uid: `${session.id}@nextgenpbacademy.com`,
          date: sessionDate,
          startTime: sessionStart,
          endTime: sessionEnd,
          title: `NGA Drop-in · ${sessionTitle}`,
          location: sessionLocation,
          description: locationHidden
            ? `${childFirst}'s NGA drop-in in ${sessionLocation}. Exact location emailed 24h before start. Bring water + court shoes. Loaners available. Questions? Text Sam 301-325-4731.`
            : `${childFirst}'s NGA drop-in. Bring water + court shoes. Loaners available. Questions? Text Sam 301-325-4731.`,
        })
      : null;

  const attachments = ics
    ? [
        {
          filename: "nga-session.ics",
          content: Buffer.from(ics, "utf-8").toString("base64"),
          contentType: "text/calendar; charset=utf-8; method=PUBLISH",
        },
      ]
    : undefined;

  const { error } = await resend.emails.send({
    from: FROM_EMAIL,
    to,
    bcc: ADMIN_EMAIL,
    replyTo: REPLY_TO,
    subject,
    html,
    text,
    attachments,
  });
  if (error) {
    console.error("[stripe-webhook] Resend rejected parent email", error);
  }
}

export async function POST(req: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "Webhook not configured" },
      { status: 500 },
    );
  }

  const sig = req.headers.get("stripe-signature");
  if (!sig) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  const stripe = getStripe();
  const rawBody = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, secret);
  } catch (err) {
    console.error("[stripe-webhook] signature verification failed", err);
    return NextResponse.json({ error: "Bad signature" }, { status: 400 });
  }

  if (event.type === "charge.refunded") {
    return handleChargeRefunded(event.data.object as Stripe.Charge);
  }

  if (event.type !== "checkout.session.completed") {
    return NextResponse.json({ received: true });
  }

  const session = event.data.object as Stripe.Checkout.Session;
  if (session.payment_status !== "paid") {
    return NextResponse.json({ received: true, skipped: "not_paid" });
  }

  // Summer Camp registrations are a separate product from the $20 drop-in. They
  // carry kind=camp metadata and run their own confirmation + CRM/OB sync — they
  // do NOT touch the drop-in Notion roster or the drop-in comms crons.
  if (metaString(session.metadata ?? {}, "kind") === "camp") {
    return handleCampCheckout(session);
  }

  // League season enrollments are a separate product from the $20 drop-in. They
  // carry kind=league metadata and run their own confirmation + CRM/OB sync —
  // they do NOT touch the drop-in Notion roster or the drop-in comms crons.
  if (metaString(session.metadata ?? {}, "kind") === "league") {
    return handleLeagueCheckout(session);
  }

  // Cluster season registrations carry kind=cluster and get a dedicated roster
  // DB that doubles as the idempotency key — unlike camp/league, a redelivered
  // event can never resend cluster emails or double-write the roster.
  if (metaString(session.metadata ?? {}, "kind") === "cluster") {
    return handleClusterCheckout(session);
  }

  const m = session.metadata ?? {};
  const sessionId = metaString(m, "session_id");

  // Only checkouts created by /api/checkout (which always stamps session_id)
  // are youth drop-ins. Other payments on this Stripe account — e.g. a Coach
  // Sam lesson-package Payment Link — arrive here too; without drop-in metadata
  // we can't (and shouldn't) build a roster row. Ack and skip so they don't hit
  // the drop-in path, fail the Notion write, and 500-loop the webhook.
  if (!sessionId) {
    console.log(
      "[stripe-webhook] checkout.session.completed without drop-in metadata — acking as non-drop-in",
      session.id,
    );
    return NextResponse.json({ received: true, skipped: "not_a_dropin" });
  }

  // Idempotency: Stripe retries webhook delivery, so skip if we've already
  // recorded this checkout.
  const already = await findDropInByCheckoutId(session.id);
  if (already) {
    return NextResponse.json({ received: true, idempotent: true });
  }

  const piId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : (session.payment_intent?.id ?? null);

  const row: DropInRow = {
    parentName: metaString(m, "parent_name"),
    parentEmail: payerEmail(session),
    parentPhone: metaString(m, "parent_phone"),
    childFirstName: metaString(m, "child_first_name"),
    childBirthYear: Number(metaString(m, "child_birth_year")) || 0,
    sessionTitle: metaString(m, "session_title"),
    sessionDate: metaString(m, "session_date"),
    sessionStartTime: metaString(m, "session_start"),
    sessionRowId: sessionId,
    location: metaString(m, "session_location"),
    publicArea: metaString(m, "session_public_area"),
    locationHidden: false, // hidden-location retired 2026-06-05 — venues are public

    level: null, // Notion session row's level isn't carried in metadata; admin can fill if needed.
    amountPaidUsd: (session.amount_total ?? 0) / 100,
    stripeCheckoutSessionId: session.id,
    stripePaymentIntentId: piId,
    displayConsent: metaString(m, "display_consent") === "true",
    smsConsent: metaString(m, "sms_consent") === "true",
    smsConsentText: metaString(m, "sms_consent_text"),
    // Source attribution from the checkout's source_utm_* metadata. Tolerates
    // absent keys (pre-deploy sessions, Payment Links) — metaString returns ""
    // and attributedSource falls back to "Website".
    source: attributedSource({
      utm_source: metaString(m, "source_utm_source"),
      utm_medium: metaString(m, "source_utm_medium"),
      utm_campaign: metaString(m, "source_utm_campaign"),
      utm_content: metaString(m, "source_utm_content"),
      ref: metaString(m, "source_ref"),
    }),
  };

  // The drop-in row is the source of truth (roster, reminders, check-in, cancel
  // refunds). Create it FIRST — this is the only critical work on the response
  // path. The findDropInByCheckoutId guard above makes any retry idempotent.
  const createResult = await createDropInRegistrationResult(row);
  if (createResult === "transient") {
    // Notion 429/5xx — a retry might land. Return 500 so Stripe redelivers.
    console.error(
      "[stripe-webhook] drop-in row create failed (transient) — returning 500 so Stripe retries",
      session.id,
    );
    return NextResponse.json({ error: "row_create_failed" }, { status: 500 });
  }
  if (createResult === "permanent") {
    // Notion rejected the write deterministically (4xx). Retrying is pointless
    // — it would fail identically for ~3 days and tank the endpoint's error
    // rate while the parent stays paid-but-unregistered. Alert loudly so Sam
    // can hand-add the row (scripts/backfill-dropin.mjs), and 200 to stop the
    // retry storm.
    console.error(
      "[stripe-webhook] drop-in row create failed (permanent) — alerting + acking so Stripe stops retrying",
      session.id,
    );
    after(() => alertDropInCreateFailure(session, row));
    return NextResponse.json({ received: true, row_create_failed: true });
  }

  // Everything below is best-effort: a flaky email/SMS/referral/increment must
  // NOT block the ack, or Stripe could time out and retry (re-running this on a
  // row that now exists). Run it AFTER the response is sent, concurrently.
  after(async () => {
    // Bump the registered count BEFORE the parent email so the confirmation's
    // fill meter shows the session with their signup counted. A failed bump
    // just drops the meter block — the confirmation still sends.
    let updated: Awaited<ReturnType<typeof incrementSessionRegistered>> = null;
    try {
      updated = await incrementSessionRegistered(sessionId, 1);
    } catch (err) {
      console.error("[stripe-webhook] registered-count increment failed", err);
    }
    const fill: ConfirmationFill | null = updated
      ? { registered: updated.registeredCount, goal: fillGoal(updated) }
      : null;

    await Promise.allSettled([
      emailAdmin(session),
      emailParent(session, fill),
      sendConfirmationSms(session, row),
      // Referral payout: if this parent signed up to the newsletter via someone
      // else's forward link and this is their first paid drop-in, mint two
      // single-use 50%-off promo codes (friend + referrer) and email both.
      // No-op when the friend isn't a subscriber, has no Referred By, or has
      // already been rewarded.
      processReferralReward(session),
      // Mirror the registration into the Player CRM so a paid website signup
      // lands a player row (or refreshes Last Attended on the existing one) —
      // the lead form already wrote to the Player DB, the drop-in path didn't.
      syncPlayerFromDropIn({
        parentName: row.parentName,
        parentEmail: row.parentEmail,
        parentPhone: row.parentPhone,
        childFirstName: row.childFirstName,
        childBirthYear: row.childBirthYear,
        sessionDate: row.sessionDate,
        location: row.location,
      }),
    ]);

    // Bust the /schedule ISR cache so the seat count reflects the new
    // registration on the next request, not after the 5-min revalidate window.
    revalidatePath("/schedule");
    const sessionTitle = metaString(m, "session_title");
    const sessionDate = metaString(m, "session_date");
    if (sessionTitle && sessionDate) {
      const slug = sessionToSlug({ title: sessionTitle, date: sessionDate });
      if (slug) revalidatePath(`/schedule/${slug}`);
    }
  });

  return NextResponse.json({ received: true });
}

// Sent when a paid drop-in could not be written to the roster and a retry won't
// help (deterministic Notion error). Surfaces the full registration so Sam can
// hand-add the row and follow up with the family.
async function alertDropInCreateFailure(
  session: Stripe.Checkout.Session,
  row: DropInRow,
) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error(
      "[stripe-webhook] permanent row-create failure AND no RESEND_API_KEY — manual recovery needed for",
      session.id,
    );
    return;
  }
  const resend = new Resend(apiKey);
  const lines = [
    `A paid NGA drop-in could NOT be written to the roster (deterministic Notion error).`,
    `The parent has paid but has no registration row. Hand-add it via scripts/backfill-dropin.mjs.`,
    "",
    `Parent: ${row.parentName}`,
    `Email: ${row.parentEmail}`,
    `Phone: ${row.parentPhone}`,
    `Child: ${row.childFirstName}`,
    `Session: ${row.sessionTitle} — ${row.sessionDate} ${row.sessionStartTime}`,
    `Location: ${row.location}`,
    `Paid: $${row.amountPaidUsd}`,
    `Stripe checkout: ${session.id}`,
    `Stripe PI: ${row.stripePaymentIntentId ?? "—"}`,
  ];
  const { error } = await resend.emails.send({
    from: FROM_EMAIL,
    to: ADMIN_NOTIFY,
    subject: `⚠️ ACTION NEEDED — drop-in roster write failed: ${row.childFirstName} (${session.id})`,
    text: lines.join("\n"),
  });
  if (error) {
    console.error("[stripe-webhook] failed to send create-failure alert", error);
  }
}

async function sendConfirmationSms(
  session: Stripe.Checkout.Session,
  row: DropInRow,
): Promise<void> {
  if (!row.smsConsent || !row.parentPhone) return;
  const sessionTitle = row.sessionTitle;
  const sessionDate = row.sessionDate;
  const sessionStart = row.sessionStartTime;
  const slug =
    sessionTitle && sessionDate
      ? sessionToSlug({ title: sessionTitle, date: sessionDate })
      : "";
  const detailUrl = slug ? `${SITE_ORIGIN}/schedule/${slug}` : `${SITE_ORIGIN}/schedule`;

  const dateShort = sessionDate
    ? new Date(`${sessionDate}T12:00:00Z`).toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
      })
    : "";

  const body = bookingConfirmationSms({
    childFirst: row.childFirstName || "your player",
    sessionTitle: sessionTitle || "drop-in",
    sessionStart,
    sessionDateShort: dateShort,
    detailUrl,
  });

  await sendSms({
    to: row.parentPhone,
    body,
    consent: row.smsConsent,
    tag: `booking-confirm:${session.id}`,
  });
}

async function emailCampAdmin(session: Stripe.Checkout.Session) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return;
  const resend = new Resend(apiKey);
  const m = session.metadata ?? {};
  const amount = ((session.amount_total ?? 0) / 100).toFixed(2);
  const birthYear = Number(metaString(m, "child_birth_year")) || 0;
  const age = birthYear ? `${new Date().getFullYear() - birthYear}` : "?";

  const subject = `New CAMP reg: ${metaString(m, "child_first_name")} — ${metaString(m, "camp_title")} (${metaString(m, "option_label")})`;
  const lines = [
    `Camp: ${metaString(m, "camp_title")} — ${metaString(m, "camp_week")}`,
    `Option: ${metaString(m, "option_label")} (${metaString(m, "option_hours")})`,
    "",
    `Parent: ${metaString(m, "parent_name")}`,
    `Email: ${payerEmail(session) || metaString(m, "parent_email")}`,
    `Phone: ${metaString(m, "parent_phone")}`,
    `Camper: ${metaString(m, "child_first_name")} (age ${age})`,
    `Emergency: ${metaString(m, "emergency_name")} · ${metaString(m, "emergency_phone")}`,
    `Allergies/medical: ${metaString(m, "allergies") || "none listed"}`,
    "",
    `Paid: $${amount}`,
    `Stripe: ${session.id}`,
  ];
  const { error } = await resend.emails.send({
    from: FROM_EMAIL,
    to: ADMIN_NOTIFY,
    subject,
    text: lines.join("\n"),
  });
  if (error) console.error("[stripe-webhook] camp admin email rejected", error);
}

async function emailCampParent(session: Stripe.Checkout.Session) {
  const apiKey = process.env.RESEND_API_KEY;
  const to = payerEmail(session);
  if (!apiKey) return;
  if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) return;

  const resend = new Resend(apiKey);
  const m = session.metadata ?? {};
  const amount = ((session.amount_total ?? 0) / 100).toFixed(2);
  const parentFirst = metaString(m, "parent_name").split(/\s+/)[0] || "there";
  const childFirst = metaString(m, "child_first_name") || "your camper";
  const campTitle = metaString(m, "camp_title");
  const campWeek = metaString(m, "camp_week");
  const optionLabel = metaString(m, "option_label");
  const optionHours = metaString(m, "option_hours");

  const subject = `You're registered — ${campTitle}`;
  const text = [
    `Hi ${parentFirst},`,
    "",
    `${childFirst} is registered for Next Gen Summer Camp!`,
    "",
    `${campTitle}`,
    `${campWeek} (Mon–Thu)`,
    `${optionLabel} · ${optionHours}`,
    `Location: Gaithersburg, MD — we'll email the exact site before camp starts.`,
    "",
    `Paid: $${amount}.`,
    "",
    `What to bring each day:`,
    `- Refillable water bottle`,
    `- Court shoes (no flat-soled sneakers)`,
    `- Lunch + snacks (full-day campers)`,
    `- A paddle if you have one — we have loaners.`,
    "",
    `Camp runs rain or shine.`,
    "",
    `Questions? Just reply to this email or text Coach Sam at 301-325-4731.`,
    "",
    `See you on the court — better than yesterday, together.`,
    `Coach Sam · Next Gen Pickleball Academy`,
  ].join("\n");

  const { error } = await resend.emails.send({
    from: FROM_EMAIL,
    to,
    bcc: ADMIN_EMAIL,
    replyTo: REPLY_TO,
    subject,
    text,
  });
  if (error) console.error("[stripe-webhook] camp parent email rejected", error);
}

async function handleCampCheckout(session: Stripe.Checkout.Session) {
  const m = session.metadata ?? {};
  const parentName = metaString(m, "parent_name");
  const parentEmail = payerEmail(session) || metaString(m, "parent_email");
  const parentPhone = metaString(m, "parent_phone");
  const childFirst = metaString(m, "child_first_name");
  const childBirthYear = Number(metaString(m, "child_birth_year")) || 0;
  const campTitle = metaString(m, "camp_title");
  const campWeek = metaString(m, "camp_week");
  const optionLabel = metaString(m, "option_label");
  const optionHours = metaString(m, "option_hours");
  const campStart = metaString(m, "camp_start");
  const publicArea = metaString(m, "public_area");
  const amount = ((session.amount_total ?? 0) / 100).toFixed(2);

  // Idempotency: camp has no roster row of its own, so a redelivered 200'd event
  // would re-fire the parent + admin emails. The shared processed-events ledger
  // (keyed on the checkout-session id) is the dedupe key — recorded on the sync
  // path before the best-effort comms; a redelivered event no-ops here.
  if (await findProcessedEvent(session.id)) {
    return NextResponse.json({ received: true, idempotent: true });
  }
  const recorded = await recordProcessedEvent(
    session.id,
    "camp",
    new Date().toISOString(),
  );
  if (recorded === "transient") {
    // 500 → Stripe redelivers; the find guard makes the retry safe.
    return NextResponse.json(
      { error: "processed-events write failed (transient)" },
      { status: 500 },
    );
  }
  // "ok" / "permanent" / env-unset → proceed. A permanent ledger failure must
  // not strand a paid family's only confirmation (logged in the helper). The
  // CRM sync is an upsert; comms are best-effort → run after the ack so a slow
  // Resend/Notion call can't time the webhook out into a Stripe retry.
  after(async () => {
  await Promise.allSettled([
    emailCampAdmin(session),
    emailCampParent(session),
    // Land the camper in the Player CRM (keyed on family). Record the exact
    // venue when present, falling back to the broad area.
    syncPlayerFromDropIn({
      parentName,
      parentEmail,
      parentPhone,
      childFirstName: childFirst,
      childBirthYear,
      sessionDate: campStart,
      location: metaString(m, "session_location") || publicArea,
    }),
    ingestToOpenBrain({
      business: "nga",
      source: "nga_summer_camp",
      name: parentName,
      email: parentEmail || undefined,
      phone: parentPhone || undefined,
      interest: `${campTitle} (${optionLabel})`,
      metadata: {
        camp_week: campWeek,
        option: optionLabel,
        option_hours: optionHours,
        child_first_name: childFirst,
        child_birth_year: childBirthYear,
        emergency_name: metaString(m, "emergency_name"),
        emergency_phone: metaString(m, "emergency_phone"),
        allergies: metaString(m, "allergies"),
        amount_paid_usd: amount,
        stripe_session: session.id,
      },
    }),
  ]);
  });

  return NextResponse.json({ received: true, camp: true });
}

async function emailLeagueAdmin(session: Stripe.Checkout.Session) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return;
  const resend = new Resend(apiKey);
  const m = session.metadata ?? {};
  const amount = ((session.amount_total ?? 0) / 100).toFixed(2);
  const birthYear = Number(metaString(m, "child_birth_year")) || 0;
  const age = birthYear ? `${new Date().getFullYear() - birthYear}` : "?";

  const subject = `New LEAGUE enroll: ${metaString(m, "child_first_name")} — ${metaString(m, "season_title")}`;
  const lines = [
    `Season: ${metaString(m, "season_title")} — ${metaString(m, "season_label")}`,
    `Division: ${metaString(m, "season_band_label")}`,
    `Option: ${metaString(m, "option_label")}`,
    "",
    `Parent: ${metaString(m, "parent_name")}`,
    `Email: ${payerEmail(session) || metaString(m, "parent_email")}`,
    `Phone: ${metaString(m, "parent_phone")}`,
    `Player: ${metaString(m, "child_first_name")} (age ${age})`,
    `Emergency: ${metaString(m, "emergency_name")} · ${metaString(m, "emergency_phone")}`,
    `Allergies/medical: ${metaString(m, "allergies") || "none listed"}`,
    "",
    `Paid: $${amount}`,
    `Stripe: ${session.id}`,
  ];
  const { error } = await resend.emails.send({
    from: FROM_EMAIL,
    to: ADMIN_NOTIFY,
    subject,
    text: lines.join("\n"),
  });
  if (error) console.error("[stripe-webhook] league admin email rejected", error);
}

async function emailLeagueParent(session: Stripe.Checkout.Session) {
  const apiKey = process.env.RESEND_API_KEY;
  const to = payerEmail(session);
  if (!apiKey) return;
  if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) return;

  const resend = new Resend(apiKey);
  const m = session.metadata ?? {};
  const amount = ((session.amount_total ?? 0) / 100).toFixed(2);
  const parentFirst = metaString(m, "parent_name").split(/\s+/)[0] || "there";
  const childFirst = metaString(m, "child_first_name") || "your player";
  const seasonTitle = metaString(m, "season_title");
  const seasonLabel = metaString(m, "season_label");
  const bandLabel = metaString(m, "season_band_label");

  const subject = `You're enrolled — ${seasonTitle}`;
  const text = [
    `Hi ${parentFirst},`,
    "",
    `${childFirst} is enrolled for the Next Gen league season!`,
    "",
    `${seasonTitle}`,
    `${seasonLabel} · ${bandLabel} division — 8 sessions across 9–10 weeks`,
    `Location: Montgomery County, MD — we'll email the exact site before the season starts.`,
    "",
    `Paid: $${amount}.`,
    "",
    `What to bring each session:`,
    `- Refillable water bottle`,
    `- Court shoes (no flat-soled sneakers)`,
    `- Protective eyewear (required, every player, every session)`,
    `- A paddle if you have one — we have loaners.`,
    "",
    `Season terms: $25 is retained if you cancel with at least 10 business days' notice; under 10 days the season fee is non-refundable. We schedule 8 sessions across 9–10 weeks so weather make-ups are built in.`,
    "",
    `Questions? Just reply to this email or text Coach Sam at 301-325-4731.`,
    "",
    `See you on the court — better than yesterday, together.`,
    `Coach Sam · Next Gen Pickleball Academy`,
  ].join("\n");

  const { error } = await resend.emails.send({
    from: FROM_EMAIL,
    to,
    bcc: ADMIN_EMAIL,
    replyTo: REPLY_TO,
    subject,
    text,
  });
  if (error) console.error("[stripe-webhook] league parent email rejected", error);
}

async function handleLeagueCheckout(session: Stripe.Checkout.Session) {
  const m = session.metadata ?? {};
  const parentName = metaString(m, "parent_name");
  const parentEmail = payerEmail(session) || metaString(m, "parent_email");
  const parentPhone = metaString(m, "parent_phone");
  const childFirst = metaString(m, "child_first_name");
  const childBirthYear = Number(metaString(m, "child_birth_year")) || 0;
  const seasonTitle = metaString(m, "season_title");
  const seasonLabel = metaString(m, "season_label");
  const bandLabel = metaString(m, "season_band_label");
  const seasonStart = metaString(m, "season_start");
  const publicArea = metaString(m, "public_area");
  const amount = ((session.amount_total ?? 0) / 100).toFixed(2);

  // Idempotency: league has no roster row of its own, so a redelivered 200'd
  // event would re-fire the parent + admin emails. The shared processed-events
  // ledger (keyed on the checkout-session id) is the dedupe key — recorded on
  // the sync path before the best-effort comms; a redelivered event no-ops here.
  if (await findProcessedEvent(session.id)) {
    return NextResponse.json({ received: true, idempotent: true });
  }
  const recorded = await recordProcessedEvent(
    session.id,
    "league",
    new Date().toISOString(),
  );
  if (recorded === "transient") {
    // 500 → Stripe redelivers; the find guard makes the retry safe.
    return NextResponse.json(
      { error: "processed-events write failed (transient)" },
      { status: 500 },
    );
  }
  // "ok" / "permanent" / env-unset → proceed. A permanent ledger failure must
  // not strand a paid family's only confirmation (logged in the helper). The
  // CRM sync is an upsert; comms are best-effort → run after the ack so a slow
  // call can't time the webhook out into a Stripe retry.
  after(async () => {
  await Promise.allSettled([
    emailLeagueAdmin(session),
    emailLeagueParent(session),
    // Land the player in the Player CRM (keyed on family). Record the exact
    // venue when present, falling back to the broad area.
    syncPlayerFromDropIn({
      parentName,
      parentEmail,
      parentPhone,
      childFirstName: childFirst,
      childBirthYear,
      sessionDate: seasonStart,
      location: metaString(m, "session_location") || publicArea,
    }),
    ingestToOpenBrain({
      business: "nga",
      source: "nga_league_enrollment",
      name: parentName,
      email: parentEmail || undefined,
      phone: parentPhone || undefined,
      interest: `${seasonTitle} (${bandLabel})`,
      metadata: {
        season_label: seasonLabel,
        season_band: metaString(m, "season_band"),
        season_title: seasonTitle,
        option: metaString(m, "option_label"),
        child_first_name: childFirst,
        child_birth_year: childBirthYear,
        emergency_name: metaString(m, "emergency_name"),
        emergency_phone: metaString(m, "emergency_phone"),
        allergies: metaString(m, "allergies"),
        amount_paid_usd: amount,
        stripe_session: session.id,
      },
    }),
  ]);
  });

  return NextResponse.json({ received: true, league: true });
}

async function handleChargeRefunded(charge: Stripe.Charge) {
  const piId =
    typeof charge.payment_intent === "string"
      ? charge.payment_intent
      : (charge.payment_intent?.id ?? null);
  if (!piId) return NextResponse.json({ received: true, skipped: "no_pi" });

  // Find the Checkout Session that produced this PI — that's our idempotency key.
  const stripe = getStripe();
  const list = await stripe.checkout.sessions.list({
    payment_intent: piId,
    limit: 1,
  });
  const checkoutSession = list.data[0];
  if (!checkoutSession) {
    return NextResponse.json({ received: true, skipped: "no_checkout" });
  }

  const result = await cancelDropIn(checkoutSession.id, "Refunded");
  if (!result.ok) {
    return NextResponse.json({ received: true, skipped: result.reason });
  }
  return NextResponse.json({ received: true, refunded: true, ...result });
}

async function emailClusterAdmin(session: Stripe.Checkout.Session) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return;
  const resend = new Resend(apiKey);
  const m = session.metadata ?? {};
  const amount = ((session.amount_total ?? 0) / 100).toFixed(2);

  const { error } = await resend.emails.send({
    from: FROM_EMAIL,
    to: ADMIN_NOTIFY,
    replyTo: REPLY_TO,
    subject: `New cluster registration — ${metaString(m, "child_first_name")} (${metaString(m, "band")}) — ${metaString(m, "cluster_name")}`,
    text: [
      `Cluster: ${metaString(m, "cluster_name")} (${metaString(m, "cluster_slug")})`,
      `Player: ${metaString(m, "child_first_name")} · ${metaString(m, "band")} · ${metaString(m, "ball_level")} ball`,
      `Parent: ${metaString(m, "parent_name")} · ${payerEmail(session) || metaString(m, "parent_email")} · ${metaString(m, "parent_phone")}`,
      `Emergency: ${metaString(m, "emergency_name")} · ${metaString(m, "emergency_phone")}`,
      `Allergies/notes: ${metaString(m, "allergies") || "none listed"}`,
      `Public name display consent: ${metaString(m, "display_consent")}`,
      `Paid: $${amount}`,
      `Stripe session: ${session.id}`,
    ].join("\n"),
  });
  if (error) console.error("[stripe-webhook] cluster admin email rejected", error);
}

async function emailClusterParent(session: Stripe.Checkout.Session) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return;
  const resend = new Resend(apiKey);
  const m = session.metadata ?? {};
  const to = payerEmail(session) || metaString(m, "parent_email");
  if (!to) return;

  const parentFirst = metaString(m, "parent_name").split(/\s+/)[0] || "there";
  const childFirst = metaString(m, "child_first_name") || "your player";
  const clusterName = metaString(m, "cluster_name");
  const band = metaString(m, "band");
  const amount = ((session.amount_total ?? 0) / 100).toFixed(2);

  const { error } = await resend.emails.send({
    from: FROM_EMAIL,
    to,
    bcc: ADMIN_EMAIL,
    replyTo: REPLY_TO,
    subject: `You're in — ${clusterName}, Fall ${metaString(m, "season_year")}`,
    text: [
      `Hi ${parentFirst},`,
      ``,
      `${childFirst} is registered with the ${clusterName} for the Fall season!`,
      ``,
      `${clusterName} · ${band} division`,
      `Weekly training at your cluster's home site — we'll email the schedule and exact site details before the season starts.`,
      ``,
      `Paid: $${amount}.`,
      ``,
      `What to bring each week:`,
      `- Refillable water bottle`,
      `- Court shoes (no flat-soled sneakers)`,
      `- Protective eyewear (required, every player, every session)`,
      `- A paddle if you have one — we have loaners.`,
      ``,
      `Season terms: $25 is retained if you cancel with at least 10 business days' notice before the season starts; under 10 days the season fee is non-refundable. If we ever have to cancel a cluster (it happens if a group doesn't fill), you get a full refund or a spot in the nearest cluster — your choice.`,
      ``,
      `Questions? Just reply to this email or text Coach Sam at 301-325-4731.`,
      ``,
      `See you on the court — better than yesterday, together.`,
      `Coach Sam · Next Gen Pickleball Academy`,
    ].join("\n"),
  });
  if (error) console.error("[stripe-webhook] cluster parent email rejected", error);
}

// A charged parent with no roster row is the worst launch-week failure — make
// the family whole automatically and escalate to Sam either way (mirrors the
// crew-autoreserve refund-after-failed-write pattern).
async function refundClusterCharge(session: Stripe.Checkout.Session) {
  const m = session.metadata ?? {};
  const pi =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id;

  let refunded = false;
  if (pi) {
    try {
      await getStripe().refunds.create({ payment_intent: pi });
      refunded = true;
    } catch (err) {
      console.error("[stripe-webhook] cluster refund failed", err);
    }
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (apiKey) {
    const resend = new Resend(apiKey);
    await resend.emails.send({
      from: FROM_EMAIL,
      to: ADMIN_NOTIFY,
      replyTo: REPLY_TO,
      subject: `Cluster registration FAILED — ${refunded ? "refunded" : "REFUND FAILED"} — ${metaString(m, "child_first_name")} (${metaString(m, "cluster_name")})`,
      text: [
        `The cluster roster write failed permanently after the parent was charged.`,
        refunded
          ? `The charge was refunded automatically. Reach out to the parent and re-register them once the roster DB issue is fixed.`
          : `THE REFUND ALSO FAILED — the parent is charged with no roster row. Refund manually in the Stripe dashboard NOW, then contact the parent.`,
        ``,
        `Parent: ${metaString(m, "parent_name")} · ${payerEmail(session) || metaString(m, "parent_email")} · ${metaString(m, "parent_phone")}`,
        `Player: ${metaString(m, "child_first_name")} · ${metaString(m, "band")}`,
        `Cluster: ${metaString(m, "cluster_name")} (${metaString(m, "cluster_slug")})`,
        `Stripe session: ${session.id}`,
        `Payment intent: ${pi ?? "MISSING"}`,
      ].join("\n"),
    });
  }
  return refunded;
}

async function handleClusterCheckout(session: Stripe.Checkout.Session) {
  const m = session.metadata ?? {};

  // The roster row IS the idempotency key — a redelivered event no-ops here.
  if (await findClusterRegByCheckoutId(session.id)) {
    return NextResponse.json({ received: true, idempotent: true });
  }

  const parentEmail = payerEmail(session) || metaString(m, "parent_email");
  const band = metaString(m, "band") === "U14" ? "U14" : "U12";
  const created = await createClusterRegistrationResult({
    parentName: metaString(m, "parent_name"),
    parentEmail,
    parentPhone: metaString(m, "parent_phone"),
    childFirstName: metaString(m, "child_first_name"),
    childBirthDate: metaString(m, "child_birth_date"),
    band,
    ballLevel: metaString(m, "ball_level"),
    clusterSlug: metaString(m, "cluster_slug"),
    amountPaidUsd: (session.amount_total ?? 0) / 100,
    stripeCheckoutSessionId: session.id,
    stripePaymentIntentId:
      typeof session.payment_intent === "string"
        ? session.payment_intent
        : (session.payment_intent?.id ?? null),
    displayConsent: metaString(m, "display_consent") === "true",
    smsConsent: metaString(m, "sms_consent") === "true",
    smsConsentText: metaString(m, "sms_consent_text"),
    emergencyName: metaString(m, "emergency_name"),
    emergencyPhone: metaString(m, "emergency_phone"),
    allergies: metaString(m, "allergies"),
  });

  if (created === "transient") {
    // 500 → Stripe redelivers; the idempotency check makes the retry safe.
    return NextResponse.json(
      { error: "cluster roster write failed (transient)" },
      { status: 500 },
    );
  }
  if (created === "permanent") {
    const refunded = await refundClusterCharge(session);
    return NextResponse.json({ received: true, rosterFailed: true, refunded });
  }

  after(async () => {
    await Promise.allSettled([
      emailClusterAdmin(session),
      emailClusterParent(session),
      syncPlayerFromDropIn({
        parentName: metaString(m, "parent_name"),
        parentEmail,
        parentPhone: metaString(m, "parent_phone"),
        childFirstName: metaString(m, "child_first_name"),
        childBirthYear: Number(metaString(m, "child_birth_date").slice(0, 4)) || 0,
        sessionDate: `${metaString(m, "season_year") || "2026"}-09-01`,
        location: metaString(m, "cluster_name"),
      }),
      ingestToOpenBrain({
        business: "nga",
        source: "nga_cluster_registration",
        name: metaString(m, "parent_name"),
        email: parentEmail || undefined,
        phone: metaString(m, "parent_phone") || undefined,
        interest: `${metaString(m, "cluster_name")} (${band})`,
        metadata: {
          cluster_slug: metaString(m, "cluster_slug"),
          band,
          ball_level: metaString(m, "ball_level"),
          child_first_name: metaString(m, "child_first_name"),
          display_consent: metaString(m, "display_consent"),
          amount_paid_usd: ((session.amount_total ?? 0) / 100).toFixed(2),
          stripe_session: session.id,
        },
      }),
    ]);
  });

  return NextResponse.json({ received: true });
}
