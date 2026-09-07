import { MONDAY_GIRLS_MONDAYS } from "@/data/monday-girls-2026";

/**
 * NGA Monday Girls Beginner Group refund policy.
 *
 * One axis — WHO cancelled — because this block states its no-refund terms at
 * the point of sale from its first row, so there is no grandfathered "sold
 * under older terms" population and no EFFECTIVE_FROM date:
 *
 *   parent_withdrawal → the seat was held all block; no refund.
 *   nga_cancelled     → we did not deliver; prorate the undelivered sessions.
 *
 * A washout is NOT a refund event on its own: the rain dates
 * (MONDAY_GIRLS_RAIN_DATES) are the stated remedy. Proration applies when NGA
 * cancels sessions outright and the rain dates cannot cover them.
 *
 * This file DECIDES; cancel-monday-girls.ts only asks. If the policy changes,
 * change it here.
 *
 * Dates are ISO date-only strings compared lexicographically, never Date
 * arithmetic (repo rule — UTC build servers render a day early).
 */

export type MondayGirlsRefundPolicy = "full" | "none" | "prorated";

export type MondayGirlsCancelReason = "parent_withdrawal" | "nga_cancelled";

/** First Monday of the block — derived, never re-typed. */
export const MONDAY_GIRLS_SEASON_START: string = MONDAY_GIRLS_MONDAYS[0];

/** Today in Eastern, as `YYYY-MM-DD`. Matches the repo's todayET() pattern. */
export function todayET(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
  }).format(new Date());
}

export interface MondayGirlsRefundContext {
  /** Who is cancelling. Defaults to the parent withdrawing. */
  reason?: MondayGirlsCancelReason;
}

/**
 * Refund owed for a cancellation happening on `todayIso` (ET, `YYYY-MM-DD`).
 * A parent withdrawal is never refunded — the terms are stated at checkout, in
 * the form, and in the confirmation email from the first sale.
 */
export function mondayGirlsRefundPolicyFor(
  _todayIso: string,
  ctx: MondayGirlsRefundContext = {},
): MondayGirlsRefundPolicy {
  // NGA failing to deliver is never the family's loss, whatever the terms.
  if (ctx.reason === "nga_cancelled") return "prorated";
  return "none";
}

/**
 * Sessions not yet delivered as of `todayIso`, today INCLUSIVE — a session
 * cancelled on its own evening has not been played, so the family is owed it.
 *
 * Counts the block's real Mondays, which is why the skipped 2026-09-21 can
 * never be counted as owed: it is not in MONDAY_GIRLS_MONDAYS at all.
 */
export function mondayGirlsSessionsRemaining(todayIso: string): number {
  return MONDAY_GIRLS_MONDAYS.filter((monday) => monday >= todayIso).length;
}

/**
 * Prorated refund in cents for an NGA-side cancellation on `todayIso`.
 * Rounds UP so rounding lands in the parent's favour, and never returns more
 * than they paid.
 */
export function mondayGirlsProratedRefundCents(
  todayIso: string,
  paidCents: number,
): number {
  const total = MONDAY_GIRLS_MONDAYS.length;
  const remaining = mondayGirlsSessionsRemaining(todayIso);
  if (remaining <= 0) return 0;
  if (remaining >= total) return paidCents;
  return Math.min(paidCents, Math.ceil((paidCents * remaining) / total));
}
