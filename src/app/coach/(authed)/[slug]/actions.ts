"use server";

import { cookies } from "next/headers";
import { cancelDropIn } from "@/lib/cancel-dropin";
import {
  COACH_SESSION_COOKIE,
  verifySessionCookieValue,
} from "@/lib/coach-auth";
import { isAllowedCoachEmail } from "@/lib/coach-allowlist";
import {
  findDropInPageByCheckoutId,
  type AttendanceValue,
} from "@/lib/notion-dropins";
import { markAttendanceCore } from "@/lib/mark-attendance";
import { resolveRefundCents, type RefundOption } from "@/lib/refund-amount";
import { getStripe } from "@/lib/stripe";
import {
  executeSessionCancel,
  type SessionCancelInput,
  type SessionCancelResult,
} from "@/lib/session-cancel";

async function requireCoach(): Promise<string | null> {
  const c = await cookies();
  const value = c.get(COACH_SESSION_COOKIE)?.value;
  const email = value ? verifySessionCookieValue(value) : null;
  return email && isAllowedCoachEmail(email) ? email : null;
}

export interface CancelActionResult {
  ok: boolean;
  message: string;
}

export interface CancelRegistrationOptions {
  /** "none" (default) cancels without a refund; "full"/"partial" refund via Stripe. */
  refund?: RefundOption;
  /** Required when refund === "partial". Amount to return, in cents. */
  amountCents?: number;
}

export async function cancelRegistrationAction(
  checkoutSessionId: string,
  options: CancelRegistrationOptions = {},
): Promise<CancelActionResult> {
  const email = await requireCoach();
  if (!email) return { ok: false, message: "Unauthorized" };

  if (!checkoutSessionId?.trim()) {
    return { ok: false, message: "Missing checkoutSessionId" };
  }

  const refund = options.refund ?? "none";

  // ── No-refund path: cancel only, free the seat (unchanged behavior). ──
  if (refund === "none") {
    const result = await cancelDropIn(checkoutSessionId, "Cancelled");
    if (!result.ok) {
      return {
        ok: false,
        message:
          result.reason === "not_found"
            ? "Registration not found"
            : "Failed to update Notion",
      };
    }
    if (result.idempotent) return { ok: true, message: "Already cancelled" };
    return {
      ok: true,
      message: result.decremented ? "Cancelled · seat freed" : "Cancelled",
    };
  }

  // ── Refund path: validate amount, refund in Stripe, then flip to Refunded. ──
  const dropIn = await findDropInPageByCheckoutId(checkoutSessionId);
  if (!dropIn) return { ok: false, message: "Registration not found" };
  if (!dropIn.stripePaymentIntentId) {
    return { ok: false, message: "No payment on file to refund" };
  }

  const resolved = resolveRefundCents(
    refund,
    dropIn.amountPaidUsd,
    options.amountCents,
  );
  if (!resolved.ok) return { ok: false, message: resolved.message };

  const stripe = getStripe();
  try {
    await stripe.refunds.create({
      payment_intent: dropIn.stripePaymentIntentId,
      ...(resolved.amountCents ? { amount: resolved.amountCents } : {}),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // A prior refund means the money's already back — fall through to flip
    // the row's status rather than erroring the coach out.
    if (!/already.*refund/i.test(message)) {
      console.error("[cancel-registration] refund failed", dropIn.id, message);
      return { ok: false, message: "Stripe refund failed — nothing changed" };
    }
  }

  const refundedUsd = (resolved.amountCents ?? Math.round(dropIn.amountPaidUsd * 100)) / 100;

  // Flip to Refunded + send the refund-cue email with the actual amount. This
  // also sets Cancellation Notified, so the charge.refunded webhook that
  // Stripe fires for this same refund finds the row already Refunded and
  // no-ops — no duplicate email.
  const result = await cancelDropIn(checkoutSessionId, "Refunded", refundedUsd);
  if (!result.ok) {
    return {
      ok: false,
      message: "Refunded in Stripe, but updating Notion failed — check the row",
    };
  }
  return { ok: true, message: `Refunded $${refundedUsd.toFixed(2)} · seat freed` };
}

// ---------------------------------------------------------------------------
// Day-of attendance check-in — writes the roster row + an Open Brain activity
// on the parent's contact (the player profile system of record).
// ---------------------------------------------------------------------------

export interface AttendanceActionResult {
  ok: boolean;
  message: string;
  attendance?: AttendanceValue | "";
}

export async function markAttendanceAction(input: {
  checkoutSessionId: string;
  attended: AttendanceValue | "clear";
}): Promise<AttendanceActionResult> {
  const email = await requireCoach();
  if (!email) return { ok: false, message: "Unauthorized" };

  // The full fan-out (Notion write + OB activity + profile recompute + cache
  // revalidation) lives in the shared core so the secret-gated agent route
  // (/api/attendance) gets identical side-effects. We don't await result.obIngest
  // here — the coach UI stays non-blocking if Open Brain is slow.
  const result = await markAttendanceCore(input);
  return { ok: result.ok, message: result.message, attendance: result.attendance };
}

// ---------------------------------------------------------------------------
// Session-wide cancellation — coach-cookie auth wrapper. The cancel logic lives
// in @/lib/session-cancel (executeSessionCancel) so the signed-token email flow
// can reuse it without exposing an unauthenticated server action.
// ---------------------------------------------------------------------------

export async function cancelSessionAction(
  input: SessionCancelInput,
): Promise<SessionCancelResult> {
  const email = await requireCoach();
  if (!email) return { ok: false, message: "Unauthorized" };
  return executeSessionCancel(input);
}
