// Coach operations over Link & Dink's rotation-league endpoint. The coach
// actions are thin requireCoach wrappers over these; every input is re-checked
// here against the season registry before a command is built, so an action can
// only ever name a configured season, one of its play weeks, a UUID game id or
// a registration ref the endpoint will look up.

import { randomUUID } from "node:crypto";
import {
  findRotationLeagueSeason,
  parsePlayoffWeek,
  parsePlayWeek,
  ROTATION_LEAGUE_SEASONS,
  type RotationLeagueSeason,
} from "@/data/rotation-league-seasons";
import { CHILD_LAST_NAME_RE, cleanChildLastName } from "@/lib/child-last-name";
import { callRotationLeague, type LeagueResult } from "@/lib/rotation-league/client";
import { buildRosterPlayers, readSeasonRegistrations, type RosterPlayer } from "@/lib/rotation-league/roster";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const REF = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,119}$/;
const ROSTER_BATCH = 60;

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export type Outcome<T = {}> =
  | ({ ok: true } & T)
  | { ok: false; message: string };

export interface WeekPlayer {
  external_ref: string;
  name: string;
  status: "active" | "withdrawn";
  present: boolean;
  /** Added by the coach for a night: plays, never ranked (older L&D builds omit it). */
  guest?: boolean;
}

export interface WeekGame {
  id: string;
  round: number | null;
  court: number | null;
  format: "doubles" | "singles";
  status: "scheduled" | "played";
  score_a: number | null;
  score_b: number | null;
  timed: boolean;
  side_a: string[];
  side_b: string[];
  /** Registration refs in the same order as the names (older L&D builds send none). */
  side_a_refs?: string[];
  side_b_refs?: string[];
}

export interface PlanRound {
  round: number;
  sitting: string[];
  games: { court: number; format: "doubles" | "singles"; side_a: string[]; side_b: string[] }[];
}

export interface PlanResult {
  saved: boolean;
  present: number;
  rounds: PlanRound[];
}

export interface StandingRow {
  rank: number;
  name: string;
  games: number;
  wins: number;
  losses: number;
  point_diff: number;
  win_pct: number;
}

const MESSAGES: Record<string, string> = {
  not_production:
    "This build doesn't talk to Link & Dink. Only the production site (or one with LINKDINK_BASE_URL set) can.",
  secret_unset: "NGA_SYNC_SECRET isn't set on this deploy, so Link & Dink can't be reached.",
  not_configured: "Link & Dink doesn't have the NGA sync secret configured yet.",
  unauthorized: "Link & Dink refused the sync secret. Check NGA_SYNC_SECRET matches on both sites.",
  timeout: "Link & Dink took too long to answer. Try again; nothing is saved twice.",
  unreachable: "Couldn't reach Link & Dink. Try again in a minute.",
  store_unavailable: "Link & Dink's database didn't answer. Try again in a minute.",
  season_not_found: "This season isn't on Link & Dink yet. Tap \"Sync roster\" first.",
  season_closed: "This season is closed on Link & Dink, so no new rounds can be planned.",
  not_a_play_week: "That week isn't a league week for this season.",
  player_not_found: "That player isn't on the Link & Dink roster. Tap \"Sync roster\" and try again.",
  player_withdrawn: "That player is withdrawn (not Confirmed), so they can't be checked in.",
  player_erased: "That player's details were erased, so they can't be added back.",
  bad_roster: "Link & Dink refused that name. Use letters only.",
  game_not_found: "That game is gone. Refresh the page.",
  game_void: "That game was removed. Refresh the page.",
  night_cancelled: "This week is marked cancelled on Link & Dink.",
  player_not_present: "Someone in the plan isn't checked in any more. Refresh and preview again.",
  court_taken: "Those rounds were already saved (maybe from another phone). Refresh the page.",
  player_double_booked: "That puts one player on two courts in the same round.",
  round_changed: "This round changed on another phone. Refresh the page and try again.",
  later_round_scored: "A later round already has a score, so those rounds can't be re-planned.",
  nothing_to_replan: "There are no rounds after this one to re-plan.",
  bad_plan: "Link & Dink refused the plan. Preview again.",
  bad_side_size: "Link & Dink refused the plan. Preview again.",
  bad_input: "Link & Dink refused the request as malformed.",
  legacy_erasure_review_required:
    "Link & Dink is holding new roster adds for this season after an old erasure. Ask Sam to review it on Link & Dink.",
  no_playoff: "This season has no playoff week.",
  not_the_playoff_week: "That isn't this season's playoff week.",
  teams_locked: "The teams are already locked. Unlock them first to change them.",
  teams_not_locked: "Lock the teams before scoring the bracket.",
  bracket_started: "A playoff game is already scored, so the teams can't be unlocked.",
  bracket_changed: "That game's teams changed. Refresh the page.",
  bad_teams: "Every team needs 2 or 3 checked-in players, each player on one team.",
  slot_not_found: "That bracket game doesn't exist. Refresh the page.",
  slot_not_ready:
    "That game can't be scored yet, or a later game already depends on it. Refresh the page.",
};

