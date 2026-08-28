// Fall 2026 season config — the single source of truth for the /fall feedback
// survey, its confirmation email, the broadcast that drives traffic to it, and
// the events feed's fall items.
//
// SHAPE DECIDED (Sam, 2026-08-14): Sundays only, Sept 20 – Oct 25 —
// Green Ball 1:00–2:30 PM, then Yellow Ball 2:30–4:00 PM, with rain dates held
// on Nov 1 and Nov 8. The earlier Saturday+Sunday 5–7 PM concept the survey
// originally sized is superseded. The Link & Dink adult round robin remains on
// the survey as its own track (its exact slot is still being worked out).
//
// NOTHING HERE IS BOOKABLE YET. There is no Stripe product for a season. Per
// the standing NGA rule, no price is quoted anywhere — we ask what a season
// would be WORTH to a family instead (PRICE_BANDS below). Do not add a dollar
// figure to this file, the /fall page, or either email until a real Stripe
// product exists.

import {
  PICKLEBALL_COURTS_PER_TENNIS_COURT,
  PLAYERS_PER_PICKLEBALL_COURT,
} from "./venue-parking";

export type FallTrack = "youth" | "adult";

/** Youth ball colors — the NGA ladder. Never renamed to Beginner/Pro. */
export type FallYouthLevel = "Red" | "Orange" | "Green" | "Yellow";

export const FALL_YOUTH_LEVELS: readonly FallYouthLevel[] = [
  "Red",
  "Orange",
  "Green",
  "Yellow",
] as const;

/**
 * Adult brackets. These mirror the canonical Link & Dink skill brackets
 * (community-os `packages/brackets`) so a player who knows their L&D bracket
 * picks the same word here. L&D assesses into brackets and does not run a
 * rating — never label these a rating, and never quote a DUPR number as ours.
 */
export type FallAdultBracket =
  | "New"
  | "Rallying"
  | "Playing"
  | "Competing"
  | "Tournament Level";

export const FALL_ADULT_BRACKETS: readonly FallAdultBracket[] = [
  "New",
  "Rallying",
  "Playing",
  "Competing",
  "Tournament Level",
] as const;

export type FallDay = "Sunday" | "Sunday doesn't work";

export const FALL_DAYS: readonly FallDay[] = [
  "Sunday",
  "Sunday doesn't work",
] as const;

export type FallCommitment =
  | "Yes — full season, paid up front"
  | "Maybe — depends on price and dates"
  | "No — a full season doesn't work for us";

export const FALL_COMMITMENTS: readonly FallCommitment[] = [
  "Yes — full season, paid up front",
  "Maybe — depends on price and dates",
  "No — a full season doesn't work for us",
] as const;

/**
 * Price-sensitivity bands for the 8-week season. Deliberately expressed as
 * per-hour-of-court-time ranges rather than a season total, so no band reads as
 * "the price." Sam adjusts these here; the form, page, and Notion select all
 * follow.
 */
export type FallPriceBand = (typeof FALL_PRICE_BANDS)[number];

export const FALL_PRICE_BANDS = [
  "Under $15 an hour",
  "$15–20 an hour",
  "$20–25 an hour",
  "$25–30 an hour",
  "Over $30 an hour",
  "Not sure yet",
] as const;

export interface FallProgram {
  track: FallTrack;
  /** Public-facing program name. */
  name: string;
  /** Who it's for, one line. */
  who: string;
  /** How a session runs, one line. */
  format: string;
  /** The grouping axis, e.g. "color group" / "bracket". */
  groupNoun: string;
  /** Group labels, in ladder order. */
  groups: readonly string[];
}

/**
 * Tennis courts NGA reserves from CUPF for each Sunday session (Sam, 2026-08-15).
 * Green and Yellow run back-to-back, so one court covers the whole 1–4 PM block.
 * Unchanged by the 2026-08-27 move to Walter Johnson: this is a booking
 * decision, not a property of the venue, so the seat count below held at 8.
 */
export const FALL_TENNIS_COURTS_PER_SESSION = 1;

