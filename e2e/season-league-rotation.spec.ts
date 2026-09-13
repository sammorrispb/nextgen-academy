import { test, expect } from "@playwright/test";
import {
  buildHistory,
  courtAllocation,
  defaultRounds,
  emptyHistory,
  pairKey,
  partnerMatrix,
  planDay,
  recordGame,
  type SeasonHistory,
} from "../src/lib/season-league/rotation";
import type { PlannedGame, PlayerId } from "../src/lib/season-league/types";

// Pure-function spec (no dev server) for the Fall 2026 season-league day
// planner. The claims a parent will feel on a Sunday are pinned here: every
// game has the right number of DIFFERENT present kids, an absent kid is never
// scheduled, sits and singles are shared within one game per Sunday, everyone
// reaches the target, and across five Sundays every pair partners a near-equal
// number of times. The season simulation prints the partner matrix so the
// "near-equal" claim is visible in the run output, not just asserted.
//   npx playwright test e2e/season-league-rotation.spec.ts --project=desktop
//
// Mutation checks (each turns at least one pin red):
//   - drop the `sitting` filter in bestRound → "distinct present players" fails
//   - return `[[]]` from sittingChoices for sit>0 → sit balance fails
//   - set W_PARTNER to 0 → the season spread pins fail

const COURTS = 2;
const TARGET = 3;

function roster(n: number): PlayerId[] {
  return Array.from({ length: n }, (_, i) => `p${String(i + 1).padStart(2, "0")}`);
}

function everyone(games: readonly PlannedGame[]): PlayerId[] {
  return games.flatMap((g) => [...g.sideA, ...g.sideB]);
}

function spread(values: number[]): number {
  return Math.max(...values) - Math.min(...values);
}

/** Simulate a season: each Sunday plans a day, "plays" every game (scores are
 * irrelevant to rotation), and folds it into the history. */
function playSeason(
  n: number,
  sundays: number,
  absences: Record<number, PlayerId[]> = {},
): { history: SeasonHistory; players: PlayerId[]; days: ReturnType<typeof planDay>[] } {
  const players = roster(n);
  const history = emptyHistory();
  const days: ReturnType<typeof planDay>[] = [];
  for (let week = 1; week <= sundays; week += 1) {
    const absent = new Set(absences[week] ?? []);
    const present = players.filter((p) => !absent.has(p));
    const plan = planDay({
      present,
      history,
      playedToday: [],
      courts: COURTS,
      targetGamesPerPlayer: TARGET,
      seed: `test-W${week}-A1`,
    });
    for (const round of plan.rounds) for (const g of round.games) recordGame(history, g);
    days.push(plan);
  }
  return { history, players, days };
}

test.describe("court allocation", () => {
  test("doubles first, then a singles court on the spare kids, then sits", () => {
    const cases: Array<[number, [number, number, number]]> = [
      [2, [0, 1, 0]],
      [3, [0, 1, 1]],
      [4, [1, 0, 0]],
      [5, [1, 0, 1]],
      [6, [1, 1, 0]],
      [7, [1, 1, 1]],
      [8, [2, 0, 0]],
      [9, [2, 0, 1]],
      [10, [2, 0, 2]],
    ];
    for (const [n, [doubles, singles, sitting]] of cases) {
      const a = courtAllocation(n, COURTS);
      expect({ n, ...a }).toEqual({
        n,
        doubles,
        singles,
        sitting,
        playing: 4 * doubles + 2 * singles,
      });
    }
  });

  test("one court still works: six kids sit two per round", () => {
    expect(courtAllocation(6, 1)).toEqual({ doubles: 1, singles: 0, playing: 4, sitting: 2 });
  });

  test("nobody to play with → nothing allocated", () => {
    expect(courtAllocation(1, COURTS).playing).toBe(0);
    expect(courtAllocation(0, COURTS).playing).toBe(0);
  });
});

test.describe("default rounds", () => {
  test("rounds up so nobody falls short of the target", () => {
    expect(defaultRounds(6, COURTS, TARGET)).toBe(3);
    expect(defaultRounds(7, COURTS, TARGET)).toBe(4);
    expect(defaultRounds(8, COURTS, TARGET)).toBe(3);
    expect(defaultRounds(5, COURTS, TARGET)).toBe(4);
    expect(defaultRounds(9, COURTS, TARGET)).toBe(4);
    expect(defaultRounds(10, COURTS, TARGET)).toBe(4);
    expect(defaultRounds(1, COURTS, TARGET)).toBe(0);
  });
});

