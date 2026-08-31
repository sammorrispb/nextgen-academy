import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import {
  PICKLPARK_SEASON_PRICE_ENV_VAR,
  PICKLPARK_SEASON_SLUG,
  PICKLPARK_SEASON_TITLE,
  findPicklParkSeasonGroup,
  picklParkSeasonSlotsFor,
} from "@/data/picklpark-season-2026";
import { PICKLPARK_SEASON_LABEL, PICKLPARK_VENUE } from "@/data/picklpark-2026";
import { SMS_CONSENT_TEXT } from "@/data/sms-consent";
import {
  validatePicklParkRegistration,
  isDuplicatePicklParkRegistration,
  type PicklParkRegistrationData,
} from "@/lib/validate-picklpark-registration";
import { fetchPicklParkRegistrationKeys } from "@/lib/notion-picklpark-registrations";
import {
  hasWaiverOnFile,
  buildWaiverSignUrl,
  WAIVER_REQUIRED_CODE,
  WAIVER_REQUIRED_MESSAGE,
} from "@/lib/waiver-gate";

// Pickl Park Saturday season checkout — full-pay only, ENV-GATED like
// checkout-fall: until STRIPE_PICKLPARK_SEASON_PRICE_ID is set this returns
// 503 so the season ships dark. Each band has its own seat cap, so the Notion
// roster count gates the checkout PER BAND (fail-open on a Notion blip — an
// oversold seat is a refundable mistake, an outage blocking checkout isn't),
// and the duplicate guard stops a same-kid double-pay.

export async function POST(req: NextRequest) {
  let body: Partial<PicklParkRegistrationData>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const errors = validatePicklParkRegistration(body);
  if (Object.keys(errors).length > 0) {
    return NextResponse.json({ errors }, { status: 400 });
  }

  const data = body as PicklParkRegistrationData;
  const option = findPicklParkSeasonGroup(data.group);
  if (!option) {
    return NextResponse.json({ error: "Group not found" }, { status: 404 });
  }

  const priceId = process.env[PICKLPARK_SEASON_PRICE_ENV_VAR];
  if (!priceId) {
    console.error(
      `[checkout-picklpark] missing Stripe price env ${PICKLPARK_SEASON_PRICE_ENV_VAR}`,
    );
    return NextResponse.json(
      { error: "Season registration isn't open yet — please check back soon." },
      { status: 503 },
    );
  }

  const keys = await fetchPicklParkRegistrationKeys(option.group);
  if (keys.length >= picklParkSeasonSlotsFor(option.group)) {
    return NextResponse.json(
      {
        error: `The ${option.label} group is full — reply to any of our emails or text Coach Sam and we'll add you to the sub list.`,
        code: "sold_out",
      },
      { status: 409 },
    );
  }
  if (isDuplicatePicklParkRegistration(keys, data.email, data.childFirstName)) {
    return NextResponse.json(
      {
        error: `${data.childFirstName.trim()} is already registered for the ${option.label} group — check your email for the confirmation, or text Coach Sam if something looks off.`,
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
          next: "/picklpark",
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
      description: `${PICKLPARK_SEASON_TITLE} (${option.label}) — ${data.childFirstName}`,
    },
    metadata: {
      kind: "picklpark",
      season_slug: PICKLPARK_SEASON_SLUG,
      season_title: PICKLPARK_SEASON_TITLE,
      season_label: PICKLPARK_SEASON_LABEL,
      group: option.group,
      group_label: option.label,
      group_time: option.timeLabel,
      // The Pickl Park is a public commercial facility, so the exact venue may
      // travel through metadata (same posture as the fall season's venue).
      venue: PICKLPARK_VENUE,
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
    success_url: `${origin}/picklpark/success?cs={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/picklpark`,
  });

  return NextResponse.json({ url: checkout.url });
}
