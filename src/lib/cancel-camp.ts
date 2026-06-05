import { Resend } from "resend";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { resolveRefundCents, type RefundOption } from "@/lib/refund-amount";
import {
  markPlayerWithdrawnFromCamp,
  type PlayerSyncResult,
} from "@/lib/notion-player-sync";
import { ingestToOpenBrain } from "@/lib/open-brain-ingest";
import {
  campCancellationHtml,
  campCancellationText,
} from "@/lib/email/camp-cancellation";
import { sendSms } from "@/lib/sms";

/**
 * Camp refund + deregister. Summer Camp is a separate product from the $20
 * drop-in: camp checkouts carry kind=camp metadata and write NO Notion roster
 * row, so the existing drop-in cancel paths (cancelDropIn / charge.refunded
 * webhook) are a no-op for camps. This is the camp equivalent — it keys off the
 * Stripe Checkout Session (the only durable record), issues the Stripe refund,
 * and deregisters the camper in the two systems that DO hold a camp footprint:
 * the Player CRM (Status → Inactive + dated note) and Open Brain (a withdrawal
 * activity). Mirrors cancelRegistrationAction's Stripe refund + already-refunded
 * idempotency, and cancelDropIn's fail-soft comms discipline.
 */

const ADMIN_EMAIL = "nextgenacademypb@gmail.com";
const FROM_EMAIL = "Next Gen PB Academy <noreply@nextgenpbacademy.com>";
const REPLY_TO = "nextgenacademypb@gmail.com";
const SITE_ORIGIN =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://nextgenpbacademy.com";

export interface CancelCampInput {
  checkoutSessionId?: string;
  parentEmail?: string;
  /** "none" deregisters without a refund; "full"/"partial" refund via Stripe. Default "full". */
  refund?: RefundOption;
  /** Required when refund === "partial". Amount to return, in cents. */
  amountCents?: number;
}

export type CancelCampResult =
  | {
      ok: true;
      checkoutSessionId: string;
      refundedUsd: number;
      playerUpdated: PlayerSyncResult;
      emailSent: boolean;
    }
  | {
      ok: false;
      reason:
        | "not_found"
        | "not_camp"
        | "not_paid"
        | "no_payment"
        | "invalid_amount"
        | "refund_failed";
      message: string;
    };

function metaString(meta: Stripe.Metadata | null | undefined, key: string): string {
  const v = meta?.[key];
  return typeof v === "string" ? v : "";
}

/**
 * Pure pick of the session to act on from a candidate list (already narrowed to
 * one parent's sessions): the most recent PAID camp checkout. Kept pure so it's
 * unit-testable without Stripe — see e2e/cancel-camp.spec.ts.
 */
export function pickRefundableCampSession(
  sessions: Stripe.Checkout.Session[],
): Stripe.Checkout.Session | null {
  const paidCamps = sessions
    .filter(
      (s) => s.payment_status === "paid" && s.metadata?.kind === "camp",
    )
    .sort((a, b) => (b.created ?? 0) - (a.created ?? 0));
  return paidCamps[0] ?? null;
}

async function findCampSessionByEmail(
  stripe: Stripe,
  email: string,
): Promise<Stripe.Checkout.Session | null> {
  const target = email.trim().toLowerCase();
  const matches: Stripe.Checkout.Session[] = [];
  let scanned = 0;
  // Checkout Sessions can't be server-filtered by email, so page newest-first
  // and match client-side. Cap the scan so a never-matching email can't run
  // away on a large account.
  for await (const session of stripe.checkout.sessions.list({ limit: 100 })) {
    scanned += 1;
    const sessionEmail = (
      session.customer_details?.email ??
      session.customer_email ??
      metaString(session.metadata, "parent_email")
    ).toLowerCase();
    if (sessionEmail === target && session.metadata?.kind === "camp") {
      matches.push(session);
      if (matches.length >= 5) break;
    }
    if (scanned >= 1000) break;
  }
  return pickRefundableCampSession(matches);
}

