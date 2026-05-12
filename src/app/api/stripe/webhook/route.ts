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

export const runtime = "nodejs";

const ADMIN_EMAIL = "nextgenacademypb@gmail.com";
const FROM_EMAIL = "Next Gen PB Academy <noreply@nextgenpbacademy.com>";
const REPLY_TO = "nextgenacademypb@gmail.com";
const SITE_ORIGIN =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.nextgenpbacademy.com";

function metaString(meta: Stripe.Metadata, key: string): string {
  return typeof meta[key] === "string" ? meta[key] : "";
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
    `Email: ${session.customer_email ?? metaString(m, "parent_email")}`,
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
    to: ADMIN_EMAIL,
    subject,
    text: lines.join("\n"),
  });
  if (error) {
    console.error("[stripe-webhook] Resend rejected admin email", error);
  }
}

async function emailParent(session: Stripe.Checkout.Session) {
  const apiKey = process.env.RESEND_API_KEY;
  const to = session.customer_email;
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
  const sessionLocation = metaString(m, "session_location");

  const slug =
    sessionTitle && sessionDate
      ? sessionToSlug({ title: sessionTitle, date: sessionDate })
      : "";
  const detailUrl = slug ? `${SITE_ORIGIN}/schedule/${slug}` : `${SITE_ORIGIN}/schedule`;

  const subject = `You're registered — ${sessionTitle || formatLongDate(sessionDate)}`;
  const lines = [
    `Hi ${parentFirst},`,
    "",
    `You're confirmed for an NGA drop-in:`,
    "",
    `${sessionTitle}`,
    `${formatLongDate(sessionDate)} · ${sessionStart}`,
    `${sessionLocation}`,
    "",
    `${childFirst} is registered for the 1-hour slot. Paid: $${amount}.`,
    "",
    `What to bring:`,
    `· Water bottle`,
    `· Court shoes (no flat-soled sneakers)`,
    `· A paddle if you have one — we have loaners if not`,
    "",
    `Drop-in payments are non-refundable, but if something comes up, reply to this email or text 301-325-4731 and we'll work it out.`,
    "",
    `Session link (re-share or check details): ${detailUrl}`,
    "",
    `See you on the court,`,
    `Sam · Next Gen Pickleball Academy`,
  ];

  const { error } = await resend.emails.send({
    from: FROM_EMAIL,
    to,
    replyTo: REPLY_TO,
    subject,
    text: lines.join("\n"),
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

  if (event.type !== "checkout.session.completed") {
    return NextResponse.json({ received: true });
  }

  const session = event.data.object as Stripe.Checkout.Session;
  if (session.payment_status !== "paid") {
    return NextResponse.json({ received: true, skipped: "not_paid" });
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
    parentEmail: session.customer_email ?? "",
    parentPhone: metaString(m, "parent_phone"),
    childFirstName: metaString(m, "child_first_name"),
    childBirthYear: Number(metaString(m, "child_birth_year")) || 0,
    sessionTitle: metaString(m, "session_title"),
    sessionDate: metaString(m, "session_date"),
    sessionStartTime: metaString(m, "session_start"),
    location: metaString(m, "session_location"),
    level: null, // Notion session row's level isn't carried in metadata; admin can fill if needed.
    amountPaidUsd: (session.amount_total ?? 0) / 100,
    stripeCheckoutSessionId: session.id,
    stripePaymentIntentId: piId,
  };

  // Run side effects concurrently. Failures in one shouldn't block the others.
  await Promise.allSettled([
    emailAdmin(session),
    emailParent(session),
    sessionId ? incrementSessionRegistered(sessionId, 1) : Promise.resolve(),
    createDropInRegistration(row),
  ]);

  // Bust the /schedule ISR cache so the seat count reflects the new
  // registration on the next request, not after the 5-min revalidate window.
  revalidatePath("/schedule");

  return NextResponse.json({ received: true });
}
