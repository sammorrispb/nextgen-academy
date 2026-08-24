import { Resend } from "resend";
import { getStripe } from "@/lib/stripe";
import {
  findFallRegByPaymentIntent,
  findFallRegByCheckoutSessionId,
  updateFallRegStatus,
  type FallRegistrationLookup,
} from "@/lib/notion-fall-registrations";
import {
  fallCancellationHtml,
  fallCancellationText,
  fallCancellationSubject,
} from "@/lib/email/fall-cancellation";
import {
  fallRefundPolicyFor,
  fallProratedRefundCents,
  todayET,
  type FallRefundPolicy,
  type FallCancelReason,
} from "@/lib/fall-refund-policy";
import { findFallSeasonGroup } from "@/data/fall-season-2026";

/**
 * Fall season cancel + refund.
 *
 * Structurally this mirrors cancelDropInRow (find row → flip Status → comms)
 * rather than cancelCamp, because fall DOES write a Notion roster row. The one
 * simplification: there is no seat decrement to do. The capacity guard in
 * /api/checkout-fall counts rows with Status = "Confirmed", so flipping a row
 * to Refunded/Cancelled frees the seat by construction.
 *
 * Refund AMOUNT is never decided here — fall-refund-policy.ts owns that.
 *
 * Fail-soft on comms: a Resend failure never rolls back a completed refund.
 * Idempotent: re-running on an already-cancelled row is a no-op, so a webhook
 * redelivery can't double-refund or double-email.
 */

const ADMIN_EMAIL = "nextgenacademypb@gmail.com";
const FROM_EMAIL = "Next Gen PB Academy <noreply@nextgenpbacademy.com>";
const REPLY_TO = "nextgenacademypb@gmail.com";
const SITE_ORIGIN =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://nextgenpbacademy.com";

export type FallCancelStatus = "Refunded" | "Cancelled";

export interface CancelFallInput {
  paymentIntentId?: string;
  checkoutSessionId?: string;
  /**
   * Override the policy's refund decision. Omit to let
   * fallRefundPolicyFor(todayET()) decide — that's the intended path.
   */
  refund?: FallRefundPolicy;
  /**
   * Who is cancelling. Defaults to a parent withdrawing (no refund under the
   * current terms). Pass "nga_cancelled" when NGA cannot deliver the sessions —
   * that prorates the undelivered ones back, whatever terms they bought under.
   */
  reason?: FallCancelReason;
}

export type CancelFallResult =
  | {
      ok: true;
      pageId: string;
      status: FallCancelStatus;
      refundedUsd: number;
      idempotent?: boolean;
      emailSent: boolean;
    }
  | {
      ok: false;
      reason:
        | "not_found"
        | "no_key"
        | "update_failed"
        | "refund_failed"
        | "partial_refund";
      message: string;
    };

/** Already terminal → nothing to do. Keeps webhook redelivery safe. */
function isTerminal(status: string): boolean {
  return status === "Refunded" || status === "Cancelled";
}

/**
 * Page Sam when a refund can't be reconciled to the roster. Stripe has already
 * returned the money at this point, so a stuck row with nobody told is the
 * exact failure this whole path exists to close — it must never be a bare
 * console.error. Fail-soft: an alert failure can't make things worse.
 */
async function alertAdmin(subject: string, body: string): Promise<boolean> {
  if (!process.env.RESEND_API_KEY) return false;
  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: ADMIN_EMAIL,
      replyTo: REPLY_TO,
      subject,
      text: body,
    });
    if (error) {
      console.error("[cancel-fall] admin alert rejected", error);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[cancel-fall] admin alert threw", err);
    return false;
  }
}

