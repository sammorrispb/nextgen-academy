import { validLineup, type LineupGame } from "./season-league/lineup";
import {
  SEASON_LEAGUE_COURTS,
  SEASON_LEAGUE_GAMES_PER_PLAYER,
  SEASON_LEAGUE_GAME_TARGET,
  SEASON_LEAGUE_GAME_TARGETS,
  SEASON_LEAGUE_GROUPS,
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
  patchSeasonLeagueRelations,
  teamKey,
  upsertSeasonLeagueRows,
  voidSeasonLeagueRows,
  type SeasonLeagueReadStatus,
  type SeasonLeagueRow,
} from "@/lib/notion-season-league";
import {
  FINAL_SIZE,
  finalTeams,
  resolveFinal,
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
import { computeStandings, tiedOnRecord, type StandingRow } from "@/lib/season-league/standings";
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
  targets: SEASON_LEAGUE_GAME_TARGETS,
  winBy: SEASON_LEAGUE_WIN_BY,
} as const;

/**
 * The rules for one score. The coach's "Games to" picker sends the length the
 * game was played to; it is validated against exactly that length. No target
 * (an older open tab) falls back to accepting any allowed length. A target
 * outside the allowed set is refused rather than trusted.
 */
export function scoreRulesFor(
  target: unknown,
): { ok: true; rules: { target: number; winBy: number; targets?: readonly number[] } } | { ok: false; reason: string } {
  if (target === undefined || target === null) return { ok: true, rules: SCORE_RULES };
  if (typeof target === "number" && (SEASON_LEAGUE_GAME_TARGETS as readonly number[]).includes(target)) {
    return { ok: true, rules: { target, winBy: SEASON_LEAGUE_WIN_BY } };
  }
  return { ok: false, reason: `Games are to ${SEASON_LEAGUE_GAME_TARGETS.join(", ")}` };
}

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
  // The Finale's two teams are seeds 1 and 2. A higher seed can only be a
  // stale bracket lock from before the Finale; it never counts (a re-lock or
  // an unlock voids it).
  const teams: Team[] = teamRows.filter((r) => r.seed <= 2).map((r) => ({ seed: r.seed, members: r.sideA }));
  const playoffGames = live
    .filter((r) => r.phase === "Playoff" && r.week === SEASON_LEAGUE_PLAYOFF_WEEK)
    .sort(byRoundThenCourt);
  const results: BracketResult[] = playoffGames
    .filter((r) => r.status === "Played" && r.scoreA !== null && r.scoreB !== null && r.slot)
    .map((r) => ({ slot: r.slot, scoreA: r.scoreA as number, scoreB: r.scoreB as number }));
  const locked = teams.length === 2;

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
      state: locked ? resolveFinal(results) : null,
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
  /** Extra time: add rounds AFTER every round already on the sheet, keeping
   * the scheduled-but-unplayed ones. Without it, unplayed rounds are replanned. */
  append?: unknown;
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

