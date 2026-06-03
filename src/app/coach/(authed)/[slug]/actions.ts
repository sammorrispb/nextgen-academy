"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { cancelDropIn } from "@/lib/cancel-dropin";
import {
  COACH_SESSION_COOKIE,
  verifySessionCookieValue,
} from "@/lib/coach-auth";
import { isAllowedCoachEmail } from "@/lib/coach-allowlist";
import {
  findDropInPageByCheckoutId,
  setDropInAttendance,
  type AttendanceValue,
} from "@/lib/notion-dropins";
import { sessionToSlug } from "@/lib/session-slug";
import { ingestToOpenBrain } from "@/lib/open-brain-ingest";
import { recomputePlayerAttendance } from "@/lib/notion-player-sync";
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

  if (!input.checkoutSessionId?.trim()) {
    return { ok: false, message: "Missing checkoutSessionId" };
  }
  const value: AttendanceValue | null =
    input.attended === "clear" ? null : input.attended;
  if (value !== null && value !== "Present" && value !== "No-show") {
    return { ok: false, message: "Invalid attendance value" };
  }

  const dropIn = await findDropInPageByCheckoutId(input.checkoutSessionId);
  if (!dropIn) return { ok: false, message: "Registration not found" };

  const ok = await setDropInAttendance(dropIn.id, value);
  if (!ok) return { ok: false, message: "Failed to update Notion" };

  // Tie the check-in to the player's Open Brain profile. Keyed on parent
  // email/phone (OB dedups to the existing contact); fire-and-forget so a
  // slow OB never blocks the coach. Only fires for a real Present/No-show.
  if (value && (dropIn.parentEmail || dropIn.parentPhone)) {
    void ingestToOpenBrain({
      business: "nga",
      source: "nga_attendance",
      email: dropIn.parentEmail || undefined,
      phone: dropIn.parentPhone || undefined,
      name: dropIn.parentName || undefined,
      interest: dropIn.childFirstName || undefined,
      metadata: {
        child_first_name: dropIn.childFirstName,
        child_birth_year: dropIn.childBirthYear || undefined,
        session_title: dropIn.sessionTitle,
        session_date: dropIn.sessionDate,
        session_start_time: dropIn.sessionStartTime,
        location: dropIn.location,
        attendance: value,
      },
    });
  }

  // Recompute the child's attendance stats on their player profile. Runs for
  // every change (Present / No-show / clear) so the count stays exact — e.g.
  // clearing a Present row decrements it. Reads the drop-in rows we just wrote,
  // so it reflects this toggle. Awaited but never fatal to the check-in.
  if (dropIn.parentEmail || dropIn.parentPhone) {
    await recomputePlayerAttendance({
      parentEmail: dropIn.parentEmail || null,
      parentPhone: dropIn.parentPhone || "",
      childFirstName: dropIn.childFirstName,
    });
  }

  const slug = sessionToSlug({
    title: dropIn.sessionTitle,
    date: dropIn.sessionDate,
  });
  if (slug) revalidatePath(`/coach/${slug}`);
  revalidatePath("/coach");

  return { ok: true, message: value ?? "Cleared", attendance: value ?? "" };
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
