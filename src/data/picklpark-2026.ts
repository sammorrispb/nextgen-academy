// Pickl Park Fall 2026 Saturday season config — the single source of truth for
// the /picklpark registration page, its confirmation email, and the events
// feed's Pickl Park items. Structural sibling of fall-2026.ts (the Wood MS
// Sunday season); the two seasons run in parallel and share nothing but the
// shape, so editing one can never move the other.
//
// SHAPE DECIDED (Sam, 2026-08-25): Saturdays at The Pickl Park in Frederick,
// Oct 3 – Nov 7 — Green Ball 1:00–2:00 PM, Yellow Ball 2:00–3:00 PM, with a
// makeup date held on Nov 14. This is NGA's first partner-venue season outside
// Montgomery County; it is a single-venue addition, not an SEO market
// expansion — the site's positioning stays MoCo.
//
// Oct 31 is Halloween. The season currently RUNS that Saturday (1–3 PM is
// well before trick-or-treat time); if Sam decides to skip it instead, move
// "2026-10-31" out of PICKLPARK_SATURDAYS and "2026-11-14" in — a one-file
// edit, before the first confirmation email ships.

import { PLAYERS_PER_PICKLEBALL_COURT } from "./venue-parking";

/**
 * Pickleball courts NGA books per Saturday under the standing Pickl Park
 * arrangement. Direct — NOT derived through the CUPF tennis-court math in
 * venue-parking.ts, because this is a commercial pickleball facility: the
 * courts ARE pickleball courts, booked per court per hour.
 */
export const PICKLPARK_PICKLEBALL_COURTS = 2;

/**
 * Seats per color group. DERIVED from the court booking (same rule the Wood
 * season learned the hard way): book a third court and the seats follow.
 */
export const PICKLPARK_SLOTS_PER_GROUP =
  PICKLPARK_PICKLEBALL_COURTS * PLAYERS_PER_PICKLEBALL_COURT;

export const PICKLPARK_SEASON_WEEKS = 6;

/** Overall Saturday window — Green then Yellow back-to-back. */
export const PICKLPARK_START_TIME = "1:00 PM";
export const PICKLPARK_END_TIME = "3:00 PM";

/** The two Saturday blocks, in play order. */
export const PICKLPARK_YOUTH_BLOCKS = [
  { level: "Green", startTime: "1:00 PM", endTime: "2:00 PM" },
  { level: "Yellow", startTime: "2:00 PM", endTime: "3:00 PM" },
] as const;

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
 * Held only in case a Saturday can't run — not part of the season proper.
 * (Pickl Park courts are the venue's call on weather; one hold covers it.)
 */
export const PICKLPARK_MAKEUP_DATES = ["2026-11-14"] as const;

/** Human range for copy, e.g. email subject lines and page headers. */
export const PICKLPARK_SEASON_LABEL = "October 3 – November 7, 2026";
