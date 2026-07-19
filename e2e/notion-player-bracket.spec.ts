import { test, expect } from "@playwright/test";
import {
  isPlayerLevel,
  buildLevelIndex,
  PLAYER_LEVELS,
  type PlayerLevelRow,
} from "../src/lib/notion-player-bracket";
import { encodeParentKey } from "../src/lib/player-profiles";

test.describe("isPlayerLevel", () => {
  test("accepts exactly the four ball colors", () => {
    for (const l of PLAYER_LEVELS) expect(isPlayerLevel(l)).toBe(true);
  });

  test("rejects synonyms, casing, empties, and non-strings", () => {
    for (const bad of ["Beginner", "red", "", "Pro", "Blue", 5, null, undefined]) {
      expect(isPlayerLevel(bad)).toBe(false);
    }
  });
});

test.describe("buildLevelIndex", () => {
  function r(over: Partial<PlayerLevelRow>): PlayerLevelRow {
    return {
      parentEmail: "kathy@example.com",
      parentPhone: "",
      playerName: "Ethan",
      level: "Green",
      ...over,
    };
  }

  test("keys on familyKey::childLower and is case-insensitive on child name", () => {
    const idx = buildLevelIndex([r({ playerName: "Ethan", level: "Green" })], encodeParentKey);
    const key = encodeParentKey("kathy@example.com", "");
    expect(idx.get(`${key}::ethan`)).toBe("Green");
  });

  test("skips rows with no assigned level", () => {
    const idx = buildLevelIndex([r({ level: "" })], encodeParentKey);
    expect(idx.size).toBe(0);
  });

  test("collapses email/phone variants to the same family key", () => {
    const idx = buildLevelIndex(
      [
        r({ parentEmail: "a@b.com", parentPhone: "111", playerName: "Sam", level: "Red" }),
        r({ parentEmail: "a@b.com", parentPhone: "999", playerName: "Sam", level: "Red" }),
      ],
      encodeParentKey,
    );
    // Same email → same key → one entry.
    expect(idx.size).toBe(1);
  });

  test("drops rows missing both key inputs and a name", () => {
    const idx = buildLevelIndex(
      [r({ parentEmail: "", parentPhone: "", level: "Yellow" }), r({ playerName: "", level: "Red" })],
      encodeParentKey,
    );
    expect(idx.size).toBe(0);
  });
});
