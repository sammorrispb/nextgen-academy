import { test, expect } from "@playwright/test";
import {
  sortByLevel,
  groupSessions,
  aggregateSeats,
  groupKey,
} from "../src/lib/schedule-grouping";
import type { NgaSession, SessionLevel } from "../src/lib/notion-sessions";

function makeSession(over: Partial<NgaSession> & { id: string }): NgaSession {
  return {
    title: "Redland Tuesday Evening — Red",
    date: "2026-06-16",
    startTime: "6:00 PM",
    endTime: "7:00 PM",
    level: "Red",
    location: "Redland Middle School Tennis Courts, 6505 Muncaster Mill Rd, Rockville, MD 20855",
    publicArea: "Derwood, MD",
    courtCount: 1,
    maxCourts: 2,
    capacity: 4,
    registeredCount: 0,
    spotsLeft: 4,
    status: "Open",
    roster: [],
    ageStats: null,
    coachReminderSent: false,
    ...over,
  };
}

function level(id: string, lvl: SessionLevel | null, over: Partial<NgaSession> = {}) {
  return makeSession({
    id,
    level: lvl,
    title: lvl ? `Redland Tuesday Evening — ${lvl}` : "Drop-in",
    ...over,
  });
}

test.describe("sortByLevel", () => {
  test("orders Red → Orange → Green → Yellow regardless of input order", () => {
    const input = [level("a", "Orange"), level("b", "Red"), level("c", "Yellow"), level("d", "Green")];
    expect(sortByLevel(input).map((s) => s.level)).toEqual([
      "Red",
      "Orange",
      "Green",
      "Yellow",
    ]);
  });

  test("null-level sessions sort last; ties keep input order (stable)", () => {
    const input = [
      level("a", null),
      level("b", "Green"),
      level("c", "Green", { startTime: "7:00 PM" }),
      level("d", "Red"),
    ];
    expect(sortByLevel(input).map((s) => s.id)).toEqual(["d", "b", "c", "a"]);
  });

  test("does not mutate its input", () => {
    const input = [level("a", "Yellow"), level("b", "Red")];
    sortByLevel(input);
    expect(input.map((s) => s.id)).toEqual(["a", "b"]);
  });
});

test.describe("groupSessions", () => {
  test("collapses four same-slot levels into one group, singles pass through", () => {
    const tuesday = ["Red", "Orange", "Green", "Yellow"].map((l, i) =>
      level(`t${i}`, l as SessionLevel),
    );
    const solo = level("solo", "Green", {
      startTime: "10:00 AM",
      endTime: "11:00 AM",
      location: "Walter Johnson HS, 6400 Rock Spring Dr, Bethesda, MD 20814",
    });
    const items = groupSessions([...tuesday, solo]);
    expect(items).toHaveLength(2);
    expect(items[0].kind).toBe("group");
    if (items[0].kind === "group") {
      expect(items[0].sessions.map((s) => s.level)).toEqual([
        "Red",
        "Orange",
        "Green",
        "Yellow",
      ]);
    }
    expect(items[1]).toEqual({ kind: "single", session: solo });
  });

  test("partial groups (2–3 levels) still collapse", () => {
    const items = groupSessions([level("a", "Red"), level("b", "Yellow")]);
    expect(items).toHaveLength(1);
    expect(items[0].kind).toBe("group");
  });

  test("same date+time at two venues stays two items", () => {
    const items = groupSessions([
      level("a", "Red"),
      level("b", "Red", { location: "Walter Johnson HS, Bethesda, MD" }),
    ]);
    expect(items).toHaveLength(2);
    expect(items.every((i) => i.kind === "single")).toBe(true);
  });

  test("grouping ignores titles — renamed venues group by slot", () => {
    const a = level("a", "Red", { title: "Olney Tuesday Evening — Red" });
    const b = level("b", "Green", { title: "Redland Tuesday Evening — Green" });
    expect(groupKey(a)).toBe(groupKey(b));
    expect(groupSessions([a, b])).toHaveLength(1);
  });

  test("empty Location falls back to publicArea for the group key", () => {
    const a = level("a", "Red", { location: "" });
    const b = level("b", "Green", { location: "" });
    expect(groupSessions([a, b])[0].kind).toBe("group");
  });
});

test.describe("aggregateSeats", () => {
  test("sums spots and capacity across the group", () => {
    const out = aggregateSeats([
      level("a", "Red", { spotsLeft: 1, capacity: 4 }),
      level("b", "Green", { spotsLeft: 5, capacity: 8 }),
    ]);
    expect(out).toEqual({ spotsLeft: 6, capacity: 12, allFull: false });
  });

  test("allFull only when every seat is gone", () => {
    const out = aggregateSeats([
      level("a", "Red", { spotsLeft: 0, capacity: 4 }),
      level("b", "Green", { spotsLeft: 0, capacity: 8 }),
    ]);
    expect(out).toEqual({ spotsLeft: 0, capacity: 12, allFull: true });
  });
});
