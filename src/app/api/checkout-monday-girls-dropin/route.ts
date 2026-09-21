import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import {
  MONDAY_GIRLS_DROPIN_KIND,
  MONDAY_GIRLS_DROPIN_PRICE_ENV_VAR,
  MONDAY_GIRLS_DROPIN_TITLE,
  mondayGirlsDropinSellableMondays,
} from "@/data/monday-girls-dropin-2026";
import {
  findMondayGirlsSeasonGroup,
} from "@/data/monday-girls-season-2026";
import {
  MONDAY_GIRLS_BLOCK_SEATS,
  MONDAY_GIRLS_SEASON_LABEL,
  MONDAY_GIRLS_TIME_LABEL,
  MONDAY_GIRLS_VENUE,
} from "@/data/monday-girls-2026";
import { SMS_CONSENT_TEXT } from "@/data/sms-consent";
import {
  validateMondayGirlsDropin,
  type MondayGirlsDropinData,
} from "@/lib/validate-monday-girls-dropin";
import { fetchMondayGirlsRegistrationKeys } from "@/lib/notion-monday-girls-registrations";
import { mondayGirlsTodayET } from "@/lib/monday-girls-registration-window";
import {
  hasWaiverOnFile,
  buildWaiverSignUrl,
  WAIVER_REQUIRED_CODE,
  WAIVER_REQUIRED_MESSAGE,
} from "@/lib/waiver-gate";

// Monday Girls drop-in checkout — ENV-GATED like the season block: until
// STRIPE_MONDAY_GIRLS_DROPIN_PRICE_ID is set this returns 503 so the drop-in
// ships dark. A drop-in seat is a season seat for that Monday — the checkout
// counts the same block-wide roster rows the season checkout counts, so a
// sold-out block cannot be oversold one $35 seat at a time.

export async function POST(req: NextRequest) {
  let body: Partial<MondayGirlsDropinData>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Fail closed on configuration BEFORE validating the form: without a live
  // Stripe price there is no checkout to offer, whatever the payload says.
  if (!process.env[MONDAY_GIRLS_DROPIN_PRICE_ENV_VAR]) {
    console.error(
      `[checkout-monday-girls-dropin] not configured — ${MONDAY_GIRLS_DROPIN_PRICE_ENV_VAR} is MISSING`,
    );
    return NextResponse.json(
      {
        error:
          "Online drop-in booking isn't open yet — text Coach Sam at 301-325-4731 and he'll get you in.",
      },
      { status: 503 },
    );
  }

  const errors = validateMondayGirlsDropin(body);
  if (Object.keys(errors).length > 0) {
    return NextResponse.json({ errors }, { status: 400 });
  }

  const data = body as MondayGirlsDropinData;
  const option = findMondayGirlsSeasonGroup(data.group);
  if (!option) {
    return NextResponse.json({ error: "Group not found" }, { status: 404 });
  }

  const priceId = process.env[MONDAY_GIRLS_DROPIN_PRICE_ENV_VAR];
  if (!priceId) {
    console.error(
      `[checkout-monday-girls-dropin] not configured — ${MONDAY_GIRLS_DROPIN_PRICE_ENV_VAR} is MISSING`,
    );
    return NextResponse.json(
      {
        error:
          "Online drop-in booking isn't open yet — text Coach Sam at 301-325-4731 and he'll get you in.",
      },
      { status: 503 },
    );
  }

  // The Monday must still be ahead of us.
  const today = mondayGirlsTodayET();
  const sellable = mondayGirlsDropinSellableMondays(today);
  if (!sellable.includes(data.monday)) {
    return NextResponse.json(
      { error: "That Monday has already passed — pick an upcoming one." },
      { status: 409 },
    );
  }

  // Block-wide seat cap, shared with the season block. Fail-open on a Notion
  // blip — an oversold seat is a refundable mistake, an outage blocking
  // checkout isn't.
  const keys = await fetchMondayGirlsRegistrationKeys();
  if (keys.length >= MONDAY_GIRLS_BLOCK_SEATS) {
    return NextResponse.json(
      {
        error:
          "The Monday block is full — text Coach Sam at 301-325-4731 and we'll add you to the sub list.",
        code: "sold_out",
      },
      { status: 409 },
    );
  }

  // One-time waiver gate — must be on file before the player's first session.
  if (!(await hasWaiverOnFile(data.email, data.phone))) {
    return NextResponse.json(
      {
        error: WAIVER_REQUIRED_MESSAGE,
        code: WAIVER_REQUIRED_CODE,
        signUrl: buildWaiverSignUrl({
          email: data.email,
          parentName: data.parentName,
          next: "/monday-girls",
        }),
      },
      { status: 409 },
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
    allow_promotion_codes: true,
    customer_email: data.email,
    payment_intent_data: {
      description: `${MONDAY_GIRLS_DROPIN_TITLE} — ${data.childFirstName} (${data.monday})`,
    },
    metadata: {
      kind: MONDAY_GIRLS_DROPIN_KIND,
      season_label: MONDAY_GIRLS_SEASON_LABEL,
      group: option.group,
      group_label: option.label,
      group_time: MONDAY_GIRLS_TIME_LABEL,
      monday: data.monday,
      // Wood MS is a public MCPS facility and this is a closed, post-payment
      // surface, so the exact venue may travel through metadata (same posture
      // as the season block).
      venue: MONDAY_GIRLS_VENUE,
      parent_name: data.parentName,
      parent_email: data.email,
      parent_phone: data.phone,
      child_first_name: data.childFirstName,
      child_birth_year: data.childBirthYear,
      emergency_name: data.emergencyName,
      emergency_phone: data.emergencyPhone,
      // Stripe metadata values cap at 500 chars; trim defensively.
      allergies: (data.allergies ?? "").slice(0, 480),
      // Gate above guarantees a signed one-time waiver is on file for this parent.
      waiver_accepted: "true",
      sms_consent: data.smsConsent ? "true" : "false",
      sms_consent_text: data.smsConsent ? SMS_CONSENT_TEXT : "",
    },
    success_url: `${origin}/monday-girls/success?cs={CHECKOUT_SESSION_ID}&dropin=${data.monday}`,
    cancel_url: `${origin}/monday-girls`,
  });

  return NextResponse.json({ url: checkout.url });
}