test.describe("a single Sunday", () => {
  for (const n of [2, 3, 4, 5, 6, 7, 8, 9, 10]) {
    test(`N=${n}: games use distinct present kids, sits and singles balance, everyone reaches ${TARGET}`, () => {
      const present = roster(n);
      const plan = planDay({
        present,
        history: emptyHistory(),
        playedToday: [],
        courts: COURTS,
        targetGamesPerPlayer: TARGET,
        seed: `single-${n}`,
      });
      expect(plan.rounds.length).toBe(defaultRounds(n, COURTS, TARGET));

      const games = new Map(present.map((p) => [p, 0]));
      const singles = new Map(present.map((p) => [p, 0]));
      for (const round of plan.rounds) {
        const onCourt = everyone(round.games);
        expect(new Set(onCourt).size, "a kid appears once per round").toBe(onCourt.length);
        for (const id of onCourt) expect(present).toContain(id);
        for (const g of round.games) {
          expect(g.round).toBe(round.round);
          if (g.format === "doubles") {
            expect(g.sideA).toHaveLength(2);
            expect(g.sideB).toHaveLength(2);
          } else {
            expect(g.sideA).toHaveLength(1);
            expect(g.sideB).toHaveLength(1);
          }
          for (const id of [...g.sideA, ...g.sideB]) {
            games.set(id, (games.get(id) ?? 0) + 1);
            if (g.format === "singles") singles.set(id, (singles.get(id) ?? 0) + 1);
          }
        }
        const courts = round.games.map((g) => g.court);
        expect(new Set(courts).size).toBe(courts.length);
        expect(Math.max(...courts)).toBeLessThanOrEqual(COURTS);
        expect([...round.sitting].sort()).toEqual(
          present.filter((p) => !onCourt.includes(p)).sort(),
        );
      }
      expect(spread([...games.values()]), "games per kid within 1").toBeLessThanOrEqual(1);
      expect(spread([...singles.values()]), "singles per kid within 1").toBeLessThanOrEqual(1);
      expect(Math.min(...games.values())).toBeGreaterThanOrEqual(TARGET);
    });
  }

  test("six kids: three rounds, nobody sits, two doubles + one singles each", () => {
    const plan = planDay({
      present: roster(6),
      history: emptyHistory(),
      playedToday: [],
      courts: COURTS,
      targetGamesPerPlayer: TARGET,
      seed: "six",
    });
    expect(plan.rounds).toHaveLength(3);
    for (const round of plan.rounds) {
      expect(round.sitting).toEqual([]);
      expect(round.games.map((g) => g.format).sort()).toEqual(["doubles", "singles"]);
    }
    const h = buildHistory(plan.rounds.flatMap((r) => r.games));
    for (const p of roster(6)) {
      expect(h.games.get(p)).toBe(3);
      expect(h.singlesGames.get(p)).toBe(1);
    }
  });

  test("no pair partners twice on the same Sunday while a fresh pair exists (N=8)", () => {
    const plan = planDay({
      present: roster(8),
      history: emptyHistory(),
      playedToday: [],
      courts: COURTS,
      targetGamesPerPlayer: TARGET,
      seed: "eight",
    });
    const h = buildHistory(plan.rounds.flatMap((r) => r.games));
    expect(Math.max(...h.partner.values())).toBe(1);
  });

  test("an absent kid is never scheduled", () => {
    const present = roster(7).filter((p) => p !== "p03");
    const plan = planDay({
      present,
      history: emptyHistory(),
      playedToday: [],
      courts: COURTS,
      targetGamesPerPlayer: TARGET,
      seed: "absent",
    });
    for (const round of plan.rounds) {
      expect(everyone(round.games)).not.toContain("p03");
      expect(round.sitting).not.toContain("p03");
    }
  });

  test("fewer than two kids → no rounds, no throw", () => {
    const plan = planDay({
      present: ["p01"],
      history: emptyHistory(),
      playedToday: [],
      courts: COURTS,
      targetGamesPerPlayer: TARGET,
      seed: "solo",
    });
    expect(plan.rounds).toEqual([]);
  });

  test("an explicit round count overrides the default (coach trims the day)", () => {
    const plan = planDay({
      present: roster(7),
      history: emptyHistory(),
      playedToday: [],
      courts: COURTS,
      targetGamesPerPlayer: TARGET,
      rounds: 2,
      seed: "trim",
    });
    expect(plan.rounds.map((r) => r.round)).toEqual([1, 2]);
  });
});

test.describe("determinism", () => {
  test("the same inputs always produce the same plan (preview == save)", () => {
    const input = {
      present: roster(7),
      history: emptyHistory(),
      playedToday: [],
      courts: COURTS,
      targetGamesPerPlayer: TARGET,
      seed: "Green-W2-A1",
    };
    expect(planDay(input)).toEqual(planDay(input));
  });

  test("a new attempt (seed) can change the plan — regenerate is not a no-op", () => {
    const base = planDay({
      present: roster(7),
      history: emptyHistory(),
      playedToday: [],
      courts: COURTS,
      targetGamesPerPlayer: TARGET,
      seed: "Green-W2-A1",
    });
    const differs = [2, 3, 4, 5, 6].some(
      (attempt) =>
        JSON.stringify(
          planDay({
            present: roster(7),
            history: emptyHistory(),
            playedToday: [],
            courts: COURTS,
            targetGamesPerPlayer: TARGET,
            seed: `Green-W2-A${attempt}`,
          }),
        ) !== JSON.stringify(base),
    );
    expect(differs).toBe(true);
  });
});

