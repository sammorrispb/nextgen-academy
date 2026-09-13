import {
  SEASON_LEAGUE_COURTS,
  SEASON_LEAGUE_GAMES_PER_PLAYER,
  SEASON_LEAGUE_GAME_TARGET,
  SEASON_LEAGUE_GROUPS,
  SEASON_LEAGUE_MAX_BRACKET_TEAMS,
  SEASON_LEAGUE_PLAYOFF_WEEK,
  SEASON_LEAGUE_PLAY_WEEKS,
  SEASON_LEAGUE_PUBLIC_TITLE,
  SEASON_LEAGUE_VENUE_SHORT,
  SEASON_LEAGUE_WEEKS,
  SEASON_LEAGUE_WIN_BY,
  seasonLeagueGroupFromSlug,
  seasonLeagueWeekDate,
  type SeasonLeagueGroup,
  type SeasonLeagueWeek,
} from "@/data/season-league-2026";
import {
  fetchFallRosterForLeague,
  type FallRosterPlayer,
  type FallRosterStatus,
} from "@/lib/notion-fall-registrations";
import {
  buildDayRowProps,
  buildGameRowProps,
  buildPlayoffRowProps,
  buildTeamRowProps,
  dayKey,
  fetchSeasonLeagueRows,
  gameKey,
  playoffKey,
  recordSeasonLeagueScore,
  teamKey,
  upsertSeasonLeagueRows,
  voidSeasonLeagueRows,
  type SeasonLeagueReadStatus,
  type SeasonLeagueRow,
} from "@/lib/notion-season-league";
import {
  resolveBracket,
  snakeTeams,
  type BracketResult,
  type BracketState,
  type Team,
} from "@/lib/season-league/finals";
import { buildNameMap, nameFor, sideLabel } from "@/lib/season-league/names";
import {
  buildHistory,
  courtAllocation,
  defaultRounds,
  planDay,
} from "@/lib/season-league/rotation";
import { validateScore } from "@/lib/season-league/scores";
import { computeStandings, type StandingRow } from "@/lib/season-league/standings";
import type {
  CourtAllocation,
  PlannedGame,
  PlannedRound,
  PlayedGame,
  PlayerId,
} from "@/lib/season-league/types";
import { verifyStandingsLink } from "@/lib/standings-link-token";

/**
 * The season-league orchestration layer: everything a coach action or a page
 * needs, over the pure engine + the two Notion readers. Actions are thin
 * requireCoach wrappers around the functions here (the same shape as
 * applyAttendance / executeSessionCancel), so the behaviour is testable with
 * FetchStub and nothing lives only in a "use server" file.
 *
 * Minor-data posture: the roster reader hands over ids + first names only,
 * and every parent-facing shape built here (StandingsView) carries first
 * names, scores and dates — never a parent field, a birth year, an age, or
 * a sitting/"unpicked" list. Pinned by invariant-season-league-egress.
 */

export const SCORE_RULES = {
  target: SEASON_LEAGUE_GAME_TARGET,
  winBy: SEASON_LEAGUE_WIN_BY,
} as const;

// ---------------------------------------------------------------------------
// Snapshot
// ---------------------------------------------------------------------------

export interface WeekSummary {
  week: SeasonLeagueWeek;
  date: string;
  dayRow: SeasonLeagueRow | null;
  /** Non-void League/Playoff games for the week, sorted by round then court. */
  games: SeasonLeagueRow[];
  played: number;
  scheduled: number;
}

export interface PlayoffSnapshot {
  locked: boolean;
  teams: Team[];
  teamRows: SeasonLeagueRow[];
  games: SeasonLeagueRow[];
  results: BracketResult[];
  state: BracketState | null;
}

export interface LeagueSnapshot {
  group: SeasonLeagueGroup;
  rosterStatus: FallRosterStatus;
  rowsStatus: SeasonLeagueReadStatus;
  roster: FallRosterPlayer[];
  confirmed: FallRosterPlayer[];
  names: Map<PlayerId, string>;
  rows: SeasonLeagueRow[];
  playedGames: PlayedGame[];
  standings: StandingRow[];
  weeks: WeekSummary[];
  playoff: PlayoffSnapshot;
}

function isPlayWeek(week: number): boolean {
  return (SEASON_LEAGUE_PLAY_WEEKS as readonly number[]).includes(week);
}

