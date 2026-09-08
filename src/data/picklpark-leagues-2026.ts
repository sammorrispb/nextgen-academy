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
// NO PRICE LIVES HERE, deliberately. Podplay quotes at the point of sale, and
// a second copy on this site is a number that can only go stale — the exact
// drift the composed-description rule on /picklpark already exists to stop.
// There is no `priceUsd` field to fill in; `picklpark-leagues.spec.ts` fails
// if a dollar figure appears in this file at all.
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
  /** Podplay event permalink. The ONLY place a family registers. */
  signupUrl: string;
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
    signupUrl:
      "https://thepicklpark.podplay.app/community/events/01a07ce8-f855-744f-a7fa-0bc238e31526",
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
    signupUrl:
      "https://thepicklpark.podplay.app/community/events/01a07cee-1f17-744f-a7fd-564453229c58",
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

/** The one-line "which one is my kid?" pointer, shared by page and emails. */
export const PICKLPARK_LEAGUE_PLACEMENT_NOTE =
  `Not sure which one fits? Start in Kid's Drill and Play, or email Coach Sam at ${PICKLPARK_LEAGUE_COACH_EMAIL} and he'll tell you where your player belongs.`;
