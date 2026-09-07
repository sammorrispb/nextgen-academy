// Pickl Park Fall 2026 Saturday — the SATURDAY ITSELF: its dates, venue,
// makeup date and indoor promise. What is SOLD on that Saturday, and by whom,
// lives in picklpark-leagues-2026.ts.
//
// WHO SELLS IT CHANGED (Sam, 2026-09-07). NGA used to sell a $225 season here
// — Red & Orange 3:00–4:00 and Green & Yellow 4:00–5:00, with a $20 all-levels
// Open Court at 2:00 as the on-ramp. The Pickl Park now sells the Saturday
// itself through podplay, as two six-week leagues:
//
//   2:00–3:00  Kid's Drill and Play (ages 8–13)  — replaces the Open Court hour
//   3:00–4:30  Youth League (ages 10+)           — replaces BOTH season blocks
//
// So: `PICKLPARK_YOUTH_BLOCKS`, `PICKLPARK_OPEN_COURT_*`, the seat maps and
// everything in picklpark-season-2026.ts describe products that NO LONGER RUN.
// They are still imported by the retired checkout machinery (the Stripe
// webhook branch, the success page, the cancel path) which stays on disk for
// the historical rows; a separate cleanup removes them. NOTHING PUBLIC MAY
// RENDER THEM — a surface that prints "Red & Orange Ball 3:00–4:00 PM" is
// advertising a block that was cancelled. `picklpark-leagues.spec.ts` and the
// consumers listed there are the guard.
//
// What is unchanged and still true: the six Saturdays (Sep 19 – Oct 24, and
// yes 9/26 — podplay's listing showed only five, which is a podplay bug), the
// Oct 31 makeup hold, the venue, and the indoors-so-every-week-runs promise.
// Both leagues run all six.
//
// Structural sibling of fall-2026.ts (the Walter Johnson HS Sunday season);
// the two run in parallel and share nothing but the shape, so editing one can
// never move the other.
//
// Frederick is a cold market — the Player CRM held zero Frederick families
// when this was planned. The Open Court hour was the on-ramp that fixed that;
// with it retired, Kid's Drill and Play is now the entire entry point, and it
// caps at 8–13. There is no Frederick on-ramp for a 6–7 or a 14–16 year old.
// That is a known, accepted gap (Sam, 2026-09-07), not an oversight.

import { PLAYERS_PER_PICKLEBALL_COURT } from "./venue-parking";
import { PICKLPARK_LEAGUES } from "./picklpark-leagues-2026";

/**
 * Pickleball courts NGA books per Saturday under the standing Pickl Park
 * arrangement. Direct — NOT derived through the CUPF tennis-court math in
 * venue-parking.ts, because this is a commercial pickleball facility: the
 * courts ARE pickleball courts, booked per court per hour.
 */
export const PICKLPARK_PICKLEBALL_COURTS = 2;

export const PICKLPARK_SEASON_WEEKS = 6;

/**
 * The Saturday's public window — first league on to last league off, DERIVED
 * from picklpark-leagues-2026 so the calendar feed can never advertise an hour
 * nobody is on court for.
 *
 * It used to be a typed 3:00–5:00 PM: the two NGA season blocks, with the $20
 * Open Court hour at 2:00 deliberately EXCLUDED so the feed sold the season
 * rather than the drop-in. Since 2026-09-07 the 2:00 hour IS a league (Kid's
 * Drill and Play), so the window legitimately opens at 2:00 and closes at 4:30.
 */
export const PICKLPARK_START_TIME = PICKLPARK_LEAGUES[0].startTime;
export const PICKLPARK_END_TIME =
  PICKLPARK_LEAGUES[PICKLPARK_LEAGUES.length - 1].endTime;

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
  "2026-09-19",
  "2026-09-26",
  "2026-10-03",
  "2026-10-10",
  "2026-10-17",
  "2026-10-24",
] as const;

/**
 * One held Saturday in case a session can't run — NOT a rain date. The Pickl
 * Park is indoors, so weather never takes a week; this covers a facility
 * closure or a coach out sick. The Walter Johnson season holds two dates
 * because it is outdoors and genuinely might not happen.
 */
export const PICKLPARK_MAKEUP_DATES = ["2026-10-31"] as const;

/** Human range for copy, e.g. email subject lines and page headers. */
export const PICKLPARK_SEASON_LABEL = "September 19 – October 24, 2026";

/**
 * How each one-hour block runs (Sam, 2026-09-05). One string, reused by the
 * page, the group cards, the schedule callout and the confirmation email, so
 * a parent reads the same split everywhere and a later change is one edit.
 * Drop it into a sentence: "Each hour is ${PICKLPARK_SESSION_FORMAT}, …".
 */
export const PICKLPARK_SESSION_FORMAT =
  "30 minutes of coached drills, then 30 minutes of game play";

/**
 * The one sentence that earns price parity with the outdoor Montgomery County
 * season. Reused verbatim by the page and the confirmation email so the two
 * can't drift — a family comparing the two prices deserves the same reason in
 * both places.
 */
export const PICKLPARK_INDOOR_NOTE =
  "Every session is indoors on cushioned courts, so all six Saturdays run — no rain dates, no cancelled weeks, no weather texts.";