function fail(result: Extract<LeagueResult<unknown>, { ok: false }>): { ok: false; message: string } {
  if (result.code === "bad_score" || result.code === "bad_game_target") {
    return { ok: false, message: result.reason ?? "That score isn't valid for this game." };
  }
  return { ok: false, message: MESSAGES[result.code] ?? `Link & Dink answered ${result.code}.` };
}

function needSeason(slug: unknown): RotationLeagueSeason | { ok: false; message: string } {
  return findRotationLeagueSeason(slug) ?? { ok: false, message: "Unknown season." };
}

function seasonCommand(season: RotationLeagueSeason) {
  return {
    action: "season_upsert",
    season: {
      slug: season.slug,
      name: season.name,
      division: season.division,
      courts: season.courts,
      target_games_per_player: season.targetGamesPerPlayer,
      play_weeks: [...season.playWeeks],
      playoff_week: season.playoffWeek,
      game_target: season.gameTarget,
      game_targets: [...season.gameTargets],
      win_by: season.winBy,
      status: season.status,
      source_ref: null,
    },
  };
}

/** Create or update the season on Link & Dink, then send the whole roster. */
export async function syncSeason(
  slug: unknown,
): Promise<Outcome<{ sent: number; skipped: number; refused: number }>> {
  const season = needSeason(slug);
  if ("ok" in season) return season;

  const read = await readSeasonRegistrations(season);
  if (read.status === "config_missing") {
    return { ok: false, message: "The registration database isn't configured on this deploy." };
  }
  if (read.status === "query_failed") {
    return { ok: false, message: "Couldn't read registrations from Notion. Nothing was sent." };
  }

  const up = await callRotationLeague(seasonCommand(season));
  if (!up.ok) return fail(up);

  const { players, skipped } = buildRosterPlayers(read.rows);
  let refused = 0;
  for (let i = 0; i < players.length; i += ROSTER_BATCH) {
    const res = await callRotationLeague<{ written: number; refused_erased: string[] }>({
      action: "roster_upsert",
      season_slug: season.slug,
      players: players.slice(i, i + ROSTER_BATCH),
    });
    if (!res.ok) return fail(res);
    refused += Array.isArray(res.data.refused_erased) ? res.data.refused_erased.length : 0;
  }
  return { ok: true, sent: players.length, skipped, refused };
}

export async function readWeek(
  slug: unknown,
  week: unknown,
): Promise<Outcome<{ players: WeekPlayer[]; games: WeekGame[] }>> {
  const season = needSeason(slug);
  if ("ok" in season) return season;
  const w = parsePlayWeek(season, week) ?? parsePlayoffWeek(season, week);
  if (w === null) return { ok: false, message: "That week isn't a league week for this season." };
  const res = await callRotationLeague<{ players: WeekPlayer[]; games: WeekGame[] }>({
    action: "read_week",
    season_slug: season.slug,
    week: w,
  });
  if (!res.ok) return fail(res);
  return { ok: true, players: res.data.players ?? [], games: res.data.games ?? [] };
}