function toPlannedGame(row: SeasonLeagueRow): PlannedGame {
  return {
    round: row.round,
    court: row.court,
    format: row.format || "doubles",
    sideA: row.sideA,
    sideB: row.sideB,
  };
}

function toPlayedGame(row: SeasonLeagueRow): PlayedGame | null {
  if (row.status !== "Played" || row.scoreA === null || row.scoreB === null) return null;
  return {
    format: row.format || "doubles",
    sideA: row.sideA,
    sideB: row.sideB,
    scoreA: row.scoreA,
    scoreB: row.scoreB,
    week: row.week,
    round: row.round,
  };
}

function byRoundThenCourt(a: SeasonLeagueRow, b: SeasonLeagueRow): number {
  return a.round - b.round || a.court - b.court || a.key.localeCompare(b.key);
}

export function buildSnapshot(
  group: SeasonLeagueGroup,
  roster: FallRosterPlayer[],
  rosterStatus: FallRosterStatus,
  rows: SeasonLeagueRow[],
  rowsStatus: SeasonLeagueReadStatus,
): LeagueSnapshot {
  const confirmed = roster.filter((p) => p.status === "Confirmed");
  const names = buildNameMap(roster);
  const live = rows.filter((r) => r.league === group && r.status !== "Void");

  const playedGames = live
    .filter((r) => r.phase === "League" && isPlayWeek(r.week))
    .map(toPlayedGame)
    .filter((g): g is PlayedGame => g !== null);

  const standings = computeStandings(
    confirmed.map((p) => p.pageId),
    playedGames,
    { nameOf: (id) => nameFor(names, id) },
  );

  const weeks: WeekSummary[] = SEASON_LEAGUE_WEEKS.map((week) => {
    const games = live
      .filter((r) => r.week === week && (r.phase === "League" || r.phase === "Playoff"))
      .sort(byRoundThenCourt);
    return {
      week,
      date: seasonLeagueWeekDate(week),
      dayRow: live.find((r) => r.week === week && r.phase === "Day") ?? null,
      games,
      played: games.filter((g) => g.status === "Played").length,
      scheduled: games.filter((g) => g.status === "Scheduled").length,
    };
  });

  const teamRows = live
    .filter((r) => r.phase === "Team" && r.week === SEASON_LEAGUE_PLAYOFF_WEEK && r.seed > 0)
    .sort((a, b) => a.seed - b.seed);
  const teams: Team[] = teamRows.map((r) => ({ seed: r.seed, members: r.sideA }));
  const playoffGames = live
    .filter((r) => r.phase === "Playoff" && r.week === SEASON_LEAGUE_PLAYOFF_WEEK)
    .sort(byRoundThenCourt);
  const results: BracketResult[] = playoffGames
    .filter((r) => r.status === "Played" && r.scoreA !== null && r.scoreB !== null && r.slot)
    .map((r) => ({ slot: r.slot, scoreA: r.scoreA as number, scoreB: r.scoreB as number }));
  const locked = teams.length >= 2;

  return {
    group,
    rosterStatus,
    rowsStatus,
    roster,
    confirmed,
    names,
    rows,
    playedGames,
    standings,
    weeks,
    playoff: {
      locked,
      teams,
      teamRows,
      games: playoffGames,
      results,
      state: locked ? resolveBracket(teams.length, results) : null,
    },
  };
}

export async function loadLeagueSnapshot(group: SeasonLeagueGroup): Promise<LeagueSnapshot> {
  const [roster, rows] = await Promise.all([
    fetchFallRosterForLeague(group),
    fetchSeasonLeagueRows(group),
  ]);
  return buildSnapshot(group, roster.players, roster.status, rows.rows, rows.status);
}

// ---------------------------------------------------------------------------
// Input validation shared by the actions
// ---------------------------------------------------------------------------

export function parseGroup(raw: unknown): SeasonLeagueGroup | null {
  if (typeof raw !== "string") return null;
  const exact = SEASON_LEAGUE_GROUPS.find((g) => g.group === raw);
  return exact ? exact.group : seasonLeagueGroupFromSlug(raw);
}

export function parseWeek(raw: unknown): SeasonLeagueWeek | null {
  const n = typeof raw === "number" ? raw : Number(raw);
  return (SEASON_LEAGUE_WEEKS as readonly number[]).includes(n) ? (n as SeasonLeagueWeek) : null;
}

