import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import {
  MONDAY_GIRLS_SEASON_PRICE_ENV_VAR,
  MONDAY_GIRLS_SEASON_SLUG,
  MONDAY_GIRLS_SEASON_TITLE,
  findMondayGirlsSeasonGroup,
  mondayGirlsSeasonSlotsFor,
} from "@/data/monday-girls-season-2026";
import {
  MONDAY_GIRLS_SEASON_LABEL,
  MONDAY_GIRLS_VENUE,
} from "@/data/monday-girls-2026";
import { SMS_CONSENT_TEXT } from "@/data/sms-consent";
import {
  validateMondayGirlsRegistration,
  isDuplicateMondayGirlsRegistration,
  type MondayGirlsRegistrationData,
} from "@/lib/validate-monday-girls-registration";
import { fetchMondayGirlsRegistrationKeys } from "@/lib/notion-monday-girls-registrations";
import {
  hasWaiverOnFile,
  buildWaiverSignUrl,
  WAIVER_REQUIRED_CODE,
  WAIVER_REQUIRED_MESSAGE,
} from "@/lib/waiver-gate";

// Monday Girls Beginner Group checkout — full-pay only, ENV-GATED like
// checkout-fall and checkout-picklpark: until STRIPE_MONDAY_GIRLS_PRICE_ID is
// set this returns 503 so the block ships dark. The Notion roster count gates
// the checkout at the group's seat cap (fail-open on a Notion blip — an
// oversold seat is a refundable mistake, an outage blocking checkout isn't),
// and the duplicate guard stops a same-kid double-pay.
//
// Every family in this block was recruited by hand over text, so the sold-out
// and duplicate messages point at a human rather than a form: these parents
// already have Coach Sam's number.

export async function POST(req: NextRequest) {
  let body: Partial<MondayGirlsRegistrationData>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const errors = validateMondayGirlsRegistration(body);
  if (Object.keys(errors).length > 0) {
    return NextResponse.json({ errors }, { status: 400 });
  }

  const data = body as MondayGirlsRegistrationData;
  const option = findMondayGirlsSeasonGroup(data.group);
  if (!option) {
    return NextResponse.json({ error: "Group not found" }, { status: 404 });
  }

  const priceId = process.env[MONDAY_GIRLS_SEASON_PRICE_ENV_VAR];
  if (!priceId) {
    console.error(
      `[checkout-monday-girls] missing Stripe price env ${MONDAY_GIRLS_SEASON_PRICE_ENV_VAR}`,
    );
    return NextResponse.json(
      { error: "Registration isn't open yet — please check back soon." },
      { status: 503 },
    );
  }

  const keys = await fetchMondayGirlsRegistrationKeys(option.group);
  if (keys.length >= mondayGirlsSeasonSlotsFor(option.group)) {
    return NextResponse.json(
      {
        error:
          "The Monday group is full — text Coach Sam at 301-325-4731 and we'll add you to the sub list.",
        code: "sold_out",
      },
      { status: 409 },
    );
  }
  if (isDuplicateMondayGirlsRegistration(keys, data.email, data.childFirstName)) {
    return NextResponse.json(
      {
        error: `${data.childFirstName.trim()} is already registered for the Monday group — check your email for the confirmation, or text Coach Sam if something looks off.`,
        code: "duplicate_registration",
      },
      { status: 409 },
    );
  }

  // One-time waiver gate — must be on file before the player's first event.
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
      description: `${MONDAY_GIRLS_SEASON_TITLE} — ${data.childFirstName}`,
    },
    metadata: {
      kind: "monday-girls",
      season_slug: MONDAY_GIRLS_SEASON_SLUG,
      season_title: MONDAY_GIRLS_SEASON_TITLE,
      season_label: MONDAY_GIRLS_SEASON_LABEL,
      group: option.group,
      group_label: option.label,
      group_time: option.timeLabel,
      // Wood MS is a public MCPS facility and this is a closed, post-payment
      // surface, so the exact venue may travel through metadata (same posture
      // as the fall and Pickl Park seasons).
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
    success_url: `${origin}/monday-girls/success?cs={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/monday-girls`,
  });

  return NextResponse.json({ url: checkout.url });
}
