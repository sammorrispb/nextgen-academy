// NGA Monday Girls drop-in — the per-session product for the Monday 6:00–7:00
// PM girls block at Earle B. Wood Middle School.
//
// PRICING SET BY SAM 2026-09-21: $35 per session.
//
// This sits ALONGSIDE the $225 season block (monday-girls-season-2026.ts), not
// instead of it: the block is the commitment product, the drop-in is the
// try-it product. Both share the block's single seat cap — a drop-in seat is a
// season seat for that Monday, so the checkout counts the same roster rows the
// season checkout counts.
//
// Safety posture matches the season page: the drop-in is sold from
// /monday-girls, which is deliberately NOINDEX (a girls-only youth group's
// exact time and place does not belong in search results).

import {
  MONDAY_GIRLS_BLOCK_SEATS,
  MONDAY_GIRLS_MONDAYS,
  MONDAY_GIRLS_SEASON_LABEL,
  MONDAY_GIRLS_TIME_LABEL,
  MONDAY_GIRLS_VENUE,
} from "./monday-girls-2026";

export const MONDAY_GIRLS_DROPIN_PRICE_USD = 35;
export const MONDAY_GIRLS_DROPIN_PRICE_ENV_VAR =
  "STRIPE_MONDAY_GIRLS_DROPIN_PRICE_ID";
export const MONDAY_GIRLS_DROPIN_TITLE = "Monday Girls Drop-In";
export const MONDAY_GIRLS_DROPIN_SLUG = "monday-girls-dropin";

/** Stripe checkout metadata kind for Monday Girls drop-in purchases. */
export const MONDAY_GIRLS_DROPIN_KIND = "monday-girls-dropin";

/** Mondays a drop-in can still be bought for (today or later, ET). */
export function mondayGirlsDropinSellableMondays(
  todayIso: string,
): string[] {
  return MONDAY_GIRLS_MONDAYS.filter((d) => d >= todayIso);
}

export {
  MONDAY_GIRLS_BLOCK_SEATS,
  MONDAY_GIRLS_SEASON_LABEL,
  MONDAY_GIRLS_TIME_LABEL,
  MONDAY_GIRLS_VENUE,
};