export async function cancelCampRegistration(
  input: CancelCampInput,
): Promise<CancelCampResult> {
  const stripe = getStripe();
  const refund: RefundOption = input.refund ?? "full";

  // 1. Resolve the camp Checkout Session.
  let session: Stripe.Checkout.Session | null = null;
  if (input.checkoutSessionId?.trim()) {
    try {
      session = await stripe.checkout.sessions.retrieve(
        input.checkoutSessionId.trim(),
      );
    } catch {
      return { ok: false, reason: "not_found", message: "Checkout session not found" };
    }
  } else if (input.parentEmail?.trim()) {
    session = await findCampSessionByEmail(stripe, input.parentEmail);
    if (!session) {
      return {
        ok: false,
        reason: "not_found",
        message: `No paid camp checkout found for ${input.parentEmail}`,
      };
    }
  } else {
    return {
      ok: false,
      reason: "not_found",
      message: "Provide checkoutSessionId or parentEmail",
    };
  }

  if (session.metadata?.kind !== "camp") {
    return { ok: false, reason: "not_camp", message: "Session is not a camp registration" };
  }
  if (session.payment_status !== "paid") {
    return { ok: false, reason: "not_paid", message: `Session is ${session.payment_status}, not paid` };
  }

  const m = session.metadata;
  const amountPaidUsd = (session.amount_total ?? 0) / 100;
  const piId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : (session.payment_intent?.id ?? null);

  // 2. Refund (unless refund === "none").
  let refundedUsd = 0;
  if (refund !== "none") {
    if (!piId) {
      return { ok: false, reason: "no_payment", message: "No payment intent to refund" };
    }
    const resolved = resolveRefundCents(refund, amountPaidUsd, input.amountCents);
    if (!resolved.ok) {
      return { ok: false, reason: "invalid_amount", message: resolved.message };
    }
    try {
      await stripe.refunds.create({
        payment_intent: piId,
        ...(resolved.amountCents ? { amount: resolved.amountCents } : {}),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      // A prior refund means the money's already back — fall through to
      // deregister/comms rather than erroring out (webhook-retry idempotency).
      if (!/already.*refund/i.test(message)) {
        console.error("[cancel-camp] refund failed", session.id, message);
        return { ok: false, reason: "refund_failed", message: "Stripe refund failed — nothing changed" };
      }
    }
    refundedUsd = (resolved.amountCents ?? Math.round(amountPaidUsd * 100)) / 100;
  }

  // 3. Deregister (Player CRM + Open Brain) and comms — all fail-soft so a
  //    Notion/email blip never rolls back a completed refund.
  const parentName = metaString(m, "parent_name");
  const parentEmail =
    session.customer_details?.email ??
    session.customer_email ??
    metaString(m, "parent_email") ??
    null;
  const parentPhone = metaString(m, "parent_phone");
  const childFirst = metaString(m, "child_first_name");
  const campTitle = metaString(m, "camp_title");
  const campWeek = metaString(m, "camp_week");
  const optionLabel = metaString(m, "option_label");

  const today = new Date().toISOString().slice(0, 10);
  const note =
    refund === "none"
      ? `Withdrawn from ${campTitle} (${campWeek}) — ${today}.`
      : `Withdrawn from ${campTitle} (${campWeek}) — $${refundedUsd.toFixed(2)} refunded ${today}.`;

  const playerUpdated = await markPlayerWithdrawnFromCamp({
    parentEmail,
    parentPhone,
    childFirstName: childFirst,
    note,
    status: "Inactive",
  });

  await ingestToOpenBrain({
    business: "nga",
    source: "nga_camp_refund",
    name: parentName,
    email: parentEmail || undefined,
    phone: parentPhone || undefined,
    interest: `${campTitle} (${optionLabel}) — withdrawn`,
    metadata: {
      camp_title: campTitle,
      camp_week: campWeek,
      option: optionLabel,
      child_first_name: childFirst,
      refunded_usd: refundedUsd.toFixed(2),
      stripe_session: session.id,
    },
  });

  const emailSent = await sendCampCancellationEmail({
    parentEmail,
    parentName,
    childFirst,
    campTitle,
    campWeek,
    optionLabel,
    refundedUsd,
  });

  if (parentPhone && metaString(m, "sms_consent") === "true") {
    try {
      await sendSms({
        to: parentPhone,
        body: `Coach Sam, Next Gen PB: ${childFirst || "your camper"} is off the ${campTitle} roster${refundedUsd > 0 ? ` and your $${refundedUsd.toFixed(2)} is on the way back` : ""}. Reply with questions.`,
        consent: true,
        tag: `camp-cancel:${session.id}`,
      });
    } catch (err) {
      console.error("[cancel-camp] cancel sms threw", err);
    }
  }

  return {
    ok: true,
    checkoutSessionId: session.id,
    refundedUsd,
    playerUpdated,
    emailSent,
  };
}

async function sendCampCancellationEmail(input: {
  parentEmail: string | null;
  parentName: string;
  childFirst: string;
  campTitle: string;
  campWeek: string;
  optionLabel: string;
  refundedUsd: number;
}): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (
    !apiKey ||
    !input.parentEmail ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.parentEmail)
  ) {
    return false;
  }

  const payload = {
    parentFirst: (input.parentName || "").split(/\s+/)[0] || "there",
    childFirst: input.childFirst || "your camper",
    campTitle: input.campTitle,
    campWeek: input.campWeek,
    optionLabel: input.optionLabel,
    refundedUsd: input.refundedUsd > 0 ? input.refundedUsd.toFixed(2) : "0.00",
    campsUrl: `${SITE_ORIGIN}/schedule`,
  };

  try {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: input.parentEmail,
      bcc: ADMIN_EMAIL,
      replyTo: REPLY_TO,
      subject: `Cancellation confirmed — ${input.campTitle}`,
      html: campCancellationHtml(payload),
      text: campCancellationText(payload),
    });
    if (error) {
      console.error("[cancel-camp] Resend rejected camp cancellation", error);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[cancel-camp] camp cancellation email threw", err);
    return false;
  }
}
