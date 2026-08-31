// Pickl Park Fall 2026 Saturday season config — the single source of truth for
// the /picklpark registration page, its confirmation email, and the events
// feed's Pickl Park items. Structural sibling of fall-2026.ts (the Walter
// Johnson HS Sunday season); the two seasons run in parallel and share nothing
// but the shape, so editing one can never move the other.
//
// SHAPE DECIDED (Sam, 2026-08-25; RESHAPED 2026-08-31): Saturdays at The Pickl
// Park in Frederick, Oct 3 – Nov 7. The Saturday now runs 2–5 PM in three
// one-hour blocks:
//
//   2:00–3:00  Open Court — all levels, $20 drop-in, NOT part of this season.
//              It is an ordinary NGA Sessions row (see recurring-templates.ts)
//              so it inherits the whole drop-in stack, and it reaches the
//              calendar through the sessions feed rather than from this file.
//   3:00–4:00  Red & Orange Ball  ┐ the season proper — what /picklpark sells
//   4:00–5:00  Green & Yellow Ball ┘
//
// The season groups are BANDS, not single colors, because Frederick is a cold
// market: the Player CRM holds zero families there, so nobody has been
// evaluated and a four-way split would ask parents to self-select a level they
// cannot know. Two bands is the same call MVF and the weekend drop-in
// templates already make.
//
// The Open Court hour running FIRST is deliberate — a family trying pickleball
// for the first time at 2:00 watches the season groups play at 3:00, which is
// the only moment on the calendar where the thing being sold is visible.
//
// This is NGA's first partner-venue season outside Montgomery County; it is a
// single-venue addition, not an SEO market expansion — the site's positioning
// stays MoCo.
//
// Oct 31 is Halloween. The season currently RUNS that Saturday (it ends at 5,
// before trick-or-treat); if Sam decides to skip it instead, move "2026-10-31"
// out of PICKLPARK_SATURDAYS and "2026-11-14" in — a one-file edit, before the
// first confirmation email ships, since every email lists the dates.

import { PLAYERS_PER_PICKLEBALL_COURT } from "./venue-parking";

/**
 * Pickleball courts NGA books per Saturday under the standing Pickl Park
 * arrangement. Direct — NOT derived through the CUPF tennis-court math in
 * venue-parking.ts, because this is a commercial pickleball facility: the
 * courts ARE pickleball courts, booked per court per hour.
 */
export const PICKLPARK_PICKLEBALL_COURTS = 2;

export const PICKLPARK_SEASON_WEEKS = 6;

/** Season window — Red & Orange then Green & Yellow, back to back. */
export const PICKLPARK_START_TIME = "3:00 PM";
export const PICKLPARK_END_TIME = "5:00 PM";

/**
 * The Open Court hour that precedes the season. Here only so the page and the
 * runbook can name one time; the bookable row itself lives in the Sessions DB.
 */
export const PICKLPARK_OPEN_COURT_START_TIME = "2:00 PM";
export const PICKLPARK_OPEN_COURT_END_TIME = "3:00 PM";

/** The two Saturday season blocks, in play order. */
export const PICKLPARK_YOUTH_BLOCKS = [
  { level: "Red/Orange", startTime: "3:00 PM", endTime: "4:00 PM" },
  { level: "Green/Yellow", startTime: "4:00 PM", endTime: "5:00 PM" },
] as const;

/**
 * "Red/Orange" | "Green/Yellow" — taken from the blocks so the two can't
 * disagree, and a typo fails at compile time.
 */
export type PicklParkBandLevel =
  (typeof PICKLPARK_YOUTH_BLOCKS)[number]["level"];

/**
 * Players per pickleball court, per band.
 *
 * Both bands hold NGA's standard 4. Split out as a map rather than one number
 * because the Wood/Walter Johnson season learned the hard way that a single
 * "spots per group" scalar silently gates one group on another's fill — the
 * bug `invariant-fall-seat-cap-per-group.spec.ts` exists to prevent.
 *
 * Scoped to this season deliberately: the site-wide 4-per-court cap that sizes
 * drop-ins and every venue's `playerCapacity` is UNCHANGED, so raising a band
 * means editing this map, never `PLAYERS_PER_PICKLEBALL_COURT`.
 */
export const PICKLPARK_PLAYERS_PER_COURT: Record<PicklParkBandLevel, number> = {
  "Red/Orange": PLAYERS_PER_PICKLEBALL_COURT,
  "Green/Yellow": PLAYERS_PER_PICKLEBALL_COURT,
};

/**
 * Seats per band. DERIVED from the court booking, never typed: book a third
 * court and the seats follow.
 */
export const PICKLPARK_SLOTS_BY_GROUP: Record<PicklParkBandLevel, number> = {
  "Red/Orange":
    PICKLPARK_PICKLEBALL_COURTS * PICKLPARK_PLAYERS_PER_COURT["Red/Orange"],
  "Green/Yellow":
    PICKLPARK_PICKLEBALL_COURTS * PICKLPARK_PLAYERS_PER_COURT["Green/Yellow"],
};

export function picklParkSlotsFor(level: PicklParkBandLevel): number {
  return PICKLPARK_SLOTS_BY_GROUP[level];
}

export const PICKLPARK_VENUE =
  "The Pickl Park, 355 Ballenger Center Dr, Frederick, MD 21703";

/** Broad area for any surface that shouldn't carry the full address. */
export const PICKLPARK_PUBLIC_AREA = "Frederick, MD";

export const PICKLPARK_VENUE_SHORT = "The Pickl Park";

/**
 * The 6 Saturdays, ISO date-only. Written out rather than computed: date
 * arithmetic on a UTC build server is the exact footgun the repo rule warns
 * about, and a season is a hand-checked calendar decision anyway.
 */
export const PICKLPARK_SATURDAYS = [
  "2026-10-03",
  "2026-10-10",
  "2026-10-17",
  "2026-10-24",
  "2026-10-31",
  "2026-11-07",
] as const;

/**
 * One held Saturday in case a session can't run — NOT a rain date. The Pickl
 * Park is indoors, so weather never takes a week; this covers a facility
 * closure or a coach out sick. The Walter Johnson season holds two dates
 * because it is outdoors and genuinely might not happen.
 */
export const PICKLPARK_MAKEUP_DATES = ["2026-11-14"] as const;

/** Human range for copy, e.g. email subject lines and page headers. */
export const PICKLPARK_SEASON_LABEL = "October 3 – November 7, 2026";

/**
 * The one sentence that earns price parity with the outdoor Montgomery County
 * season. Reused verbatim by the page and the confirmation email so the two
 * can't drift — a family comparing the two prices deserves the same reason in
 * both places.
 */
export const PICKLPARK_INDOOR_NOTE =
  "Every session is indoors on cushioned courts, so all six Saturdays run — no rain dates, no cancelled weeks, no weather texts.";
