import { test, expect } from "@playwright/test";
import { fillGoal, fillLabel, fillBar } from "../src/lib/fill-meter";

test.describe("fillGoal", () => {
  test("targets the full build-out, not the currently-open capacity", () => {
    expect(fillGoal({ capacity: 4, maxCourts: 2 })).toBe(8);
  });

  test("falls back to capacity when maxCourts is missing or smaller", () => {
    expect(fillGoal({ capacity: 8 })).toBe(8);
    expect(fillGoal({ capacity: 12, maxCourts: 2 })).toBe(12);
  });
});

test.describe("fillLabel", () => {
  test("counts who's in, not what's open", () => {
    expect(fillLabel(3, 8)).toBe("3 of 8 in");
  });

  test("invites the first signup at zero", () => {
    expect(fillLabel(0, 8)).toBe("0 of 8 in — be the first");
  });

  test("adds a to-go nudge near the goal", () => {
    expect(fillLabel(5, 8)).toBe("5 of 8 in — 3 to go");
    expect(fillLabel(7, 8)).toBe("7 of 8 in — 1 to go");
  });

  test("celebrates a full meter", () => {
    expect(fillLabel(8, 8)).toBe("Full — 8 of 8 in");
  });

  test("clamps out-of-range counts and empty goals", () => {
    expect(fillLabel(11, 8)).toBe("Full — 8 of 8 in");
    expect(fillLabel(-2, 8)).toBe("0 of 8 in — be the first");
    expect(fillLabel(3, 0)).toBe("");
  });
});

test.describe("fillBar", () => {
  test("renders one block per slot, filled from the left", () => {
    expect(fillBar(3, 8)).toBe("▰▰▰▱▱▱▱▱");
    expect(fillBar(0, 4)).toBe("▱▱▱▱");
    expect(fillBar(4, 4)).toBe("▰▰▰▰");
  });

  test("clamps out-of-range counts", () => {
    expect(fillBar(9, 8)).toBe("▰▰▰▰▰▰▰▰");
    expect(fillBar(-1, 3)).toBe("▱▱▱");
  });
});
