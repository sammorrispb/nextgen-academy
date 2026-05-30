import { test, expect } from "@playwright/test";
import { findSiblingSlot, orderSlots } from "../src/lib/session-bundle";
import type { NgaSession } from "../src/lib/notion-sessions";

function makeSession(over: Partial<NgaSession>): NgaSession {
  return {
    id: "s",
    title: "Sherwood HS — Early",
    date: "2026-06-06",
    startTime: "10:00 AM",
    endTime: "11:00 AM",
    level: "Green",
    location: "Sherwood HS, Olney",
    courtCount: 1,
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

const early = makeSession({ id: "early", startTime: "10:00 AM", endTime: "11:00 AM" });
const late = makeSession({
  id: "late",
  title: "Sherwood HS — Late",
  startTime: "11:00 AM",
  endTime: "12:00 PM",
});

test.describe("findSiblingSlot", () => {
  test("pairs consecutive slots at the same venue/day (early → late)", () => {
    expect(findSiblingSlot(early, [early, late])?.id).toBe("late");
  });

  test("pairs in the other direction too (late → early)", () => {
    expect(findSiblingSlot(late, [early, late])?.id).toBe("early");
  });

  test("does not pair non-adjacent slots", () => {
    const afternoon = makeSession({
      id: "pm",
      startTime: "2:00 PM",
      endTime: "3:00 PM",
    });
    expect(findSiblingSlot(early, [early, afternoon])).toBeNull();
  });

  test("does not pair across different locations", () => {
    const otherVenue = makeSession({
      id: "gburg",
      startTime: "11:00 AM",
      endTime: "12:00 PM",
      location: "Gaithersburg HS",
    });
    expect(findSiblingSlot(early, [early, otherVenue])).toBeNull();
  });

  test("does not pair across different days", () => {
    const nextDay = makeSession({
      id: "sun",
      date: "2026-06-07",
      startTime: "11:00 AM",
      endTime: "12:00 PM",
    });
    expect(findSiblingSlot(early, [early, nextDay])).toBeNull();
  });

  test("ignores a cancelled sibling", () => {
    const cancelledLate = makeSession({ ...late, status: "Cancelled" });
    expect(findSiblingSlot(early, [early, cancelledLate])).toBeNull();
  });

  test("never pairs a session with itself", () => {
    expect(findSiblingSlot(early, [early])).toBeNull();
  });
});

test.describe("orderSlots", () => {
  test("identifies the earlier slot by its end == other's start", () => {
    expect(orderSlots(early, late)).toBe(true);
    expect(orderSlots(late, early)).toBe(false);
  });
});
