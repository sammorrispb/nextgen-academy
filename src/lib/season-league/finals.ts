import type { PlayerId } from "./types";

/**
 * Week-6 playoff engine: snake-seeded doubles teams from the standings, then a
 * double-elimination bracket.
 *
 * Snake seeding replaced a captains' draft on Sam's call (2026-09-13): a
 * visible pick order can leave a nine-year-old picked last in front of the
 * group. 1+N, 2+N−1, … is private, deterministic and balanced; an odd, lowest-
 * ranked kid rides as a third on the last team, rotating in.
 *
 * The bracket is a static blueprint of SLOTS (winners rounds, losers rounds,
 * the final, the reset) whose entrants are resolved from recorded results, so
 * the only state the store holds is scores keyed by slot id. Byes go to the
 * top seeds and propagate: a slot with one bye auto-advances the other team
 * without a game, a slot with two byes yields a bye. Real games therefore
 * always number 2T−2, plus one if the losers-side team wins the final.
 * Adapted from community-os packages/tournament/src/sandbox/double_elim.ts
 * (power-of-two only, singles-shaped) and single_elim.ts (bye placement).
 */

export interface Team {
  seed: number;
  members: PlayerId[];
}

/** Standings order in, teams out. Requires ≥ 2 kids for a team, ≥ 4 for a bracket. */
export function snakeTeams(rankedPlayerIds: readonly PlayerId[]): Team[] {
  const ids = [...new Set(rankedPlayerIds)];
  const pairs = Math.floor(ids.length / 2);
  const teams: Team[] = [];
  for (let i = 0; i < pairs; i += 1) {
    teams.push({ seed: i + 1, members: [ids[i], ids[2 * pairs - 1 - i]] });
  }
  if (ids.length % 2 === 1 && pairs > 0) {
    teams[pairs - 1].members.push(ids[ids.length - 1]);
  }
  return teams;
}

export function nextPow2(n: number): number {
  let size = 1;
  while (size < n) size *= 2;
  return size;
}

/** Canonical mirrored seed order, e.g. size 8 → [1, 8, 4, 5, 2, 7, 3, 6]. */
export function standardBracket(size: number): number[] {
  if (size <= 1) return [1];
  const prev = standardBracket(size / 2);
  const out: number[] = [];
  for (const seed of prev) out.push(seed, size + 1 - seed);
  return out;
}

export type SlotId = string;

export type Source =
  | { kind: "seed"; seed: number }
  | { kind: "winner"; slot: SlotId }
  | { kind: "loser"; slot: SlotId };

export type BracketSide = "winners" | "losers" | "final" | "reset";

export interface BracketSlot {
  id: SlotId;
  side: BracketSide;
  round: number;
  index: number;
  label: string;
  a: Source;
  b: Source;
}

const winnerOf = (slot: SlotId): Source => ({ kind: "winner", slot });
const loserOf = (slot: SlotId): Source => ({ kind: "loser", slot });

/** Blueprint for T teams (2..8 supported; larger sizes work but are untested). */
export function buildBracket(teamCount: number): BracketSlot[] {
  if (teamCount < 2) return [];
  const size = nextPow2(teamCount);
  const k = Math.log2(size);
  const order = standardBracket(size);
  const slots: BracketSlot[] = [];

  // Winners bracket.
  for (let i = 0; i < size / 2; i += 1) {
    slots.push({
      id: `w1m${i + 1}`,
      side: "winners",
      round: 1,
      index: i + 1,
      label: k === 1 ? "Final (winners)" : `Winners R1 · Match ${i + 1}`,
      a: { kind: "seed", seed: order[2 * i] },
      b: { kind: "seed", seed: order[2 * i + 1] },
    });
  }
  for (let r = 2; r <= k; r += 1) {
    const count = size / 2 ** r;
    for (let i = 0; i < count; i += 1) {
      slots.push({
        id: `w${r}m${i + 1}`,
        side: "winners",
        round: r,
        index: i + 1,
        label: r === k ? "Winners final" : `Winners R${r} · Match ${i + 1}`,
        a: winnerOf(`w${r - 1}m${2 * i + 1}`),
        b: winnerOf(`w${r - 1}m${2 * i + 2}`),
      });
    }
  }

  // Losers bracket: round 1 pairs adjacent winners-R1 losers; even rounds are
  // "major" (a losers survivor meets a team dropping from the winners side,
  // index-reversed to delay rematches); odd rounds ≥ 3 are "minor" (survivors
  // pair up).
  const lbRounds = 2 * (k - 1);
  for (let r = 1; r <= lbRounds; r += 1) {
    const count = size / 2 ** (Math.ceil(r / 2) + 1);
    for (let i = 0; i < count; i += 1) {
      let a: Source;
      let b: Source;
      if (r === 1) {
        a = loserOf(`w1m${2 * i + 1}`);
        b = loserOf(`w1m${2 * i + 2}`);
      } else if (r % 2 === 0) {
        a = winnerOf(`l${r - 1}m${i + 1}`);
        b = loserOf(`w${r / 2 + 1}m${count - i}`);
      } else {
        a = winnerOf(`l${r - 1}m${2 * i + 1}`);
        b = winnerOf(`l${r - 1}m${2 * i + 2}`);
      }
      slots.push({
        id: `l${r}m${i + 1}`,
        side: "losers",
        round: r,
        index: i + 1,
        label: r === lbRounds ? "Losers final" : `Losers R${r} · Match ${i + 1}`,
        a,
        b,
      });
    }
  }

  slots.push({
    id: "gf",
    side: "final",
    round: 1,
    index: 1,
    label: "Grand final",
    a: winnerOf(`w${k}m1`),
    b: k >= 2 ? winnerOf(`l${lbRounds}m1`) : loserOf("w1m1"),
  });
  slots.push({
    id: "gfr",
    side: "reset",
    round: 2,
    index: 1,
    label: "Grand final · reset",
    a: winnerOf("gf"),
    b: loserOf("gf"),
  });
  return slots;
}