async function issueRefund(
  paymentIntentId: string,
  /** Omit for the whole charge; set for an NGA-cancelled prorated refund. */
  amountCents?: number,
): Promise<{ ok: true; usd: number } | { ok: false; message: string }> {
  try {
    const stripe = getStripe();
    const refund = await stripe.refunds.create({
      payment_intent: paymentIntentId,
      ...(amountCents !== undefined ? { amount: amountCents } : {}),
    });
    return { ok: true, usd: (refund.amount ?? 0) / 100 };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // Stripe says "already refunded" when a redelivery or a Dashboard click beat
    // us here. That's success from the roster's point of view, not a failure.
    if (/already been refunded|has already been refunded/i.test(message)) {
      return { ok: true, usd: 0 };
    }
    console.error("[cancel-fall] refund failed:", message);
    return { ok: false, message };
  }
}

async function sendCancellationEmail(
  row: FallRegistrationLookup,
  refundedUsd: number,
): Promise<boolean> {
  if (!process.env.RESEND_API_KEY || !row.parentEmail) return false;

  const option = findFallSeasonGroup(row.group);
  const input = {
    parentFirst: row.parentName.split(" ")[0] || row.parentName || "there",
    childFirst: row.childFirstName || "your player",
    groupLabel: option?.label ?? `${row.group} Ball`,
    refundedUsd: refundedUsd.toFixed(2),
    fallUrl: `${SITE_ORIGIN}/fall`,
  };

  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: row.parentEmail,
      bcc: ADMIN_EMAIL,
      replyTo: REPLY_TO,
      subject: fallCancellationSubject(input),
      html: fallCancellationHtml(input),
      text: fallCancellationText(input),
    });
    if (error) {
      console.error("[cancel-fall] cancellation email rejected", error);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[cancel-fall] cancellation email threw", err);
    return false;
  }
}

export async function cancelFallRegistration(
  input: CancelFallInput,
): Promise<CancelFallResult> {
  const { paymentIntentId, checkoutSessionId } = input;
  if (!paymentIntentId && !checkoutSessionId) {
    return {
      ok: false,
      reason: "no_key",
      message: "paymentIntentId or checkoutSessionId is required",
    };
  }

  const row = paymentIntentId
    ? await findFallRegByPaymentIntent(paymentIntentId)
    : await findFallRegByCheckoutSessionId(checkoutSessionId!);

  if (!row) {
    return { ok: false, reason: "not_found", message: "No fall roster row for that key" };
  }

  if (isTerminal(row.status)) {
    return {
      ok: true,
      pageId: row.pageId,
      status: row.status as FallCancelStatus,
      refundedUsd: 0,
      idempotent: true,
      emailSent: false,
    };
  }

  const today = todayET();
  const decision =
    input.refund ??
    fallRefundPolicyFor(today, {
      registeredOnIso: row.registeredOnIso || undefined,
      reason: input.reason,
    });

  // "prorated" only ever comes from an NGA-side cancellation. Before the season
  // starts every session is still owed, so this equals a full refund.
  const proratedCents =
    decision === "prorated"
      ? fallProratedRefundCents(today, Math.round(row.amountPaidUsd * 100))
      : 0;

  if (decision === "prorated" && proratedCents <= 0) {
    // Every session was delivered — there is nothing to give back, and issuing
    // a $0 refund would email the parent a refund cue for no money.
    return {
      ok: false,
      reason: "refund_failed",
      message:
        "NGA-cancelled after the last session — nothing left to prorate; cancel by hand if this is intentional.",
    };
  }

  let refundedUsd = 0;
  if (decision === "full" || decision === "prorated") {
    const pi =
      paymentIntentId ??
      (await (async () => {
        try {
          const stripe = getStripe();
          const cs = await stripe.checkout.sessions.retrieve(checkoutSessionId!);
          return typeof cs.payment_intent === "string"
            ? cs.payment_intent
            : (cs.payment_intent?.id ?? null);
        } catch {
          return null;
        }
      })());

    if (!pi) {
      return {
        ok: false,
        reason: "refund_failed",
        message: "Could not resolve a Payment Intent to refund",
      };
    }

    const refund = await issueRefund(
      pi,
      decision === "prorated" ? proratedCents : undefined,
    );
    if (!refund.ok) {
      // Do NOT flip the row — an un-refunded parent must stay on the roster so
      // the failure is visible and retryable rather than silently swallowed.
      return { ok: false, reason: "refund_failed", message: refund.message };
    }
    refundedUsd = refund.usd;
  }

  const status: FallCancelStatus =
    refundedUsd > 0 || decision === "full" ? "Refunded" : "Cancelled";

  const updated = await updateFallRegStatus(row.pageId, status);
  if (!updated) {
    return {
      ok: false,
      reason: "update_failed",
      message:
        refundedUsd > 0
          ? `Refunded $${refundedUsd.toFixed(2)} but the roster row did not flip — free the seat by hand.`
          : "Roster row did not flip",
    };
  }

  const emailSent = await sendCancellationEmail(row, refundedUsd);

  return { ok: true, pageId: row.pageId, status, refundedUsd, emailSent };
}

