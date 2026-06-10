// Cluster season refund policy as a pure function, so the policy that goes in
// the FAQ is the policy the code executes (the league's policy lives only in
// copy — clusters fix that). Mirrors the league terms parents already see:
// $25 retained with 10+ business days' notice, non-refundable under 10 days.
// If NGA cancels a cluster (min-size miss, no coach/venue), the parent is
// always made whole.

const ADMIN_FEE_CENTS = 2500;
const FULL_REFUND_NOTICE_BUSINESS_DAYS = 10;

export type ClusterRefundReason = "min-size-miss" | "parent-cancel";

export function resolveClusterRefundCents(input: {
  paidCents: number;
  reason: ClusterRefundReason;
  businessDaysBeforeStart: number;
}): number {
  const paid = Math.max(0, Math.floor(input.paidCents));
  if (paid === 0) return 0;

  if (input.reason === "min-size-miss") return paid;

  if (input.businessDaysBeforeStart >= FULL_REFUND_NOTICE_BUSINESS_DAYS) {
    return Math.max(0, paid - ADMIN_FEE_CENTS);
  }
  return 0;
}