test.describe("late arrival / regenerate remaining", () => {
  test("round numbering continues, the newcomer plays next, and default rounds shrink by what was played", () => {
    const six = roster(6);
    const first = planDay({
      present: six,
      history: emptyHistory(),
      playedToday: [],
      courts: COURTS,
      targetGamesPerPlayer: TARGET,
      seed: "late-A1",
    });
    const round1 = first.rounds[0].games;
    const history = buildHistory(round1); // the store's Played rows include today's
    const seven = [...six, "p07"];
    const rest = planDay({
      present: seven,
      history,
      playedToday: round1,
      courts: COURTS,
      targetGamesPerPlayer: TARGET,
      seed: "late-A2",
    });
    // 7 kids → 4 rounds by default; one already played → 3 more, numbered 2..4.
    expect(rest.rounds.map((r) => r.round)).toEqual([2, 3, 4]);
    expect(everyone(rest.rounds[0].games), "the newcomer (0 games) plays round 2").toContain("p07");
    // Over the whole day games stay within one of each other.
    const games = new Map(seven.map((p) => [p, 0]));
    for (const g of [...round1, ...rest.rounds.flatMap((r) => r.games)]) {
      for (const id of [...g.sideA, ...g.sideB]) games.set(id, (games.get(id) ?? 0) + 1);
    }
    expect(spread([...games.values()])).toBeLessThanOrEqual(1);
  });

  test("a kid who leaves early is dropped from the remaining rounds", () => {
    const seven = roster(7);
    const first = planDay({
      present: seven,
      history: emptyHistory(),
      playedToday: [],
      courts: COURTS,
      targetGamesPerPlayer: TARGET,
      seed: "leave-A1",
    });
    const played = [...first.rounds[0].games, ...first.rounds[1].games];
    const rest = planDay({
      present: seven.filter((p) => p !== "p02"),
      history: buildHistory(played),
      playedToday: played,
      courts: COURTS,
      targetGamesPerPlayer: TARGET,
      seed: "leave-A2",
    });
    expect(rest.rounds.map((r) => r.round)).toEqual([3]);
    for (const r of rest.rounds) expect(everyone(r.games)).not.toContain("p02");
  });
});

test.describe("a five-Sunday season (full attendance)", () => {
  const limits: Record<number, number> = { 4: 2, 5: 2, 6: 1, 7: 2, 8: 1, 9: 2, 10: 2 };
  for (const n of [4, 5, 6, 7, 8, 9, 10]) {
    test(`N=${n}: every pair partners a near-equal number of times (spread ≤ ${limits[n]})`, () => {
      const { history, players } = playSeason(n, 5);
      const counts: number[] = [];
      for (let i = 0; i < players.length; i += 1) {
        for (let j = i + 1; j < players.length; j += 1) {
          counts.push(history.partner.get(pairKey(players[i], players[j])) ?? 0);
        }
      }
      expect(spread(counts)).toBeLessThanOrEqual(limits[n]);
      // Singles load also stays level across the season.
      const singles = players.map((p) => history.singlesGames.get(p) ?? 0);
      expect(spread(singles)).toBeLessThanOrEqual(1);
    });
  }

  test("N=6 and N=7 partner matrices (printed for the record)", () => {
    for (const n of [6, 7]) {
      const { history, players } = playSeason(n, 5);
      const m = partnerMatrix(history, players);
      console.log(
        `\npartner matrix N=${n} after 5 Sundays:\n` +
          m.map((row, i) => `${players[i]}  ${row.map((v) => String(v).padStart(2)).join(" ")}`).join("\n"),
      );
      for (let i = 0; i < n; i += 1) expect(m[i][i]).toBe(0);
      for (let i = 0; i < n; i += 1) {
        for (let j = 0; j < n; j += 1) expect(m[i][j]).toBe(m[j][i]);
      }
    }
  });
});

test.describe("a season with absences", () => {
  test("N=7 with a kid missing two Sundays still balances the kids who came", () => {
    const { history, players, days } = playSeason(7, 5, { 2: ["p04"], 4: ["p04"] });
    for (const week of [2, 4]) {
      for (const r of days[week - 1].rounds) expect(everyone(r.games)).not.toContain("p04");
    }
    const always = players.filter((p) => p !== "p04");
    const counts: number[] = [];
    for (let i = 0; i < always.length; i += 1) {
      for (let j = i + 1; j < always.length; j += 1) {
        counts.push(history.partner.get(pairKey(always[i], always[j])) ?? 0);
      }
    }
    expect(spread(counts)).toBeLessThanOrEqual(2);
    expect(history.games.get("p04")).toBeLessThan(history.games.get("p01") ?? 0);
  });
});
