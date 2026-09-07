// NGA Monday Girls Beginner Group, Fall 2026 — the single source of truth for
// the /monday-girls registration page, its confirmation email, and the season's
// roster math. Structural sibling of fall-2026.ts (Walter Johnson Sundays) and
// picklpark-2026.ts (Frederick Saturdays); the three seasons run in parallel
// and share nothing but the shape, so editing one can never move another.
//
// WHY THIS GROUP EXISTS. Amanda Stone told Sam on 2026-08-03 that her daughter
// had trained elsewhere and enjoyed it, but the group was all boys and she was
// hoping for "additional girl energy" — she would not book an evaluation
// without it. Sam proposed a girls-only group around that objection on
// 2026-08-13 and recruited it family by family. The format is the product: a
// small peer group of girls at the same level, not a ladder and not a lesson.
//
// SHAPE (Sam, 2026-08-23; RESCHEDULED 2026-09-04): Mondays 6:00–7:00 PM at
// Earle B. Wood Middle School in Rockville, $225 for the 6-session block paid
// up front.
//
// The block was originally sold as Sept 14 – Oct 19, six consecutive Mondays.
// Session 2 would have landed on Mon Sep 21, which is Yom Kippur AND an MCPS
// closure — the courts are on school grounds, so that session cannot run. The
// block therefore SKIPS 9/21 and runs one week longer, Sep 14 – Oct 26, to
// preserve all six sessions a family paid for. Every recruiting text quoted
// "Sept 14 – Oct 19", so any surface a recruited family reads must state the
// corrected end date plainly rather than quietly shipping a different one.

import {
  PICKLEBALL_COURTS_PER_TENNIS_COURT,
  PLAYERS_PER_PICKLEBALL_COURT,
} from "./venue-parking";

/**
 * Tennis courts NGA holds at Wood on a Monday evening. The Wood Monday
 * 6:00–7:00 PM hold is a standing block on the Fall 2026 master schedule —
 * do not double-book it (Wednesday 5:30 drop-ins and the Tuesday Morales
 * block use the same courts on their own nights).
 */
export const MONDAY_GIRLS_TENNIS_COURTS = 1;

export const MONDAY_GIRLS_SEASON_SESSIONS = 6;

export const MONDAY_GIRLS_START_TIME = "6:00 PM";
export const MONDAY_GIRLS_END_TIME = "7:00 PM";

/**
 * The one group this block sells. A single-member union rather than a bare
 * string so a second group (a Thursday cohort, say) is a compile-time change
 * everywhere it matters, and so the Notion `Group` select has one exact value
 * the capacity filter can match.
 */
export const MONDAY_GIRLS_GROUP = "Girls Beginner" as const;
export type MondayGirlsGroup = typeof MONDAY_GIRLS_GROUP;

/**
 * Players per pickleball court for this group. Held at NGA's site-wide 4 —
 * this is a beginner group where court time per kid IS the product.
 *
 * A Record keyed by group, not a bare number, on purpose: the Walter Johnson
 * season learned the hard way that one shared "spots per group" scalar
 * silently gates one group on another's fill (the bug
 * invariant-fall-seat-cap-per-group.spec.ts exists to prevent). There is one
 * group today; keeping the map shape means adding a second can't reintroduce
 * that bug.
 */
export const MONDAY_GIRLS_PLAYERS_PER_COURT: Record<MondayGirlsGroup, number> =
  {
    [MONDAY_GIRLS_GROUP]: PLAYERS_PER_PICKLEBALL_COURT,
  };

/**
 * Seats. DERIVED from the court booking, never typed: book a second tennis
 * court and the seats follow. To change capacity, change the booking or
 * MONDAY_GIRLS_PLAYERS_PER_COURT — never PLAYERS_PER_PICKLEBALL_COURT, which
 * sizes drop-ins and every venue's playerCapacity site-wide.
 */
export const MONDAY_GIRLS_SLOTS_BY_GROUP: Record<MondayGirlsGroup, number> = {
  [MONDAY_GIRLS_GROUP]:
    MONDAY_GIRLS_TENNIS_COURTS *
    PICKLEBALL_COURTS_PER_TENNIS_COURT *
    MONDAY_GIRLS_PLAYERS_PER_COURT[MONDAY_GIRLS_GROUP],
};

export function mondayGirlsSlotsFor(group: MondayGirlsGroup): number {
  return MONDAY_GIRLS_SLOTS_BY_GROUP[group];
}

export const MONDAY_GIRLS_VENUE =
  "Earle B. Wood Middle School Tennis Courts, 14615 Bauer Dr, Rockville, MD 20853";

/** Broad area for any surface that shouldn't carry the full address. */
export const MONDAY_GIRLS_PUBLIC_AREA = "Rockville, MD";

export const MONDAY_GIRLS_VENUE_SHORT = "Earle B. Wood Middle School";

/**
 * The 6 Mondays, ISO date-only. Written out rather than computed — both
 * because date arithmetic on a UTC build server is the documented footgun,
 * and because this list is not a weekly interval: 2026-09-21 is deliberately
 * absent (Yom Kippur + MCPS closure) and the block runs a week longer to
 * compensate. A generated range would silently put the closure back.
 */
export const MONDAY_GIRLS_MONDAYS = [
  "2026-09-14",
  "2026-09-28",
  "2026-10-05",
  "2026-10-12",
  "2026-10-19",
  "2026-10-26",
] as const;

/**
 * The Monday the block skips, and why. Exported so the page and the
 * confirmation email can both say it out loud — a family who was recruited
 * with "Sept 14 – Oct 19" needs to see the missing week named, not just a
 * different end date.
 */
export const MONDAY_GIRLS_SKIPPED_DATE = "2026-09-21";
export const MONDAY_GIRLS_SKIPPED_REASON =
  "Yom Kippur and an MCPS closure — school grounds are closed, so we skip that Monday and add one at the end.";

/**
 * Rain dates. Wood is outdoors, so weather genuinely can take a week. Two
 * holds, matching the Walter Johnson season's posture.
 */
export const MONDAY_GIRLS_RAIN_DATES = ["2026-11-02", "2026-11-09"] as const;

/** Human range for copy — email subject lines and page headers. */
export const MONDAY_GIRLS_SEASON_LABEL = "September 14 – October 26, 2026";

/**
 * Advertised age band.
 *
 * Sam recruited this group as "ages 8–10". The families who actually said yes
 * span 7–10 (the one CONFIRMED player is 7), so advertising 8–10 would tell a
 * girl already in the group that she does not qualify. The band is widened
 * down to the roster that exists rather than up to a roster we hope for.
 *
 * This is COPY only. Checkout validates against NGA's site-wide 6–16 window
 * (see validate-monday-girls-registration.ts), so the band can never hard-block
 * a sibling or an edge-case registration — a coach placing a player is the
 * right check, not a form field.
 */
export const MONDAY_GIRLS_AGE_MIN = 7;
export const MONDAY_GIRLS_AGE_MAX = 10;

/**
 * How each session runs. One string, reused by the page and the confirmation
 * email so a parent reads the same thing in both places.
 */
export const MONDAY_GIRLS_SESSION_FORMAT =
  "30 minutes of coached skill work, then 30 minutes of games with the group";

/**
 * The sentence that says what a parent is actually buying. This group was
 * built around a retention objection, not a skill gap — the peer group IS the
 * offer, so every surface that quotes the price carries this with it.
 */
export const MONDAY_GIRLS_PEER_NOTE =
  "Every player in this block is a girl at the same beginner stage, so nobody is the only one learning — they build the habit together, week after week.";
