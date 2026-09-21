import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { createAndSendSignupInvoice } from "@/lib/stripe-invoices";
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

// Lesson sign-up — INVOICE-BASED. There are no fixed Stripe products/prices:
// the invoice line items are built from the sign-up form (lesson type, player
// count). Flow: validate -> waiver gate -> find-or-create customer -> create
// draft invoice -> add line items -> finalize -> Stripe emails the invoice ->
// parent pays on the hosted invoice page. The form redirects to our success
// page, which shows the invoice status and a Pay-now button; the invoice email
// is the fallback if the parent closes the tab.
//
// GROUP PRICING (confirmed by Sam 2026-09-21): $60 TOTAL for the hour — a
// single $60 line item, quantity 1, never per player. The player count is
// written into the line description + metadata so staff see the per-player
// split without it being a separate charge.
//
// Fail-closed on STRIPE_SECRET_KEY: without it there is no invoice to create,
// whatever the payload says. STRIPE_*_LESSON_PRICE_ID env vars are no longer
// read.

const NOT_OPEN_MESSAGE =
  "Online lesson booking isn't open yet — text Coach Sam at 301-325-4731 and he'll get you scheduled.";

export async function POST(req: NextRequest) {
  let body: Partial<LessonPurchaseData> & { submissionId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Fail closed on configuration BEFORE validating the form.
  try {
    getStripe();
  } catch {
    console.error("[checkout-lesson] not configured — STRIPE_SECRET_KEY is MISSING");
    return NextResponse.json({ error: NOT_OPEN_MESSAGE }, { status: 503 });
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

  // Group: the $60 total is one line item (quantity 1); the player count goes
  // in the description + metadata for staff visibility.
  const groupPlayers =
    data.lessonType === "group" ? Number(data.groupPlayers) || null : null;
  const lineDescription =
    data.lessonType === "group"
      ? `Group lesson — ${data.childFirstName} (${groupPlayers} players, $${LESSON_PRICE_USD} total split between the players)`
      : `Private lesson — ${data.childFirstName} ($${LESSON_PRICE_USD}/hr)`;

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
          description: lineDescription,
          amountCents: LESSON_PRICE_USD * 100,
          quantity: 1,
        },
      ],
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
      memo: `${product.title} — sign-up invoice`,
      footer:
        "A Next Gen coach will text you within one business day to lock in the hour.",
      daysUntilDue: 7,
      idempotencyKey: submissionId
        ? `lesson-${submissionId}`
        : undefined,
    });
  } catch (err) {
    console.error("[checkout-lesson] invoice creation failed", err);
    return NextResponse.json(
      {
        error:
          "We couldn't create your invoice — text Coach Sam at 301-325-4731 and he'll get you scheduled.",
      },
      { status: 502 },
    );
  }

  return NextResponse.json({
    invoiceId: invoice.id,
    url: invoice.hosted_invoice_url,
  });
}