/** Ids the client sent, kept only if they are Confirmed roster rows. */
function presentFrom(snapshot: LeagueSnapshot, presentIds: readonly unknown[]): PlayerId[] {
  const allowed = new Set(snapshot.confirmed.map((p) => p.pageId));
  const out: PlayerId[] = [];
  for (const raw of presentIds) {
    if (typeof raw === "string" && allowed.has(raw) && !out.includes(raw)) out.push(raw);
  }
  return out;
}

function parseRounds(raw: unknown): number | undefined {
  if (raw === undefined || raw === null || raw === "") return undefined;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 0 || n > 12) return undefined;
  return n;
}

// ---------------------------------------------------------------------------
// League days (weeks 1–5)
// ---------------------------------------------------------------------------

export interface DayInput {
  group: unknown;
  week: unknown;
  presentIds: unknown[];
  rounds?: unknown;
}

export type DayPreview =
  | {
      ok: true;
      group: SeasonLeagueGroup;
      week: SeasonLeagueWeek;
      present: PlayerId[];
      allocation: CourtAllocation;
      roundsPlayed: number;
      defaultNewRounds: number;
      rounds: PlannedRound[];
      attempt: number;
      names: Record<PlayerId, string>;
    }
  | { ok: false; message: string };

function computeDay(snapshot: LeagueSnapshot, week: SeasonLeagueWeek, presentIds: unknown[], roundsRaw: unknown): DayPreview {
  if (!isPlayWeek(week)) return { ok: false, message: "Week 6 is the playoff — use the teams panel" };
  if (snapshot.rowsStatus !== "ok") {
    return {
      ok: false,
      message:
        snapshot.rowsStatus === "config_missing"
          ? "NOTION_SEASON_LEAGUE_DB_ID is not set — nothing can be saved"
          : "Couldn't read the games database — try again",
    };
  }
  const present = presentFrom(snapshot, presentIds);
  if (present.length < 2) return { ok: false, message: "Check in at least two kids" };

  const weekSummary = snapshot.weeks.find((w) => w.week === week)!;
  const playedToday = weekSummary.games
    .filter((g) => g.phase === "League" && g.status === "Played")
    .map(toPlannedGame);
  const roundsPlayed = playedToday.reduce((m, g) => Math.max(m, g.round), 0);
  const defaultNewRounds = Math.max(
    0,
    defaultRounds(present.length, SEASON_LEAGUE_COURTS, SEASON_LEAGUE_GAMES_PER_PLAYER) - roundsPlayed,
  );
  const attempt = (weekSummary.dayRow?.attempt ?? 0) + 1;
  const plan = planDay({
    present,
    history: buildHistory(snapshot.playedGames),
    playedToday,
    courts: SEASON_LEAGUE_COURTS,
    targetGamesPerPlayer: SEASON_LEAGUE_GAMES_PER_PLAYER,
    rounds: parseRounds(roundsRaw),
    seed: `${snapshot.group}-W${week}-A${attempt}`,
  });
  const names: Record<PlayerId, string> = {};
  for (const id of present) names[id] = nameFor(snapshot.names, id);
  return {
    ok: true,
    group: snapshot.group,
    week,
    present,
    allocation: plan.allocation,
    roundsPlayed,
    defaultNewRounds,
    rounds: plan.rounds,
    attempt,
    names,
  };
}

/** Pure compute, zero writes. */
export async function previewDay(input: DayInput): Promise<DayPreview> {
  const group = parseGroup(input.group);
  const week = parseWeek(input.week);
  if (!group || !week) return { ok: false, message: "Unknown league or week" };
  const snapshot = await loadLeagueSnapshot(group);
  return computeDay(snapshot, week, input.presentIds ?? [], input.rounds);
}

export interface SaveDayResult {
  ok: boolean;
  message: string;
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  voided: number;
}

/**
 * Recompute the day server-side (never trust a client plan), then write: the
 * Day row (who was present, the attempt, the round count), one row per new
 * game, and void the Scheduled rows the new plan no longer contains — this
 * week's replaced rounds and any earlier week's leftovers. Played rows are
 * untouched by construction (the store skips them).
 */
