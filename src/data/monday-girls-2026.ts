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
// girls-only place to play, not a ladder and not a lesson.
//
// WIDENED 2026-09-20 (Sam): the block now takes BEGINNER and ADVANCED BEGINNER
// together, ages 7–12. The purpose he stated is the on-ramp, not the level —
// "somewhere we can guide any girls who want girls-only play, and then
// eventually they'll be good enough to join Green Ball". So the block is a
// holding pattern with a destination: a girl arrives wherever she is, plays
// only with girls, and leaves for Green Ball when she is ready.
//
// Note what that does to the ORIGINAL promise. This block used to tell parents
// every player was "a girl at the same beginner stage". Across two levels and
// ages 7–12 that is no longer true, and a parent of a 12-year-old advanced
// beginner would notice. The sameness claim therefore moves from STAGE to
// SETTING — see MONDAY_GIRLS_PEER_NOTE, which is the sentence that answers
// Amanda's objection and must never quietly become a claim we can't keep.
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
 * The hour, as copy. BOTH levels play it — that shared hour on a single court
 * booking is the physical fact the block-wide seat cap rests on. If a level
 * ever gets its own hour, capacity stops being a block property and
 * MONDAY_GIRLS_BLOCK_SEATS has to change with it.
 */
export const MONDAY_GIRLS_TIME_LABEL =
  `${MONDAY_GIRLS_START_TIME}–${MONDAY_GIRLS_END_TIME}`.replace(" PM–", "–");

/**
 * The two levels this block sells, as the exact strings the Notion `Group`
 * select stores.
 *
 * MONDAY_GIRLS_BEGINNER IS LOAD-BEARING AND MUST NOT BE RENAMED. Real
 * Confirmed rows in the roster DB carry "Girls Beginner" verbatim; changing the
 * string strands them from the seat count, the duplicate guard and the admin
 * roster in one edit. Pinned by invariant-monday-girls-block-capacity.
 */
export const MONDAY_GIRLS_BEGINNER = "Girls Beginner" as const;
export const MONDAY_GIRLS_ADVANCED_BEGINNER = "Girls Advanced Beginner" as const;

export const MONDAY_GIRLS_LEVELS = [
  MONDAY_GIRLS_BEGINNER,
  MONDAY_GIRLS_ADVANCED_BEGINNER,
] as const;

export type MondayGirlsGroup = (typeof MONDAY_GIRLS_LEVELS)[number];

/**
 * The level a row gets when nothing else says otherwise — an admin "maybe"
 * jotted down mid-conversation, for instance. Beginner, because that is the
 * door this block was built to open.
 */
export const MONDAY_GIRLS_DEFAULT_LEVEL: MondayGirlsGroup = MONDAY_GIRLS_BEGINNER;

/** Pickleball courts the Monday hold actually yields. */
export const MONDAY_GIRLS_PICKLEBALL_COURTS =
  MONDAY_GIRLS_TENNIS_COURTS * PICKLEBALL_COURTS_PER_TENNIS_COURT;

/**
 * Seats — ONE cap for the WHOLE BLOCK, shared by both levels. Derived from the
 * court booking, never typed: book a second tennis court and the seats follow.
 *
 * WHY THIS IS A SCALAR AND NOT A PER-LEVEL MAP, which is the opposite of what
 * the Walter Johnson season does and looks at a glance like the bug
 * invariant-fall-seat-cap-per-group.spec.ts exists to prevent:
 *
 *   Walter Johnson's Green (1:00–2:30) and Yellow (2:30–4:00) own DIFFERENT
 *   HOURS. Each group has its own court-time, so a shared scalar there gates
 *   one group on the other's fill — a real bug, correctly pinned.
 *
 *   Both Monday levels play the SAME 6:00–7:00 PM hour on the SAME single
 *   tennis court (Sam, 2026-09-20: "it's that same session, expanding the
 *   group"). One booking, one hour, one cap. A per-level cap of 8 would seat 16
 *   girls on 2 pickleball courts; a per-level cap of 4 would turn away an
 *   all-beginner fill the court can hold, which is exactly the flexibility
 *   widening the block was meant to buy.
 *
 * So capacity here is a property of the BOOKING, and the level is a placement
 * label on a registration. To change capacity, change the booking or
 * MONDAY_GIRLS_PLAYERS_PER_COURT — never PLAYERS_PER_PICKLEBALL_COURT, which
 * sizes drop-ins and every venue's playerCapacity site-wide.
 */
