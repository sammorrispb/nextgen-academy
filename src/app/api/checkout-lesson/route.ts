import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { createAndSendSignupInvoice, type SignupInvoiceResult } from "@/lib/stripe-invoices";
import { parseSubmissionId } from "@/lib/submission-key";
import {
  GROUP_LESSON_PRICE_PER_PLAYER_USD,
  LESSON_CHECKOUT_KIND,
  PRIVATE_LESSON_PRICE_USD,
  findLessonProduct,
  lessonTotalUsd,
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
import { invoiceSafeName } from "@/lib/invoice-text";
import { notifyInvoiceSent } from "@/lib/signup-admin-notify";
import { createRateLimiter, getClientIp } from "@/lib/rate-limit";

// Per IP (best-effort, in-memory): each request can make NGA's Stripe account
// email an invoice to the address typed in (security review 2026-09-28, H2).
const invoiceLimiter = createRateLimiter({ limit: 20 });


// Lesson sign-up — INVOICE-BASED. There are no fixed Stripe products/prices:
// the invoice line items are built from the sign-up form (lesson type, player
// count). Flow: validate -> waiver gate -> find-or-create customer -> create
// draft invoice -> add line items -> finalize -> Stripe emails the invoice ->
// parent pays on the hosted invoice page. The form redirects to our success
// page, which shows the invoice status and a Pay-now button; the invoice email
// is the fallback if the parent closes the tab.
//
// PRICING (Sam, 2026-09-29) comes from src/data/lessons.ts: a private lesson
// is one PRIVATE_LESSON_PRICE_USD line; a group is one line of
// GROUP_LESSON_PRICE_PER_PLAYER_USD times the validated player count, with
// the count in the line description + metadata so staff see what was billed.
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

  if (invoiceLimiter.isRateLimited(getClientIp(req))) {
    return NextResponse.json(
      { error: "Too many sign-ups from this connection. Please try again in a bit, or text Coach Sam at 301-325-4731 and he'll get you in." },
      { status: 429 },
    );
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

  // Group: one line item priced per player; the player count goes in the
  // description + metadata for staff visibility.
  const groupPlayers =
    data.lessonType === "group" ? Number(data.groupPlayers) || null : null;
  const totalUsd = lessonTotalUsd(product.type, groupPlayers ?? undefined);
  const lineDescription =
    data.lessonType === "group"
      ? `Group lesson — ${invoiceSafeName(data.childFirstName)} (${groupPlayers} players × $${GROUP_LESSON_PRICE_PER_PLAYER_USD})`
      : `Private lesson — ${invoiceSafeName(data.childFirstName)} ($${PRIVATE_LESSON_PRICE_USD}/hr)`;

  // A retry carrying the same id replays this sign-up's invoice rather than
  // sending a second one.
  const submissionId = parseSubmissionId(body.submissionId);

  let result: SignupInvoiceResult;
  try {
    result = await createAndSendSignupInvoice({
      customerEmail: data.email,
      customerName: invoiceSafeName(data.parentName, ""),
      items: [
        {
          description: lineDescription,
          amountCents: totalUsd * 100,
          quantity: 1,
        },
      ],
      metadata: {
        kind: LESSON_CHECKOUT_KIND,
        lesson_type: product.type,
        lesson_title: product.title,
        lesson_slug: product.slug,
        // Group-lesson player count: the line is priced per player. Private
        // lessons omit it (single player).
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
        "After payment, pick your lesson time at nextgenpbacademy.com/lessons/book — a coach confirms within a day.",
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
  const { invoice, alreadySent } = result;

  // Both admin inboxes get an "invoice sent" heads-up — once per invoice, so
  // not on a retry. notifyInvoiceSent never throws, so this can't fail a
  // signup whose invoice already went out.
  if (!alreadySent) {
    await notifyAdminInvoiceSent(
      invoice,
      product,
      data,
      product.type === "group" ? groupPlayers : null,
      totalUsd,
    );
  } else {
    console.info(
      `[checkout-lesson] retry of a sign-up whose invoice ${invoice.id} already went out — not announcing it again`,
    );
  }

  return NextResponse.json({
    invoiceId: invoice.id,
    url: invoice.hosted_invoice_url,
  });
}

async function notifyAdminInvoiceSent(
  invoice: { id: string; hosted_invoice_url?: string | null },
  product: { type: string; title: string },
  data: {
    parentName: string;
    email: string;
    phone: string;
    childFirstName: string;
  },
  groupPlayers: number | null,
  totalUsd: number,
): Promise<void> {
  // Fire-and-forget: notifyInvoiceSent never throws, so a Resend hiccup
  // can't fail a signup whose invoice is already emailed.
  await notifyInvoiceSent({
    kind: "lesson",
    headline: `${product.title} invoice sent`,
    parentName: data.parentName,
    parentEmail: data.email,
    parentPhone: data.phone,
    childFirstName: data.childFirstName,
    amountUsd: totalUsd.toFixed(2),
    invoiceId: invoice.id,
    hostedUrl: invoice.hosted_invoice_url ?? null,
    dueDate: "7 days",
    details: [
      `${product.title}${groupPlayers != null ? ` — ${groupPlayers} players × $${GROUP_LESSON_PRICE_PER_PLAYER_USD}` : ""}`,
    ],
  });
}
