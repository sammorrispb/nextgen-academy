import { NextRequest, NextResponse } from "next/server";
import { fetchSessionById } from "@/lib/notion-sessions";
import { getStripe } from "@/lib/stripe";
import { REGISTRATION_WINDOW_DAYS } from "@/data/schedule";
import {
  validateRsvpForm,
  type RsvpFormData,
} from "@/lib/validate-rsvp";

const REGISTRATION_WINDOW_MS = REGISTRATION_WINDOW_DAYS * 24 * 60 * 60 * 1000;

export async function POST(req: NextRequest) {
  let body: Partial<RsvpFormData>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const errors = validateRsvpForm(body);
  if (Object.keys(errors).length > 0) {
    return NextResponse.json({ errors }, { status: 400 });
  }

  const data = body as RsvpFormData;

  const session = await fetchSessionById(data.sessionId);
  if (!session) {
    return NextResponse.json(
      { error: "Session not found" },
      { status: 404 },
    );
  }

  if (session.status !== "Open") {
    return NextResponse.json(
      { error: `Session is ${session.status.toLowerCase()}` },
      { status: 409 },
    );
  }

  if (session.spotsLeft <= 0) {
    return NextResponse.json(
      { error: "Session is full" },
      { status: 409 },
    );
  }

  const sessionDate = new Date(`${session.date}T00:00:00Z`);
  const now = Date.now();
  if (sessionDate.getTime() - now > REGISTRATION_WINDOW_MS) {
    return NextResponse.json(
      { error: `Registration opens ${REGISTRATION_WINDOW_DAYS} days before the session` },
      { status: 409 },
    );
  }
  if (sessionDate.getTime() < now - 24 * 60 * 60 * 1000) {
    return NextResponse.json(
      { error: "Session has already passed" },
      { status: 409 },
    );
  }

  const priceId = process.env.STRIPE_DROPIN_PRICE_ID;
  if (!priceId) {
    return NextResponse.json(
      { error: "Stripe price not configured" },
      { status: 500 },
    );
  }

  const origin =
    req.headers.get("origin") ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    "https://nextgenpbacademy.com";

  const stripe = getStripe();
  const checkout = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [{ price: priceId, quantity: 1 }],
    customer_email: data.email,
    payment_intent_data: {
      description: `${session.title} — ${data.childFirstName}`,
    },
    metadata: {
      session_id: session.id,
      session_title: session.title,
      session_date: session.date,
      session_start: session.startTime,
      session_location: session.location,
      parent_name: data.parentName,
      parent_phone: data.phone,
      child_first_name: data.childFirstName,
      child_age: data.childAge,
    },
    success_url: `${origin}/schedule/success?cs={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/schedule`,
  });

  return NextResponse.json({ url: checkout.url });
}