function computeDay(
  snapshot: LeagueSnapshot,
  week: SeasonLeagueWeek,
  presentIds: unknown[],
  roundsRaw: unknown,
  append = false,
): DayPreview {
  if (!isPlayWeek(week)) return { ok: false, message: "That Sunday isn't a play week" };
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
  // In append mode the rounds already on the sheet count as today's games, for
  // round numbering and for partner/sit balance, even before they are scored.
  const keptToday = append
    ? weekSummary.games.filter((g) => g.phase === "League" && g.status === "Scheduled").map(toPlannedGame)
    : [];
  const roundsOnSheet = [...playedToday, ...keptToday].reduce((m, g) => Math.max(m, g.round), 0);
  const defaultNewRounds = Math.max(
    0,
    defaultRounds(present.length, SEASON_LEAGUE_COURTS, SEASON_LEAGUE_GAMES_PER_PLAYER) - roundsPlayed,
  );
  const attempt = (weekSummary.dayRow?.attempt ?? 0) + 1;
  const plan = planDay({
    present,
    history: buildHistory([...snapshot.playedGames, ...keptToday]),
    playedToday: [...playedToday, ...keptToday],
    courts: SEASON_LEAGUE_COURTS,
    targetGamesPerPlayer: SEASON_LEAGUE_GAMES_PER_PLAYER,
    rounds: append ? (parseRounds(roundsRaw) ?? 1) : parseRounds(roundsRaw),
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
    roundsPlayed: append ? roundsOnSheet : roundsPlayed,
    defaultNewRounds: append ? 1 : defaultNewRounds,
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
  return computeDay(snapshot, week, input.presentIds ?? [], input.rounds, input.append === true);
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
  const append = input.append === true;
  const preview = computeDay(snapshot, week, input.presentIds ?? [], input.rounds, append);
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
  // Appending never clears anything: the rounds already on the sheet stay.
  const stale = append ? [] : snapshot.rows.filter(
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

/** Edit only an unscored round; the browser must submit the lineup it read. */
export async function editRoundLineup(input: {
  group: unknown; week: unknown; round: number;
  expected: LineupGame[]; games: LineupGame[];
}): Promise<ScoreResult> {
  const group = parseGroup(input.group), week = parseWeek(input.week);
  if (!group || !week || !Number.isInteger(input.round) || input.round < 1 ||
    !Array.isArray(input.expected) || input.expected.some(g => !g || !Array.isArray(g.sideA) || !Array.isArray(g.sideB)) || !Array.isArray(input.games)) return { ok: false, message: "Invalid round" };
  const snapshot = await loadLeagueSnapshot(group);
  if (snapshot.rowsStatus !== "ok" || snapshot.rosterStatus !== "ok") return { ok: false, message: "Couldn't verify roster and games. Reload and try again." };
  if (snapshot.playoff.locked) return { ok: false, message: "Final teams are locked. Unlock them before editing league lineups." };
  const summary = snapshot.weeks.find(w => w.week === week)!;
  const rows = summary.games.filter(g => g.phase === "League" && g.round === input.round);
  if (!rows.length || rows.some(g => g.status !== "Scheduled")) return { ok: false, message: "Scored rounds cannot be edited." };
  const shape = (g: LineupGame) => ({ key: g.key, round: g.round, court: g.court, format: g.format, sideA: g.sideA, sideB: g.sideB });
  const current = rows.map(g => shape({ ...toPlannedGame(g), key: g.key }));
  if (JSON.stringify(input.expected.map(shape)) !== JSON.stringify(current)) return { ok: false, message: "This round changed. Reload before editing." };
  const present = presentFrom(snapshot, summary.dayRow?.present ?? []);
  if (input.games.length !== rows.length || !input.games.every((g, i) => g &&
    g.key === rows[i].key && g.round === rows[i].round && g.court === rows[i].court &&
    g.format === rows[i].format && Array.isArray(g.sideA) && Array.isArray(g.sideB)) ||
    !validLineup(input.games, present)) return { ok: false, message: "Choose checked-in players once each, keeping each court's format." };
  const changed = input.games.filter((g, i) => JSON.stringify(shape(g)) !== JSON.stringify(current[i]));
  if (!changed.length) return { ok: true, message: "No lineup changes" };
  const result = await patchSeasonLeagueRelations(changed.map(g => ({
    pageId: rows.find(r => r.key === g.key)!.pageId, sideA: g.sideA, sideB: g.sideB,
  })));
  // Notion has no multi-row transaction. Never report partial writes as saved.
  const verified = await loadLeagueSnapshot(group);
  const matches = verified.rowsStatus === "ok" && input.games.every(g => {
    const row = verified.rows.find(r => r.key === g.key);
    return row && row.status === "Scheduled" && JSON.stringify(row.sideA) === JSON.stringify(g.sideA) && JSON.stringify(row.sideB) === JSON.stringify(g.sideB);
  });
  return result.failed === 0 && matches ? { ok: true, message: "Lineup saved" } :
    { ok: false, message: "Some lineup changes could not be verified. Reload and check every court before entering scores." };
}

export interface ScoreInput {
  group: unknown;
  week: unknown;
  key: unknown;
  scoreA: unknown;
  scoreB: unknown;
  timed?: unknown;
  target?: unknown;
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
  const rules = scoreRulesFor(input.target);
  if (!rules.ok) return { ok: false, message: rules.reason };
  const valid = validateScore(input.scoreA, input.scoreB, rules.rules, { timed });
  if (!valid.ok) return { ok: false, message: valid.reason };

  const snapshot = await loadLeagueSnapshot(group);
  const row = snapshot.rows.find(
    (r) => r.key === key && r.league === group && r.week === week && r.phase === "League" && r.status !== "Void",
  );
  if (!row) return { ok: false, message: "That game isn't on today's schedule" };
  const roundPlayers = snapshot.rows.filter(r => r.week === week && r.phase === "League" && r.round === row.round && r.status !== "Void").flatMap(r => [...r.sideA, ...r.sideB]);
  if (new Set(roundPlayers).size !== roundPlayers.length) return { ok: false, message: "This round has duplicate players. Correct the lineup before scoring." };
  const saved = await recordSeasonLeagueScore(row.pageId, input.scoreA as number, input.scoreB as number, timed);
  return saved
    ? { ok: true, message: row.status === "Played" ? "Score corrected" : "Score saved" }
    : { ok: false, message: "Couldn't save to Notion — try again" };
}

// ---------------------------------------------------------------------------
// The Finale's final game (week 6)
// ---------------------------------------------------------------------------

export interface FinalInput {
  group: unknown;
  /** After a tie at the cut is settled on court: the tied kids who take the open spots. */
  chosen?: unknown;
}

/** A dead-even tie straddling the #4/#5 cut. */
export interface FinalTie {
  /** How many of the tied kids get into the final. */
  spots: number;
  kids: Array<{ id: PlayerId; name: string }>;
}

export type FinalPreview =
  | {
      ok: true;
      group: SeasonLeagueGroup;
      /** Seed 1 = #1 & #4, seed 2 = #2 & #3. */
      teams: Team[];
      names: Record<PlayerId, string>;
      /** Round-robin games still unscored: the top four may still move. */
      warning: string | null;
    }
  | { ok: false; message: string; tie?: FinalTie };

/**
 * Who plays the final (Sam, 2026-11-02): the kids checked in for the week-6
 * round robin (its Day row), ranked by the standings after it, top four →
 * #1 & #4 vs #2 & #3. A tie on every numeric key across the #4/#5 cut is never
 * settled by the name fallback — the coach settles it on court and picks.
 */
function computeFinal(snapshot: LeagueSnapshot, chosenRaw: unknown): FinalPreview {
  if (snapshot.rowsStatus !== "ok") {
    return { ok: false, message: snapshot.rowsStatus === "config_missing" ? "NOTION_SEASON_LEAGUE_DB_ID is not set" : "Couldn't read the games database — try again" };
  }
  const summary = snapshot.weeks.find((w) => w.week === SEASON_LEAGUE_PLAYOFF_WEEK);
  if (!summary?.dayRow) return { ok: false, message: "Check in today's kids and save the round robin first" };
  const present = presentFrom(snapshot, summary.dayRow.present);
  if (present.length < FINAL_SIZE) return { ok: false, message: "The final needs at least four kids checked in" };

  const ranked = snapshot.standings.filter((s) => present.includes(s.playerId));
  const atCut = ranked[FINAL_SIZE - 1];
  const tiedFrom = ranked.findIndex((s) => tiedOnRecord(s, atCut));
  const tied = ranked.filter((s) => tiedOnRecord(s, atCut));
  let top: StandingRow[] = ranked.slice(0, FINAL_SIZE);
  if (tiedFrom + tied.length > FINAL_SIZE) {
    const spots = FINAL_SIZE - tiedFrom;
    const tie: FinalTie = { spots, kids: tied.map((s) => ({ id: s.playerId, name: nameFor(snapshot.names, s.playerId) })) };
    const listed = tie.kids.map((k) => k.name).join(", ");
    const chosen = Array.isArray(chosenRaw) ? [...new Set(chosenRaw.filter((c): c is string => typeof c === "string"))] : [];
    if (chosen.length === 0) {
      return { ok: false, tie, message: `Tied at the cut: ${listed}. Settle it on court, then pick who plays.` };
    }
    if (chosen.length !== spots || chosen.some((id) => !tied.some((s) => s.playerId === id))) {
      return { ok: false, tie, message: `Pick ${spots} of the tied kids: ${listed}` };
    }
    top = [...ranked.slice(0, tiedFrom), ...tied.filter((s) => chosen.includes(s.playerId))];
  }

  const teams = finalTeams(top.map((s) => s.playerId));
  const names: Record<PlayerId, string> = {};
  for (const t of teams) for (const id of t.members) names[id] = nameFor(snapshot.names, id);
  const unscored = summary.games.filter((g) => g.phase === "League" && g.status === "Scheduled").length;
  const warning =
    unscored > 0
      ? `${unscored} round-robin game${unscored === 1 ? " is" : "s are"} still unscored — the top four may still change`
      : null;
  return { ok: true, group: snapshot.group, teams, names, warning };
}

export async function previewFinal(input: FinalInput): Promise<FinalPreview> {
  const group = parseGroup(input.group);
  if (!group) return { ok: false, message: "Unknown league" };
  const snapshot = await loadLeagueSnapshot(group);
  return computeFinal(snapshot, input.chosen);
}

export interface LockResult {
  ok: boolean;
  message: string;
  created: number;
  updated: number;
  failed: number;
  voided: number;
}

const FINAL_SCORED = "The final is already scored — the teams can't change now";

export async function lockFinal(input: FinalInput): Promise<LockResult> {
  const zero = { created: 0, updated: 0, failed: 0, voided: 0 };
  const group = parseGroup(input.group);
  if (!group) return { ok: false, message: "Unknown league", ...zero };
  const snapshot = await loadLeagueSnapshot(group);
  if (snapshot.playoff.results.length > 0) return { ok: false, message: FINAL_SCORED, ...zero };
  const preview = computeFinal(snapshot, input.chosen);
  if (!preview.ok) return { ok: false, message: preview.message, ...zero };

  const week = SEASON_LEAGUE_PLAYOFF_WEEK;
  const sessionDate = seasonLeagueWeekDate(week);
  // Team rows only. The Day row is the round robin's (who is checked in, its
  // rounds and plan seed) and is never rewritten by the final.
  const outcomes = await upsertSeasonLeagueRows(
    preview.teams.map((t) => ({
      key: teamKey(group, week, t.seed),
      props: buildTeamRowProps({ group, week, sessionDate, seed: t.seed, members: t.members }),
    })),
  );
  const counts = { ...zero };
  for (const o of outcomes) {
    if (o.action === "created" || o.action === "updated" || o.action === "failed") counts[o.action] += 1;
  }
  const stale = snapshot.playoff.teamRows.filter((r) => r.seed > preview.teams.length);
  counts.voided = await voidSeasonLeagueRows(stale.map((r) => r.pageId));
  const ok = counts.failed === 0;
  const [a, b] = preview.teams.map((t) => sideLabel(snapshot.names, t.members));
  return { ok, message: ok ? `Locked the final: ${a} vs ${b}` : `${counts.failed} rows failed — tap Lock again`, ...counts };
}

export async function unlockFinal(input: { group: unknown }): Promise<ScoreResult> {
  const group = parseGroup(input.group);
  if (!group) return { ok: false, message: "Unknown league" };
  const snapshot = await loadLeagueSnapshot(group);
  if (snapshot.playoff.results.length > 0) return { ok: false, message: FINAL_SCORED };
  const voided = await voidSeasonLeagueRows(snapshot.playoff.teamRows.map((r) => r.pageId));
  return { ok: true, message: `Unlocked the final (${voided} team rows cleared)` };
}

export interface PlayoffScoreInput {
  group: unknown;
  slot: unknown;
  scoreA: unknown;
  scoreB: unknown;
  timed?: unknown;
  target?: unknown;
}

export async function recordPlayoffScore(input: PlayoffScoreInput): Promise<ScoreResult> {
  const group = parseGroup(input.group);
  if (!group) return { ok: false, message: "Unknown league" };
  const slot = typeof input.slot === "string" ? input.slot : "";
  const timed = input.timed === true;
  const rules = scoreRulesFor(input.target);
  if (!rules.ok) return { ok: false, message: rules.reason };
  const valid = validateScore(input.scoreA, input.scoreB, rules.rules, { timed });
  if (!valid.ok) return { ok: false, message: valid.reason };

  const snapshot = await loadLeagueSnapshot(group);
  const { state, teams } = snapshot.playoff;
  if (!state) return { ok: false, message: "Lock the final first" };
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
    const roundPlayers = snapshot.rows.filter(r => r.week === week && r.phase === "League" && r.round === row.round && r.status !== "Void").flatMap(r => [...r.sideA, ...r.sideB]);
  if (new Set(roundPlayers).size !== roundPlayers.length) return { ok: false, message: "This round has duplicate players. Correct the lineup before scoring." };
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
  /** The game ended on the clock, so the score needn't reach the length. */
  timed: boolean;
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
              timed: snapshot.playoff.games.find((g) => g.slot === s.slot.id)?.timed ?? false,
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
