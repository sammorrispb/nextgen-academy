import { test, expect } from "@playwright/test";
import { computeStandings } from "../src/lib/season-league/standings";
import { gameWinner, validateScore } from "../src/lib/season-league/scores";
import type { PlayedGame } from "../src/lib/season-league/types";

// Pure-function spec (no dev server) for the season-league standings and the
// score rules. The table is what a parent reads on the standings link, so the
// ranking rule that stops a 3–0 Sunday from outranking a 12–3 season is pinned
// here, with the tiebreak order and the two formats' split records.
//   npx playwright test e2e/season-league-standings.spec.ts --project=desktop
//
// Mutation checks: set priorWins/priorGames defaults to 0 → the shrinkage pin
// fails; drop the pointDiff comparator → the tiebreak pin fails; count a tied
// game → the tie pin fails.

const RULES = { target: 11, winBy: 2 };

function doubles(a: [string, string], b: [string, string], scoreA: number, scoreB: number): PlayedGame {
  return { format: "doubles", sideA: a, sideB: b, scoreA, scoreB };
}
function singles(a: string, b: string, scoreA: number, scoreB: number): PlayedGame {
  return { format: "singles", sideA: [a], sideB: [b], scoreA, scoreB };
}

test.describe("score rules (to 11, win by 2)", () => {
  test("accepts a regulation finish and a deuce finish by exactly two", () => {
    expect(validateScore(11, 7, RULES)).toEqual({ ok: true });
    expect(validateScore(13, 11, RULES)).toEqual({ ok: true });
    expect(validateScore(9, 11, RULES)).toEqual({ ok: true });
  });

  test("rejects ties, short games, win-by-one, and running past deuce", () => {
    expect(validateScore(11, 11, RULES).ok).toBe(false);
    expect(validateScore(10, 8, RULES).ok).toBe(false);
    expect(validateScore(11, 10, RULES).ok).toBe(false);
    expect(validateScore(14, 11, RULES).ok).toBe(false);
    expect(validateScore(-1, 11, RULES).ok).toBe(false);
    expect(validateScore(11.5, 3, RULES).ok).toBe(false);
    expect(validateScore("11", 3, RULES).ok).toBe(false);
  });

  test("'ended on time' accepts any non-tied score but never a tie", () => {
    expect(validateScore(7, 5, RULES, { timed: true })).toEqual({ ok: true });
    expect(validateScore(6, 6, RULES, { timed: true }).ok).toBe(false);
  });

  test("gameWinner", () => {
    expect(gameWinner({ scoreA: 11, scoreB: 4 })).toBe("A");
    expect(gameWinner({ scoreA: 9, scoreB: 11 })).toBe("B");
    expect(gameWinner({ scoreA: 5, scoreB: 5 })).toBeNull();
  });
});

test.describe("standings", () => {
  test("a 3–0 Sunday ranks BELOW a 12–3 season (shrunk win percentage)", () => {
    const games: PlayedGame[] = [];
    // hot: 3 wins, 0 losses
    for (let i = 0; i < 3; i += 1) games.push(singles("hot", "filler", 11, 5));
    // steady: 12 wins, 3 losses
    for (let i = 0; i < 12; i += 1) games.push(singles("steady", "filler", 11, 5));
    for (let i = 0; i < 3; i += 1) games.push(singles("filler", "steady", 11, 5));
    const rows = computeStandings(["hot", "steady", "filler"], games);
    expect(rows[0].playerId).toBe("steady");
    expect(rows[1].playerId).toBe("hot");
    const hot = rows.find((r) => r.playerId === "hot")!;
    expect(hot.winPct).toBe(1);
    expect(hot.rankScore).toBeCloseTo(5 / 7, 6);
    const steady = rows.find((r) => r.playerId === "steady")!;
    expect(steady.rankScore).toBeCloseTo(14 / 19, 6);
    expect(rows.map((r) => r.rank)).toEqual([1, 2, 3]);
  });

  test("equal rank scores: point differential per game breaks the tie, then points for, then name", () => {
    // amy/ben/cal/dan are 1–1 (rank score 3/6); zed is 4–4 over eight games
    // (6/12) — the same 0.5, so all five fall to the tiebreaks:
    //   amy  +7 diff (3.5/game), PF 10.0/game   → diff wins
    //   ben   0 diff,            PF 10.5/game   → PF beats cal/dan
    //   cal   0 diff,            PF 10.0/game   → name beats dan
    //   dan   0 diff,            PF 10.0/game
    //   zed  −6 diff
    const games: PlayedGame[] = [
      singles("amy", "zed", 11, 2),
      singles("zed", "amy", 11, 9),
      singles("ben", "zed", 11, 9),
      singles("zed", "ben", 12, 10),
      singles("cal", "zed", 11, 9),
      singles("zed", "cal", 11, 9),
      singles("dan", "zed", 11, 9),
      singles("zed", "dan", 11, 9),
    ];
    const rows = computeStandings(["dan", "ben", "cal", "amy", "zed"], games, {
      nameOf: (id) => id,
    });
    expect(rows.every((r) => r.rankScore === 0.5)).toBe(true);
    expect(rows.map((r) => r.playerId)).toEqual(["amy", "ben", "cal", "dan", "zed"]);
  });

  test("singles and doubles both count, and the split records are reported", () => {
    const games: PlayedGame[] = [
      doubles(["a", "b"], ["c", "d"], 11, 6),
      singles("a", "c", 8, 11),
    ];
    const rows = computeStandings(["a", "b", "c", "d"], games);
    const a = rows.find((r) => r.playerId === "a")!;
    expect(a.games).toBe(2);
    expect(a.wins).toBe(1);
    expect(a.losses).toBe(1);
    expect(a.doublesWins).toBe(1);
    expect(a.doublesLosses).toBe(0);
    expect(a.singlesWins).toBe(0);
    expect(a.singlesLosses).toBe(1);
    expect(a.pointsFor).toBe(19);
    expect(a.pointsAgainst).toBe(17);
    expect(a.pointDiff).toBe(2);
    const c = rows.find((r) => r.playerId === "c")!;
    expect(c.singlesWins).toBe(1);
    expect(c.doublesLosses).toBe(1);
  });

  test("a tied score is never counted", () => {
    const rows = computeStandings(["a", "b"], [singles("a", "b", 7, 7)]);
    expect(rows.every((r) => r.games === 0)).toBe(true);
  });

  test("kids with no games yet sit at the bottom with zero everything", () => {
    const rows = computeStandings(["new", "vet"], [singles("vet", "gone", 11, 3)]);
    expect(rows[0].playerId).toBe("vet");
    expect(rows[1]).toMatchObject({ playerId: "new", games: 0, wins: 0, winPct: 0, rank: 2 });
  });

  test("a kid no longer on the roster still counts for the kids who played them", () => {
    const rows = computeStandings(["a"], [singles("a", "refunded", 11, 3)]);
    expect(rows).toHaveLength(1);
    expect(rows[0].wins).toBe(1);
  });

  test("names come from nameOf and the last tiebreak is alphabetical", () => {
    const rows = computeStandings(["id2", "id1"], [], { nameOf: (id) => (id === "id1" ? "Zoe" : "Ann") });
    expect(rows.map((r) => r.name)).toEqual(["Ann", "Zoe"]);
  });
});
