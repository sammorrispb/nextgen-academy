// NGA Fall 2026 Sunday season — LEAGUE PLAY config (one league per colour group).
//
// NOT the "Fall 2026 League" product in ./leagues.ts (14U/16U age divisions,
// /league). That is a separate, unlaunched offering; this file configures the
// rotating-partner standings that run INSIDE the Walter Johnson Sunday season
// sold on /fall. Parent-facing copy says "Fall Season standings", never "the
// fall league", so the two can't be confused in a WhatsApp group (Open Brain,
// 2026-08-29: a family was nearly told the wrong product under that name).
//
// Terms (Sam, 2026-09-13):
//   - weeks 1–5 are league play. Every round runs a DOUBLES court and a SINGLES
//     court, so with six kids nobody sits and each kid plays exactly three games
//     a Sunday (two doubles, one singles). Games to 11, win by 2.
//   - week 6 is the playoff: teams snake-seeded from the standings (1+6, 2+5,
//     3+4; an odd lowest-ranked kid rides as a third on the last team), then a
//     double-elimination bracket of single games to 11.
//   - every pair of kids partners a near-equal number of times across the
//     season; the engine reads the season's played games to guarantee it.
// Every number here is imported from the season files rather than re-typed, so
// a venue or court change on /fall reaches the engine without a second edit.

import {
  FALL_SUNDAYS,
  FALL_TENNIS_COURTS_PER_SESSION,
  FALL_VENUE_SHORT,
} from "./fall-2026";
import { FALL_SEASON_GROUPS, type FallSeasonGroup } from "./fall-season-2026";
import { PICKLEBALL_COURTS_PER_TENNIS_COURT } from "./venue-parking";

export type SeasonLeagueGroup = FallSeasonGroup;

/** Green Ball 1:00–2:30 PM · Yellow Ball 2:30–4:00 PM — one league each. */
export const SEASON_LEAGUE_GROUPS = FALL_SEASON_GROUPS;

export const SEASON_LEAGUE_VENUE_SHORT = FALL_VENUE_SHORT;

/** The six Sundays, week 1 first. A washed-out week slides to a rain date and
 * keeps its number — rows key on Week, never on the calendar date. */
export const SEASON_LEAGUE_SUNDAYS = FALL_SUNDAYS;

export const SEASON_LEAGUE_WEEKS = [1, 2, 3, 4, 5, 6] as const;
export type SeasonLeagueWeek = (typeof SEASON_LEAGUE_WEEKS)[number];

export const SEASON_LEAGUE_PLAY_WEEKS = [1, 2, 3, 4, 5] as const;
export const SEASON_LEAGUE_PLAYOFF_WEEK: SeasonLeagueWeek = 6;

/** One tennis court per group block = two pickleball courts. */
export const SEASON_LEAGUE_COURTS =
  FALL_TENNIS_COURTS_PER_SESSION * PICKLEBALL_COURTS_PER_TENNIS_COURT;

export const SEASON_LEAGUE_GAME_TARGET = 11;
export const SEASON_LEAGUE_WIN_BY = 2;
/** The Sunday target; the engine rounds UP so nobody plays fewer. */
export const SEASON_LEAGUE_GAMES_PER_PLAYER = 3;

/** The bracket engine is exhaustive-tested to this size (Yellow sells to 10
 * kids = 5 teams). */
export const SEASON_LEAGUE_MAX_BRACKET_TEAMS = 8;

/** Parent-facing title. Deliberately not "league" — see the header. */
export const SEASON_LEAGUE_PUBLIC_TITLE = "Fall Season standings";

/** Notion row-key prefix per league: G-W2-R1-C1, Y-W6-DAY, … */
export const SEASON_LEAGUE_KEY_PREFIX: Record<SeasonLeagueGroup, "G" | "Y"> = {
  Green: "G",
  Yellow: "Y",
};

export function seasonLeagueGroupSlug(group: SeasonLeagueGroup): string {
  return group.toLowerCase();
}

export function seasonLeagueGroupFromSlug(
  raw: string | undefined,
): SeasonLeagueGroup | null {
  const slug = (raw ?? "").trim().toLowerCase();
  const hit = SEASON_LEAGUE_GROUPS.find((g) => g.group.toLowerCase() === slug);
  return hit ? hit.group : null;
}

export function isSeasonLeagueWeek(raw: unknown): raw is SeasonLeagueWeek {
  return (
    typeof raw === "number" &&
    (SEASON_LEAGUE_WEEKS as readonly number[]).includes(raw)
  );
}

export function parseSeasonLeagueWeek(raw: string | undefined): SeasonLeagueWeek | null {
  const n = Number(raw);
  return isSeasonLeagueWeek(n) ? n : null;
}

/** The Sunday a week is scheduled for (informational — see SEASON_LEAGUE_SUNDAYS). */
export function seasonLeagueWeekDate(week: SeasonLeagueWeek): string {
  return SEASON_LEAGUE_SUNDAYS[week - 1];
}
