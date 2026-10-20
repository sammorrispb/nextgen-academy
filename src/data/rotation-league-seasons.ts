import { FALL_SUNDAYS } from "@/data/fall-2026";

// Seasons run on Link & Dink's rotation-league engine (community-os
// packages/rotation-league, ld.rotation_league_*), reached through
// /play/api/internal/nga-rotation-league. NGA stays the system of record for
// families: the registration rows live here, and only a child's first and last
// name plus the registration's page id cross over (Sam, 2026-10-19).
//
// Adding a season is one entry. `slug` is the Link & Dink season key and must
// never change once the season has games: the roster, check-ins and scores
// hang off it. `rosterGroup` is the registration DB's Group select value.

export type RotationLeagueRosterSource = "fall";

export interface RotationLeagueSeason {
  slug: string;
  /** Coach-facing name. Never rendered on a parent or public page. */
  name: string;
  /** Short label for cards and headings. */
  label: string;
  /** Link & Dink division id; also seeds the planner (`<division>-W<week>-A<n>`). */
  division: string;
  rosterSource: RotationLeagueRosterSource;
  rosterGroup: string;
  /** Pickleball courts the group has each night. */
  courts: number;
  targetGamesPerPlayer: number;
  playWeeks: readonly number[];
  playoffWeek: number | null;
  gameTarget: number;
  gameTargets: readonly number[];
  winBy: number;
  status: "draft" | "running" | "complete" | "archived";
  /** ISO date per week, for the coach's reference. Weeks without one show the number only. */
  weekDates: Readonly<Record<number, string>>;
  /** Shown on every screen of the season. */
  note?: string;
}

const FALL_WEEK_DATES: Record<number, string> = Object.fromEntries(
  FALL_SUNDAYS.map((date, i) => [i + 1, date]),
);

const TRIAL_NOTE =
  "Trial run beside the Notion season play. Nothing here changes the Fall standings parents see; the parent link still reads the Notion games.";

export const ROTATION_LEAGUE_SEASONS: readonly RotationLeagueSeason[] = [
  {
    slug: "nga-fall-2026-green-trial",
    name: "Fall 2026 Green (trial)",
    label: "Green Ball",
    division: "green",
    rosterSource: "fall",
    rosterGroup: "Green",
    courts: 2,
    targetGamesPerPlayer: 3,
    playWeeks: [1, 2, 3, 4, 5],
    playoffWeek: 6,
    gameTarget: 11,
    gameTargets: [11, 15, 21],
    winBy: 2,
    status: "draft",
    weekDates: FALL_WEEK_DATES,
    note: TRIAL_NOTE,
  },
  {
    slug: "nga-fall-2026-yellow-trial",
    name: "Fall 2026 Yellow (trial)",
    label: "Yellow Ball",
    division: "yellow",
    rosterSource: "fall",
    rosterGroup: "Yellow",
    courts: 2,
    targetGamesPerPlayer: 3,
    playWeeks: [1, 2, 3, 4, 5],
    playoffWeek: 6,
    gameTarget: 11,
    gameTargets: [11, 15, 21],
    winBy: 2,
    status: "draft",
    weekDates: FALL_WEEK_DATES,
    note: TRIAL_NOTE,
  },
];

export function findRotationLeagueSeason(slug: unknown): RotationLeagueSeason | null {
  if (typeof slug !== "string") return null;
  return ROTATION_LEAGUE_SEASONS.find((s) => s.slug === slug) ?? null;
}

/** A play week of this season, or null. The playoff week is not a play week. */
export function parsePlayWeek(season: RotationLeagueSeason, week: unknown): number | null {
  const n = typeof week === "string" ? Number(week) : week;
  return typeof n === "number" && Number.isInteger(n) && season.playWeeks.includes(n) ? n : null;
}
