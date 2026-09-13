import { seededRandom } from "./prng";
import type {
  CourtAllocation,
  DayPlan,
  GameFormat,
  GameSides,
  PlannedGame,
  PlannedRound,
  PlayerId,
} from "./types";

/**
 * Rotating-partner day planner.
 *
 * Every round fills the courts from the kids present: doubles courts first,
 * then a singles court on whatever is left, so with six kids nobody sits
 * (1 doubles + 1 singles) and with seven exactly one kid sits per round. The
 * planner is HISTORY-AWARE: it reads every partnership, opponent and singles
 * game the season has already produced and picks each round to keep those
 * counts level — which is what makes "every kid plays with every kid a
 * near-equal number of times" survive absences and late arrivals, where a
 * fixed whist table breaks the moment one kid is missing.
 *
 * Search is exhaustive per round (a few thousand candidates at ten kids), and
 * deterministic for a given seed, so a preview and the save that follows it
 * agree by construction. Generic vendored tables were rejected: the community-
 * os rrDoublesGeneric pins one pivot who plays every round and leaves the
 * rest badly unbalanced at 6 and 7 — exactly our roster sizes.
 */

export function pairKey(a: PlayerId, b: PlayerId): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

export interface SeasonHistory {
  /** Times each pair has PARTNERED (doubles). */
  partner: Map<string, number>;
  /** Times each pair has faced each other in doubles. */
  doublesOpponent: Map<string, number>;
  /** Times each pair has faced each other in singles. */
  singlesOpponent: Map<string, number>;
  /** Singles games per player. */
  singlesGames: Map<PlayerId, number>;
  /** Games per player, any format. */
  games: Map<PlayerId, number>;
}

export function emptyHistory(): SeasonHistory {
  return {
    partner: new Map(),
    doublesOpponent: new Map(),
    singlesOpponent: new Map(),
    singlesGames: new Map(),
    games: new Map(),
  };
}

function bump(map: Map<string, number>, key: string, by = 1): void {
  map.set(key, (map.get(key) ?? 0) + by);
}

function count(map: Map<string, number>, key: string): number {
  return map.get(key) ?? 0;
}

export function cloneHistory(h: SeasonHistory): SeasonHistory {
  return {
    partner: new Map(h.partner),
    doublesOpponent: new Map(h.doublesOpponent),
    singlesOpponent: new Map(h.singlesOpponent),
    singlesGames: new Map(h.singlesGames),
    games: new Map(h.games),
  };
}

export type HistoryGame = GameSides & { format: GameFormat };

/** Fold one game into the history (mutates). Playoff team games are not
 * history — only weeks 1–5 feed the partner balance. */
export function recordGame(history: SeasonHistory, game: HistoryGame): void {
  const { sideA, sideB } = game;
  for (const p of [...sideA, ...sideB]) bump(history.games, p);
  if (game.format === "doubles") {
    for (const side of [sideA, sideB]) {
      for (let i = 0; i < side.length; i += 1) {
        for (let j = i + 1; j < side.length; j += 1) {
          bump(history.partner, pairKey(side[i], side[j]));
        }
      }
    }
    for (const x of sideA) {
      for (const y of sideB) bump(history.doublesOpponent, pairKey(x, y));
    }
  } else {
    for (const p of [...sideA, ...sideB]) bump(history.singlesGames, p);
    for (const x of sideA) {
      for (const y of sideB) bump(history.singlesOpponent, pairKey(x, y));
    }
  }
}

/** Season history from every PLAYED game the store returns (caller filters
 * Void/Scheduled rows out — the engine trusts its input). */
export function buildHistory(games: readonly HistoryGame[]): SeasonHistory {
  const h = emptyHistory();
  for (const g of games) recordGame(h, g);
  return h;
}

/** Partner-count matrix for a roster, for tests and the coach balance view. */
export function partnerMatrix(
  history: SeasonHistory,
  players: readonly PlayerId[],
): number[][] {
  return players.map((a) =>
    players.map((b) => (a === b ? 0 : count(history.partner, pairKey(a, b)))),
  );
}

// ---------------------------------------------------------------------------
// Court allocation
// ---------------------------------------------------------------------------

/**
 * How many doubles courts, singles courts and sitting kids a round has for N
 * present on C courts. Doubles is preferred (partner rotation is the point);
 * singles takes a court only when a spare court AND at least two spare kids
 * exist. 6 → 1D+1S; 7 → 1D+1S+1 sits; 8 → 2D; 5 → 1D+1 sits; 3 → 1S+1 sits.
 */
export function courtAllocation(playerCount: number, courts: number): CourtAllocation {
  const n = Math.max(0, Math.floor(playerCount));
  const c = Math.max(0, Math.floor(courts));
  const doubles = Math.min(c, Math.floor(n / 4));
  const singles = Math.min(c - doubles, Math.floor((n - 4 * doubles) / 2));
  const playing = 4 * doubles + 2 * singles;
  return { doubles, singles, playing, sitting: n - playing };
}