/** What Stripe actually did, read off the Charge — never inferred from the row. */
export interface ObservedRefund {
  /** Stripe's `charge.refunded` — true ONLY when the whole charge came back. */
  fullyRefunded: boolean;
  /** Stripe's `charge.amount_refunded`, in dollars. */
  amountRefundedUsd: number;
}

/**
 * Payment-Intent entrypoint used by the charge.refunded webhook branch.
 *
 * Stripe fires `charge.refunded` for PARTIAL refunds too, so the observed
 * refund must be passed in rather than assumed. Treating a partial refund as a
 * cancellation would pull a child off the roster over a fee adjustment and tell
 * the parent they got the full season price back. The amount emailed is always
 * what Stripe returned, never the row's sticker price.
 */
export async function cancelFallByPaymentIntent(
  paymentIntentId: string,
  refund: ObservedRefund,
): Promise<CancelFallResult> {
  // The money already moved (Stripe told us), so never try to refund again —
  // just reconcile the roster and tell the parent.
  const row = await findFallRegByPaymentIntent(paymentIntentId);
  if (!row) {
    return { ok: false, reason: "not_found", message: "No fall roster row for that PI" };
  }

  // PARTIAL refund → the family is still enrolled. Touch nothing, page Sam.
  if (!refund.fullyRefunded) {
    const message = `Partial refund of $${refund.amountRefundedUsd.toFixed(2)} on fall registration for ${row.childFirstName} (${row.group}, ${row.parentEmail}). The roster row was left Confirmed — they are STILL ENROLLED and still hold a seat. If this was meant to cancel the registration, do it through /api/cancel-fall-registration so the seat frees and the parent is emailed.`;
    await alertAdmin(
      `[NGA] Partial refund on a fall registration — no action taken`,
      message,
    );
    return { ok: false, reason: "partial_refund", message };
  }

  // Only "Refunded" is terminal here. A row already "Cancelled" (withdrawn with
  // no refund, per policy) that later receives a goodwill refund must still
  // reconcile to Refunded and tell the parent — money moved.
  if (row.status === "Refunded") {
    return {
      ok: true,
      pageId: row.pageId,
      status: "Refunded",
      refundedUsd: 0,
      idempotent: true,
      emailSent: false,
    };
  }

  const updated = await updateFallRegStatus(row.pageId, "Refunded");
  if (!updated) {
    const message = `Stripe refunded $${refund.amountRefundedUsd.toFixed(2)} for ${row.childFirstName} (${row.group}, ${row.parentEmail}) but the Notion roster row did NOT flip. The seat is still counted as Confirmed and cannot be resold, and the parent has NOT been emailed. Flip row ${row.pageId} to Refunded by hand.`;
    await alertAdmin(`[NGA] Fall refund could not be reconciled to the roster`, message);
    return { ok: false, reason: "update_failed", message };
  }

  const emailSent = await sendCancellationEmail(row, refund.amountRefundedUsd);
  return {
    ok: true,
    pageId: row.pageId,
    status: "Refunded",
    refundedUsd: refund.amountRefundedUsd,
    emailSent,
  };
}
