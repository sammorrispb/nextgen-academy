import { Resend } from "resend";
import { getStripe } from "@/lib/stripe";
import {
  findPicklParkRegByPaymentIntent,
  findPicklParkRegByCheckoutSessionId,
  updatePicklParkRegStatus,
  type PicklParkRegistrationLookup,
} from "@/lib/notion-picklpark-registrations";
import {
  picklParkCancellationHtml,
  picklParkCancellationText,
  picklParkCancellationSubject,
} from "@/lib/email/picklpark-cancellation";
import {
  picklParkRefundPolicyFor,
  picklParkProratedRefundCents,
  todayET,
  type PicklParkRefundPolicy,
  type PicklParkCancelReason,
} from "@/lib/picklpark-refund-policy";
import { findPicklParkSeasonGroup } from "@/data/picklpark-season-2026";

/**
 * Pickl Park season cancel + refund — structural mirror of cancel-fall.ts
 * (find row → refund per policy → flip Status → comms). The capacity guard in
 * /api/checkout-picklpark counts rows with Status = "Confirmed", so flipping a
 * row to Refunded/Cancelled frees the seat by construction.
 *
 * Refund AMOUNT is never decided here — picklpark-refund-policy.ts owns that.
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

export type PicklParkCancelStatus = "Refunded" | "Cancelled";

export interface CancelPicklParkInput {
  paymentIntentId?: string;
  checkoutSessionId?: string;
  /**
   * Override the policy's refund decision. Omit to let
   * picklParkRefundPolicyFor(todayET()) decide — that's the intended path.
   */
  refund?: PicklParkRefundPolicy;
  /**
   * Who is cancelling. Defaults to a parent withdrawing (no refund under the
   * stated terms). Pass "nga_cancelled" when NGA cannot deliver the sessions —
   * that prorates the undelivered ones back.
   */
  reason?: PicklParkCancelReason;
}

export type CancelPicklParkResult =
  | {
      ok: true;
      pageId: string;
      status: PicklParkCancelStatus;
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
 * returned the money at this point, so a stuck row with nobody told must never
 * be a bare console.error. Fail-soft: an alert failure can't make things worse.
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
      console.error("[cancel-picklpark] admin alert rejected", error);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[cancel-picklpark] admin alert threw", err);
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
    console.error("[cancel-picklpark] refund failed:", message);
    return { ok: false, message };
  }
}

async function sendCancellationEmail(
  row: PicklParkRegistrationLookup,
  refundedUsd: number,
): Promise<boolean> {
  if (!process.env.RESEND_API_KEY || !row.parentEmail) return false;

  const option = findPicklParkSeasonGroup(row.group);
  const input = {
    parentFirst: row.parentName.split(" ")[0] || row.parentName || "there",
    childFirst: row.childFirstName || "your player",
    groupLabel: option?.label ?? `${row.group} Ball`,
    refundedUsd: refundedUsd.toFixed(2),
    picklparkUrl: `${SITE_ORIGIN}/picklpark`,
  };

  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: row.parentEmail,
      bcc: ADMIN_EMAIL,
      replyTo: REPLY_TO,
      subject: picklParkCancellationSubject(input),
      html: picklParkCancellationHtml(input),
      text: picklParkCancellationText(input),
    });
    if (error) {
      console.error("[cancel-picklpark] cancellation email rejected", error);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[cancel-picklpark] cancellation email threw", err);
    return false;
  }
}

export async function cancelPicklParkRegistration(
  input: CancelPicklParkInput,
): Promise<CancelPicklParkResult> {
  const { paymentIntentId, checkoutSessionId } = input;
  if (!paymentIntentId && !checkoutSessionId) {
    return {
      ok: false,
      reason: "no_key",
      message: "paymentIntentId or checkoutSessionId is required",
    };
  }

  const row = paymentIntentId
    ? await findPicklParkRegByPaymentIntent(paymentIntentId)
    : await findPicklParkRegByCheckoutSessionId(checkoutSessionId!);

  if (!row) {
    return {
      ok: false,
      reason: "not_found",
      message: "No Pickl Park roster row for that key",
    };
  }

  if (isTerminal(row.status)) {
    return {
      ok: true,
      pageId: row.pageId,
      status: row.status as PicklParkCancelStatus,
      refundedUsd: 0,
      idempotent: true,
      emailSent: false,
    };
  }

  const today = todayET();
  const decision =
    input.refund ?? picklParkRefundPolicyFor(today, { reason: input.reason });

  // "prorated" only ever comes from an NGA-side cancellation. Before the season
  // starts every session is still owed, so this equals a full refund.
  const proratedCents =
    decision === "prorated"
      ? picklParkProratedRefundCents(today, Math.round(row.amountPaidUsd * 100))
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

  const status: PicklParkCancelStatus =
    refundedUsd > 0 || decision === "full" ? "Refunded" : "Cancelled";

  const updated = await updatePicklParkRegStatus(row.pageId, status);
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
export interface ObservedPicklParkRefund {
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
export async function cancelPicklParkByPaymentIntent(
  paymentIntentId: string,
  refund: ObservedPicklParkRefund,
): Promise<CancelPicklParkResult> {
  // The money already moved (Stripe told us), so never try to refund again —
  // just reconcile the roster and tell the parent.
  const row = await findPicklParkRegByPaymentIntent(paymentIntentId);
  if (!row) {
    return {
      ok: false,
      reason: "not_found",
      message: "No Pickl Park roster row for that PI",
    };
  }

  // PARTIAL refund → the family is still enrolled. Touch nothing, page Sam.
  if (!refund.fullyRefunded) {
    const message = `Partial refund of $${refund.amountRefundedUsd.toFixed(2)} on Pickl Park registration for ${row.childFirstName} (${row.group}, ${row.parentEmail}). The roster row was left Confirmed — they are STILL ENROLLED and still hold a seat. If this was meant to cancel the registration, do it through /api/cancel-picklpark-registration so the seat frees and the parent is emailed.`;
    await alertAdmin(
      `[NGA] Partial refund on a Pickl Park registration — no action taken`,
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

  const updated = await updatePicklParkRegStatus(row.pageId, "Refunded");
  if (!updated) {
    const message = `Stripe refunded $${refund.amountRefundedUsd.toFixed(2)} for ${row.childFirstName} (${row.group}, ${row.parentEmail}) but the Notion roster row did NOT flip. The seat is still counted as Confirmed and cannot be resold, and the parent has NOT been emailed. Flip row ${row.pageId} to Refunded by hand.`;
    await alertAdmin(
      `[NGA] Pickl Park refund could not be reconciled to the roster`,
      message,
    );
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
