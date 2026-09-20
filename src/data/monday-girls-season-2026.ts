// NGA Monday Girls Beginner Group, Fall 2026 — the BOOKABLE product. Terms set
// by Sam 2026-08-23 ($225 for the block, paid up front), rescheduled 2026-09-04
// to skip the Yom Kippur / MCPS closure.
//
// WHY $225 — the same number the Walter Johnson Sunday season and the Pickl
// Park Saturday season charge. It buys 6 × 60 min here against Walter Johnson's
// 6 × 90; what closes that gap is the group, not the clock. It is a small peer
// block on one court (see MONDAY_GIRLS_SLOTS_BY_GROUP for the derived cap —
// never restate the number here, that is how the fall season's copy drifted),
// so a player gets real coaching time every week rather than a place in a
// line — and the girls-only cohort is the thing these families said yes to.
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
  MONDAY_GIRLS_ADVANCED_BEGINNER,
  MONDAY_GIRLS_BEGINNER,
  MONDAY_GIRLS_BLOCK_SEATS,
  MONDAY_GIRLS_LEVELS,
  MONDAY_GIRLS_TIME_LABEL,
  type MondayGirlsGroup,
} from "./monday-girls-2026";

export type MondayGirlsSeasonGroup = MondayGirlsGroup;

export const MONDAY_GIRLS_SEASON_SLUG = "monday-girls-fall-2026";
// Display only (Stripe payment description + email subject); the SLUG is the
// key. Dropped "Beginner" 2026-09-20 so an advanced-beginner family is not
// emailed a receipt for a group they did not join.
export const MONDAY_GIRLS_SEASON_TITLE = "Next Gen Monday Girls Group";
export const MONDAY_GIRLS_SEASON_PRICE_USD = 225;
export const MONDAY_GIRLS_SEASON_PRICE_ENV_VAR = "STRIPE_MONDAY_GIRLS_PRICE_ID";

export interface MondayGirlsSeasonGroupOption {
  group: MondayGirlsSeasonGroup;
  /** Parent-facing name for the level. */
  label: string;
  /** "6:00–7:00 PM" — the SAME hour for both levels. */
  timeLabel: string;
  /**
   * One line a parent can self-place against without a coach. Deliberately
   * written in terms of what a girl can already DO, never what she is: a
   * parent knows whether her daughter can keep a rally going; she does not
   * know what "advanced beginner" means.
   */
  blurb: string;
}

export const MONDAY_GIRLS_SEASON_GROUPS: readonly MondayGirlsSeasonGroupOption[] =
  [
    {
      group: MONDAY_GIRLS_BEGINNER,
      label: "Beginner",
      timeLabel: MONDAY_GIRLS_TIME_LABEL,
      blurb:
        "New to pickleball, or still learning to serve and keep score. No experience needed at all.",
    },
    {
      group: MONDAY_GIRLS_ADVANCED_BEGINNER,
      label: "Advanced beginner",
      timeLabel: MONDAY_GIRLS_TIME_LABEL,
      blurb:
        "Has played before and can keep a rally going, but isn't ready for Green Ball yet.",
    },
  ];

/**
 * Seats for the block as a whole. NO level argument — both levels share one
 * 6:00–7:00 PM booking, so there is one cap, and a signature that took a level
 * would tell callers otherwise. See MONDAY_GIRLS_BLOCK_SEATS for the full
 * reasoning and why this is NOT the fall season's per-group bug.
 */
export function mondayGirlsSeasonSeats(): number {
  return MONDAY_GIRLS_BLOCK_SEATS;
}

export function findMondayGirlsSeasonGroup(
  group: string | undefined,
): MondayGirlsSeasonGroupOption | undefined {
  return MONDAY_GIRLS_SEASON_GROUPS.find((g) => g.group === group);
}

/** Every level, for callers that only need the select values. */
export const MONDAY_GIRLS_SEASON_LEVELS = MONDAY_GIRLS_LEVELS;
