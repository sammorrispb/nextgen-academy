import { test, expect } from "@playwright/test";
import { computeAttendance } from "../src/lib/notion-player-sync";

// Minimal shape computeAttendance reads — mirrors the relevant DropInRegistration
// fields without dragging in the whole row builder.
function r(
  childFirstName: string,
  sessionDate: string,
  attendance: string,
): { childFirstName: string; sessionDate: string; attendance: string } {
  return { childFirstName, sessionDate, attendance };
}

test.describe("computeAttendance", () => {
  test("counts only Present rows for the matching child", () => {
    const rows = [
      r("Joe", "2026-06-06", "Present"),
      r("Joe", "2026-05-30", "Present"),
      r("Joe", "2026-05-23", "No-show"),
      r("Joe", "2026-06-13", ""), // upcoming, not yet checked in
    ];
    const { count, lastSessionDate } = computeAttendance(rows, "Joe");
    expect(count).toBe(2);
    expect(lastSessionDate).toBe("2026-06-06"); // latest Present, not the future row
  });

  test("isolates the child within a multi-kid family", () => {
    const rows = [
      r("Joe", "2026-06-06", "Present"),
      r("Mia", "2026-06-06", "Present"),
      r("Mia", "2026-05-30", "Present"),
    ];
    expect(computeAttendance(rows, "Mia").count).toBe(2);
    expect(computeAttendance(rows, "Joe").count).toBe(1);
  });

  test("matches child name case-insensitively and trims whitespace", () => {
    const rows = [r("  joe ", "2026-06-06", "Present")];
    expect(computeAttendance(rows, "Joe").count).toBe(1);
  });

  test("returns zero + null when the child has never attended", () => {
    const rows = [
      r("Joe", "2026-06-06", "No-show"),
      r("Joe", "2026-06-13", ""),
    ];
    expect(computeAttendance(rows, "Joe")).toEqual({
      count: 0,
      lastSessionDate: null,
    });
  });

  test("ignores Present rows missing a session date", () => {
    const rows = [
      r("Joe", "", "Present"),
      r("Joe", "2026-06-06", "Present"),
    ];
    const { count, lastSessionDate } = computeAttendance(rows, "Joe");
    expect(count).toBe(1);
    expect(lastSessionDate).toBe("2026-06-06");
  });
});
