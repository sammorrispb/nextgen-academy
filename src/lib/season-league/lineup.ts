import type { PlannedGame } from './types';

export type LineupGame = PlannedGame & { key: string };

/** Selecting someone already on court swaps the two positions. */
export function replaceLineupPlayer(games: readonly LineupGame[], key: string, side: 'sideA' | 'sideB', index: number, player: string): LineupGame[] {
  const next = games.map(g => ({ ...g, sideA: [...g.sideA], sideB: [...g.sideB] }));
  const game = next.find(g => g.key === key);
  if (!game || !game[side][index]) return next;
  const previous = game[side][index];
  for (const g of next) for (const s of ['sideA', 'sideB'] as const) {
    g[s] = g[s].map(p => p === player ? previous : p);
  }
  game[side][index] = player;
  return next;
}

export function validLineup(games: readonly LineupGame[], present: readonly string[]): boolean {
  const seen = new Set<string>();
  return games.every(g => {
    const size = g.format === 'singles' ? 1 : 2;
    return g.sideA.length === size && g.sideB.length === size && [...g.sideA, ...g.sideB].every(p => {
      if (!present.includes(p) || seen.has(p)) return false;
      seen.add(p); return true;
    });
  });
}