export async function saveDay(input: DayInput): Promise<SaveDayResult> {
  const zero = { created: 0, updated: 0, skipped: 0, failed: 0, voided: 0 };
  const group = parseGroup(input.group);
  const week = parseWeek(input.week);
  if (!group || !week) return { ok: false, message: "Unknown league or week", ...zero };
  const snapshot = await loadLeagueSnapshot(group);
  const preview = computeDay(snapshot, week, input.presentIds ?? [], input.rounds);
  if (!preview.ok) return { ok: false, message: preview.message, ...zero };
  if (preview.rounds.length === 0) {
    return { ok: false, message: "Nothing to add — every round is played or the round count is 0", ...zero };
  }

  const sessionDate = seasonLeagueWeekDate(week);
  const entries = [
    {
      key: dayKey(group, week),
      props: buildDayRowProps({
        group,
        week,
        sessionDate,
        present: preview.present,
        attempt: preview.attempt,
        rounds: preview.roundsPlayed + preview.rounds.length,
      }),
    },
    ...preview.rounds.flatMap((round) =>
      round.games.map((g) => ({
        key: gameKey(group, week, g.round, g.court),
        props: buildGameRowProps({
          group,
          week,
          sessionDate,
          round: g.round,
          court: g.court,
          format: g.format,
          sideA: g.sideA,
          sideB: g.sideB,
        }),
      })),
    ),
  ];
  const outcomes = await upsertSeasonLeagueRows(entries);
  const counts = { ...zero };
  for (const o of outcomes) counts[o.action] += 1;

  const keep = new Set(entries.map((e) => e.key));
  const stale = snapshot.rows.filter(
    (r) =>
      r.phase === "League" &&
      r.status === "Scheduled" &&
      (r.week === week ? !keep.has(r.key) : r.week < week),
  );
  counts.voided = await voidSeasonLeagueRows(stale.map((r) => r.pageId));

  const ok = counts.failed === 0;
  return {
    ok,
    message: ok
      ? `Saved ${preview.rounds.length} round${preview.rounds.length === 1 ? "" : "s"} (${preview.rounds.reduce((n, r) => n + r.games.length, 0)} games)`
      : `${counts.failed} row${counts.failed === 1 ? "" : "s"} failed to save — tap Save again to retry`,
    ...counts,
  };
}

export interface ScoreInput {
  group: unknown;
  week: unknown;
  key: unknown;
  scoreA: unknown;
  scoreB: unknown;
  timed?: unknown;
}

export interface ScoreResult {
  ok: boolean;
  message: string;
}

export async function recordGameScore(input: ScoreInput): Promise<ScoreResult> {
  const group = parseGroup(input.group);
  const week = parseWeek(input.week);
  if (!group || !week) return { ok: false, message: "Unknown league or week" };
  const key = typeof input.key === "string" ? input.key : "";
  const timed = input.timed === true;
  const valid = validateScore(input.scoreA, input.scoreB, SCORE_RULES, { timed });
  if (!valid.ok) return { ok: false, message: valid.reason };

  const snapshot = await loadLeagueSnapshot(group);
  const row = snapshot.rows.find(
    (r) => r.key === key && r.league === group && r.week === week && r.phase === "League" && r.status !== "Void",
  );
  if (!row) return { ok: false, message: "That game isn't on today's schedule" };
  const saved = await recordSeasonLeagueScore(row.pageId, input.scoreA as number, input.scoreB as number, timed);
  return saved
    ? { ok: true, message: row.status === "Played" ? "Score corrected" : "Score saved" }
    : { ok: false, message: "Couldn't save to Notion — try again" };
}

// ---------------------------------------------------------------------------
// Playoff (week 6)
// ---------------------------------------------------------------------------

export interface TeamsInput {
  group: unknown;
  presentIds: unknown[];
  /** Optional coach-adjusted teams; validated against `presentIds`. */
  teams?: unknown;
}

export type TeamsPreview =
  | { ok: true; group: SeasonLeagueGroup; present: PlayerId[]; ranked: PlayerId[]; teams: Team[]; names: Record<PlayerId, string> }
  | { ok: false; message: string };

