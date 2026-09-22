import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { createAndSendSignupInvoice } from "@/lib/stripe-invoices";
import {
  MVF_JUNIOR_TOURNAMENT_DATE_ISO,
  MVF_JUNIOR_TOURNAMENT_DATE_LABEL,
  MVF_JUNIOR_TOURNAMENT_DIVISION_MAX,
  MVF_JUNIOR_TOURNAMENT_KIND,
  MVF_JUNIOR_TOURNAMENT_TIME_LABEL,
  MVF_JUNIOR_TOURNAMENT_TITLE,
  MVF_JUNIOR_TOURNAMENT_VENUE,
  NGA_REVENUE_SHARE,
  NO_REFUNDS_TEXT,
  RAIN_OR_SHINE_TEXT,
  findMvfTournamentDivision,
  resolveTournamentPriceUsd,
  splitTournamentRevenueUsd,
} from "@/data/mvf-junior-tournament-2026";
import { SMS_CONSENT_TEXT } from "@/data/sms-consent";
import {
  validateMvfJuniorTournament,
  type MvfJuniorTournamentData,
} from "@/lib/validate-mvf-junior-tournament";
import {
  countPaidMvfTournamentRegistrations,
  createMvfTournamentRegistration,
  type MvfTournamentDivisionSlug,
} from "@/lib/notion-mvf-tournament-registrations";
import {
  hasWaiverOnFile,
  buildWaiverSignUrl,
  WAIVER_REQUIRED_CODE,
  WAIVER_REQUIRED_MESSAGE,
} from "@/lib/waiver-gate";

// MVF Junior Tournament sign-up — INVOICE-BASED, mirroring the lessons,
// Monday Girls drop-in, and Winter League checkouts. The $50/$60 entry fee
// (Montgomery Village resident vs non-resident, self-attested) becomes a
// Stripe invoice line item built from the form (player + division) instead of
// a fixed Price ID. Flow: validate -> division lookup -> per-division paid
// cap -> waiver gate -> find-or-create customer -> invoice -> finalize ->
// Stripe emails the invoice -> parent pays on the hosted invoice page.
//
// The price is resolved SERVER-SIDE from the resident flag — the client never
// sends an amount. The 80/20 NGA/MVF revenue split is stamped on the invoice
// metadata (nga_share_usd / mvf_share_usd); remittance is manual, no money
// moves automatically.
//
// Fail-closed on STRIPE_SECRET_KEY: without it there is no invoice to create.

const NOT_OPEN_MESSAGE =
  "Tournament sign-ups aren't open yet — text Coach Sam at 301-325-4731 and he'll get your player in.";

