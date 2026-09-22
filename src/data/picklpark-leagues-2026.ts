// The Fall 2026 Saturday league at The Pickl Park — the BOOKABLE product,
// and the single source of truth for /picklpark, the /fall and
// /schedule cross-links, the events feed and the weekly newsletter.
//
// WHO TAKES THE MONEY CHANGED (Sam, 2026-09-07). Until now NGA sold its own
// $225 Saturday season here through /api/checkout-picklpark: Red & Orange
// 3:00–4:00 and Green & Yellow 4:00–5:00, with a $20 all-levels Open Court at
// 2:00 as the on-ramp. The Pickl Park now sells the Saturday itself through
// podplay, so:
//
//   2:00–3:00  Kid's Drill and Play  — replaces the $20 Open Court hour
//
// (There was a second league, Youth League 3:00–4:30, replacing BOTH old
// season blocks. Sam, 2026-09-22: REMOVED — The Pickl Park changed its dates
// (a possible October 24 start was mentioned but never confirmed) and the
// old Sep 26 – Oct 31 dates are wrong. No Youth League dates are confirmed,
// so it is off every public surface until real dates exist. Re-add with a
// fresh entry — never edit the removed one back in — when dates confirm.)
//
// Red & Orange has no successor: beginners go to Drill and Play instead. The
// NGA season is retired (picklParkRegistrationOpen is now permanently false)
// and the Open Court recurring template is inactive. Nothing on this site
// takes a payment for a Pickl Park Saturday any more.
//
// PRICE IS TWO-TIER, AND LIVES ON EXACTLY ONE SURFACE (Sam, 2026-09-20).
// The Pickl Park charges members less than everyone else, and until now this
// site published no price at all — so a non-member read podplay's "$225 per
// player" in the listing description and was then charged $250 at the box.
// Both numbers were right; neither said which was which.
//
// The old rule here was "no price anywhere", on the sound reasoning that a
// second copy of someone else's number can only go stale. That reasoning is
// unchanged, so the fix is scope, not volume: the prices live in this file and
// render on **/picklpark ONLY** — the page where a parent is actually choosing
// — and NOT on the aggregator surfaces (the weekly newsletter block, llms.txt,
// /league, /youth-pickleball-frederick, the /fall and /schedule cross-links,
// the FAQ or the blog). One copy to keep true instead of eight.
//
// `picklpark-leagues.spec.ts` enforces both halves: the prices must be present
// and coherent here, every shared composed line must stay free of a dollar
// figure, and /picklpark must be the only page source that reads them.
//
// The dates, venue, makeup Saturday and indoor note still live in
// picklpark-2026.ts — they describe the Saturday, not who sells it, and both
// leagues run the same six.

/** Ages 6–16 is the whole academy; a league never widens it. */

export interface PicklParkLeague {
  slug: string;
  /** Public title. Ours, not podplay's — see `podplayTitle`. */
  title: string;
  /** Exactly what the podplay listing calls it, so a parent who clicks
   * through recognises the page they land on. */
  podplayTitle: string;
  /** Where this sits on the ball-colour ladder, in parent words. */
  levelLabel: string;
  startTime: string;
  endTime: string;
  /** "2:00–3:00 PM" — composed once so no surface re-derives it. */
  timeLabel: string;
  minAge: number;
  maxAge: number;
  /** "Ages 8–13" / "Ages 10+" — the podplay framing, not minAge–maxAge. */
  ageLabel: string;
  blurb: string;
  /**
   * How the hour splits, PER LEAGUE — "30 minutes of coached drills, then 30
   * minutes of game play". Per-league (not one shared constant) so the line
   * can never go stale if a league's split changes. Podplay says
   * "first half / second half"; this spells the halves out.
   */
  sessionFormat: string;
  /**
   * Podplay permalink. The ONLY place a family registers.
   *
   * THIS FIELD CAUSED A 12-DAY DEAD LINK (corrected 2026-09-20 — the first
   * account of it, written the same day, was wrong and is worth knowing about
   * because the wrong version is the intuitive one).
   *
   * The story is NOT "the vendor rebuilt the season and retired our URLs".
   * These are UUIDv7 ids, so each carries its own creation time, and all four
   * decode to 2026-09-07 within 29 minutes of each other — corroborated by
   * `og:updated_time` on both live listings. Nothing was re-issued on 09-20:
   *
   *   17:27:17  intro  01a07ce8… (captured here, abandoned ~29 min later)
   *   17:32:55  youth  01a07cee-1f17… event      ─┐ 131 ms apart: podplay
   *   17:32:55  youth  01a07cee-1f9a… series     ─┘ makes both together
   *   17:56:24  intro  01a07d03… (the live one)
   *
   * So the ids were already superseded when PR #321 committed them at 21:20
   * EDT that evening — 7.4 hours after the replacements existed. Every
   * "Register" click from #321 until #345 on 09-20 landed a parent on a
   * superseded listing, on the page CLAUDE.md calls the primary conversion
   * surface, in a market with zero Frederick families in the CRM.
   *
   * Two things follow, and neither is "watch for vendor rebuilds":
   *
   * 1. A URL copied out of a vendor UI can be stale before it is committed.
   *    Re-open every `signupUrl` right before merging, and again when a season
   *    goes on sale. Nothing on this site checks that these are alive.
   * 2. `/community/events/<id>` vs `/community/series/<id>` is NOT
   *    single-vs-multi-week — Kid's Drill and Play is six weeks on an `events`
   *    URL and its page lists all six Saturdays. The series id is the wrapper
   *    podplay mints beside the event in the same transaction; copying the
   *    event when a series exists is exactly the mistake made here. Prefer the
   *    series URL when the listing has one.
   *
   * A superseded listing still renders its title, description, price and a
   * live seat count, and only says "Admission is no longer available" at the
   * button — so verify a replacement by OPENING it and reading the title.
   * Never by id prefix: the old and new Youth League ids share eight
   * characters precisely BECAUSE they were minted 131 ms apart.
   */
  signupUrl: string;
  /**
   * Season price in whole dollars, for the full six weeks.
   *
   * TWO TIERS because The Pickl Park sells it that way: `memberPriceUsd` is
   * for its own members, `nonMemberPriceUsd` for everyone else. The number
   * podplay shows in its price box is the NON-member one — that is the trap
   * this pair exists to close, since the listing description quotes the member
   * price without the word "member" anywhere near it.
   *
   * These are The Pickl Park's numbers, not NGA's, so they can change without
   * anyone telling us. Anything rendering them must say whose membership it
   * means — never a bare "members" — and must stay on /picklpark.
   */
  memberPriceUsd: number;
  nonMemberPriceUsd: number;
  /** ISO date-only when public signup opens. Omitted = open now. Set for the
   * Intro league, which is members-only until 2026-09-09 — linking it without
   * saying so drops a parent onto a "Become a member" gate. */
  signupOpensOn?: string;
}

