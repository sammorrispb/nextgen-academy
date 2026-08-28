/**
 * Fall 2026 Sunday season — the CONFIRMED season the one-click poll email asks
 * about. Distinct from src/data/fall-2026.ts (the /fall demand-sizing survey,
 * which now carries the same Sunday shape but deliberately quotes no price):
 * Sam set these terms on 2026-08-14 — real dates, real price, real caps — so
 * this file DOES carry the dollar figure, and the poll asks for a commitment
 * signal (In / Interested / Out), not a valuation.
 *
 * Dates written out, never computed — date arithmetic on a UTC build server is
 * the documented footgun. Sept 20 → Oct 25 2026 are the six consecutive
 * Sundays.
 */

export const FALL_POLL_SEASON_LABEL = "Sept 20 – Oct 25, 2026";
export const FALL_POLL_SEASON_WEEKS = 6;
export const FALL_POLL_DAY_LABEL = "Sundays";
// Venue moved 2026-08-27 — see the note on FALL_VENUE in fall-2026.ts.
export const FALL_POLL_VENUE = "Walter Johnson High School";
export const FALL_POLL_VENUE_SHORT = "Walter Johnson HS";
export const FALL_POLL_PRICE_USD = 225;
export const FALL_POLL_SPOTS_PER_GROUP = 8;

export const FALL_POLL_SUNDAYS = [
  "2026-09-20",
  "2026-09-27",
  "2026-10-04",
  "2026-10-11",
  "2026-10-18",
  "2026-10-25",
] as const;

export interface FallPollGroup {
  /** Canonical ball-color label (never synonyms, per CLAUDE.md). */
  level: "Green" | "Yellow";
  timeLabel: string;
}

export const FALL_POLL_GROUPS: readonly FallPollGroup[] = [
  { level: "Green", timeLabel: "1:00–2:30 PM" },
  { level: "Yellow", timeLabel: "2:30–4:00 PM" },
] as const;
