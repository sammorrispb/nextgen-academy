// NGA Monday Girls Beginner Group, Fall 2026 — the BOOKABLE product. Terms set
// by Sam 2026-08-23 ($225 for the block, paid up front), rescheduled 2026-09-04
// to skip the Yom Kippur / MCPS closure.
//
// WHY $225 — the same number the Walter Johnson Sunday season and the Pickl
// Park Saturday season charge. It buys 6 × 60 min here against Walter Johnson's
// 6 × 90; what closes that gap is the group, not the clock. This is a four-seat
// peer block, so a player gets roughly a quarter of a coach's attention for the
// full hour rather than a share of a larger court — and the girls-only cohort
// is the thing these families said yes to.
//
// Until 2026-09-07 this block had NO Stripe product at all and payment was
// collected by hand, one text at a time. That is what this file ends.
//
// Registration ships DARK by the league convention: /api/checkout-monday-girls
// returns 503 until STRIPE_MONDAY_GIRLS_PRICE_ID is set, and /monday-girls
// hides the form until the same env var is present (see
// monday-girls-registration-window.ts). So no family can ever reach a checkout
// that cannot charge, and no price is quoted before it exists.

import {
  MONDAY_GIRLS_END_TIME,
  MONDAY_GIRLS_GROUP,
  MONDAY_GIRLS_SLOTS_BY_GROUP,
  MONDAY_GIRLS_START_TIME,
  type MondayGirlsGroup,
} from "./monday-girls-2026";

export type MondayGirlsSeasonGroup = MondayGirlsGroup;

export const MONDAY_GIRLS_SEASON_SLUG = "monday-girls-fall-2026";
export const MONDAY_GIRLS_SEASON_TITLE = "Next Gen Monday Girls Beginner Group";
export const MONDAY_GIRLS_SEASON_PRICE_USD = 225;
export const MONDAY_GIRLS_SEASON_PRICE_ENV_VAR = "STRIPE_MONDAY_GIRLS_PRICE_ID";

export interface MondayGirlsSeasonGroupOption {
  group: MondayGirlsSeasonGroup;
  /** Parent-facing name for the one group. */
  label: string;
  /** "6:00–7:00 PM" */
  timeLabel: string;
}

export const MONDAY_GIRLS_SEASON_GROUP: MondayGirlsSeasonGroupOption = {
  group: MONDAY_GIRLS_GROUP,
  label: "Girls Beginner",
  timeLabel: `${MONDAY_GIRLS_START_TIME}–${MONDAY_GIRLS_END_TIME}`.replace(
    " PM–",
    "–",
  ),
};

export const MONDAY_GIRLS_SEASON_GROUPS: readonly MondayGirlsSeasonGroupOption[] =
  [MONDAY_GIRLS_SEASON_GROUP];

/**
 * Seats in the group. Per-group signature even though there is exactly one
 * group, so a second cohort can never be gated on this one's fill.
 */
export function mondayGirlsSeasonSlotsFor(
  group: MondayGirlsSeasonGroup,
): number {
  return MONDAY_GIRLS_SLOTS_BY_GROUP[group];
}

export function findMondayGirlsSeasonGroup(
  group: string | undefined,
): MondayGirlsSeasonGroupOption | undefined {
  return MONDAY_GIRLS_SEASON_GROUPS.find((g) => g.group === group);
}
