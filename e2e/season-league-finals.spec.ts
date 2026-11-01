import { test, expect } from "@playwright/test";
import {
  buildBracket,
  lossesBySeed,
  nextPow2,
  resolveBracket,
  firstRound,
  halvesTeams,
  pairTeams,
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
// Mutation checks (halves): give the bottom teams ascending seeds → the
// eight-kid round-one pin and the top-meets-bottom pin fail; drop the one-team
// snake fallback → the three-kid pin fails; take the bottom half's odd kid onto
// a top team → the seven- and nine-kid pins fail.
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

test.describe("top-half / bottom-half pairing (Sam, 2026-11-01)", () => {
  test("eight kids → 1+4, 2+3 on top and 6+7, 5+8 below, so round one is 1+4 v 5+8 and 2+3 v 6+7", () => {
    const teams = halvesTeams(ranked(8));
    expect(teams).toEqual([
      { seed: 1, members: ["r1", "r4"] },
      { seed: 2, members: ["r2", "r3"] },
      { seed: 3, members: ["r6", "r7"] },
      { seed: 4, members: ["r5", "r8"] },
    ]);
    const members = new Map(teams.map((t) => [t.seed, t.members]));
    expect(firstRound(4).map((m) => [members.get(m.a), members.get(m.b as number)])).toEqual([
      [["r1", "r4"], ["r5", "r8"]],
      [["r2", "r3"], ["r6", "r7"]],
    ]);
  });

  test("top team i meets bottom team i in round one, for 4, 8 and 16 kids", () => {
    for (const n of [4, 8, 16]) {
      const half = n / 2;
      const teams = halvesTeams(ranked(n));
      const bottomPairs = snakeTeams(ranked(n).slice(half));
      const matches = firstRound(teams.length);
      expect(matches, `${n} kids`).toHaveLength(teams.length / 2);
      for (const m of matches) {
        const top = teams.find((t) => t.seed === m.a);
        const bottom = teams.find((t) => t.seed === m.b);
        expect(top?.members.every((r) => Number(r.slice(1)) <= half), `${n} kids: seed ${m.a} is a top team`).toBe(true);
        expect(bottom?.members, `${n} kids: top team ${m.a} meets bottom team ${m.a}`).toEqual(bottomPairs[m.a - 1].members);
      }
    }
  });

  test("four kids → the top two against the bottom two", () => {
    expect(halvesTeams(ranked(4))).toEqual([
      { seed: 1, members: ["r1", "r2"] },
      { seed: 2, members: ["r3", "r4"] },
    ]);
    expect(firstRound(2)).toEqual([{ match: 1, a: 1, b: 2 }]);
  });

  test("an odd kid rides as a third on the last bottom team; a single team is plain snake", () => {
    expect(halvesTeams(ranked(7))).toEqual([
      { seed: 1, members: ["r1", "r4"] },
      { seed: 2, members: ["r2", "r3"] },
      { seed: 3, members: ["r5", "r6", "r7"] },
    ]);
    expect(halvesTeams(ranked(9))).toEqual([
      { seed: 1, members: ["r1", "r4"] },
      { seed: 2, members: ["r2", "r3"] },
      { seed: 3, members: ["r6", "r7", "r9"] },
      { seed: 4, members: ["r5", "r8"] },
    ]);
    expect(halvesTeams(ranked(5))).toEqual([
      { seed: 1, members: ["r1", "r2"] },
      { seed: 2, members: ["r3", "r4", "r5"] },
    ]);
    expect(halvesTeams(ranked(3))).toEqual(snakeTeams(ranked(3)));
  });

  test("six and ten kids: the top half of the teams snakes from the top of the standings, the rest from the bottom", () => {
    expect(halvesTeams(ranked(6))).toEqual([
      { seed: 1, members: ["r1", "r4"] },
      { seed: 2, members: ["r2", "r3"] },
      { seed: 3, members: ["r5", "r6"] },
    ]);
    expect(halvesTeams(ranked(10))).toEqual([
      { seed: 1, members: ["r1", "r6"] },
      { seed: 2, members: ["r2", "r5"] },
      { seed: 3, members: ["r3", "r4"] },
      { seed: 4, members: ["r8", "r9"] },
      { seed: 5, members: ["r7", "r10"] },
    ]);
  });

  test("every kid is on exactly one team of 2 or 3 and seeds run 1..T, for 2 to 16 kids", () => {
    for (let n = 2; n <= 16; n += 1) {
      const teams = halvesTeams(ranked(n));
      expect(teams.map((t) => t.seed), `${n} kids`).toEqual(teams.map((_, i) => i + 1));
      expect(teams.flatMap((t) => t.members).sort(), `${n} kids`).toEqual(ranked(n).sort());
      expect(teams.every((t) => t.members.length >= 2 && t.members.length <= 3), `${n} kids`).toBe(true);
    }
  });

  test("too few kids → no teams; duplicates are ignored; pairTeams picks the rule, snake by default", () => {
    expect(halvesTeams(ranked(1))).toEqual([]);
    expect(halvesTeams([])).toEqual([]);
    expect(halvesTeams(["a", "b", "a", "c", "d"])).toEqual([
      { seed: 1, members: ["a", "b"] },
      { seed: 2, members: ["c", "d"] },
    ]);
    expect(pairTeams(ranked(8), "halves")).toEqual(halvesTeams(ranked(8)));
    expect(pairTeams(ranked(8), "snake")).toEqual(snakeTeams(ranked(8)));
    expect(pairTeams(ranked(8))).toEqual(snakeTeams(ranked(8)));
  });

  test("the first round names byes past the team count, never for the higher seed", () => {
    expect(firstRound(1)).toEqual([]);
    expect(firstRound(3)).toEqual([
      { match: 1, a: 1, b: "bye" },
      { match: 2, a: 2, b: 3 },
    ]);
    expect(firstRound(5).map((m) => [m.a, m.b])).toEqual([
      [1, "bye"],
      [4, 5],
      [2, "bye"],
      [3, "bye"],
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
