// Pure unit spec for the MVF program lifecycle helpers. No dev server:
//   npx playwright test e2e/mvf-programs.spec.ts --project=desktop
//
// Dates are injected, never `new Date()`, so this spec asserts the same thing
// in 2026 as it will in 2027.
import { test, expect } from "@playwright/test";
import {
  MVF_PROGRAMS,
  mvfClassDates,
  mvfClassesRemaining,
  isMvfProgramPast,
  isMvfProgramInProgress,
  upcomingMvfPrograms,
  type MvfProgram,
} from "../src/data/mvf";

const intro = MVF_PROGRAMS.find((p) => p.key === "intro")!;
const fall1 = MVF_PROGRAMS.find((p) => p.key === "fall-1-beginner")!;
const fall2 = MVF_PROGRAMS.find((p) => p.key === "fall-2-beginner")!;

test.describe("mvfClassDates", () => {
  test("a single-class program is just its own date", () => {
    expect(mvfClassDates(intro)).toEqual([intro.startDate]);
  });

  test("a six-week session steps weekly and lands exactly on endDate", () => {
    const dates = mvfClassDates(fall1);
    expect(dates).toHaveLength(fall1.classCount);
    expect(dates[0]).toBe(fall1.startDate);
    expect(dates.at(-1)).toBe(fall1.endDate);
    expect(dates).toEqual([
      "2026-09-03",
      "2026-09-10",
      "2026-09-17",
      "2026-09-24",
      "2026-10-01",
      "2026-10-08",
    ]);
  });

  test("steps whole days across a DST boundary", () => {
    // Nov 1 2026 is the US fall-back. A naive +7*24h on a local Date would
    // slide an hour and, at midnight anchoring, a whole day — this is why the
    // helper anchors at noon UTC.
    const spanning: MvfProgram = {
      ...fall2,
      startDate: "2026-10-29",
      endDate: "2026-11-12",
      classCount: 3,
    };
    expect(mvfClassDates(spanning)).toEqual([
      "2026-10-29",
      "2026-11-05",
      "2026-11-12",
    ]);
  });
});

test.describe("isMvfProgramPast", () => {
  test("is false on the final class day and true the morning after", () => {
    expect(isMvfProgramPast(intro, intro.endDate)).toBe(false);
    expect(isMvfProgramPast(intro, "2026-08-28")).toBe(true);
  });

  test("a six-week session is not past just because it started", () => {
    expect(isMvfProgramPast(fall1, "2026-09-09")).toBe(false);
    expect(isMvfProgramPast(fall1, "2026-10-09")).toBe(true);
  });
});

test.describe("upcomingMvfPrograms", () => {
  test("drops the finished intro class but keeps a session in flight", () => {
    // The exact regression: on 2026-09-09 the Aug 27 intro was still the
    // first, cheapest card on the page while Fall I was mid-run.
    const keys = upcomingMvfPrograms("2026-09-09").map((p) => p.key);
    expect(keys).not.toContain("intro");
    expect(keys).toContain("fall-1-beginner");
    expect(keys).toContain("fall-2-advanced");
  });

  test("keeps everything before the season starts", () => {
    expect(upcomingMvfPrograms("2026-08-01")).toHaveLength(MVF_PROGRAMS.length);
  });

  test("empties once the last session ends — no card outlives its season", () => {
    expect(upcomingMvfPrograms("2026-11-20")).toEqual([]);
  });
});

test.describe("mvfClassesRemaining", () => {
  test("counts today inclusive — a class this evening still counts", () => {
    expect(mvfClassesRemaining(fall1, "2026-09-03")).toBe(6);
    expect(mvfClassesRemaining(fall1, "2026-09-04")).toBe(5);
    // 2026-09-09: only Sept 3 has run; Sept 10 is tomorrow, so 5 are left.
    expect(mvfClassesRemaining(fall1, "2026-09-09")).toBe(5);
    expect(mvfClassesRemaining(fall1, "2026-10-08")).toBe(1);
    expect(mvfClassesRemaining(fall1, "2026-10-09")).toBe(0);
  });
});

test.describe("isMvfProgramInProgress", () => {
  test("true only between the first class and the last, for a real session", () => {
    expect(isMvfProgramInProgress(fall1, "2026-09-02")).toBe(false);
    expect(isMvfProgramInProgress(fall1, "2026-09-03")).toBe(true);
    expect(isMvfProgramInProgress(fall1, "2026-09-09")).toBe(true);
    expect(isMvfProgramInProgress(fall1, "2026-10-08")).toBe(true);
    expect(isMvfProgramInProgress(fall1, "2026-10-09")).toBe(false);
  });

  test("a one-evening class is never 'under way'", () => {
    expect(isMvfProgramInProgress(intro, intro.startDate)).toBe(false);
  });
});
