import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { getClusterBySlug } from "@/lib/clusters";
import type { ClusterSlug } from "@/data/clusters";
import {
  CLUSTER_LAUNCH_GATES,
  resolveClusterCheckoutGate,
} from "@/data/cluster-launch-gates";
import { resolveClusterBand, SEASON_YEAR } from "@/lib/cluster-age";
import {
  validateClusterForm,
  isDuplicateClusterRegistration,
  type ClusterFormData,
} from "@/lib/validate-cluster";
import { fetchClusterRegistrationKeys } from "@/lib/notion-clusters";
import { SMS_CONSENT_TEXT } from "@/data/sms-consent";

// Cluster season checkout — DOUBLE-gated so it ships dark:
//   1. Per-cluster launch gates (coach + venue confirmed in
//      src/data/cluster-launch-gates.ts) — the pre-launch guard, mechanical.
//   2. STRIPE_CLUSTER_SEASON_PRICE_ID env var (same pattern as checkout-league).
// No cluster page surfaces this route until a cluster's gates flip true; the
// public CTA stays the /crew interest list. Flipping a cluster live is:
// confirm coach + venue → flip its gates → create the Stripe price → set the
// env var → swap that cluster page's CTA.

export async function POST(req: NextRequest) {
  let body: Partial<ClusterFormData>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const errors = validateClusterForm(body);
  if (Object.keys(errors).length > 0) {
    return NextResponse.json({ errors }, { status: 400 });
  }

  const data = body as ClusterFormData;
  const slug = data.clusterSlug.trim() as ClusterSlug;
  const cluster = getClusterBySlug(slug);
  if (!cluster) {
    return NextResponse.json({ error: "Cluster not found" }, { status: 404 });
  }

  const gate = resolveClusterCheckoutGate(
    CLUSTER_LAUNCH_GATES[slug],
    process.env.STRIPE_CLUSTER_SEASON_PRICE_ID,
  );
  if (!gate.ok) {
    return NextResponse.json({ error: gate.message }, { status: gate.status });
  }

  const existing = await fetchClusterRegistrationKeys(slug);
  if (
    isDuplicateClusterRegistration(existing, {
      childFirstName: data.childFirstName,
      parentEmail: data.email,
      clusterSlug: slug,
    })
  ) {
    return NextResponse.json(
      {
        error: `${data.childFirstName.trim()} is already registered for the ${cluster.name}. Questions? Reply to your confirmation email or text Coach Sam.`,
      },
      { status: 409 },
    );
  }

  const band = resolveClusterBand(data.childBirthDate);
  if (!band) {
    // validateClusterForm already rejected out-of-band dates; this guards the cast.
    return NextResponse.json(
      { errors: { childBirthDate: "Player birthdate is out of range" } },
      { status: 400 },
    );
  }

  const origin =
    req.headers.get("origin") ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    "https://nextgenpbacademy.com";

  const stripe = getStripe();
  const checkout = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [
      { price: process.env.STRIPE_CLUSTER_SEASON_PRICE_ID!, quantity: 1 },
    ],
    allow_promotion_codes: true,
    customer_email: data.email,
    payment_intent_data: {
      description: `${cluster.name} — Fall ${SEASON_YEAR} (${band}) — ${data.childFirstName}`,
    },
    metadata: {
      kind: "cluster",
      cluster_slug: slug,
      cluster_name: cluster.name,
      season_year: String(SEASON_YEAR),
      band,
      ball_level: data.ballLevel,
      parent_name: data.parentName,
      parent_email: data.email,
      parent_phone: data.phone,
      child_first_name: data.childFirstName,
      child_birth_date: data.childBirthDate,
      emergency_name: data.emergencyName,
      emergency_phone: data.emergencyPhone,
      allergies: (data.allergies ?? "").slice(0, 480),
      waiver_accepted: data.waiverAccepted ? "true" : "false",
      display_consent: data.displayConsent === true ? "true" : "false",
      sms_consent: data.smsConsent ? "true" : "false",
      sms_consent_text: data.smsConsent ? SMS_CONSENT_TEXT : "",
    },
    success_url: `${origin}/clusters/${slug}?registered=1&cs={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/clusters/${slug}`,
  });

  return NextResponse.json({ url: checkout.url });
}
