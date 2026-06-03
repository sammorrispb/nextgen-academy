import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import type Stripe from "stripe";
import { Resend } from "resend";
import { getStripe } from "@/lib/stripe";
import { incrementSessionRegistered } from "@/lib/notion-sessions";
import {
  createDropInRegistration,
  findDropInByCheckoutId,
  type DropInRow,
} from "@/lib/notion-dropins";
import { sessionToSlug } from "@/lib/session-slug";
import { cancelDropIn } from "@/lib/cancel-dropin";
import { buildDropInIcs } from "@/lib/email/ics";
import { bookingConfirmationHtml } from "@/lib/email/booking-confirmation";
import { whatsappInviteText } from "@/lib/email/whatsapp-invite";
import { sendSms, bookingConfirmationSms } from "@/lib/sms";
import { signCancelToken } from "@/lib/cancel-token";
import { processReferralReward } from "@/lib/referral-rewards";
import { isFirstTimeParent } from "@/lib/notion-player-lookup";
import { syncPlayerFromDropIn } from "@/lib/notion-player-sync";
import { ingestToOpenBrain } from "@/lib/open-brain-ingest";

export const runtime = "nodejs";

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
  isFirstTimer: boolean,
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
  const locationHidden = metaString(m, "location_hidden") === "true";
  // Hidden sessions: confirmation shows the broad area; the exact venue is sent
  // separately by the 24h reveal cron. Never put the exact address (or a maps
  // link / ICS location derived from it) in this email.
  const sessionLocation = locationHidden ? sessionPublicArea : sessionExact;

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
    ...(isFirstTimer ? ["", whatsappInviteText()] : []),
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
    includeWhatsappInvite: isFirstTimer,
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

  // Idempotency — Stripe retries webhook delivery.
  const already = await findDropInByCheckoutId(session.id);
  if (already) {
    return NextResponse.json({ received: true, idempotent: true });
  }

  const m = session.metadata ?? {};
  const sessionId = metaString(m, "session_id");

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
    location: metaString(m, "session_location"),
    publicArea: metaString(m, "session_public_area"),
    locationHidden: metaString(m, "location_hidden") === "true",
    level: null, // Notion session row's level isn't carried in metadata; admin can fill if needed.
    amountPaidUsd: (session.amount_total ?? 0) / 100,
    stripeCheckoutSessionId: session.id,
    stripePaymentIntentId: piId,
    displayConsent: metaString(m, "display_consent") === "true",
    smsConsent: metaString(m, "sms_consent") === "true",
    smsConsentText: metaString(m, "sms_consent_text"),
  };

  // First-touch check runs against the Player CRM. A miss (Notion unavailable
  // or env unset) defaults to "not first timer" so returning families never
  // get re-prompted with the WhatsApp invite.
  const parentEmailForLookup = payerEmail(session);
  const isFirstTimer = parentEmailForLookup
    ? await isFirstTimeParent(parentEmailForLookup)
    : false;

  // The drop-in row is the source of truth (roster, reminders, check-in, cancel
  // refunds). Create it FIRST and treat failure as fatal: return non-2xx so
  // Stripe retries delivery rather than losing the registration to a swallowed
  // error. The findDropInByCheckoutId guard above makes the retry idempotent —
  // once the row lands, a redelivery short-circuits before re-running anything.
  const rowCreated = await createDropInRegistration(row);
  if (!rowCreated) {
    console.error(
      "[stripe-webhook] drop-in row create failed — returning 500 so Stripe retries",
      session.id,
    );
    return NextResponse.json({ error: "row_create_failed" }, { status: 500 });
  }

  // Everything below is best-effort: a flaky email/SMS/referral/increment must
  // NOT fail the request, or Stripe would retry and double-create the row
  // (which now exists but only the full-rerun guard catches). Run concurrently.
  await Promise.allSettled([
    emailAdmin(session),
    emailParent(session, isFirstTimer),
    sendConfirmationSms(session, row),
    sessionId ? incrementSessionRegistered(sessionId, 1) : Promise.resolve(),
    // Referral payout: if this parent signed up to the newsletter via someone
    // else's forward link and this is their first paid drop-in, mint two
    // single-use 50%-off promo codes (friend + referrer) and email both.
    // No-op when the friend isn't a subscriber, has no Referred By, or has
    // already been rewarded.
    processReferralReward(session),
    // Mirror the registration into the Player CRM so a paid website signup
    // lands a player row (or refreshes Last Attended on the existing one) — the
    // lead form already wrote to the Player DB, the drop-in path didn't.
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

  return NextResponse.json({ received: true });
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

  // v1 has no Notion camp roster, so no DB-backed idempotency. The CRM sync is
  // an upsert (safe to repeat); emails could resend if Stripe redelivers a
  // 200'd event (rare). A dedicated Camp Registrations DB is the planned
  // fast-follow for a clean roster + an idempotency key.
  await Promise.allSettled([
    emailCampAdmin(session),
    emailCampParent(session),
    // Land the camper in the Player CRM (keyed on family). Location = public
    // area only; the exact venue stays hidden.
    syncPlayerFromDropIn({
      parentName,
      parentEmail,
      parentPhone,
      childFirstName: childFirst,
      childBirthYear,
      sessionDate: campStart,
      location: publicArea,
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

  return NextResponse.json({ received: true, camp: true });
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
