import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { findCampBySlug, findCampOption } from "@/data/camps";
import { SMS_CONSENT_TEXT } from "@/data/sms-consent";
import { validateCampForm, type CampFormData } from "@/lib/validate-camp";

export async function POST(req: NextRequest) {
  let body: Partial<CampFormData>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const errors = validateCampForm(body);
  if (Object.keys(errors).length > 0) {
    return NextResponse.json({ errors }, { status: 400 });
  }

  const data = body as CampFormData;

  const camp = findCampBySlug(data.campSlug);
  const option = findCampOption(data.optionKey);
  if (!camp || !option) {
    return NextResponse.json({ error: "Camp not found" }, { status: 404 });
  }

  const priceId = process.env[option.priceEnvVar];
  if (!priceId) {
    console.error(
      `[checkout-camp] missing Stripe price env ${option.priceEnvVar}`,
    );
    return NextResponse.json(
      { error: "Camp registration isn't open yet — please check back soon." },
      { status: 503 },
    );
  }

  const origin =
    req.headers.get("origin") ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    "https://nextgenpbacademy.com";

  // For the single-morning SKU, bake the chosen day into the label so the
  // confirmation email, admin alert, Player CRM, and success page all show
  // which morning was booked — the webhook reads option_label verbatim, so no
  // change to that slop-free file is needed.
  const dayLabel =
    option.key === "day" && data.selectedDay
      ? new Date(`${data.selectedDay}T12:00:00Z`).toLocaleDateString("en-US", {
          weekday: "short",
          month: "short",
          day: "numeric",
          timeZone: "UTC",
        })
      : "";
  const optionLabel = dayLabel ? `${option.label} — ${dayLabel}` : option.label;

  const stripe = getStripe();
  const checkout = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [{ price: priceId, quantity: 1 }],
    allow_promotion_codes: true,
    customer_email: data.email,
    payment_intent_data: {
      description: `${camp.title} (${optionLabel}) — ${data.childFirstName}`,
    },
    metadata: {
      kind: "camp",
      camp_slug: camp.slug,
      camp_title: camp.title,
      camp_week: camp.weekLabel,
      camp_start: camp.startDate,
      camp_end: camp.endDate,
      camp_makeup: camp.makeupDate,
      // Hidden location: only the broad area travels through metadata; the exact
      // venue is shared with registered families separately.
      public_area: camp.publicArea,
      option_key: option.key,
      option_label: optionLabel,
      option_hours: option.hours,
      selected_day: option.key === "day" ? data.selectedDay : "",
      parent_name: data.parentName,
      parent_email: data.email,
      parent_phone: data.phone,
      child_first_name: data.childFirstName,
      child_birth_year: data.childBirthYear,
      emergency_name: data.emergencyName,
      emergency_phone: data.emergencyPhone,
      // Stripe metadata values cap at 500 chars; trim defensively.
      allergies: (data.allergies ?? "").slice(0, 480),
      waiver_accepted: data.waiverAccepted ? "true" : "false",
      sms_consent: data.smsConsent ? "true" : "false",
      sms_consent_text: data.smsConsent ? SMS_CONSENT_TEXT : "",
    },
    success_url: `${origin}/camp/success?cs={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/camp/${camp.slug}`,
  });

  return NextResponse.json({ url: checkout.url });
}