/** A recorded score for one slot. A/B are the slot's own a/b entrants. */
export interface BracketResult {
  slot: SlotId;
  scoreA: number;
  scoreB: number;
}

/** A seed number, a bye, or null while an upstream game is unplayed. */
export type Entrant = number | "bye" | null;

export type SlotStatus = "bye" | "pending" | "ready" | "played" | "skipped";

export interface ResolvedSlot {
  slot: BracketSlot;
  a: Entrant;
  b: Entrant;
  status: SlotStatus;
  winner: Entrant;
  loser: Entrant;
  result?: BracketResult;
}

export interface BracketState {
  teamCount: number;
  slots: ResolvedSlot[];
  readySlotIds: SlotId[];
  playedCount: number;
  champion: number | null;
  runnerUp: number | null;
  /** The losers-side team won the grand final — the reset decides it. */
  resetNeeded: boolean;
  complete: boolean;
}

export function resolveBracket(
  teamCount: number,
  results: readonly BracketResult[],
): BracketState {
  const blueprint = buildBracket(teamCount);
  const byId = new Map<SlotId, ResolvedSlot>();
  const resultById = new Map<SlotId, BracketResult>();
  for (const r of results) {
    if (r.scoreA !== r.scoreB) resultById.set(r.slot, r);
  }

  const resolveSource = (s: Source): Entrant => {
    if (s.kind === "seed") return s.seed <= teamCount ? s.seed : "bye";
    const up = byId.get(s.slot);
    if (!up) return null;
    return s.kind === "winner" ? up.winner : up.loser;
  };

  let resetNeeded = false;
  for (const slot of blueprint) {
    let a = resolveSource(slot.a);
    let b = resolveSource(slot.b);
    let status: SlotStatus;
    let winner: Entrant = null;
    let loser: Entrant = null;
    let result: BracketResult | undefined;

    if (slot.side === "reset") {
      const gf = byId.get("gf");
      resetNeeded = !!gf && gf.status === "played" && gf.winner === gf.b;
      if (!resetNeeded) {
        a = null;
        b = null;
      }
    }

    if (slot.side === "reset" && !resetNeeded) {
      status = "skipped";
    } else if (a === "bye" && b === "bye") {
      status = "bye";
      winner = "bye";
      loser = "bye";
    } else if (a === "bye" && typeof b === "number") {
      status = "bye";
      winner = b;
      loser = "bye";
    } else if (b === "bye" && typeof a === "number") {
      status = "bye";
      winner = a;
      loser = "bye";
    } else if (typeof a !== "number" || typeof b !== "number") {
      status = "pending";
    } else {
      result = resultById.get(slot.id);
      if (result) {
        status = "played";
        winner = result.scoreA > result.scoreB ? a : b;
        loser = result.scoreA > result.scoreB ? b : a;
      } else {
        status = "ready";
      }
    }
    byId.set(slot.id, { slot, a, b, status, winner, loser, result });
  }

  const slots = [...byId.values()];
  const gf = byId.get("gf");
  const gfr = byId.get("gfr");
  let champion: number | null = null;
  let runnerUp: number | null = null;
  if (gf?.status === "played") {
    if (!resetNeeded) {
      champion = typeof gf.winner === "number" ? gf.winner : null;
      runnerUp = typeof gf.loser === "number" ? gf.loser : null;
    } else if (gfr?.status === "played") {
      champion = typeof gfr.winner === "number" ? gfr.winner : null;
      runnerUp = typeof gfr.loser === "number" ? gfr.loser : null;
    }
  }

  return {
    teamCount,
    slots,
    readySlotIds: slots.filter((s) => s.status === "ready").map((s) => s.slot.id),
    playedCount: slots.filter((s) => s.status === "played").length,
    champion,
    runnerUp,
    resetNeeded,
    complete: champion !== null,
  };
}

/** Losses per seed from the resolved bracket (bye "losses" never count). */
export function lossesBySeed(state: BracketState): Map<number, number> {
  const out = new Map<number, number>();
  for (let seed = 1; seed <= state.teamCount; seed += 1) out.set(seed, 0);
  for (const s of state.slots) {
    if (s.status === "played" && typeof s.loser === "number") {
      out.set(s.loser, (out.get(s.loser) ?? 0) + 1);
    }
  }
  return out;
}
