import { NextRequest, NextResponse } from "next/server";
import { fetchSessionById, type NgaSession } from "@/lib/notion-sessions";
import { findSiblingSlot } from "@/lib/session-bundle";
import { getStripe } from "@/lib/stripe";
import { REGISTRATION_WINDOW_DAYS } from "@/data/schedule";
import { SMS_CONSENT_TEXT } from "@/data/sms-consent";
import {
  validateRsvpForm,
  type RsvpFormData,
} from "@/lib/validate-rsvp";

const REGISTRATION_WINDOW_MS = REGISTRATION_WINDOW_DAYS * 24 * 60 * 60 * 1000;

/** Reject a session that isn't open, is full, or is outside the booking window. */
function bookableError(session: NgaSession, now: number): NextResponse | null {
  if (session.status !== "Open") {
    return NextResponse.json(
      { error: `Session is ${session.status.toLowerCase()}` },
      { status: 409 },
    );
  }
  if (session.spotsLeft <= 0) {
    return NextResponse.json({ error: "Session is full" }, { status: 409 });
  }
  const sessionDate = new Date(`${session.date}T00:00:00Z`);
  if (sessionDate.getTime() - now > REGISTRATION_WINDOW_MS) {
    return NextResponse.json(
      {
        error: `Registration opens ${REGISTRATION_WINDOW_DAYS} days before the session`,
      },
      { status: 409 },
    );
  }
  if (sessionDate.getTime() < now - 24 * 60 * 60 * 1000) {
    return NextResponse.json(
      { error: "Session has already passed" },
      { status: 409 },
    );
  }
  return null;
}

export async function POST(req: NextRequest) {
  let body: Partial<RsvpFormData> & { secondSessionId?: unknown };
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

  // Optional two-hour bundle: a second adjacent slot booked in one $35 checkout.
  const secondSessionId =
    typeof body.secondSessionId === "string" ? body.secondSessionId.trim() : "";

  const session = await fetchSessionById(data.sessionId);
  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  const now = Date.now();
  const primaryError = bookableError(session, now);
  if (primaryError) return primaryError;

  let bundleSession: NgaSession | null = null;
  if (secondSessionId && secondSessionId !== session.id) {
    const second = await fetchSessionById(secondSessionId);
    if (!second) {
      return NextResponse.json(
        { error: "Second session not found" },
        { status: 404 },
      );
    }
    // Must be a genuine adjacent pair (same day + venue, consecutive hour).
    if (!findSiblingSlot(session, [session, second])) {
      return NextResponse.json(
        { error: "Those two slots can't be bundled" },
        { status: 409 },
      );
    }
    const secondError = bookableError(second, now);
    if (secondError) return secondError;
    bundleSession = second;
  }

  const priceId = bundleSession
    ? process.env.STRIPE_DROPIN_BUNDLE_PRICE_ID
    : process.env.STRIPE_DROPIN_PRICE_ID;
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

  const metadata: Record<string, string> = {
    session_id: session.id,
    session_title: session.title,
    session_date: session.date,
    session_start: session.startTime,
    session_end: session.endTime,
    session_location: session.location,
    parent_name: data.parentName,
    parent_phone: data.phone,
    child_first_name: data.childFirstName,
    child_birth_year: data.childBirthYear,
    display_consent: data.displayConsent ? "true" : "false",
    sms_consent: data.smsConsent ? "true" : "false",
    // Snapshot the exact disclosure shown at opt-in for TCPA audit trail.
    // Only stored when the user actually opted in.
    sms_consent_text: data.smsConsent ? SMS_CONSENT_TEXT : "",
  };
  if (bundleSession) {
    metadata.bundle = "true";
    metadata.session_id_2 = bundleSession.id;
    metadata.session_2_title = bundleSession.title;
    metadata.session_2_date = bundleSession.date;
    metadata.session_2_start = bundleSession.startTime;
    metadata.session_2_end = bundleSession.endTime;
  }

  const description = bundleSession
    ? `${session.title} + ${bundleSession.title} (2-hour bundle) — ${data.childFirstName}`
    : `${session.title} — ${data.childFirstName}`;

  const stripe = getStripe();
  const checkout = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [{ price: priceId, quantity: 1 }],
    allow_promotion_codes: true,
    customer_email: data.email,
    payment_intent_data: { description },
    metadata,
    success_url: `${origin}/schedule/success?cs={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/schedule`,
  });

  return NextResponse.json({ url: checkout.url });
}