/**
 * Slots available in each color group / bracket. First come, first serve.
 *
 * DERIVED from the court booking rather than typed, because it drifted once:
 * this file advertised 9 while `fall-poll-2026.ts` sold 8, and 9 doesn't fit on
 * one court anyway (2 pickleball courts × 4 players). Book a second court and
 * the seat count follows on its own.
 */
export const SLOTS_PER_GROUP =
  FALL_TENNIS_COURTS_PER_SESSION *
  PICKLEBALL_COURTS_PER_TENNIS_COURT *
  PLAYERS_PER_PICKLEBALL_COURT;

export const FALL_SEASON_WEEKS = 6;

/** Overall Sunday window — Green then Yellow back-to-back. */
export const FALL_START_TIME = "1:00 PM";
export const FALL_END_TIME = "4:00 PM";

/** The two Sunday blocks, in play order. */
export const FALL_YOUTH_BLOCKS = [
  { level: "Green", startTime: "1:00 PM", endTime: "2:30 PM" },
  { level: "Yellow", startTime: "2:30 PM", endTime: "4:00 PM" },
] as const;

/**
 * VENUE MOVED 2026-08-27 (Sam): Earle B. Wood MS was no longer available for the
 * season, so all 6 Sundays (and both rain dates) run at Walter Johnson HS
 * instead. Dates, times, groups, price and seat count are all unchanged — only
 * the place. Wood MS is still a live NGA venue for Saturday drop-in sessions and
 * the August camp; do not sweep those references along with this one.
 */
export const FALL_VENUE =
  "Walter Johnson High School Tennis Courts, 6400 Rock Spring Dr, Bethesda, MD 20814";

/** Broad area for any surface that shouldn't carry the full address. */
export const FALL_PUBLIC_AREA = "Bethesda, MD";

export const FALL_VENUE_SHORT = "Walter Johnson High School";

/**
 * The 6 Sundays, ISO date-only. Written out rather than computed: date
 * arithmetic on a UTC build server is the exact footgun the repo rule warns
 * about, and a season is a hand-checked calendar decision anyway.
 */
export const FALL_SUNDAYS = [
  "2026-09-20",
  "2026-09-27",
  "2026-10-04",
  "2026-10-11",
  "2026-10-18",
  "2026-10-25",
] as const;

/** Held only in case a Sunday washes out — not part of the season proper. */
export const FALL_RAIN_DATES = ["2026-11-01", "2026-11-08"] as const;

/** Human range for copy, e.g. email subject lines and page headers. */
export const FALL_SEASON_LABEL = "September 20 – October 25, 2026";

export const FALL_PROGRAMS: readonly FallProgram[] = [
  {
    track: "youth",
    name: "Next Gen Youth Fall Season",
    who: "Kids 6–16 — Green and Yellow Ball this season",
    format:
      "Ninety minutes per color group — coached practice, then a rotating-partner round robin. Green Ball 1:00–2:30 PM, Yellow Ball 2:30–4:00 PM.",
    groupNoun: "color group",
    groups: ["Green", "Yellow"],
  },
  {
    track: "adult",
    name: "Link & Dink Fall Round Robin",
    who: "Adults, grouped by bracket — parents especially welcome",
    format:
      "Two hours of rotating-partner round robin. No practice hour — you're playing the whole time.",
    groupNoun: "bracket",
    groups: FALL_ADULT_BRACKETS,
  },
] as const;

export function fallProgram(track: FallTrack): FallProgram {
  const program = FALL_PROGRAMS.find((p) => p.track === track);
  if (!program) throw new Error(`Unknown fall track: ${track}`);
  return program;
}

/**
 * The one sentence that keeps this survey honest: responses are feedback, not a
 * reservation. Reused verbatim by the page, the confirmation email, and the
 * broadcast so the promise can't drift between surfaces.
 */
export const FALL_NO_HOLD_NOTE =
  "Filling this out doesn't hold a spot — registration isn't open yet, and you'll hear from us first when it is.";
