import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { Resend } from "resend";
import { getStripe } from "@/lib/stripe";
import { incrementSessionRegistered } from "@/lib/notion-sessions";
import {
  createDropInRegistration,
  findDropInByCheckoutId,
  type DropInRow,
} from "@/lib/notion-dropins";

export const runtime = "nodejs";

const ADMIN_EMAIL = "nextgenacademypb@gmail.com";
const FROM_EMAIL = "Next Gen Academy <hello@nextgenpbacademy.com>";

function metaString(meta: Stripe.Metadata, key: string): string {
  return typeof meta[key] === "string" ? meta[key] : "";
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

  const subject = `New drop-in: ${metaString(m, "child_first_name")} — ${metaString(m, "session_title") || metaString(m, "session_date")}`;
  const lines = [
    `Parent: ${metaString(m, "parent_name")}`,
    `Email: ${session.customer_email ?? metaString(m, "parent_email")}`,
    `Phone: ${metaString(m, "parent_phone")}`,
    `Child: ${metaString(m, "child_first_name")} (age ${metaString(m, "child_age")})`,
    "",
    `Session: ${metaString(m, "session_title")}`,
    `Date: ${metaString(m, "session_date")} ${metaString(m, "session_start")}`,
    `Location: ${metaString(m, "session_location")}`,
    "",
    `Paid: $${amount}`,
    `Stripe: ${session.id}`,
  ];

  await resend.emails.send({
    from: FROM_EMAIL,
    to: ADMIN_EMAIL,
    subject,
    text: lines.join("\n"),
  });
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
    childAge: Number(metaString(m, "child_age")) || 0,
    sessionTitle: metaString(m, "session_title"),
    sessionDate: metaString(m, "session_date"),
    sessionStartTime: metaString(m, "session_start"),
    location: metaString(m, "session_location"),
    level: null, // Notion session row's level isn't carried in metadata; admin can fill if needed.
    amountPaidUsd: (session.amount_total ?? 0) / 100,
    stripeCheckoutSessionId: session.id,
    stripePaymentIntentId: piId,
  };

  // Run all three side effects concurrently. Failures in one shouldn't block the others.
  await Promise.allSettled([
    emailAdmin(session),
    sessionId ? incrementSessionRegistered(sessionId, 1) : Promise.resolve(),
    createDropInRegistration(row),
  ]);

  return NextResponse.json({ received: true });
}
