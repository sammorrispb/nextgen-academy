// The coach's "Change players" lineup for one round, as plain data the
// dropdowns edit. Pure, so the swap rule is pinned by a spec, not a browser.
//
// The rule: picking a kid for a spot never puts them on two courts. If the kid
// is already somewhere else in this round, the two kids trade places; if they
// were sitting, the kid they replace sits instead.

export interface LineupGame {
  gameId: string;
  sideA: string[];
  sideB: string[];
}

export interface SlotRef {
  game: number;
  side: "A" | "B";
  index: number;
}

export function lineupFromGames(
  games: readonly { id: string; side_a_refs?: string[]; side_b_refs?: string[] }[],
): LineupGame[] | null {
  const out: LineupGame[] = [];
  for (const g of games) {
    const a = g.side_a_refs ?? [];
    const b = g.side_b_refs ?? [];
    // An older Link & Dink build sends no refs: nothing to edit against.
    if (a.length === 0 || b.length === 0 || [...a, ...b].some((r) => r === "")) return null;
    out.push({ gameId: g.id, sideA: [...a], sideB: [...b] });
  }
  return out;
}

function sideOf(game: LineupGame, side: "A" | "B"): string[] {
  return side === "A" ? game.sideA : game.sideB;
}

export function refAt(lineup: readonly LineupGame[], slot: SlotRef): string | undefined {
  const game = lineup[slot.game];
  return game ? sideOf(game, slot.side)[slot.index] : undefined;
}

export function assignSlot(lineup: readonly LineupGame[], slot: SlotRef, ref: string): LineupGame[] {
  const next = lineup.map((g) => ({ gameId: g.gameId, sideA: [...g.sideA], sideB: [...g.sideB] }));
  const target = next[slot.game];
  if (!target) return next;
  const targetSide = sideOf(target, slot.side);
  const current = targetSide[slot.index];
  if (current === undefined || current === ref) return next;
  for (const g of next) {
    for (const side of [g.sideA, g.sideB]) {
      const i = side.indexOf(ref);
      if (i !== -1) side[i] = current;
    }
  }
  targetSide[slot.index] = ref;
  return next;
}

/** Kids checked in but on no court this round. */
export function sittingFor(lineup: readonly LineupGame[], present: readonly string[]): string[] {
  const on = new Set(lineup.flatMap((g) => [...g.sideA, ...g.sideB]));
  return present.filter((r) => !on.has(r));
}

export function lineupChanged(a: readonly LineupGame[], b: readonly LineupGame[]): boolean {
  return JSON.stringify(a) !== JSON.stringify(b);
}
