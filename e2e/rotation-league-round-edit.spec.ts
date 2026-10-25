import { test, expect } from "@playwright/test";
import {
  assignSlot,
  lineupChanged,
  lineupFromGames,
  sittingFor,
  type LineupGame,
} from "../src/lib/rotation-league/round-edit";

// The coach's "Change players" dropdowns (Sam, 2026-10-25). Picking a kid for a
// spot must never put them on two courts: a kid already playing this round
// trades places, and a kid who was sitting takes the spot while the kid they
// replace sits. Pure, so it runs without a dev server:
//   npx playwright test e2e/rotation-league-round-edit.spec.ts --project=desktop

const round: LineupGame[] = [
  { gameId: "g1", sideA: ["ava", "ben"], sideB: ["cal", "dee"] },
  { gameId: "g2", sideA: ["eli"], sideB: ["fae"] },
];
const present = ["ava", "ben", "cal", "dee", "eli", "fae", "gus"];

function everyone(lineup: LineupGame[]): string[] {
  return lineup.flatMap((g) => [...g.sideA, ...g.sideB]);
}

test.describe("round edit lineup", () => {
  test("picking a kid from another court swaps the two", () => {
    const next = assignSlot(round, { game: 1, side: "A", index: 0 }, "ava");
    expect(next[1].sideA).toEqual(["ava"]);
    expect(next[0].sideA).toEqual(["eli", "ben"]);
    expect(new Set(everyone(next)).size).toBe(everyone(next).length);
  });

  test("picking a teammate or opponent on the same court swaps within it", () => {
    const next = assignSlot(round, { game: 0, side: "A", index: 1 }, "cal");
    expect(next[0]).toEqual({ gameId: "g1", sideA: ["ava", "cal"], sideB: ["ben", "dee"] });
  });

  test("picking a sitting kid puts them in and sits the kid they replace", () => {
    const next = assignSlot(round, { game: 0, side: "B", index: 1 }, "gus");
    expect(next[0].sideB).toEqual(["cal", "gus"]);
    expect(sittingFor(next, present)).toEqual(["dee"]);
  });

  test("the original lineup is never mutated, and re-picking the same kid changes nothing", () => {
    const before = JSON.stringify(round);
    const same = assignSlot(round, { game: 0, side: "A", index: 0 }, "ava");
    expect(JSON.stringify(round)).toBe(before);
    expect(lineupChanged(same, round)).toBe(false);
    expect(lineupChanged(assignSlot(round, { game: 1, side: "B", index: 0 }, "gus"), round)).toBe(true);
  });

  test("a spot that doesn't exist changes nothing", () => {
    expect(assignSlot(round, { game: 5, side: "A", index: 0 }, "gus")).toEqual(round);
    expect(assignSlot(round, { game: 1, side: "A", index: 3 }, "gus")).toEqual(round);
  });

  test("the lineup comes from the refs Link & Dink returns; none means not editable", () => {
    expect(
      lineupFromGames([{ id: "g1", side_a_refs: ["ava"], side_b_refs: ["ben"] }]),
    ).toEqual([{ gameId: "g1", sideA: ["ava"], sideB: ["ben"] }]);
    expect(lineupFromGames([{ id: "g1" }])).toBeNull();
    expect(lineupFromGames([{ id: "g1", side_a_refs: [""], side_b_refs: ["ben"] }])).toBeNull();
  });
});
