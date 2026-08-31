// Pickl Park Fall 2026 Saturday season — the BOOKABLE product. Terms set by
// Sam 2026-08-25; repriced to $225 and re-banded 2026-08-31. The $225 figure
// may ship on the page/emails ONLY once the real Stripe price exists (create
// the product before flipping NEXT_PUBLIC_PICKLPARK_REGISTRATION_OPEN); until
// then the page holds the closed state and checkout 503s, so no price that
// doesn't exist yet is ever quoted to a family.
//
// WHY $225 — the same number the Walter Johnson Sunday season charges (Sam,
// 2026-08-31). Note it buys a shorter block here: 6 × 60 min against Walter
// Johnson's 6 × 90. What closes that gap is the venue, not the clock — this
// season is INDOORS on cushioned courts, so all six Saturdays actually run,
// while the outdoor season holds two rain dates precisely because it might
// not. PICKLPARK_INDOOR_NOTE carries that sentence to every surface that
// quotes the price; a page that shows $225 without it is selling the shorter
// hour and none of the reason.
//
// Registration ships DARK by the league convention: /api/checkout-picklpark
// returns 503 until STRIPE_PICKLPARK_SEASON_PRICE_ID is set, and /picklpark
// shows the closed state until NEXT_PUBLIC_PICKLPARK_REGISTRATION_OPEN is
// "true". BOTH must be set to go live.

import {
  PICKLPARK_SLOTS_BY_GROUP,
  PICKLPARK_YOUTH_BLOCKS,
  type PicklParkBandLevel,
} from "./picklpark-2026";

export type PicklParkSeasonGroup = PicklParkBandLevel;

export const PICKLPARK_SEASON_SLUG = "picklpark-fall-2026";
export const PICKLPARK_SEASON_TITLE = "Next Gen Pickl Park Saturday Season";
export const PICKLPARK_SEASON_PRICE_USD = 225;
export const PICKLPARK_SEASON_PRICE_ENV_VAR = "STRIPE_PICKLPARK_SEASON_PRICE_ID";

export interface PicklParkSeasonGroupOption {
  group: PicklParkSeasonGroup;
  /** "Red & Orange Ball" — canonical ball-color words, never a synonym. */
  label: string;
  /** "3:00–4:00 PM" */
  timeLabel: string;
}

export const PICKLPARK_SEASON_GROUPS: readonly PicklParkSeasonGroupOption[] =
  PICKLPARK_YOUTH_BLOCKS.map((block) => ({
    group: block.level,
    label: `${block.level.replace("/", " & ")} Ball`,
    timeLabel: `${block.startTime}–${block.endTime}`.replace(" PM–", "–"),
  }));

/**
 * Seats in one band. Per-group on purpose — there is no single "spots per
 * group" number any more, so a caller has to say which band it means and a
 * full Red/Orange can never gate Green/Yellow.
 */
export function picklParkSeasonSlotsFor(group: PicklParkSeasonGroup): number {
  return PICKLPARK_SLOTS_BY_GROUP[group];
}

export function findPicklParkSeasonGroup(
  group: string | undefined,
): PicklParkSeasonGroupOption | undefined {
  return PICKLPARK_SEASON_GROUPS.find((g) => g.group === group);
}