export async function POST(req: NextRequest) {
  let body: Partial<MvfJuniorTournamentData> & { submissionId?: string };
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
      "[checkout-mvf-junior-tournament] not configured — STRIPE_SECRET_KEY is MISSING",
    );
    return NextResponse.json({ error: NOT_OPEN_MESSAGE }, { status: 503 });
  }

  const errors = validateMvfJuniorTournament(body);
  if (Object.keys(errors).length > 0) {
    return NextResponse.json({ errors }, { status: 400 });
  }

  const data = body as MvfJuniorTournamentData;
  const division = findMvfTournamentDivision(data.division);
  if (!division) {
    return NextResponse.json({ error: "Division not found" }, { status: 404 });
  }

  // Per-division paid seat cap. Fail-open on a Notion blip (null = unknown) —
  // an oversold seat is a refundable mistake, an outage blocking checkout
  // isn't. Same posture as the Monday Girls roster.
  const paidCount = await countPaidMvfTournamentRegistrations(
    division.division as MvfTournamentDivisionSlug,
  );
  if (paidCount !== null && paidCount >= MVF_JUNIOR_TOURNAMENT_DIVISION_MAX) {
    return NextResponse.json(
      {
        error: `The ${division.label} division is full (${MVF_JUNIOR_TOURNAMENT_DIVISION_MAX} players) — text Coach Sam at 301-325-4731 and we'll add you to the waitlist.`,
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
          next: "/mvf-junior-tournament",
        }),
      },
      { status: 409 },
    );
  }

  // Server-side price: the client's resident flag decides, never an amount.
  const priceUsd = resolveTournamentPriceUsd(data.resident === true);
  const { ngaShareUsd, mvfShareUsd } = splitTournamentRevenueUsd(priceUsd);

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
          description: `${MVF_JUNIOR_TOURNAMENT_TITLE} — ${division.label} — ${data.childFirstName} ${data.childLastName} (${data.resident ? "Resident" : "Non-resident"})`,
          amountCents: priceUsd * 100,
          quantity: 1,
        },
      ],
      metadata: {
        kind: MVF_JUNIOR_TOURNAMENT_KIND,
        event_label: MVF_JUNIOR_TOURNAMENT_TITLE,
        event_date: MVF_JUNIOR_TOURNAMENT_DATE_ISO,
        event_time: MVF_JUNIOR_TOURNAMENT_TIME_LABEL,
        venue: MVF_JUNIOR_TOURNAMENT_VENUE,
        division: division.division,
        division_label: division.label,
        resident: data.resident ? "true" : "false",
        amount_usd: priceUsd.toFixed(2),
        // 80/20 NGA/MVF revenue split — remitted manually, tracked here.
        nga_revenue_share: String(NGA_REVENUE_SHARE),
        nga_share_usd: ngaShareUsd,
        mvf_share_usd: mvfShareUsd,
        parent_name: data.parentName,
        parent_email: data.email,
        parent_phone: data.phone,
        child_first_name: data.childFirstName,
        child_last_name: data.childLastName,
        child_dob: data.childDob,
        emergency_name: data.emergencyName,
        emergency_phone: data.emergencyPhone,
        // Stripe metadata values cap at 500 chars; trim defensively.
        allergies: (data.allergies ?? "").slice(0, 480),
        // Gate above guarantees a signed one-time waiver is on file for this parent.
        waiver_accepted: "true",
        sms_consent: data.smsConsent ? "true" : "false",
        sms_consent_text: data.smsConsent ? SMS_CONSENT_TEXT : "",
      },
      memo: `${MVF_JUNIOR_TOURNAMENT_TITLE} — ${division.label} — ${data.childFirstName} ${data.childLastName}`,
      footer: `${NO_REFUNDS_TEXT} ${RAIN_OR_SHINE_TEXT} Bring a refillable water bottle and court shoes — we have loaner paddles.`,
      // A week to pay keeps the roster real.
      daysUntilDue: 7,
      idempotencyKey: submissionId
        ? `mvf-junior-tournament-${submissionId}`
        : undefined,
    });
  } catch (err) {
    console.error("[checkout-mvf-junior-tournament] invoice creation failed", err);
    return NextResponse.json(
      {
        error:
          "We couldn't create your invoice — text Coach Sam at 301-325-4731 and he'll get you in.",
      },
      { status: 502 },
    );
  }

  // Roster row now, Paid=false — the Stripe webhook flips it on payment. A
  // failed write here is loud but can't fail a signup whose invoice already
  // went out; the webhook backfills the row on payment if it finds none.
  const rowResult = await createMvfTournamentRegistration({
    parentName: data.parentName,
    parentEmail: data.email,
    parentPhone: data.phone,
    childFirstName: data.childFirstName,
    childLastName: data.childLastName,
    childDob: data.childDob,
    division: division.division as MvfTournamentDivisionSlug,
    resident: data.resident === true,
    amountUsd: priceUsd,
    stripeInvoiceId: invoice.id,
    smsConsent: data.smsConsent === true,
    smsConsentText: data.smsConsent ? SMS_CONSENT_TEXT : "",
    emergencyName: data.emergencyName,
    emergencyPhone: data.emergencyPhone,
    allergies: data.allergies ?? "",
  });
  if (rowResult !== "ok") {
    console.error(
      `[checkout-mvf-junior-tournament] roster row write ${rowResult} for invoice ${invoice.id} — webhook will backfill on payment`,
    );
  }

  // Both admin inboxes get an "invoice sent" heads-up. notifyInvoiceSent
  // never throws, so this can't fail a signup whose invoice already went out.
  await import("@/lib/signup-admin-notify").then(({ notifyInvoiceSent }) =>
    notifyInvoiceSent({
      kind: "mvf-junior-tournament",
      headline: `MVF Junior Tournament invoice sent`,
      parentName: data.parentName,
      parentEmail: data.email,
      parentPhone: data.phone,
      childFirstName: `${data.childFirstName} ${data.childLastName}`,
      amountUsd: priceUsd.toFixed(2),
      invoiceId: invoice.id,
      hostedUrl: invoice.hosted_invoice_url ?? null,
      dueDate: "7 days",
      details: [
        `Division: ${division.label} (${division.ageLabel})`,
        `Event: ${MVF_JUNIOR_TOURNAMENT_DATE_LABEL}, ${MVF_JUNIOR_TOURNAMENT_TIME_LABEL} — ${MVF_JUNIOR_TOURNAMENT_VENUE}`,
        `Entry: $${priceUsd.toFixed(2)} (${data.resident ? "MV resident" : "non-resident"}) — NGA $${ngaShareUsd} / MVF $${mvfShareUsd}`,
      ],
    }),
  );

  // MVF tournament: push the registrant onto the Link & Dink popup roster so
  // registration numbers show in real time and day-of tooling has the player.
  // Never throws — a sync miss is logged for hand retry; Notion stays source
  // of truth and the L&D endpoint is idempotent.
  await import("@/lib/linkdink-roster-sync").then(({ syncMvfRegistrationToLinkDink }) =>
    syncMvfRegistrationToLinkDink({
      division: division.division,
      childFirstName: data.childFirstName,
      childLastName: data.childLastName,
      parentEmail: data.email,
      parentPhone: data.phone,
    }),
  );

  // Branded NGA signup confirmation to the parent — sent at registration
  // (BEFORE payment), distinct from the webhook's post-payment "You're in".
  // Single primary CTA: the hosted pay link. Failures are logged, never
  // thrown — the invoice already went out and the success page works.
  try {
    const apiKey = process.env.RESEND_API_KEY;
    if (
      apiKey &&
      invoice.hosted_invoice_url &&
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)
    ) {
      const { Resend } = await import("resend");
      const {
        mvfTournamentSignupConfirmationSubject,
        mvfTournamentSignupConfirmationText,
        mvfTournamentSignupConfirmationHtml,
      } = await import("@/lib/email/mvf-tournament-signup-confirmation");
      const parentFirst = data.parentName.split(/\s+/)[0] || "there";
      const emailInput = {
        parentFirst,
        childFirst: data.childFirstName || "your player",
        divisionLabel: division.label,
        amountUsd: priceUsd.toFixed(2),
        residencyLabel: data.resident ? "MV resident" : "non-resident",
        payUrl: invoice.hosted_invoice_url,
      };
      const { error } = await new Resend(apiKey).emails.send({
        from: "Next Gen PB Academy <noreply@nextgenpbacademy.com>",
        to: data.email,
        bcc: "nextgenacademypb@gmail.com",
        replyTo: "nextgenacademypb@gmail.com",
        subject: mvfTournamentSignupConfirmationSubject({
          childFirst: emailInput.childFirst,
        }),
        html: mvfTournamentSignupConfirmationHtml(emailInput),
        text: mvfTournamentSignupConfirmationText(emailInput),
      });
      if (error) {
        console.error(
          "[checkout-mvf-junior-tournament] signup confirmation email rejected",
          error,
        );
      }
    }
  } catch (err) {
    console.error(
      "[checkout-mvf-junior-tournament] signup confirmation email failed",
      err,
    );
  }

  return NextResponse.json({
    invoiceId: invoice.id,
    url: invoice.hosted_invoice_url,
  });
}
