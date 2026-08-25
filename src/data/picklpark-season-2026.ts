// Pickl Park Fall 2026 Saturday season — the BOOKABLE product. Terms set by
// Sam 2026-08-25. The $175 figure may ship on the page/emails ONLY once the
// real Stripe price exists (create the product before flipping
// NEXT_PUBLIC_PICKLPARK_REGISTRATION_OPEN); until then the page holds the
// closed state and checkout 503s, so no price that doesn't exist yet is ever
// quoted to a family.
//
// Registration ships DARK by the league convention: /api/checkout-picklpark
// returns 503 until STRIPE_PICKLPARK_SEASON_PRICE_ID is set, and /picklpark
// shows the closed state until NEXT_PUBLIC_PICKLPARK_REGISTRATION_OPEN is
// "true". BOTH must be set to go live.

import {
  PICKLPARK_SLOTS_PER_GROUP,
  PICKLPARK_YOUTH_BLOCKS,
} from "./picklpark-2026";

export type PicklParkSeasonGroup = "Green" | "Yellow";

export const PICKLPARK_SEASON_SLUG = "picklpark-fall-2026";
export const PICKLPARK_SEASON_TITLE = "Next Gen Pickl Park Saturday Season";
export const PICKLPARK_SEASON_PRICE_USD = 175;
export const PICKLPARK_SEASON_PRICE_ENV_VAR = "STRIPE_PICKLPARK_SEASON_PRICE_ID";
export const PICKLPARK_SEASON_SPOTS_PER_GROUP = PICKLPARK_SLOTS_PER_GROUP;

export interface PicklParkSeasonGroupOption {
  group: PicklParkSeasonGroup;
  /** "Green Ball" — canonical ball-color label, never a synonym. */
  label: string;
  /** "1:00–2:00 PM" */
  timeLabel: string;
}

export const PICKLPARK_SEASON_GROUPS: readonly PicklParkSeasonGroupOption[] =
  PICKLPARK_YOUTH_BLOCKS.map((block) => ({
    group: block.level,
    label: `${block.level} Ball`,
    timeLabel: `${block.startTime}–${block.endTime}`.replace(" PM–", "–"),
  }));

export function findPicklParkSeasonGroup(
  group: string | undefined,
): PicklParkSeasonGroupOption | undefined {
  return PICKLPARK_SEASON_GROUPS.find((g) => g.group === group);
}
