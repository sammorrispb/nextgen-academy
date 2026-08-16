import { FALL_SUNDAYS } from "@/data/fall-2026";

/**
 * Fall 2026 season refund policy (set by Sam, 2026-08-16).
 *
 *   Before the season starts → full refund.
 *   On or after the first Sunday → no refund.
 *
 * A season-wide washout is deliberately NOT refundable: the two rain dates
 * (FALL_RAIN_DATES) are the stated remedy, so there is no prorating here and no
 * season-wide refund fan-out. If that policy ever changes, this file is the one
 * place to change it — cancel-fall.ts asks, it never decides.
 *
 * Dates are ISO date-only strings compared lexicographically, never Date
 * arithmetic: `new Date(y, m, d)` renders a day early on the UTC build server
 * (repo rule, burned twice 2026-05-24).
 */

export type FallRefundPolicy = "full" | "none";

/** First Sunday of the season — derived, never re-typed. */
export const FALL_SEASON_START: string = FALL_SUNDAYS[0];

/** Today in Eastern, as `YYYY-MM-DD`. Matches the repo's todayET() pattern. */
export function todayET(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
  }).format(new Date());
}

/**
 * Refund owed for a cancellation happening on `todayIso` (ET, `YYYY-MM-DD`).
 * The first Sunday counts as "season started" — a parent who cancels the
 * morning of week 1 has had the seat held for them all along.
 */
export function fallRefundPolicyFor(todayIso: string): FallRefundPolicy {
  return todayIso < FALL_SEASON_START ? "full" : "none";
}
