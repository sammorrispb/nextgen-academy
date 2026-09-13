import { test, expect } from "@playwright/test";
import {
  buildBracket,
  lossesBySeed,
  nextPow2,
  resolveBracket,
  snakeTeams,
  standardBracket,
  type BracketResult,
} from "../src/lib/season-league/finals";
import { mulberry32 } from "../src/lib/season-league/prng";

// Pure-function spec (no dev server) for the week-6 playoff: snake seeding and
// the double-elimination bracket. The bracket invariant that matters is the
// one a parent would notice if it broke — every team that isn't champion loses
// exactly twice, the champion at most once — and it is checked for every team
// count the season can produce (2..8) under random results.
//   npx playwright test e2e/season-league-finals.spec.ts --project=desktop
//
// Mutation checks: drop the odd-kid `push` in snakeTeams → the seven-kids pin
// fails; make a one-bye slot `pending` instead of auto-advancing → the random-
// results pins fail (the bracket never completes); force `resetNeeded` false →
// the reset pin fails.

function ranked(n: number): string[] {
  return Array.from({ length: n }, (_, i) => `r${i + 1}`);
}

/** Play out a bracket with a seeded coin flip (or a fixed rule) until done. */
function playOut(
  teamCount: number,
  decide: (slotId: string, a: number, b: number) => "A" | "B",
): ReturnType<typeof resolveBracket> {
  const results: BracketResult[] = [];
  for (let guard = 0; guard < 64; guard += 1) {
    const state = resolveBracket(teamCount, results);
    if (state.complete) return state;
    expect(state.readySlotIds.length, "an incomplete bracket must have a playable game").toBeGreaterThan(0);
    const id = state.readySlotIds[0];
    const slot = state.slots.find((s) => s.slot.id === id)!;
    const a = slot.a as number;
    const b = slot.b as number;
    const w = decide(id, a, b);
    results.push({ slot: id, scoreA: w === "A" ? 11 : 6, scoreB: w === "A" ? 6 : 11 });
  }
  throw new Error("bracket never completed");
}

test.describe("snake seeding", () => {
  test("six kids → 1+6, 2+5, 3+4", () => {
    expect(snakeTeams(ranked(6))).toEqual([
      { seed: 1, members: ["r1", "r6"] },
      { seed: 2, members: ["r2", "r5"] },
      { seed: 3, members: ["r3", "r4"] },
    ]);
  });

  test("seven kids → the lowest-ranked rides as a third on the last team", () => {
    expect(snakeTeams(ranked(7))).toEqual([
      { seed: 1, members: ["r1", "r6"] },
      { seed: 2, members: ["r2", "r5"] },
      { seed: 3, members: ["r3", "r4", "r7"] },
    ]);
  });

  test("five kids → two teams, third on the last one; ten kids → five teams", () => {
    expect(snakeTeams(ranked(5))).toEqual([
      { seed: 1, members: ["r1", "r4"] },
      { seed: 2, members: ["r2", "r3", "r5"] },
    ]);
    expect(snakeTeams(ranked(10))).toHaveLength(5);
    expect(snakeTeams(ranked(10))[4]).toEqual({ seed: 5, members: ["r5", "r6"] });
  });

  test("too few kids → no teams; duplicates are ignored", () => {
    expect(snakeTeams(ranked(1))).toEqual([]);
    expect(snakeTeams([])).toEqual([]);
    expect(snakeTeams(["a", "b", "a", "c", "d"])).toEqual([
      { seed: 1, members: ["a", "d"] },
      { seed: 2, members: ["b", "c"] },
    ]);
  });
});

