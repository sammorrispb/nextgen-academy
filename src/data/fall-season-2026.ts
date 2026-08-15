// Fall 2026 season — the BOOKABLE product. Terms set by Sam 2026-08-14 and a
// real Stripe price backs checkout, so this file (like fall-poll-2026.ts, and
// unlike the fall-2026.ts survey config) carries the dollar figure. Price and
// seat count are imported, never re-typed, so the poll, the survey math, and
// the checkout can't drift apart (fall-court-capacity pins the seat math).
//
// Registration ships DARK by the league convention: /api/checkout-fall returns
// 503 until STRIPE_FALL_SEASON_PRICE_ID is set, and /fall shows the closed
// state until NEXT_PUBLIC_FALL_REGISTRATION_OPEN is "true". BOTH must be set
// to go live.

import { SLOTS_PER_GROUP, FALL_YOUTH_BLOCKS } from "./fall-2026";
import { FALL_POLL_PRICE_USD } from "./fall-poll-2026";

export type FallSeasonGroup = "Green" | "Yellow";

export const FALL_SEASON_SLUG = "fall-2026";
export const FALL_SEASON_TITLE = "Next Gen Youth Fall Season";
export const FALL_SEASON_PRICE_USD = FALL_POLL_PRICE_USD;
export const FALL_SEASON_PRICE_ENV_VAR = "STRIPE_FALL_SEASON_PRICE_ID";
export const FALL_SEASON_SPOTS_PER_GROUP = SLOTS_PER_GROUP;

export interface FallSeasonGroupOption {
  group: FallSeasonGroup;
  /** "Green Ball" — canonical ball-color label, never a synonym. */
  label: string;
  /** "1:00–2:30 PM" */
  timeLabel: string;
}

export const FALL_SEASON_GROUPS: readonly FallSeasonGroupOption[] =
  FALL_YOUTH_BLOCKS.map((block) => ({
    group: block.level,
    label: `${block.level} Ball`,
    timeLabel: `${block.startTime}–${block.endTime}`.replace(" PM–", "–"),
  }));

export function findFallSeasonGroup(
  group: string | undefined,
): FallSeasonGroupOption | undefined {
  return FALL_SEASON_GROUPS.find((g) => g.group === group);
}
