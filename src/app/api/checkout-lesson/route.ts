import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import {
  LESSON_CHECKOUT_KIND,
  LESSON_PRICE_USD,
  findLessonProduct,
} from "@/data/lessons";
import { SMS_CONSENT_TEXT } from "@/data/sms-consent";
import {
  validateLessonPurchase,
  type LessonPurchaseData,
} from "@/lib/validate-lesson";
import {
  hasWaiverOnFile,
  buildWaiverSignUrl,
  WAIVER_REQUIRED_CODE,
  WAIVER_REQUIRED_MESSAGE,
} from "@/lib/waiver-gate";

// Lesson checkout — ENV-GATED like the season checkouts: until the matching
// STRIPE_*_LESSON_PRICE_ID is set this returns 503 so the page ships dark.
// A lesson is a scheduling conversation as much as a purchase: the form
// collects preferred times, and the webhook confirmation tells the family a
// coach will reach out to lock the hour.
//
// GROUP PRICING (confirmed by Sam 2026-09-21): the group Stripe price
// STRIPE_GROUP_LESSON_PRICE_ID is the $60 TOTAL for the hour — quantity 1,
// never per player. The player count is collected on the form and written
// into session metadata + the payment-intent description so staff see the
// per-player split without it being a separate charge.

export async function POST(req: NextRequest) {
  let body: Partial<LessonPurchaseData>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Fail closed on configuration BEFORE validating the form: without a live
  // Stripe price there is no checkout to offer, whatever the payload says.
  const provisionalType =
    typeof body?.lessonType === "string" ? body.lessonType : "private";
  const provisionalProduct = findLessonProduct(provisionalType);
  const provisionalPriceId = provisionalProduct
    ? process.env[provisionalProduct.priceEnvVar]
    : undefined;
  if (!provisionalPriceId) {
    console.error(
      `[checkout-lesson] not configured — ${
        provisionalProduct?.priceEnvVar ?? "STRIPE_PRIVATE_LESSON_PRICE_ID"
      } is MISSING`,
    );
    return NextResponse.json(
      {
        error:
          "Online lesson booking isn't open yet — text Coach Sam at 301-325-4731 and he'll get you scheduled.",
      },
      { status: 503 },
    );
  }

  const errors = validateLessonPurchase(body);
  if (Object.keys(errors).length > 0) {
    return NextResponse.json({ errors }, { status: 400 });
  }

  const data = body as LessonPurchaseData;
  const product = findLessonProduct(data.lessonType);
  if (!product) {
    return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
  }

  const priceId = process.env[product.priceEnvVar];
  if (!priceId) {
    console.error(
      `[checkout-lesson] not configured — ${product.priceEnvVar} is MISSING`,
    );
    return NextResponse.json(
      {
        error:
          "Online lesson booking isn't open yet — text Coach Sam at 301-325-4731 and he'll get you scheduled.",
      },
      { status: 503 },
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
          next: "/lessons",
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

  // Group: the $60 total is charged once (quantity 1) and split between the
  // players — the count goes in metadata + description for staff visibility.
  const groupPlayers =
    data.lessonType === "group" ? Number(data.groupPlayers) || null : null;
  const splitLine =
    groupPlayers != null
      ? ` — ${groupPlayers} players ($${LESSON_PRICE_USD} total, split between the players)`
      : "";
  const paymentDescription =
    data.lessonType === "group"
      ? `${product.title} — ${data.childFirstName}${splitLine}`
      : `${product.title} — ${data.childFirstName} ($${LESSON_PRICE_USD}/hr)`;

  const checkout = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [{ price: priceId, quantity: 1 }],
    allow_promotion_codes: true,
    customer_email: data.email,
    payment_intent_data: {
      description: paymentDescription,
    },
    metadata: {
      kind: LESSON_CHECKOUT_KIND,
      lesson_type: product.type,
      lesson_title: product.title,
      lesson_slug: product.slug,
      // Group-lesson player count: the $60/hour total is split this many
      // ways. Private lessons omit it (single player).
      group_players: groupPlayers != null ? String(groupPlayers) : "",
      parent_name: data.parentName,
      parent_email: data.email,
      parent_phone: data.phone,
      child_first_name: data.childFirstName,
      child_birth_year: data.childBirthYear,
      preferred_times: (data.preferredTimes ?? "").slice(0, 480),
      emergency_name: data.emergencyName,
      emergency_phone: data.emergencyPhone,
      // Stripe metadata values cap at 500 chars; trim defensively.
      allergies: (data.allergies ?? "").slice(0, 480),
      notes: (data.notes ?? "").slice(0, 480),
      // Gate above guarantees a signed one-time waiver is on file for this parent.
      waiver_accepted: "true",
      sms_consent: data.smsConsent ? "true" : "false",
      sms_consent_text: data.smsConsent ? SMS_CONSENT_TEXT : "",
    },
    success_url: `${origin}/lessons/success?cs={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/lessons`,
  });

  return NextResponse.json({ url: checkout.url });
}
