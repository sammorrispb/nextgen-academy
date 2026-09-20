// The two Fall 2026 Saturday leagues at The Pickl Park — the BOOKABLE
// products, and the single source of truth for /picklpark, the /fall and
// /schedule cross-links, the events feed and the weekly newsletter.
//
// WHO TAKES THE MONEY CHANGED (Sam, 2026-09-07). Until now NGA sold its own
// $225 Saturday season here through /api/checkout-picklpark: Red & Orange
// 3:00–4:00 and Green & Yellow 4:00–5:00, with a $20 all-levels Open Court at
// 2:00 as the on-ramp. The Pickl Park now sells the Saturday itself through
// podplay, so:
//
//   2:00–3:00  Kid's Drill and Play  — replaces the $20 Open Court hour
//   3:00–4:30  Youth League          — replaces BOTH season blocks
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
import { LEAGUE_AGE_MAX } from "./leagues";

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
   * minutes of game play". Not one shared constant: the old blocks were both
   * 60 minutes so a single string worked, but Youth League is 90, and a
   * blanket "30 and 30" leaves a third of that session undescribed. Podplay
   * says "first half / second half"; this spells the halves out.
   */
  sessionFormat: string;
  /**
   * Podplay permalink. The ONLY place a family registers.
   *
   * Two path shapes are valid, and which one a league gets is podplay's
   * choice, not ours: `/community/events/<id>` for a single listing and
   * `/community/series/<id>` for one that spans weeks. Both were re-issued on
   * 2026-09-20 when The Pickl Park rebuilt the two listings — the originals
   * still resolve but answer "Admission is no longer available", which is a
   * dead end a parent cannot tell apart from a working page. Verify a
   * replacement by OPENING it and reading the title, never by matching id
   * prefixes: the old and new Youth League ids share their first 8 characters.
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

export const PICKLPARK_LEAGUE_COACH_EMAIL = "sam.morris2131@gmail.com";

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
  {
    slug: "youth-league",
    title: "Youth League",
    podplayTitle: "Youth League with Next Gen Academy",
    levelLabel: "Green & Yellow Ball",
    startTime: "3:00 PM",
    endTime: "4:30 PM",
    timeLabel: "3:00–4:30 PM",
    minAge: 10,
    maxAge: LEAGUE_AGE_MAX,
    ageLabel: "Ages 10+",
    sessionFormat:
      "45 minutes of coached drills, then 45 minutes of game play",
    blurb:
      "Six weeks of weekly meetups: we drill and practice for the first half of each session, then play games for the second half. It's for players who already keep a rally going — serving and returning, dropping, driving, volleying, and moving around the court. Across the season they'll add more advanced technique, court positioning, and shot selection.",
    memberPriceUsd: 225,
    nonMemberPriceUsd: 250,
    signupUrl:
      "https://thepicklpark.podplay.app/community/series/01a07cee-1f9a-744f-a7fd-9b12c7c8420a",
  },
];

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
 * "each hour is drills then games" phrased for BOTH leagues at once, for the
 * surfaces that describe the Saturday in one sentence (the /fall and
 * /schedule cross-links, the newsletter). Says "half" rather than a minute
 * count precisely because the two leagues split differently — 30/30 and
 * 45/45 — so one number would be wrong for one of them.
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