export const PICKLPARK_LEAGUE_COACH_EMAIL = "nextgenacademypb@gmail.com";

export const PICKLPARK_LEAGUES: readonly PicklParkLeague[] = [
  {
    slug: "drill-and-play",
    title: "Kid's Drill and Play",
    podplayTitle: "Kid's Drill and Play with Next Gen Pickleball Academy",
    levelLabel: "New to pickleball · Red & Orange Ball",
    startTime: "2:00 PM",
    endTime: "3:00 PM",
    timeLabel: "2:00–3:00 PM",
    minAge: 8,
    maxAge: 13,
    ageLabel: "Ages 8–13",
    sessionFormat:
      "30 minutes of coached drills, then 30 minutes of game play",
    blurb:
      "A fun, high-energy six-week season of drilling and playing pickleball. It's a great entry into the sport for a new or beginner player — no prior experience needed, equipment provided, and lots of chances to hit and move.",
    memberPriceUsd: 150,
    nonMemberPriceUsd: 175,
    signupUrl:
      "https://thepicklpark.podplay.app/community/events/01a07d03-9f72-744f-a80c-6284f8f60fd5",
    signupOpensOn: "2026-09-09",
  },
];

// (Youth League entry removed 2026-09-22 — see the header note. The array's
// only remaining league is drill-and-play.)

export function findPicklParkLeague(
  slug: string,
): PicklParkLeague | undefined {
  return PICKLPARK_LEAGUES.find((l) => l.slug === slug);
}

/**
 * Whether public signup for a league has opened yet. Date-injected, never
 * `new Date()`, so the spec pins the boundary instead of the clock.
 */
export function picklParkLeagueSignupOpen(
  league: PicklParkLeague,
  todayIso: string,
): boolean {
  return !league.signupOpensOn || todayIso >= league.signupOpensOn;
}

/** "Saturdays 2:00–3:00 PM · Ages 8–13" — one line, reused by every surface. */
export function picklParkLeagueSummary(league: PicklParkLeague): string {
  return `${league.title} ${league.timeLabel} · ${league.ageLabel}`;
}

/**
 * "each hour is drills then games" phrased once, for the surfaces that
 * describe the Saturday in one sentence (the /fall and /schedule
 * cross-links, the newsletter). Says "half" rather than a minute count so
 * the line never needs re-deriving if the split changes.
 */
export const PICKLPARK_LEAGUES_FORMAT_LINE =
  "each session is coached drills for the first half, then game play for the second";

/** Start time as 24h "HH:MM", for JSON-LD. Parsed, never pattern-matched. */
export function picklParkLeagueStartHour24(league: PicklParkLeague): string {
  const m = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(league.startTime.trim());
  if (!m) throw new Error(`unparseable startTime: ${league.startTime}`);
  let hour = Number(m[1]) % 12;
  if (m[3].toUpperCase() === "PM") hour += 12;
  return `${String(hour).padStart(2, "0")}:${m[2]}`;
}

/**
 * "$150 per player for The Pickl Park members, $175 for everyone else" —
 * composed once so
 * the two tiers can never be shown without each other, and so "members" is
 * never a bare word a parent could read as an NGA membership they don't have.
 *
 * Intended for /picklpark and nothing else; see the header note. It returns a
 * fragment, not a sentence, so the page can label it the way it labels the
 * session format right above it.
 */
export function picklParkLeaguePriceLine(league: PicklParkLeague): string {
  return `$${league.memberPriceUsd} per player for The Pickl Park members, $${league.nonMemberPriceUsd} for everyone else`;
}

/** The one-line "which one is my kid?" pointer, shared by page and emails. */
export const PICKLPARK_LEAGUE_PLACEMENT_NOTE =
  `Not sure which one fits? Start in Kid's Drill and Play, or email Coach Sam at ${PICKLPARK_LEAGUE_COACH_EMAIL} and he'll tell you where your player belongs.`;