/** Rounds so that everyone reaches the target: ceil(target·N / slots per round). */
export function defaultRounds(
  playerCount: number,
  courts: number,
  targetGamesPerPlayer: number,
): number {
  const a = courtAllocation(playerCount, courts);
  if (a.playing === 0) return 0;
  return Math.ceil((targetGamesPerPlayer * playerCount) / a.playing);
}

// ---------------------------------------------------------------------------
// Enumeration helpers
// ---------------------------------------------------------------------------

function combinations<T>(items: readonly T[], k: number): T[][] {
  const out: T[][] = [];
  const pick: T[] = [];
  const walk = (start: number) => {
    if (pick.length === k) {
      out.push([...pick]);
      return;
    }
    for (let i = start; i < items.length; i += 1) {
      pick.push(items[i]);
      walk(i + 1);
      pick.pop();
    }
  };
  walk(0);
  return out;
}

/** All ways to pair an even-sized list into 2-sets. */
function pairings(items: readonly PlayerId[]): [PlayerId, PlayerId][][] {
  if (items.length === 0) return [[]];
  const [first, ...rest] = items;
  const out: [PlayerId, PlayerId][][] = [];
  for (let i = 0; i < rest.length; i += 1) {
    const partner = rest[i];
    const remaining = rest.filter((_, idx) => idx !== i);
    for (const tail of pairings(remaining)) out.push([[first, partner], ...tail]);
  }
  return out;
}

/** All ways to split a list (size 4d) into unordered groups of four. */
function quads(items: readonly PlayerId[]): PlayerId[][][] {
  if (items.length === 0) return [[]];
  const [first, ...rest] = items;
  const out: PlayerId[][][] = [];
  for (const three of combinations(rest, 3)) {
    const group = [first, ...three];
    const remaining = rest.filter((p) => !three.includes(p));
    for (const tail of quads(remaining)) out.push([group, ...tail]);
  }
  return out;
}

const TEAM_SPLITS: [number, number, number, number][] = [
  [0, 1, 2, 3],
  [0, 2, 1, 3],
  [0, 3, 1, 2],
];

// ---------------------------------------------------------------------------
// planDay
// ---------------------------------------------------------------------------

export interface PlanDayInput {
  present: readonly PlayerId[];
  /** Season-to-date history, INCLUDING any of today's played games. */
  history: SeasonHistory;
  /** Today's games already played or saved, for round numbering and the
   * day's own sit/singles balance. */
  playedToday: readonly PlannedGame[];
  courts: number;
  targetGamesPerPlayer: number;
  /** Rounds to generate NOW. Default: defaultRounds − rounds already played. */
  rounds?: number;
  /** e.g. "Green-W2-A1" — bump the attempt to get a different plan. */
  seed: string;
}

interface DayState {
  gamesToday: Map<PlayerId, number>;
  singlesToday: Map<PlayerId, number>;
  partnerToday: Map<string, number>;
}

interface Candidate {
  sitting: PlayerId[];
  doubles: [PlayerId, PlayerId][][]; // per game: [teamA, teamB]
  singles: [PlayerId, PlayerId][];
}

const W_PARTNER = 10;
const W_PARTNER_TODAY = 3;
const W_DOUBLES_OPP = 2;
const W_SINGLES_OPP = 3;
const W_SINGLES_LOAD = 5;
const W_SEASON_GAMES = 2;

function candidateCost(
  c: Candidate,
  h: SeasonHistory,
  day: DayState,
  playing: readonly PlayerId[],
): number {
  let cost = 0;
  for (const [teamA, teamB] of c.doubles) {
    for (const team of [teamA, teamB]) {
      const k = pairKey(team[0], team[1]);
      const n = count(h.partner, k) + W_PARTNER_TODAY * count(day.partnerToday, k);
      cost += W_PARTNER * n * n;
    }
    for (const x of teamA) {
      for (const y of teamB) {
        const n = count(h.doublesOpponent, pairKey(x, y));
        cost += W_DOUBLES_OPP * n * n;
      }
    }
  }
  for (const [x, y] of c.singles) {
    const n = count(h.singlesOpponent, pairKey(x, y));
    cost += W_SINGLES_OPP * n * n;
    for (const p of [x, y]) {
      const load = count(h.singlesGames, p) + count(day.singlesToday, p);
      cost += W_SINGLES_LOAD * load * load;
    }
  }
  // Prefer resting the kids who already have the most games this season.
  for (const p of playing) cost += W_SEASON_GAMES * count(h.games, p);
  return cost;
}

/** Sitting sets: the kids with the most games today sit; ties at the boundary
 * are enumerated so the cost function (not list order) breaks them. */
