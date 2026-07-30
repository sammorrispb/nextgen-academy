// Fall 2026 season config — the single source of truth for the /fall feedback
// survey, its confirmation email, and the broadcast that drives traffic to it.
//
// Two programs share one window at one venue: the NGA youth season (coached
// practice hour + rotating-partner round robin hour) and the Link & Dink adult
// round robin (two hours of rotating-partner play, no practice hour). Parents
// are encouraged to play in the adult block while their kid is on the next
// court.
//
// NOTHING HERE IS BOOKABLE YET. This is a demand-sizing survey: the court
// permit covers fewer players than `SLOTS_PER_GROUP` x the group count, and
// there is no Stripe product for a season. Per the standing NGA rule, no price
// is quoted anywhere — we ask what a season would be WORTH to a family instead
// (PRICE_BANDS below). Do not add a dollar figure to this file, the /fall page,
// or either email until a real Stripe product exists.

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

export type FallDay = "Saturday" | "Sunday" | "Neither works";

export const FALL_DAYS: readonly FallDay[] = [
  "Saturday",
  "Sunday",
  "Neither works",
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

/** Slots available in each color group / bracket. First come, first serve. */
export const SLOTS_PER_GROUP = 9;

export const FALL_SEASON_WEEKS = 8;

/** Session window, both days. */
export const FALL_START_TIME = "5:00 PM";
export const FALL_END_TIME = "7:00 PM";

export const FALL_VENUE =
  "Earle B. Wood Middle School Tennis Courts, 14615 Bauer Dr, Rockville, MD 20853";

/** Broad area for any surface that shouldn't carry the full address. */
export const FALL_PUBLIC_AREA = "Rockville, MD";

export const FALL_VENUE_SHORT = "Earle B. Wood Middle School";

/**
 * The 8 Saturdays and 8 Sundays, ISO date-only. Written out rather than
 * computed: date arithmetic on a UTC build server is the exact footgun the repo
 * rule warns about, and a season is a hand-checked calendar decision anyway.
 */
export const FALL_SATURDAYS = [
  "2026-09-12",
  "2026-09-19",
  "2026-09-26",
  "2026-10-03",
  "2026-10-10",
  "2026-10-17",
  "2026-10-24",
  "2026-10-31",
] as const;

export const FALL_SUNDAYS = [
  "2026-09-13",
  "2026-09-20",
  "2026-09-27",
  "2026-10-04",
  "2026-10-11",
  "2026-10-18",
  "2026-10-25",
  "2026-11-01",
] as const;

/** Human range for copy, e.g. email subject lines and page headers. */
export const FALL_SEASON_LABEL = "September 12 – November 1, 2026";

export const FALL_PROGRAMS: readonly FallProgram[] = [
  {
    track: "youth",
    name: "Next Gen Youth Fall Season",
    who: "Kids 6–16, grouped by ball color",
    format:
      "Two hours: one hour of coached practice, then one hour of rotating-partner round robin.",
    groupNoun: "color group",
    groups: FALL_YOUTH_LEVELS,
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
  "Filling this out doesn't hold a spot — there's nothing to register for yet. We're sizing real demand before we book the courts, and you'll hear from us first when it opens.";