export async function checkIn(
  slug: unknown,
  week: unknown,
  externalRef: unknown,
  present: unknown,
): Promise<Outcome> {
  const season = needSeason(slug);
  if ("ok" in season) return season;
  const w = parsePlayWeek(season, week) ?? parsePlayoffWeek(season, week);
  if (w === null) return { ok: false, message: "That week isn't a league week for this season." };
  if (typeof externalRef !== "string" || !REF.test(externalRef) || typeof present !== "boolean") {
    return { ok: false, message: "Bad check-in." };
  }
  const res = await callRotationLeague({
    action: "checkin",
    season_slug: season.slug,
    week: w,
    external_ref: externalRef,
    present,
  });
  return res.ok ? { ok: true } : fail(res);
}

/** Preview (dryRun) or save the next rounds for the players checked in. */
export async function planWeek(input: {
  slug: unknown;
  week: unknown;
  rounds: unknown;
  attempt: unknown;
  save: boolean;
}): Promise<Outcome<PlanResult>> {
  const season = needSeason(input.slug);
  if ("ok" in season) return season;
  const w = parsePlayWeek(season, input.week);
  if (w === null) return { ok: false, message: "That week isn't a league week for this season." };
  const rounds = input.rounds === null || input.rounds === undefined ? null : Number(input.rounds);
  if (rounds !== null && !(Number.isInteger(rounds) && rounds >= 1 && rounds <= 12)) {
    return { ok: false, message: "Rounds must be 1 to 12, or automatic." };
  }
  const attempt = Number(input.attempt ?? 1);
  if (!(Number.isInteger(attempt) && attempt >= 1 && attempt <= 99)) {
    return { ok: false, message: "Bad plan attempt." };
  }
  const res = await callRotationLeague<PlanResult>({
    action: "plan",
    season_slug: season.slug,
    week: w,
    rounds,
    attempt,
    dry_run: !input.save,
  });
  if (!res.ok) return fail(res);
  return {
    ok: true,
    saved: res.data.saved === true,
    present: Number(res.data.present) || 0,
    rounds: Array.isArray(res.data.rounds) ? res.data.rounds : [],
  };
}

// --------------------------------------------------------------- guests

export interface GuestCandidate {
  external_ref: string;
  name: string;
  group: string;
}

/** Seasons whose registrations a guest for `season` may come from: the same
 * registration DB, a different group (Kobe from Green, for Yellow). */
function otherGroups(season: RotationLeagueSeason): RotationLeagueSeason[] {
  const seen = new Set<string>();
  return ROTATION_LEAGUE_SEASONS.filter((s) => {
    if (s.rosterSource !== season.rosterSource || s.rosterGroup === season.rosterGroup) return false;
    if (seen.has(s.rosterGroup)) return false;
    seen.add(s.rosterGroup);
    return true;
  });
}

/** Confirmed children registered in the other groups, as the roster sync
 * would send them. Fails loud like the roster read. */
async function otherGroupPlayers(
  season: RotationLeagueSeason,
): Promise<Outcome<{ players: (RosterPlayer & { group: string })[] }>> {
  const players: (RosterPlayer & { group: string })[] = [];
  for (const other of otherGroups(season)) {
    const read = await readSeasonRegistrations(other);
    if (read.status === "config_missing") {
      return { ok: false, message: "The registration database isn't configured on this deploy." };
    }
    if (read.status === "query_failed") {
      return { ok: false, message: "Couldn't read registrations from Notion. Try again." };
    }
    for (const p of buildRosterPlayers(read.rows).players) {
      if (p.status === "active") players.push({ ...p, group: other.rosterGroup });
    }
  }
  return { ok: true, players };
}

