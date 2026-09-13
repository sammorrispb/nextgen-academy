import { gameWinner } from "./scores";
import type { PlayedGame, PlayerId } from "./types";

/**
 * Standings for a rotating-partner league where every kid plays a different
 * number of games (a missed Sunday, a 4th game on a 7-kid day, singles AND
 * doubles). Ranked on SHRUNK win percentage — (W + 2) / (GP + 4), i.e. every
 * kid starts from a phantom 2–2 — so a 3–0 Sunday cannot outrank a 12–3
 * season (idea from community-os packages/league-engine). Tiebreaks: point
 * differential per game, then points-for per game, then name. Head-to-head
 * was dropped on purpose: in rotating doubles it is noise.
 *
 * Input is the store's PLAYED games only; a tie (never stored) is skipped.
 */

export interface StandingRow {
  playerId: PlayerId;
  name: string;
  games: number;
  wins: number;
  losses: number;
  pointsFor: number;
  pointsAgainst: number;
  pointDiff: number;
  doublesWins: number;
  doublesLosses: number;
  singlesWins: number;
  singlesLosses: number;
  /** Raw W / GP (0 when no games). What the table shows. */
  winPct: number;
  /** (W + priorWins) / (GP + priorGames). What the table is SORTED by. */
  rankScore: number;
  rank: number;
}

export interface StandingsOptions {
  priorWins?: number;
  priorGames?: number;
  /** Display name per id; defaults to the id. Used for the last tiebreak too. */
  nameOf?: (id: PlayerId) => string;
}

export const DEFAULT_PRIOR_WINS = 2;
export const DEFAULT_PRIOR_GAMES = 4;

function blank(playerId: PlayerId, name: string): StandingRow {
  return {
    playerId,
    name,
    games: 0,
    wins: 0,
    losses: 0,
    pointsFor: 0,
    pointsAgainst: 0,
    pointDiff: 0,
    doublesWins: 0,
    doublesLosses: 0,
    singlesWins: 0,
    singlesLosses: 0,
    winPct: 0,
    rankScore: 0,
    rank: 0,
  };
}

function perGame(total: number, games: number): number {
  return games === 0 ? 0 : total / games;
}

export function computeStandings(
  playerIds: readonly PlayerId[],
  games: readonly PlayedGame[],
  options: StandingsOptions = {},
): StandingRow[] {
  const priorWins = options.priorWins ?? DEFAULT_PRIOR_WINS;
  const priorGames = options.priorGames ?? DEFAULT_PRIOR_GAMES;
  const nameOf = options.nameOf ?? ((id: PlayerId) => id);

  const rows = new Map<PlayerId, StandingRow>();
  for (const id of playerIds) rows.set(id, blank(id, nameOf(id)));

  for (const g of games) {
    const winner = gameWinner(g);
    if (!winner) continue;
    const sides: Array<{ ids: PlayerId[]; won: boolean; pf: number; pa: number }> = [
      { ids: g.sideA, won: winner === "A", pf: g.scoreA, pa: g.scoreB },
      { ids: g.sideB, won: winner === "B", pf: g.scoreB, pa: g.scoreA },
    ];
    for (const side of sides) {
      for (const id of side.ids) {
        const row = rows.get(id);
        if (!row) continue; // a kid no longer on the roster still counts for others
        row.games += 1;
        row.pointsFor += side.pf;
        row.pointsAgainst += side.pa;
        if (side.won) row.wins += 1;
        else row.losses += 1;
        if (g.format === "doubles") {
          if (side.won) row.doublesWins += 1;
          else row.doublesLosses += 1;
        } else if (side.won) row.singlesWins += 1;
        else row.singlesLosses += 1;
      }
    }
  }

  const out = [...rows.values()];
  for (const row of out) {
    row.pointDiff = row.pointsFor - row.pointsAgainst;
    row.winPct = perGame(row.wins, row.games);
    row.rankScore = (row.wins + priorWins) / (row.games + priorGames);
  }
  out.sort(
    (a, b) =>
      b.rankScore - a.rankScore ||
      perGame(b.pointDiff, b.games) - perGame(a.pointDiff, a.games) ||
      perGame(b.pointsFor, b.games) - perGame(a.pointsFor, a.games) ||
      a.name.localeCompare(b.name) ||
      a.playerId.localeCompare(b.playerId),
  );
  out.forEach((row, i) => {
    row.rank = i + 1;
  });
  return out;
}

export function rankedPlayerIds(rows: readonly StandingRow[]): PlayerId[] {
  return rows.map((r) => r.playerId);
}