function parseTeams(raw: unknown, present: readonly PlayerId[]): Team[] | { error: string } {
  if (!Array.isArray(raw)) return { error: "Teams must be a list" };
  const used = new Set<PlayerId>();
  const teams: Team[] = [];
  for (const [i, t] of raw.entries()) {
    const members = Array.isArray((t as { members?: unknown })?.members) ? ((t as { members: unknown[] }).members) : null;
    if (!members) return { error: `Team ${i + 1} has no players` };
    const ids: PlayerId[] = [];
    for (const m of members) {
      if (typeof m !== "string" || !present.includes(m)) return { error: "A team lists a kid who isn't checked in" };
      if (used.has(m)) return { error: `${m} is on two teams` };
      used.add(m);
      ids.push(m);
    }
    if (ids.length < 2 || ids.length > 3) return { error: `Team ${i + 1} needs 2 or 3 players` };
    teams.push({ seed: i + 1, members: ids });
  }
  if (used.size !== present.length) return { error: "Every checked-in kid must be on a team" };
  if (teams.length < 2) return { error: "A playoff needs at least two teams" };
  if (teams.length > SEASON_LEAGUE_MAX_BRACKET_TEAMS) return { error: `At most ${SEASON_LEAGUE_MAX_BRACKET_TEAMS} teams` };
  return teams;
}

function computeTeams(snapshot: LeagueSnapshot, presentIds: unknown[], teamsRaw: unknown): TeamsPreview {
  if (snapshot.rowsStatus !== "ok") {
    return { ok: false, message: snapshot.rowsStatus === "config_missing" ? "NOTION_SEASON_LEAGUE_DB_ID is not set" : "Couldn't read the games database — try again" };
  }
  const present = presentFrom(snapshot, presentIds);
  if (present.length < 4) return { ok: false, message: "A playoff needs at least four kids checked in" };
  const ranked = snapshot.standings.map((s) => s.playerId).filter((id) => present.includes(id));
  let teams: Team[];
  if (teamsRaw !== undefined) {
    const parsed = parseTeams(teamsRaw, present);
    if ("error" in parsed) return { ok: false, message: parsed.error };
    teams = parsed;
  } else {
    teams = snakeTeams(ranked);
  }
  if (teams.length > SEASON_LEAGUE_MAX_BRACKET_TEAMS) return { ok: false, message: `At most ${SEASON_LEAGUE_MAX_BRACKET_TEAMS} teams` };
  const names: Record<PlayerId, string> = {};
  for (const id of present) names[id] = nameFor(snapshot.names, id);
  return { ok: true, group: snapshot.group, present, ranked, teams, names };
}

export async function previewTeams(input: TeamsInput): Promise<TeamsPreview> {
  const group = parseGroup(input.group);
  if (!group) return { ok: false, message: "Unknown league" };
  const snapshot = await loadLeagueSnapshot(group);
  return computeTeams(snapshot, input.presentIds ?? [], input.teams);
}

export interface LockResult {
  ok: boolean;
  message: string;
  created: number;
  updated: number;
  failed: number;
  voided: number;
}

export async function lockTeams(input: TeamsInput): Promise<LockResult> {
  const zero = { created: 0, updated: 0, failed: 0, voided: 0 };
  const group = parseGroup(input.group);
  if (!group) return { ok: false, message: "Unknown league", ...zero };
  const snapshot = await loadLeagueSnapshot(group);
  if (snapshot.playoff.results.length > 0) {
    return { ok: false, message: "Playoff games are already scored — teams can't change now", ...zero };
  }
  const preview = computeTeams(snapshot, input.presentIds ?? [], input.teams);
  if (!preview.ok) return { ok: false, message: preview.message, ...zero };

  const week = SEASON_LEAGUE_PLAYOFF_WEEK;
  const sessionDate = seasonLeagueWeekDate(week);
  const attempt = (snapshot.weeks.find((w) => w.week === week)?.dayRow?.attempt ?? 0) + 1;
  const entries = [
    {
      key: dayKey(group, week),
      props: buildDayRowProps({ group, week, sessionDate, present: preview.present, attempt, rounds: 0 }),
    },
    ...preview.teams.map((t) => ({
      key: teamKey(group, week, t.seed),
      props: buildTeamRowProps({ group, week, sessionDate, seed: t.seed, members: t.members }),
    })),
  ];
  const outcomes = await upsertSeasonLeagueRows(entries);
  const counts = { ...zero };
  for (const o of outcomes) {
    if (o.action === "created" || o.action === "updated" || o.action === "failed") counts[o.action] += 1;
  }
  const stale = snapshot.playoff.teamRows.filter((r) => r.seed > preview.teams.length);
  counts.voided = await voidSeasonLeagueRows(stale.map((r) => r.pageId));
  const ok = counts.failed === 0;
  return { ok, message: ok ? `Locked ${preview.teams.length} teams` : `${counts.failed} rows failed — tap Lock again`, ...counts };
}

