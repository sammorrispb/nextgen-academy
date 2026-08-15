import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import {
  FALL_SEASON_PRICE_ENV_VAR,
  FALL_SEASON_SLUG,
  FALL_SEASON_SPOTS_PER_GROUP,
  FALL_SEASON_TITLE,
  findFallSeasonGroup,
} from "@/data/fall-season-2026";
import { FALL_SEASON_LABEL, FALL_VENUE } from "@/data/fall-2026";
import { SMS_CONSENT_TEXT } from "@/data/sms-consent";
import {
  validateFallRegistration,
  isDuplicateFallRegistration,
  type FallRegistrationData,
} from "@/lib/validate-fall-registration";
import { fetchFallRegistrationKeys } from "@/lib/notion-fall-registrations";
import {
  hasWaiverOnFile,
  buildWaiverSignUrl,
  WAIVER_REQUIRED_CODE,
  WAIVER_REQUIRED_MESSAGE,
} from "@/lib/waiver-gate";

// Fall 2026 season checkout — full-pay only, ENV-GATED like checkout-league:
// until STRIPE_FALL_SEASON_PRICE_ID is set this returns 503 so the season
// ships dark. Unlike league, the season has a real 8-seat cap per group, so
// the Notion roster count gates the checkout (fail-open on a Notion blip —
// an oversold seat is a refundable mistake, an outage blocking checkout
// isn't), and the cluster-style duplicate guard stops a same-kid double-pay.

export async function POST(req: NextRequest) {
  let body: Partial<FallRegistrationData>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const errors = validateFallRegistration(body);
  if (Object.keys(errors).length > 0) {
    return NextResponse.json({ errors }, { status: 400 });
  }

  const data = body as FallRegistrationData;
  const option = findFallSeasonGroup(data.group);
  if (!option) {
    return NextResponse.json({ error: "Group not found" }, { status: 404 });
  }

  const priceId = process.env[FALL_SEASON_PRICE_ENV_VAR];
  if (!priceId) {
    console.error(
      `[checkout-fall] missing Stripe price env ${FALL_SEASON_PRICE_ENV_VAR}`,
    );
    return NextResponse.json(
      { error: "Season registration isn't open yet — please check back soon." },
      { status: 503 },
    );
  }

  const keys = await fetchFallRegistrationKeys(option.group);
  if (keys.length >= FALL_SEASON_SPOTS_PER_GROUP) {
    return NextResponse.json(
      {
        error: `The ${option.label} group is full — reply to any of our emails or text Coach Sam and we'll add you to the sub list.`,
        code: "sold_out",
      },
      { status: 409 },
    );
  }
  if (isDuplicateFallRegistration(keys, data.email, data.childFirstName)) {
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
          next: "/fall",
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
      description: `${FALL_SEASON_TITLE} (${option.label}) — ${data.childFirstName}`,
    },
    metadata: {
      kind: "fall",
      season_slug: FALL_SEASON_SLUG,
      season_title: FALL_SEASON_TITLE,
      season_label: FALL_SEASON_LABEL,
      group: option.group,
      group_label: option.label,
      group_time: option.timeLabel,
      // The fall venue is public (events feed emits the full address), so the
      // exact venue may travel through metadata.
      venue: FALL_VENUE,
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
    success_url: `${origin}/fall/success?cs={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/fall`,
  });

  return NextResponse.json({ url: checkout.url });
}
