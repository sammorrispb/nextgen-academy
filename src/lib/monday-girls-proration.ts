import { MONDAY_GIRLS_MONDAYS } from "@/data/monday-girls-2026";
import { mondayGirlsSessionsRemaining } from "@/lib/monday-girls-refund-policy";

/**
 * Mid-season joining for the Monday Girls block — what a family pays when they
 * arrive after the block has already started.
 *
 * WHY THIS EXISTS (Sam, 2026-09-14). The block used to stop selling the day
 * after session 1: it is a 6-session prepaid product, and charging the full
 * $225 in week four would bill a family for three sessions nobody delivered.
 * That was the right call while the only fix was a locked door. It also meant
 * every late family became a manual text-and-invoice conversation, and the
 * block sold 3 of 8 seats — so the door is now open all season and the PRICE
 * carries the fairness instead.
 *
 * The three terms Sam set, and the reason each is here rather than inferred:
 *
 *  - ROUND DOWN. Rounding lands in the parent's favour, matching the refund
 *    policy's posture (which rounds UP, in the same direction, for the same
 *    reason — the family never absorbs our arithmetic).
 *
 *  - NO TIME CUTOFF. Dates are date-only, so a family registering at 9pm on a
 *    Monday still pays for that evening's session. Accepted deliberately: the
 *    alternative is a wall-clock rule in a module that is otherwise pure and
 *    timezone-stable, to fix a case Sam would rather just refund by hand.
 *
 *  - A FLOOR OF 3 SESSIONS. Below that this is drop-in pricing for a peer
 *    block, and NGA already sells drop-ins. See MONDAY_GIRLS_MIN_SESSIONS_SOLD.
 *
 * Pure and date-injected (no `new Date()`, no `process.env`) so specs pin the
 * boundaries rather than the clock. ISO date-only strings compare
 * lexicographically — never Date arithmetic, which renders a day early on a UTC
 * build server.
 */

/**
 * Fewest sessions we will sell. At or above this the form is open and the price
 * is prorated; below it the page points at Coach Sam instead.
 *
 * Three, not one: the product these families bought is a small girls-only peer
 * group that builds over weeks. Two sessions is a pair of drop-ins wearing the
 * block's name, and the drop-in product already exists for that.
 */
export const MONDAY_GIRLS_MIN_SESSIONS_SOLD = 3;

/**
 * The sessions a family joining on `todayIso` will actually attend, in order.
 *
 * Today INCLUSIVE — someone registering the afternoon of a session is coming to
 * it. Derived from MONDAY_GIRLS_MONDAYS, so the skipped 2026-09-21 (Yom Kippur
 * + MCPS closure) can never appear here: it is not in that list at all.
 */
export function mondayGirlsRemainingMondays(
  todayIso: string,
): readonly string[] {
  return MONDAY_GIRLS_MONDAYS.filter((monday) => monday >= todayIso);
}

/** Whether the block can still be sold on `todayIso` — the floor, as a gate. */
export function mondayGirlsSellableOn(todayIso: string): boolean {
  return mondayGirlsSessionsRemaining(todayIso) >= MONDAY_GIRLS_MIN_SESSIONS_SOLD;
}

/**
 * What a family joining on `todayIso` owes, in cents, given the block's full
 * price in cents.
 *
 * Before the block starts this is the full price EXACTLY — no floor() drift on
 * the common path, so the three families who bought at sticker and everyone
 * buying today pay the same number to the cent.
 */
export function mondayGirlsJoinPriceCents(
  todayIso: string,
  fullPriceCents: number,
): number {
  const total = MONDAY_GIRLS_MONDAYS.length;
  const remaining = mondayGirlsSessionsRemaining(todayIso);
  if (remaining >= total) return fullPriceCents;
  if (remaining <= 0) return 0;
  // DOWN, in the parent's favour.
  return Math.floor((fullPriceCents * remaining) / total);
}

/** The same price as whole dollars-and-cents, for copy. */
export function mondayGirlsJoinPriceUsd(
  todayIso: string,
  fullPriceUsd: number,
): number {
  return mondayGirlsJoinPriceCents(todayIso, Math.round(fullPriceUsd * 100)) / 100;
}

/** Whether a join on `todayIso` is prorated rather than a full-block sale. */
export function mondayGirlsIsProratedOn(todayIso: string): boolean {
  return mondayGirlsSessionsRemaining(todayIso) < MONDAY_GIRLS_MONDAYS.length;
}
