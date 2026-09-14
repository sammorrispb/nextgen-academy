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
 *
 * `sessionsPurchased` is what THIS family bought — not the block's length.
 * Defaults to the full block, which is what every row sold before mid-season
 * joining existed actually bought, so omitting it preserves the original
 * behaviour exactly.
 *
 * WHY IT IS AN ARGUMENT. This divided by the season's 6 sessions regardless of
 * what was purchased. That was correct while the block only ever sold whole,
 * and silently wrong the moment a family could join mid-season: a parent who
 * bought 3 sessions for $112.50 and then lost 2 to an NGA cancellation was
 * owed $75.00, but the season denominator returned ceil(11250 * 2/6) = $37.50.
 * Half, quietly, and only for prorated joiners — the population least likely
 * to know what they were owed. Pinned by
 * e2e/invariant-monday-girls-proration.spec.ts.
 */
export function mondayGirlsProratedRefundCents(
  todayIso: string,
  paidCents: number,
  sessionsPurchased: number = MONDAY_GIRLS_MONDAYS.length,
): number {
  const purchased = Math.min(
    Math.max(Math.round(sessionsPurchased), 0),
    MONDAY_GIRLS_MONDAYS.length,
  );
  if (purchased <= 0) return 0;
  // A family can never have more sessions left than they bought, but clamp
  // rather than trust: `todayIso` and the purchase date come from different
  // clocks (ET here, Notion's UTC `created_time` at the call site).
  const remaining = Math.min(mondayGirlsSessionsRemaining(todayIso), purchased);
  if (remaining <= 0) return 0;
  if (remaining >= purchased) return paidCents;
  return Math.min(paidCents, Math.ceil((paidCents * remaining) / purchased));
}

/**
 * How many sessions a roster row bought, inferred from the day it was created.
 *
 * The roster DB has no "sessions purchased" column and adding one is not free:
 * Notion 400s an entire page-create that names a property the database lacks,
 * and createMondayGirlsRegistrationResult does not go through the Source-only
 * fail-soft retry — so a schema change here would drop a paid registration on
 * the floor. The registration date already carries the answer, because the
 * price was computed from exactly this function on exactly that day.
 *
 * `registeredOnIso` is Notion's `created_time` sliced to a date, which is UTC:
 * an evening registration can read as the next day and understate the purchase
 * by one session. The refund clamp above keeps that from ever paying out more
 * than was paid, and Sam declined a wall-clock cutoff for the same edge on the
 * selling side.
 */
export function mondayGirlsSessionsPurchasedOn(registeredOnIso: string): number {
  if (!registeredOnIso) return MONDAY_GIRLS_MONDAYS.length;
  return Math.max(mondayGirlsSessionsRemaining(registeredOnIso), 1);
}
