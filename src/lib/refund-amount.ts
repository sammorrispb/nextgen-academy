/**
 * Pure validation for a coach-initiated per-row refund. Kept out of the
 * "use server" actions file (which may only export async functions) so it can
 * be unit-tested directly.
 *
 * Returns the amount in cents to pass to stripe.refunds.create:
 *   - amountCents omitted  → Stripe refunds the full charge
 *   - amountCents present  → partial refund of exactly that many cents
 */
export type RefundOption = "none" | "full" | "partial";

export type ResolveRefundResult =
  | { ok: true; amountCents?: number }
  | { ok: false; message: string };

export function resolveRefundCents(
  option: "full" | "partial",
  amountPaidUsd: number,
  requestedCents?: number,
): ResolveRefundResult {
  const paidCents = Math.round((amountPaidUsd || 0) * 100);
  if (paidCents <= 0) {
    return { ok: false, message: "No charge amount on file to refund" };
  }

  if (option === "full") {
    return { ok: true }; // omit amount → Stripe refunds the whole charge
  }

  // partial
  if (requestedCents == null || !Number.isFinite(requestedCents)) {
    return { ok: false, message: "Enter a refund amount" };
  }
  if (!Number.isInteger(requestedCents) || requestedCents <= 0) {
    return { ok: false, message: "Refund amount must be a positive number" };
  }
  if (requestedCents > paidCents) {
    return {
      ok: false,
      message: `Refund can't exceed the $${(paidCents / 100).toFixed(2)} paid`,
    };
  }
  return { ok: true, amountCents: requestedCents };
}
