import { test, expect } from "@playwright/test";
import { CAMPS } from "../src/data/camps";
import {
  deriveAge,
  campAttendingDays,
  allergyDisplay,
  toRosterView,
} from "../src/lib/camp-roster-view";
import type { CampRosterEntry } from "../src/lib/notion-camp-roster";

const CAMP = CAMPS[0]; // june-29: 2026-06-29 .. 2026-07-02

function entry(overrides: Partial<CampRosterEntry> = {}): CampRosterEntry {
  return {
    stripeSessionId: "cs_test",
    parentName: "Parent One",
    parentEmail: "p1@example.com",
    parentPhone: "3015550100",
    childFirstName: "Kid",
    childBirthYear: 2016,
    campSlug: CAMP.slug,
    campTitle: CAMP.title,
    campWeek: CAMP.weekLabel,
    optionLabel: "Full week (Mon–Thu)",
    optionKey: "week",
    selectedDay: "",
    allergies: "",
    emergencyName: "Emergency One",
    emergencyPhone: "3015550199",
    registeredAt: "2026-06-01",
    ...overrides,
  };
}

test.describe("deriveAge", () => {
  test("computes age from birth year and reference year", () => {
    expect(deriveAge(2016, 2026)).toBe(10);
  });
  test("returns null for a null birth year", () => {
    expect(deriveAge(null, 2026)).toBeNull();
  });
});

test.describe("campAttendingDays", () => {
  test("full week → all four indexes, not off-week", () => {
    expect(campAttendingDays("week", "", CAMP)).toEqual({
      indexes: [0, 1, 2, 3],
      offWeek: false,
    });
  });
  test("a single day inside the camp week → that one index", () => {
    // 2026-06-30 is the 2nd morning (index 1) of the june-29 week.
    expect(campAttendingDays("day", "2026-06-30", CAMP)).toEqual({
      indexes: [1],
      offWeek: false,
    });
  });
  test("a single day NOT in the camp week → empty + offWeek flag", () => {
    expect(campAttendingDays("day", "2026-08-15", CAMP)).toEqual({
      indexes: [],
      offWeek: true,
    });
  });
  test("a day option with no selected day → empty, not off-week", () => {
    expect(campAttendingDays("day", "", CAMP)).toEqual({
      indexes: [],
      offWeek: false,
    });
  });
});

test.describe("allergyDisplay", () => {
  test("flags a 480-char (capped) string as possibly truncated", () => {
    const capped = "a".repeat(480);
    const out = allergyDisplay(capped);
    expect(out.truncated).toBe(true);
    expect(out.text).toBe(capped);
  });
  test("does not flag a shorter string", () => {
    const out = allergyDisplay("peanuts");
    expect(out.truncated).toBe(false);
    expect(out.text).toBe("peanuts");
  });
});

test.describe("toRosterView", () => {
  test("empty entries → empty view", () => {
    expect(toRosterView([], CAMP, 2026)).toEqual([]);
  });

  test("maps a full-week entry to all four attending days", () => {
    const rows = toRosterView([entry()], CAMP, 2026);
    expect(rows).toHaveLength(1);
    expect(rows[0].attendingDays).toEqual([0, 1, 2, 3]);
    expect(rows[0].offWeek).toBe(false);
    expect(rows[0].age).toBe(10);
    expect(rows[0].childFirstName).toBe("Kid");
  });

  test("maps a single-day entry to its one attending day", () => {
    const rows = toRosterView(
      [entry({ optionKey: "day", selectedDay: "2026-07-01" })],
      CAMP,
      2026,
    );
    expect(rows[0].attendingDays).toEqual([2]);
    expect(rows[0].offWeek).toBe(false);
  });
});
