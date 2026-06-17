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

/**
 * True when a failed `stripe.refunds.create` means the charge is ALREADY (fully)
 * refunded — i.e. the money is back and the caller should proceed to flip the
 * row rather than error out. A charge refunded out-of-band (Stripe Dashboard /
 * MCP / admin API) makes a later coach "full refund" fail, and Stripe phrases
 * that several ways: the `charge_already_refunded` code, "has already been
 * refunded", or an amount error like "greater than … unrefunded amount" /
 * "minus refunds already issued" (note: "refund" does NOT follow "already"
 * there, which is why a naive /already.*refund/ check missed it).
 */
export function isAlreadyRefundedError(err: unknown): boolean {
  const e = err as { code?: unknown; message?: unknown } | null | undefined;
  if (!e) return false;
  if (e.code === "charge_already_refunded") return true;
  const msg = typeof e.message === "string" ? e.message.toLowerCase() : "";
  if (!msg) return false;
  return (
    /already\s+(?:been\s+)?refund/.test(msg) || // "has already been refunded"
    /refunds?\s+already\s+issued/.test(msg) || // "minus refunds already issued"
    /greater than[^.]*unrefunded amount/.test(msg) || // over-refund on $0 left
    /greater than[^.]*amount available/.test(msg)
  );
}