function sittingChoices(
  present: readonly PlayerId[],
  sit: number,
  day: DayState,
): PlayerId[][] {
  if (sit === 0) return [[]];
  const byGames = new Map<number, PlayerId[]>();
  for (const p of present) {
    const g = count(day.gamesToday, p);
    byGames.set(g, [...(byGames.get(g) ?? []), p]);
  }
  const tiers = [...byGames.keys()].sort((a, b) => b - a);
  const fixed: PlayerId[] = [];
  let need = sit;
  for (const g of tiers) {
    const tier = byGames.get(g) ?? [];
    if (tier.length <= need) {
      fixed.push(...tier);
      need -= tier.length;
      if (need === 0) return [fixed];
      continue;
    }
    return combinations(tier, need).map((extra) => [...fixed, ...extra]);
  }
  return [fixed];
}

function bestRound(
  present: readonly PlayerId[],
  allocation: CourtAllocation,
  h: SeasonHistory,
  day: DayState,
  rnd: () => number,
): Candidate {
  let best: { cost: number; candidate: Candidate } | null = null;
  const consider = (candidate: Candidate, playing: readonly PlayerId[]) => {
    const cost = candidateCost(candidate, h, day, playing) + rnd() * 1e-3;
    if (!best || cost < best.cost) best = { cost, candidate };
  };

  for (const sitting of sittingChoices(present, allocation.sitting, day)) {
    const playing = present.filter((p) => !sitting.includes(p));
    const singlesSlots = 2 * allocation.singles;
    for (const singlesPlayers of combinations(playing, singlesSlots)) {
      const doublesPlayers = playing.filter((p) => !singlesPlayers.includes(p));
      for (const singles of pairings(singlesPlayers)) {
        for (const groups of quads(doublesPlayers)) {
          const splitsPerGame = groups.map(() => TEAM_SPLITS);
          const walk = (idx: number, acc: [PlayerId, PlayerId][][]) => {
            if (idx === groups.length) {
              consider({ sitting, doubles: acc, singles }, playing);
              return;
            }
            const g = groups[idx];
            for (const [a, b, c, d] of splitsPerGame[idx]) {
              walk(idx + 1, [...acc, [[g[a], g[b]], [g[c], g[d]]]]);
            }
          };
          walk(0, []);
        }
      }
    }
  }
  if (!best) throw new Error("planDay: no candidate round (allocation bug)");
  return (best as { cost: number; candidate: Candidate }).candidate;
}

export function planDay(input: PlanDayInput): DayPlan {
  const present = [...new Set(input.present)].sort();
  const allocation = courtAllocation(present.length, input.courts);
  const roundsPlayed = input.playedToday.reduce((m, g) => Math.max(m, g.round), 0);
  const wanted =
    input.rounds ??
    Math.max(
      0,
      defaultRounds(present.length, input.courts, input.targetGamesPerPlayer) -
        roundsPlayed,
    );
  if (allocation.playing === 0 || wanted <= 0) return { rounds: [], allocation };

  const rnd = seededRandom(input.seed);
  const h = cloneHistory(input.history);
  const day: DayState = {
    gamesToday: new Map(present.map((p) => [p, 0])),
    singlesToday: new Map(present.map((p) => [p, 0])),
    partnerToday: new Map(),
  };
  for (const g of input.playedToday) {
    for (const p of [...g.sideA, ...g.sideB]) {
      if (day.gamesToday.has(p)) bump(day.gamesToday, p);
      if (g.format === "singles" && day.singlesToday.has(p)) bump(day.singlesToday, p);
    }
    if (g.format === "doubles") {
      for (const side of [g.sideA, g.sideB]) {
        if (side.length === 2) bump(day.partnerToday, pairKey(side[0], side[1]));
      }
    }
  }

  const rounds: PlannedRound[] = [];
  for (let r = 1; r <= wanted; r += 1) {
    const roundNo = roundsPlayed + r;
    const pick = bestRound(present, allocation, h, day, rnd);
    const games: PlannedGame[] = [];
    let court = 1;
    for (const [teamA, teamB] of pick.doubles) {
      const game: PlannedGame = { round: roundNo, court, format: "doubles", sideA: teamA, sideB: teamB };
      games.push(game);
      court += 1;
    }
    for (const [x, y] of pick.singles) {
      games.push({ round: roundNo, court, format: "singles", sideA: [x], sideB: [y] });
      court += 1;
    }
    for (const g of games) {
      recordGame(h, g);
      for (const p of [...g.sideA, ...g.sideB]) {
        bump(day.gamesToday, p);
        if (g.format === "singles") bump(day.singlesToday, p);
      }
      if (g.format === "doubles") {
        bump(day.partnerToday, pairKey(g.sideA[0], g.sideA[1]));
        bump(day.partnerToday, pairKey(g.sideB[0], g.sideB[1]));
      }
    }
    rounds.push({ round: roundNo, games, sitting: [...pick.sitting].sort() });
  }
  return { rounds, allocation };
}