test.describe("bracket blueprint", () => {
  test("mirrored seed order and bracket sizing", () => {
    expect(nextPow2(3)).toBe(4);
    expect(nextPow2(5)).toBe(8);
    expect(nextPow2(8)).toBe(8);
    expect(standardBracket(8)).toEqual([1, 8, 4, 5, 2, 7, 3, 6]);
    expect(standardBracket(4)).toEqual([1, 4, 2, 3]);
  });

  test("T=8: 7 winners slots, 6 losers slots, a final and a reset (15 slots)", () => {
    const slots = buildBracket(8);
    expect(slots.filter((s) => s.side === "winners")).toHaveLength(7);
    expect(slots.filter((s) => s.side === "losers")).toHaveLength(6);
    expect(slots.map((s) => s.id)).toContain("gf");
    expect(slots.map((s) => s.id)).toContain("gfr");
    expect(slots).toHaveLength(15);
  });

  test("fewer than two teams → no bracket", () => {
    expect(buildBracket(1)).toEqual([]);
    expect(buildBracket(0)).toEqual([]);
  });

  test("T=3: the top seed's opener is a bye and the 2v3 game is ready at once", () => {
    const state = resolveBracket(3, []);
    const w1m1 = state.slots.find((s) => s.slot.id === "w1m1")!;
    expect(w1m1.status).toBe("bye");
    expect(w1m1.winner).toBe(1);
    expect(state.readySlotIds).toEqual(["w1m2"]);
  });

  test("T=5: byes make both a round-1 game and a round-2 game playable immediately", () => {
    const state = resolveBracket(5, []);
    expect(state.readySlotIds).toEqual(["w1m2", "w2m2"]);
    const w2m2 = state.slots.find((s) => s.slot.id === "w2m2")!;
    expect([w2m2.a, w2m2.b]).toEqual([2, 3]);
  });
});

test.describe("double elimination — every team count the season can produce", () => {
  for (const t of [2, 3, 4, 5, 6, 7, 8]) {
    test(`T=${t}: random results → non-champions lose exactly twice, champion at most once, 2T−2 (+1) games`, () => {
      for (let trial = 0; trial < 20; trial += 1) {
        const rnd = mulberry32(t * 1000 + trial);
        const state = playOut(t, () => (rnd() < 0.5 ? "A" : "B"));
        expect(state.complete).toBe(true);
        expect(state.champion).not.toBeNull();
        const losses = lossesBySeed(state);
        for (let seed = 1; seed <= t; seed += 1) {
          if (seed === state.champion) expect(losses.get(seed)).toBeLessThanOrEqual(1);
          else expect(losses.get(seed), `seed ${seed} losses`).toBe(2);
        }
        expect(state.playedCount).toBe(2 * t - 2 + (state.resetNeeded ? 1 : 0));
        for (const s of state.slots) {
          if (s.status === "played" || s.status === "ready") {
            expect(typeof s.a).toBe("number");
            expect(typeof s.b).toBe("number");
            expect(s.a, `${s.slot.id} never pits a team against itself`).not.toBe(s.b);
          }
        }
        expect(state.readySlotIds).toEqual([]);
      }
    });
  }

  test("T=8, higher seed always wins: seed 1 takes it with zero losses and no reset", () => {
    const state = playOut(8, (_id, a, b) => (a < b ? "A" : "B"));
    expect(state.champion).toBe(1);
    expect(state.runnerUp).toBe(2);
    expect(state.resetNeeded).toBe(false);
    expect(state.playedCount).toBe(14);
    expect(lossesBySeed(state).get(1)).toBe(0);
  });

  test("the reset is played only when the losers-side team wins the grand final", () => {
    // Higher seed wins everything EXCEPT the grand final, where the losers-side
    // team (slot side B) takes it — that is the one path to a reset.
    const state = playOut(4, (id, a, b) => (id === "gf" ? "B" : a < b ? "A" : "B"));
    expect(state.resetNeeded).toBe(true);
    expect(state.playedCount).toBe(2 * 4 - 2 + 1);
    const gfr = state.slots.find((s) => s.slot.id === "gfr")!;
    expect(gfr.status).toBe("played");
    expect(state.champion).not.toBeNull();
    // And when the winners-bracket team wins the final, the reset is skipped.
    const clean = playOut(4, (_id, a, b) => (a < b ? "A" : "B"));
    expect(clean.slots.find((s) => s.slot.id === "gfr")!.status).toBe("skipped");
  });

  test("a result for a slot that isn't playable yet is ignored, and ties are ignored", () => {
    const early = resolveBracket(4, [{ slot: "gf", scoreA: 11, scoreB: 3 }]);
    expect(early.complete).toBe(false);
    expect(early.slots.find((s) => s.slot.id === "gf")!.status).toBe("pending");
    const tied = resolveBracket(4, [{ slot: "w1m1", scoreA: 7, scoreB: 7 }]);
    expect(tied.slots.find((s) => s.slot.id === "w1m1")!.status).toBe("ready");
  });

  test("resolution is a pure function of the results (order-independent)", () => {
    const a: BracketResult[] = [
      { slot: "w1m1", scoreA: 11, scoreB: 5 },
      { slot: "w1m2", scoreA: 4, scoreB: 11 },
    ];
    const b = [...a].reverse();
    expect(resolveBracket(4, a)).toEqual(resolveBracket(4, b));
  });
});