export const MONDAY_GIRLS_PLAYERS_PER_COURT = PLAYERS_PER_PICKLEBALL_COURT;

export const MONDAY_GIRLS_BLOCK_SEATS =
  MONDAY_GIRLS_PICKLEBALL_COURTS * MONDAY_GIRLS_PLAYERS_PER_COURT;

/**
 * The block's seat cap. Takes NO level argument on purpose — a signature that
 * accepted one would tell every caller that levels have separate caps.
 */
export function mondayGirlsBlockSeats(): number {
  return MONDAY_GIRLS_BLOCK_SEATS;
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
 * girl already in the group that she does not qualify. The band was widened
 * DOWN to the roster that existed rather than up to one we hoped for.
 *
 * WIDENED UP to 12 on 2026-09-20 when the block opened to advanced beginners
 * (Sam): an advanced beginner is frequently an older girl who simply started
 * late, and the block's job is to hold any girl who wants girls-only play until
 * she is ready for Green Ball. 12 is the ceiling because above it a player who
 * is genuinely beyond advanced-beginner belongs on the ladder, not here.
 *
 * This is COPY only. Checkout validates against NGA's site-wide 6–16 window
 * (see validate-monday-girls-registration.ts), so the band can never hard-block
 * a sibling or an edge-case registration — a coach placing a player is the
 * right check, not a form field.
 */
export const MONDAY_GIRLS_AGE_MIN = 7;
export const MONDAY_GIRLS_AGE_MAX = 12;

/**
 * How each session runs. One string, reused by the page and the confirmation
 * email so a parent reads the same thing in both places.
 */
export const MONDAY_GIRLS_SESSION_FORMAT =
  "30 minutes of coached skill work, then 30 minutes of games with the group";

/**
 * The sentence that says what a parent is actually buying, and the one that
 * answers Amanda Stone's original objection. Every surface that quotes the
 * price carries it.
 *
 * REWRITTEN 2026-09-20 with the two-level widening. It used to read "every
 * player in this block is a girl at the same beginner stage" — a promise about
 * STAGE, which stopped being true the moment the block spanned beginner and
 * advanced beginner across ages 7–12. The promise is now about the SETTING,
 * which is what these families actually said yes to and what stays true however
 * the roster fills.
 */
export const MONDAY_GIRLS_PEER_NOTE =
  "Every player on court is a girl, and we group them by where they actually are that week — so nobody is the only girl out there, and nobody is stuck in a group that is too easy or too fast for her.";

/**
 * Where this block LEADS. Sam's framing on 2026-09-20: the block is an on-ramp,
 * not a destination — a girl plays here until she is ready for Green Ball.
 *
 * DELIBERATELY NOT the words "Green Ball League". Three different things could
 * mean that — the Fall 2026 League product at /league (14U/16U divisions), the
 * Walter Johnson Sunday Green season, and Green Ball as a rung on the ladder —
 * and Open Brain records a family nearly being sold the wrong product under
 * exactly that ambiguity. So this names a LEVEL and points at the ladder, which
 * is true all year and implies no product. Do not turn it into a league link
 * without picking one deliberately.
 */
export const MONDAY_GIRLS_PATHWAY_NOTE =
  "This block is a starting point, not a ceiling. When a girl is rallying, serving and keeping score on her own, Coach Sam will tell you she's ready to step up to Green Ball and play the wider Next Gen ladder.";

export const MONDAY_GIRLS_PATHWAY_HREF = "/#levels";
