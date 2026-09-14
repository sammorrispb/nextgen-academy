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
  MONDAY_GIRLS_MONDAYS,
  MONDAY_GIRLS_SEASON_LABEL,
  MONDAY_GIRLS_VENUE,
} from "@/data/monday-girls-2026";
import {
  mondayGirlsJoinPriceCents,
  mondayGirlsRemainingMondays,
  mondayGirlsSellableOn,
} from "@/lib/monday-girls-proration";
import { mondayGirlsSessionsRemaining } from "@/lib/monday-girls-refund-policy";
import { SMS_CONSENT_TEXT } from "@/data/sms-consent";
import {
  validateMondayGirlsRegistration,
  isDuplicateMondayGirlsRegistration,
  type MondayGirlsRegistrationData,
} from "@/lib/validate-monday-girls-registration";
import { fetchMondayGirlsRegistrationKeys } from "@/lib/notion-monday-girls-registrations";
import {
  MONDAY_GIRLS_ROSTER_DB_ENV_VAR,
  mondayGirlsTodayET,
} from "@/lib/monday-girls-registration-window";
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

  // BOTH envs gate, not just the price. With a price but no roster DB the
  // capacity gate reads an empty list, the duplicate guard never fires, and the
  // webhook's row create fail-softs to "ok" with rosterFailed=false — so a
  // family would pay $225 and leave no row, no seat count and no admin warning.
  // Silent money-without-a-roster is the one outcome worth refusing a sale for.
  // The page's gate checks the same pair; this is the direct-POST backstop.
  const priceId = process.env[MONDAY_GIRLS_SEASON_PRICE_ENV_VAR];
  const rosterDbId = process.env[MONDAY_GIRLS_ROSTER_DB_ENV_VAR];
  if (!priceId || !rosterDbId) {
    console.error(
      `[checkout-monday-girls] not configured — ${MONDAY_GIRLS_SEASON_PRICE_ENV_VAR}: ${priceId ? "set" : "MISSING"}, ${MONDAY_GIRLS_ROSTER_DB_ENV_VAR}: ${rosterDbId ? "set" : "MISSING"}`,
    );
    return NextResponse.json(
      { error: "Registration isn't open yet — please check back soon." },
      { status: 503 },
    );
  }

  // The selling floor. Pure and cheap, so it runs before any Notion call — a
  // block that is no longer on sale should not cost a roster query. This is the
  // direct-POST backstop for the same gate the page renders from; below the
  // floor the answer is a conversation with Coach Sam, not a checkout.
  const today = mondayGirlsTodayET();
  if (!mondayGirlsSellableOn(today)) {
    return NextResponse.json(
      {
        error:
          "Only a couple of Mondays are left in this block, so we've stopped selling it online — text Coach Sam at 301-325-4731 and he'll sort out a fair price for what's left.",
        code: "too_few_sessions",
      },
      { status: 409 },
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

  // Full block vs mid-season join.
  //
  // A full-block sale keeps the fixed Stripe Price verbatim — the path the
  // three families who bought at sticker went through, byte for byte, so
  // reopening the season cannot have moved the common case by a cent.
  //
  // A prorated join cannot use a fixed Price (the amount differs per day), so
  // it builds price_data against the SAME Stripe Product. The full amount is
  // read off the Price rather than the code constant, keeping Stripe the single
  // source of truth for what the block costs; if that amount cannot be read we
  // refuse rather than guess, because guessing here charges a real card.
  const sessionsPurchased = mondayGirlsSessionsRemaining(today);
  const sessionsTotal = MONDAY_GIRLS_MONDAYS.length;
  const prorated = sessionsPurchased < sessionsTotal;

  let lineItem: { price: string; quantity: number } | {
    price_data: {
      currency: string;
      product: string;
      unit_amount: number;
    };
    quantity: number;
  } = { price: priceId, quantity: 1 };

  if (prorated) {
    const price = await stripe.prices.retrieve(priceId);
    const fullCents = price.unit_amount;
    const productId =
      typeof price.product === "string" ? price.product : price.product?.id;
    if (typeof fullCents !== "number" || !productId) {
      console.error(
        `[checkout-monday-girls] cannot prorate — price ${priceId} has unit_amount=${String(fullCents)} product=${String(productId)}`,
      );
      return NextResponse.json(
        {
          error:
            "We couldn't work out the prorated price — text Coach Sam at 301-325-4731 and he'll get you signed up.",
        },
        { status: 503 },
      );
    }
    lineItem = {
      price_data: {
        currency: price.currency,
        product: productId,
        unit_amount: mondayGirlsJoinPriceCents(today, fullCents),
      },
      quantity: 1,
    };
  }

  const checkout = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [lineItem],
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
      // What this family actually bought. The confirmation email lists exactly
      // these dates, and the refund path reconstructs the same count from the
      // roster row's creation date — so a prorated joiner is never quoted, or
      // refunded against, sessions that were over before they arrived.
      sessions_purchased: String(sessionsPurchased),
      sessions_total: String(sessionsTotal),
      prorated: prorated ? "true" : "false",
      first_session: mondayGirlsRemainingMondays(today)[0] ?? "",
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