export async function unlockTeams(input: { group: unknown }): Promise<ScoreResult> {
  const group = parseGroup(input.group);
  if (!group) return { ok: false, message: "Unknown league" };
  const snapshot = await loadLeagueSnapshot(group);
  if (snapshot.playoff.results.length > 0) {
    return { ok: false, message: "Playoff games are already scored — teams can't change now" };
  }
  const voided = await voidSeasonLeagueRows(snapshot.playoff.teamRows.map((r) => r.pageId));
  return { ok: true, message: `Unlocked (${voided} team rows cleared)` };
}

export interface PlayoffScoreInput {
  group: unknown;
  slot: unknown;
  scoreA: unknown;
  scoreB: unknown;
  timed?: unknown;
}

export async function recordPlayoffScore(input: PlayoffScoreInput): Promise<ScoreResult> {
  const group = parseGroup(input.group);
  if (!group) return { ok: false, message: "Unknown league" };
  const slot = typeof input.slot === "string" ? input.slot : "";
  const timed = input.timed === true;
  const valid = validateScore(input.scoreA, input.scoreB, SCORE_RULES, { timed });
  if (!valid.ok) return { ok: false, message: valid.reason };

  const snapshot = await loadLeagueSnapshot(group);
  const { state, teams } = snapshot.playoff;
  if (!state) return { ok: false, message: "Lock the teams first" };
  const resolved = state.slots.find((s) => s.slot.id === slot);
  if (!resolved || (resolved.status !== "ready" && resolved.status !== "played")) {
    return { ok: false, message: "That game isn't ready to play yet" };
  }
  const teamA = teams.find((t) => t.seed === resolved.a);
  const teamB = teams.find((t) => t.seed === resolved.b);
  if (!teamA || !teamB) return { ok: false, message: "That game isn't ready to play yet" };

  const week = SEASON_LEAGUE_PLAYOFF_WEEK;
  const [outcome] = await upsertSeasonLeagueRows([
    {
      key: playoffKey(group, week, slot),
      props: buildPlayoffRowProps({
        group,
        week,
        sessionDate: seasonLeagueWeekDate(week),
        slot,
        sideA: teamA.members,
        sideB: teamB.members,
        scoreA: input.scoreA as number,
        scoreB: input.scoreB as number,
        timed,
      }),
    },
  ]);
  if (outcome.action === "failed") return { ok: false, message: "Couldn't save to Notion — try again" };
  if (outcome.action === "skipped") {
    // A Played playoff row is corrected in place rather than re-created.
    const row = snapshot.playoff.games.find((g) => g.slot === slot);
    if (!row) return { ok: false, message: "Couldn't find the game to correct" };
    const saved = await recordSeasonLeagueScore(row.pageId, input.scoreA as number, input.scoreB as number, timed);
    return saved ? { ok: true, message: "Score corrected" } : { ok: false, message: "Couldn't save to Notion — try again" };
  }
  return { ok: true, message: "Score saved" };
}

// ---------------------------------------------------------------------------
// Parent-facing view
// ---------------------------------------------------------------------------

export interface StandingsViewRow {
  rank: number;
  name: string;
  games: number;
  wins: number;
  losses: number;
  winPct: number;
  pointDiff: number;
  doublesRecord: string;
  singlesRecord: string;
}

export interface StandingsViewGame {
  round: number;
  court: number;
  format: "doubles" | "singles";
  sideA: string;
  sideB: string;
  scoreA: number | null;
  scoreB: number | null;
  timed: boolean;
  status: "Played" | "Scheduled";
}

export interface StandingsViewWeek {
  week: number;
  date: string;
  games: StandingsViewGame[];
}

export interface StandingsViewPlayoffGame {
  id: string;
  label: string;
  a: string | null;
  b: string | null;
  scoreA: number | null;
  scoreB: number | null;
  status: "bye" | "pending" | "ready" | "played" | "skipped";
}

export interface StandingsViewPlayoff {
  teams: Array<{ seed: number; name: string }>;
  games: StandingsViewPlayoffGame[];
  champion: string | null;
  runnerUp: string | null;
}

