import { PICKLPARK_SATURDAYS } from "@/data/picklpark-2026";

/**
 * Pickl Park Fall 2026 season refund policy.
 *
 * One axis — WHO cancelled — because unlike the Wood MS fall season this one
 * states its no-refund terms at the point of sale from day one, so there is no
 * grandfathered "sold under older terms" population and no EFFECTIVE_FROM date:
 *
 *   parent_withdrawal → the seat was held all season; no refund.
 *   nga_cancelled     → we did not deliver; prorate the undelivered sessions.
 *
 * A washout is still not a refund event on its own: the makeup date
 * (PICKLPARK_MAKEUP_DATES) is the stated remedy. Proration applies when NGA
 * cancels sessions outright and the makeup date cannot cover them.
 *
 * This file DECIDES; cancel-picklpark.ts only asks. If the policy changes,
 * change it here.
 *
 * Dates are ISO date-only strings compared lexicographically, never Date
 * arithmetic (repo rule — UTC build servers render a day early).
 */

export type PicklParkRefundPolicy = "full" | "none" | "prorated";

export type PicklParkCancelReason = "parent_withdrawal" | "nga_cancelled";

/** First Saturday of the season — derived, never re-typed. */
export const PICKLPARK_SEASON_START: string = PICKLPARK_SATURDAYS[0];

/** Today in Eastern, as `YYYY-MM-DD`. Matches the repo's todayET() pattern. */
export function todayET(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
  }).format(new Date());
}

export interface PicklParkRefundContext {
  /** Who is cancelling. Defaults to the parent withdrawing. */
  reason?: PicklParkCancelReason;
}

/**
 * Refund owed for a cancellation happening on `todayIso` (ET, `YYYY-MM-DD`).
 * A parent withdrawal is never refunded — the terms are stated at checkout,
 * in the form, and in the confirmation email from the first sale.
 */
export function picklParkRefundPolicyFor(
  _todayIso: string,
  ctx: PicklParkRefundContext = {},
): PicklParkRefundPolicy {
  // NGA failing to deliver is never the family's loss, whatever the terms.
  if (ctx.reason === "nga_cancelled") return "prorated";
  return "none";
}

/**
 * Sessions not yet delivered as of `todayIso`, today INCLUSIVE — a session
 * cancelled on its own morning has not been played, so the family is owed it.
 */
export function picklParkSessionsRemaining(todayIso: string): number {
  return PICKLPARK_SATURDAYS.filter((saturday) => saturday >= todayIso).length;
}

/**
 * Prorated refund in cents for an NGA-side cancellation on `todayIso`.
 * Rounds UP so rounding lands in the parent's favour, and never returns more
 * than they paid.
 */
export function picklParkProratedRefundCents(
  todayIso: string,
  paidCents: number,
): number {
  const total = PICKLPARK_SATURDAYS.length;
  const remaining = picklParkSessionsRemaining(todayIso);
  if (remaining <= 0) return 0;
  if (remaining >= total) return paidCents;
  return Math.min(paidCents, Math.ceil((paidCents * remaining) / total));
}
