import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { createAndSendSignupInvoice } from "@/lib/stripe-invoices";
import {
  PICKL_PARK_WINTER_LEAGUE_KIND,
  PICKL_PARK_WINTER_LEAGUE_PRICE_USD,
  PICKL_PARK_WINTER_LEAGUE_SEASON_LABEL,
  PICKL_PARK_WINTER_LEAGUE_TITLE,
  PICKL_PARK_WINTER_LEAGUE_VENUE,
  findPicklParkWinterLeagueTrack,
} from "@/data/pickl-park-winter-league-2026";
import { SMS_CONSENT_TEXT } from "@/data/sms-consent";
import {
  validatePicklParkWinterLeague,
  type PicklParkWinterLeagueData,
} from "@/lib/validate-pickl-park-winter-league";
import {
  hasWaiverOnFile,
  buildWaiverSignUrl,
  WAIVER_REQUIRED_CODE,
  WAIVER_REQUIRED_MESSAGE,
} from "@/lib/waiver-gate";

// Pickl Park Winter Youth League sign-up — INVOICE-BASED, mirroring the
// lessons and Monday Girls drop-in checkouts. The $225 six-week league becomes
// a Stripe invoice line item built from the form (player + track) instead of a
// fixed Price ID. Flow: validate -> track lookup -> waiver gate ->
// find-or-create customer -> invoice -> finalize -> Stripe emails the invoice
// -> parent pays on the hosted invoice page.
//
// Fail-closed on STRIPE_SECRET_KEY: without it there is no invoice to create.
//
// This is NGA-sold (Sam, 2026-09-21) — distinct from the retired Pickl Park
// fall Saturday, which The Pickl Park sells itself through PodPlay and which
// NGA must never sell or advertise.

const NOT_OPEN_MESSAGE =
  "Winter League sign-ups aren't open yet — text Coach Sam at 301-325-4731 and he'll get your player in.";

export async function POST(req: NextRequest) {
  let body: Partial<PicklParkWinterLeagueData> & { submissionId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Fail closed on configuration BEFORE validating the form.
  try {
    getStripe();
  } catch {
    console.error(
      "[checkout-pickl-park-winter-league] not configured — STRIPE_SECRET_KEY is MISSING",
    );
    return NextResponse.json({ error: NOT_OPEN_MESSAGE }, { status: 503 });
  }

  const errors = validatePicklParkWinterLeague(body);
  if (Object.keys(errors).length > 0) {
    return NextResponse.json({ errors }, { status: 400 });
  }

  const data = body as PicklParkWinterLeagueData;
  const track = findPicklParkWinterLeagueTrack(data.track);
  if (!track) {
    return NextResponse.json({ error: "Track not found" }, { status: 404 });
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
          next: "/pickl-park-winter-league",
        }),
      },
      { status: 409 },
    );
  }

  const submissionId =
    typeof body.submissionId === "string" && body.submissionId.length > 0
      ? body.submissionId
      : undefined;

  let invoice;
  try {
    invoice = await createAndSendSignupInvoice({
      customerEmail: data.email,
      customerName: data.parentName,
      items: [
        {
          description: `${PICKL_PARK_WINTER_LEAGUE_TITLE} — ${track.label} — ${data.childFirstName}`,
          amountCents: PICKL_PARK_WINTER_LEAGUE_PRICE_USD * 100,
          quantity: 1,
        },
      ],
      metadata: {
        kind: PICKL_PARK_WINTER_LEAGUE_KIND,
        season_label: PICKL_PARK_WINTER_LEAGUE_SEASON_LABEL,
        track: track.track,
        track_label: track.label,
        track_time: track.timeLabel,
        // Co-branded with The Pickl Park; Amar signed off 2026-09-21. The
        // venue is a public commercial facility and this is a closed,
        // post-payment surface.
        venue: PICKL_PARK_WINTER_LEAGUE_VENUE,
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
      memo: `${PICKL_PARK_WINTER_LEAGUE_TITLE} — ${track.label} — ${data.childFirstName}`,
      footer:
        "Bring a refillable water bottle and court shoes — we have loaner paddles.",
      // Six-week league; a week to pay keeps the roster real.
      daysUntilDue: 7,
      idempotencyKey: submissionId
        ? `pickl-park-winter-league-${submissionId}`
        : undefined,
    });
  } catch (err) {
    console.error("[checkout-pickl-park-winter-league] invoice creation failed", err);
    return NextResponse.json(
      {
        error:
          "We couldn't create your invoice — text Coach Sam at 301-325-4731 and he'll get you in.",
      },
      { status: 502 },
    );
  }

  // Both admin inboxes get an "invoice sent" heads-up. notifyInvoiceSent
  // never throws, so this can't fail a signup whose invoice already went out.
  await import("@/lib/signup-admin-notify").then(({ notifyInvoiceSent }) =>
    notifyInvoiceSent({
      kind: "pickl-park-winter-league",
      headline: `Winter League invoice sent`,
      parentName: data.parentName,
      parentEmail: data.email,
      parentPhone: data.phone,
      childFirstName: data.childFirstName,
      amountUsd: PICKL_PARK_WINTER_LEAGUE_PRICE_USD.toFixed(2),
      invoiceId: invoice.id,
      hostedUrl: invoice.hosted_invoice_url ?? null,
      dueDate: "7 days",
      details: [
        `Track: ${track.label} (${track.timeLabel})`,
        `Season: ${PICKL_PARK_WINTER_LEAGUE_SEASON_LABEL}`,
      ],
    }),
  );

  return NextResponse.json({
    invoiceId: invoice.id,
    url: invoice.hosted_invoice_url,
  });
}
