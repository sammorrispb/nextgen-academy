import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { findSeasonBySlug, findPriceOption, findBand } from "@/data/leagues";
import { SMS_CONSENT_TEXT } from "@/data/sms-consent";
import { validateLeagueForm, type LeagueFormData } from "@/lib/validate-league";
import {
  hasWaiverOnFile,
  buildWaiverSignUrl,
  WAIVER_REQUIRED_CODE,
  WAIVER_REQUIRED_MESSAGE,
} from "@/lib/waiver-gate";

// Season enrollment checkout — full-pay only, ENV-GATED. When the season's
// Stripe price env var is unset (the default until the P0 launch gate clears),
// this returns 503 so the product can ship dark. The public /league page does
// NOT surface this route yet; it routes parents to the interest form. Flipping
// the season live is: create the Stripe price → set the env var → swap the page
// CTA. See docs/youth-pickleball-league-build-spec.md.

export async function POST(req: NextRequest) {
  let body: Partial<LeagueFormData>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const errors = validateLeagueForm(body);
  if (Object.keys(errors).length > 0) {
    return NextResponse.json({ errors }, { status: 400 });
  }

  const data = body as LeagueFormData;

  const season = findSeasonBySlug(data.seasonSlug);
  const option = findPriceOption(data.priceKey);
  if (!season || !option) {
    return NextResponse.json({ error: "Season not found" }, { status: 404 });
  }

  const priceId = process.env[option.priceEnvVar];
  if (!priceId) {
    console.error(
      `[checkout-league] missing Stripe price env ${option.priceEnvVar}`,
    );
    return NextResponse.json(
      { error: "League enrollment isn't open yet — please check back soon." },
      { status: 503 },
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
          next: "/league",
        }),
      },
      { status: 409 },
    );
  }

  const band = findBand(season.band);

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
      description: `${season.title} (${option.label}) — ${data.childFirstName}`,
    },
    metadata: {
      kind: "league",
      season_slug: season.slug,
      season_title: season.title,
      season_label: season.seasonLabel,
      season_band: season.band,
      season_band_label: band?.label ?? season.band,
      season_start: season.startDate,
      season_end: season.endDate,
      // Hidden location: only the broad area travels through metadata; the exact
      // venue is shared with enrolled families separately.
      public_area: season.publicArea,
      option_key: option.key,
      option_label: option.label,
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
    success_url: `${origin}/league/success?cs={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/league`,
  });

  return NextResponse.json({ url: checkout.url });
}