export interface StandingsView {
  group: SeasonLeagueGroup;
  label: string;
  timeLabel: string;
  venue: string;
  title: string;
  status: SeasonLeagueReadStatus;
  standings: StandingsViewRow[];
  weeks: StandingsViewWeek[];
  playoff: StandingsViewPlayoff | null;
  playoffWeek: number;
  playoffDate: string;
}

export function buildStandingsView(snapshot: LeagueSnapshot): StandingsView {
  const option = SEASON_LEAGUE_GROUPS.find((g) => g.group === snapshot.group)!;
  const names = snapshot.names;
  const teamName = (seed: number | "bye" | null): string | null => {
    if (typeof seed !== "number") return null;
    const team = snapshot.playoff.teams.find((t) => t.seed === seed);
    return team ? sideLabel(names, team.members) : null;
  };

  const standings: StandingsViewRow[] = snapshot.standings.map((s) => ({
    rank: s.rank,
    name: s.name,
    games: s.games,
    wins: s.wins,
    losses: s.losses,
    winPct: s.winPct,
    pointDiff: s.pointDiff,
    doublesRecord: `${s.doublesWins}–${s.doublesLosses}`,
    singlesRecord: `${s.singlesWins}–${s.singlesLosses}`,
  }));

  const weeks: StandingsViewWeek[] = snapshot.weeks
    .filter((w) => isPlayWeek(w.week) && w.games.length > 0)
    .map((w) => ({
      week: w.week,
      date: w.date,
      games: w.games
        .filter((g) => g.phase === "League" && (g.status === "Played" || g.status === "Scheduled"))
        .map((g) => ({
          round: g.round,
          court: g.court,
          format: g.format || "doubles",
          sideA: sideLabel(names, g.sideA),
          sideB: sideLabel(names, g.sideB),
          scoreA: g.status === "Played" ? g.scoreA : null,
          scoreB: g.status === "Played" ? g.scoreB : null,
          timed: g.timed,
          status: g.status === "Played" ? "Played" : "Scheduled",
        })),
    }));

  const { state, teams, locked } = snapshot.playoff;
  const playoff: StandingsViewPlayoff | null =
    locked && state
      ? {
          teams: teams.map((t) => ({ seed: t.seed, name: sideLabel(names, t.members) })),
          games: state.slots
            .filter((s) => s.status !== "skipped" && s.status !== "bye")
            .map((s) => ({
              id: s.slot.id,
              label: s.slot.label,
              a: teamName(s.a),
              b: teamName(s.b),
              scoreA: s.result?.scoreA ?? null,
              scoreB: s.result?.scoreB ?? null,
              status: s.status,
            })),
          champion: teamName(state.champion),
          runnerUp: teamName(state.runnerUp),
        }
      : null;

  return {
    group: snapshot.group,
    label: option.label,
    timeLabel: option.timeLabel,
    venue: SEASON_LEAGUE_VENUE_SHORT,
    title: SEASON_LEAGUE_PUBLIC_TITLE,
    status: snapshot.rowsStatus,
    standings,
    weeks,
    playoff,
    playoffWeek: SEASON_LEAGUE_PLAYOFF_WEEK,
    playoffDate: seasonLeagueWeekDate(SEASON_LEAGUE_PLAYOFF_WEEK),
  };
}

/**
 * The parent page's loader. The token is verified BEFORE any Notion call —
 * a bad or missing token costs zero fetches and renders 404.
 */
export async function resolveStandingsView(
  groupSlug: string | undefined,
  token: string | undefined,
): Promise<StandingsView | null> {
  const group = seasonLeagueGroupFromSlug(groupSlug);
  if (!group) return null;
  if (!verifyStandingsLink(token, group)) return null;
  const snapshot = await loadLeagueSnapshot(group);
  return buildStandingsView(snapshot);
}

/** Court allocation summary for the day page copy ("1 doubles + 1 singles court"). */
export function describeAllocation(a: CourtAllocation): string {
  const parts: string[] = [];
  if (a.doubles) parts.push(`${a.doubles} doubles court${a.doubles === 1 ? "" : "s"}`);
  if (a.singles) parts.push(`${a.singles} singles court${a.singles === 1 ? "" : "s"}`);
  if (a.sitting) parts.push(`${a.sitting} sit${a.sitting === 1 ? "s" : ""} each round`);
  return parts.length ? parts.join(" · ") : "not enough kids for a game";
}

export { courtAllocation };