/** The coach's "Add a player" picker: other groups' Confirmed children by name. */
export async function guestCandidates(slug: unknown): Promise<Outcome<{ candidates: GuestCandidate[] }>> {
  const season = needSeason(slug);
  if ("ok" in season) return season;
  const found = await otherGroupPlayers(season);
  if (!found.ok) return found;
  const candidates = found.players
    .map((p) => ({
      external_ref: p.external_ref,
      name: p.last_name ? `${p.first_name} ${p.last_name}` : p.first_name,
      group: p.group,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
  return { ok: true, candidates };
}

/**
 * Add a guest for one week: a Confirmed child from another group (by their
 * registration ref; the names come from Notion, never from the browser) or a
 * typed first name for anyone else (the coach filling a court). A guest is
 * checked in and plays, and is never ranked.
 */
export async function addGuest(input: {
  slug: unknown;
  week: unknown;
  externalRef?: unknown;
  firstName?: unknown;
  lastName?: unknown;
}): Promise<Outcome> {
  const season = needSeason(input.slug);
  if ("ok" in season) return season;
  const w = parsePlayWeek(season, input.week);
  if (w === null) return { ok: false, message: "That week isn't a league week for this season." };

  let guest: { external_ref: string; first_name: string; last_name: string | null };
  if (input.externalRef !== undefined && input.externalRef !== null && input.externalRef !== "") {
    if (typeof input.externalRef !== "string" || !REF.test(input.externalRef)) {
      return { ok: false, message: "Unknown player." };
    }
    const found = await otherGroupPlayers(season);
    if (!found.ok) return found;
    const pick = found.players.find((p) => p.external_ref === input.externalRef);
    if (!pick) return { ok: false, message: "That player isn't a Confirmed registration in another group." };
    guest = { external_ref: pick.external_ref, first_name: pick.first_name, last_name: pick.last_name };
  } else {
    const first = typeof input.firstName === "string" ? cleanChildLastName(input.firstName) : "";
    const lastRaw = typeof input.lastName === "string" ? cleanChildLastName(input.lastName) : "";
    if (!CHILD_LAST_NAME_RE.test(first)) return { ok: false, message: "Type a first name (letters only)." };
    if (lastRaw !== "" && !CHILD_LAST_NAME_RE.test(lastRaw)) {
      return { ok: false, message: "The last name can only be letters." };
    }
    guest = { external_ref: `guest-${randomUUID()}`, first_name: first, last_name: lastRaw || null };
  }

  const res = await callRotationLeague({
    action: "add_guest",
    season_slug: season.slug,
    week: w,
    external_ref: guest.external_ref,
    first_name: guest.first_name,
    last_name: guest.last_name,
  });
  return res.ok ? { ok: true } : fail(res);
}

/** One game's new sides, as registration refs, from the coach's dropdowns. */
export interface RoundEditGame {
  gameId: string;
  sideA: string[];
  sideB: string[];
}

/** Save the players for every game in one round (a swap between courts included). */
export async function editRound(input: {
  slug: unknown;
  week: unknown;
  round: unknown;
  games: unknown;
}): Promise<Outcome> {
  const season = needSeason(input.slug);
  if ("ok" in season) return season;
  const w = parsePlayWeek(season, input.week);
  if (w === null) return { ok: false, message: "That week isn't a league week for this season." };
  const round = Number(input.round);
  if (!(Number.isInteger(round) && round >= 1 && round <= 99)) return { ok: false, message: "Unknown round." };
  if (!Array.isArray(input.games) || input.games.length < 1 || input.games.length > 12) {
    return { ok: false, message: "Unknown round." };
  }
  const side = (v: unknown) =>
    Array.isArray(v) && v.length >= 1 && v.length <= 2 && v.every((r) => typeof r === "string" && REF.test(r))
      ? [...(v as string[])]
      : null;
  const games: { game_id: string; side_a: string[]; side_b: string[] }[] = [];
  const everyone: string[] = [];
  for (const g of input.games as Partial<RoundEditGame>[]) {
    const a = side(g?.sideA);
    const b = side(g?.sideB);
    if (typeof g?.gameId !== "string" || !UUID.test(g.gameId) || !a || !b || a.length !== b.length) {
      return { ok: false, message: "Every game needs a full set of players." };
    }
    games.push({ game_id: g.gameId, side_a: a, side_b: b });
    everyone.push(...a, ...b);
  }
  if (new Set(everyone).size !== everyone.length) return { ok: false, message: MESSAGES.player_double_booked };
  const res = await callRotationLeague({
    action: "edit_round",
    season_slug: season.slug,
    week: w,
    round,
    games,
  });
  return res.ok ? { ok: true } : fail(res);
}

/** Preview (dryRun) or save new rounds for everything after `afterRound`. */
export async function replanAfter(input: {
  slug: unknown;
  week: unknown;
  afterRound: unknown;
  attempt: unknown;
  save: boolean;
}): Promise<Outcome<PlanResult>> {
  const season = needSeason(input.slug);
  if ("ok" in season) return season;
  const w = parsePlayWeek(season, input.week);
  if (w === null) return { ok: false, message: "That week isn't a league week for this season." };
  const after = Number(input.afterRound);
  if (!(Number.isInteger(after) && after >= 1 && after <= 99)) return { ok: false, message: "Unknown round." };
  const attempt = Number(input.attempt ?? 1);
  if (!(Number.isInteger(attempt) && attempt >= 1 && attempt <= 99)) {
    return { ok: false, message: "Bad plan attempt." };
  }
  const res = await callRotationLeague<PlanResult>({
    action: "replan_after",
    season_slug: season.slug,
    week: w,
    after_round: after,
    attempt,
    dry_run: !input.save,
  });
  if (!res.ok) return fail(res);
  return {
    ok: true,
    saved: res.data.saved === true,
    present: Number(res.data.present) || 0,
    rounds: Array.isArray(res.data.rounds) ? res.data.rounds : [],
  };
}

export async function recordScore(input: {
  slug: unknown;
  gameId: unknown;
  scoreA: unknown;
  scoreB: unknown;
  gameTarget: unknown;
  timed: unknown;
}): Promise<Outcome> {
  const season = needSeason(input.slug);
  if ("ok" in season) return season;
  const a = Number(input.scoreA);
  const b = Number(input.scoreB);
  const target = Number(input.gameTarget ?? season.gameTarget);
  if (typeof input.gameId !== "string" || !UUID.test(input.gameId)) {
    return { ok: false, message: "Unknown game." };
  }
  if (![a, b].every((n) => Number.isInteger(n) && n >= 0 && n <= 99)) {
    return { ok: false, message: "Scores are whole numbers from 0 to 99." };
  }
  if (!season.gameTargets.includes(target)) {
    return { ok: false, message: `Games go to ${season.gameTargets.join(", ")}.` };
  }
  const res = await callRotationLeague({
    action: "score",
    season_slug: season.slug,
    game_id: input.gameId,
    score_a: a,
    score_b: b,
    game_target: target,
    timed: input.timed === true,
  });
  return res.ok ? { ok: true } : fail(res);
}

export async function removeGame(slug: unknown, gameId: unknown): Promise<Outcome> {
  const season = needSeason(slug);
  if ("ok" in season) return season;
  if (typeof gameId !== "string" || !UUID.test(gameId)) return { ok: false, message: "Unknown game." };
  const res = await callRotationLeague({ action: "void_game", season_slug: season.slug, game_id: gameId });
  return res.ok ? { ok: true } : fail(res);
}

export async function readStandings(slug: unknown): Promise<Outcome<{ standings: StandingRow[] }>> {
  const season = needSeason(slug);
  if ("ok" in season) return season;
  const res = await callRotationLeague<{ standings: StandingRow[] }>({
    action: "standings",
    season_slug: season.slug,
  });
  if (!res.ok) return fail(res);
  return { ok: true, standings: Array.isArray(res.data.standings) ? res.data.standings : [] };
}

// --------------------------------------------------------------- playoff

export interface PlayoffPlayer {
  external_ref: string;
  name: string;
}

export interface PlayoffPreview {
  locked: boolean;
  teams: { seed: number; players: PlayoffPlayer[] }[];
}

export type BracketEntrant = { seed: number; players: string[] } | "bye" | null;

export interface BracketSlotView {
  id: string;
  side: "winners" | "losers" | "final" | "reset";
  round: number;
  label: string;
  a: BracketEntrant;
  b: BracketEntrant;
  status: "pending" | "ready" | "played";
  score_a: number | null;
  score_b: number | null;
  can_score: boolean;
}

export interface PlayoffView {
  locked: boolean;
  slots: BracketSlotView[];
  champion: BracketEntrant;
  runner_up: BracketEntrant;
  complete: boolean;
}

const SLOT_ID = /^[A-Za-z0-9:_-]{1,40}$/;

export async function previewPlayoff(slug: unknown): Promise<Outcome<PlayoffPreview>> {
  const season = needSeason(slug);
  if ("ok" in season) return season;
  if (season.playoffWeek === null) return { ok: false, message: MESSAGES.no_playoff };
  const res = await callRotationLeague<PlayoffPreview>({ action: "playoff_preview", season_slug: season.slug });
  if (!res.ok) return fail(res);
  return { ok: true, locked: res.data.locked === true, teams: Array.isArray(res.data.teams) ? res.data.teams : [] };
}

/** Lock teams given as seed order -> registration refs (the coach may have moved kids). */
export async function lockPlayoffTeams(slug: unknown, teams: unknown): Promise<Outcome> {
  const season = needSeason(slug);
  if ("ok" in season) return season;
  if (!Array.isArray(teams) || teams.length < 2 || teams.length > 16) {
    return { ok: false, message: "Lock needs at least two teams." };
  }
  const clean: { seed: number; external_refs: string[] }[] = [];
  for (const [i, t] of teams.entries()) {
    if (!Array.isArray(t) || t.length < 2 || t.length > 3 || !t.every((r) => typeof r === "string" && REF.test(r))) {
      return { ok: false, message: MESSAGES.bad_teams };
    }
    clean.push({ seed: i + 1, external_refs: [...(t as string[])] });
  }
  const res = await callRotationLeague({ action: "playoff_lock", season_slug: season.slug, teams: clean });
  return res.ok ? { ok: true } : fail(res);
}

export async function unlockPlayoffTeams(slug: unknown): Promise<Outcome> {
  const season = needSeason(slug);
  if ("ok" in season) return season;
  const res = await callRotationLeague({ action: "playoff_unlock", season_slug: season.slug });
  return res.ok ? { ok: true } : fail(res);
}

export async function readPlayoff(slug: unknown): Promise<Outcome<PlayoffView>> {
  const season = needSeason(slug);
  if ("ok" in season) return season;
  if (season.playoffWeek === null) return { ok: false, message: MESSAGES.no_playoff };
  const res = await callRotationLeague<PlayoffView>({ action: "read_playoff", season_slug: season.slug });
  if (!res.ok) return fail(res);
  return {
    ok: true,
    locked: res.data.locked === true,
    slots: Array.isArray(res.data.slots) ? res.data.slots : [],
    champion: res.data.champion ?? null,
    runner_up: res.data.runner_up ?? null,
    complete: res.data.complete === true,
  };
}

export async function recordPlayoffScore(input: {
  slug: unknown;
  slot: unknown;
  scoreA: unknown;
  scoreB: unknown;
  gameTarget: unknown;
  timed: unknown;
}): Promise<Outcome> {
  const season = needSeason(input.slug);
  if ("ok" in season) return season;
  const a = Number(input.scoreA);
  const b = Number(input.scoreB);
  const target = Number(input.gameTarget ?? season.gameTarget);
  if (typeof input.slot !== "string" || !SLOT_ID.test(input.slot)) {
    return { ok: false, message: "Unknown bracket game." };
  }
  if (![a, b].every((n) => Number.isInteger(n) && n >= 0 && n <= 99)) {
    return { ok: false, message: "Scores are whole numbers from 0 to 99." };
  }
  if (!season.gameTargets.includes(target)) {
    return { ok: false, message: `Games go to ${season.gameTargets.join(", ")}.` };
  }
  const res = await callRotationLeague({
    action: "playoff_score",
    season_slug: season.slug,
    slot: input.slot,
    score_a: a,
    score_b: b,
    game_target: target,
    timed: input.timed === true,
  });
  return res.ok ? { ok: true } : fail(res);
}
