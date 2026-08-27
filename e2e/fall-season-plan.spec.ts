import { test, expect } from "@playwright/test";

import {
  FALL_RAIN_DATES,
  FALL_SEASON_WEEKS,
  FALL_SUNDAYS,
  FALL_YOUTH_BLOCKS,
} from "../src/data/fall-2026";
import {
  FALL_BLOCKS,
  FALL_PLAN_WEEKS,
  FALL_SEASON_PLAN,
  findWeek,
  focusBlockFor,
  gamesFor,
  ritualFor,
  weekForDate,
} from "../src/data/fall-season-plan-2026";
import { SKILL_STACK } from "../src/data/session-curriculum";

// Pure-data checks. Run with:
//   npx playwright test e2e/fall-season-plan.spec.ts --project=desktop
//
// Nine families have paid for a six-week progression. The plan and the season's
// real dates are two different files, and a plan that points at a Sunday the
// season doesn't run — or at a drill that no longer exists — is a run sheet
// that fails on court, not at build time.

test.describe("the plan matches the season it plans", () => {
  test("there is exactly one planned week per season Sunday", () => {
    expect(FALL_SEASON_PLAN).toHaveLength(FALL_SEASON_WEEKS);
    expect(FALL_SEASON_PLAN).toHaveLength(FALL_SUNDAYS.length);
    expect(FALL_PLAN_WEEKS).toBe(FALL_SEASON_WEEKS);
  });

  test("week numbers are 1..N in order with no gaps", () => {
    expect(FALL_SEASON_PLAN.map((w) => w.week)).toEqual(
      FALL_SUNDAYS.map((_, i) => i + 1),
    );
  });

  test("each week sits on the matching season Sunday, in calendar order", () => {
    FALL_SEASON_PLAN.forEach((week, i) => {
      expect(week.date, `week ${week.week}`).toBe(FALL_SUNDAYS[i]);
    });
    const sorted = [...FALL_SEASON_PLAN.map((w) => w.date)].sort();
    expect(FALL_SEASON_PLAN.map((w) => w.date)).toEqual(sorted);
  });

  test("no week is scheduled on a rain date — those are holds, not season weeks", () => {
    for (const week of FALL_SEASON_PLAN) {
      expect(FALL_RAIN_DATES).not.toContain(week.date);
    }
  });

  test("lookups resolve both ways", () => {
    for (const week of FALL_SEASON_PLAN) {
      expect(findWeek(week.week)?.date).toBe(week.date);
      expect(weekForDate(week.date)?.week).toBe(week.week);
    }
    expect(findWeek(FALL_SEASON_WEEKS + 1)).toBeUndefined();
    expect(weekForDate("2026-01-01")).toBeUndefined();
  });

  test("the re-exported blocks are the season's own blocks", () => {
    expect(FALL_BLOCKS).toBe(FALL_YOUTH_BLOCKS);
  });
});

test.describe("every week points at content that exists", () => {
  test("focus blocks resolve to real Skill Stack blocks", () => {
    const orders = new Set(SKILL_STACK.map((b) => b.order));
    for (const week of FALL_SEASON_PLAN) {
      expect(orders.has(week.focusBlock), `week ${week.week}`).toBe(true);
      expect(() => focusBlockFor(week)).not.toThrow();
      expect(focusBlockFor(week).order).toBe(week.focusBlock);
    }
  });

  test("each week names two real games and one real ritual", () => {
    for (const week of FALL_SEASON_PLAN) {
      expect(week.games, `week ${week.week}`).toHaveLength(2);
      expect(() => gamesFor(week)).not.toThrow();
      expect(gamesFor(week)).toHaveLength(2);

      expect(() => ritualFor(week)).not.toThrow();
      expect(ritualFor(week).purpose, `week ${week.week} ritual`).toBe("ritual");
    }
  });

  test("a week pointing at a game that doesn't exist throws instead of rendering blank", () => {
    const broken = { ...FALL_SEASON_PLAN[0], games: ["nope", "kitchen-game"] as const };
    expect(() => gamesFor(broken)).toThrow(/nope/);
    const brokenBlock = { ...FALL_SEASON_PLAN[0], focusBlock: 99 };
    expect(() => focusBlockFor(brokenBlock)).toThrow(/99/);
  });
});

test.describe("the season is a progression, not six of the same session", () => {
  test("the six weeks go deep on distinct blocks", () => {
    const focuses = FALL_SEASON_PLAN.map((w) => w.focusBlock);
    expect(new Set(focuses).size).toBe(focuses.length);
  });

  test("week 1 is the baseline and starts at the kitchen", () => {
    const first = FALL_SEASON_PLAN[0];
    expect(first.focusBlock).toBe(1);
    expect(first.coachLooksFor.toLowerCase()).toMatch(/baseline/);
  });

  test("all four EASE values get used as a Word of the Day across the season", () => {
    const words = new Set(FALL_SEASON_PLAN.map((w) => w.word));
    for (const value of ["Ethics", "Attitude", "Skills", "Excellence"]) {
      expect(words.has(value as never), value).toBe(true);
    }
  });

  test("every week gives parents a plain sentence and a five-minute home rep", () => {
    for (const week of FALL_SEASON_PLAN) {
      expect(week.parentLine.length, `week ${week.week} parentLine`).toBeGreaterThan(20);
      expect(week.homeRep.length, `week ${week.week} homeRep`).toBeGreaterThan(5);
      expect(week.wordFraming.length, `week ${week.week} wordFraming`).toBeGreaterThan(20);
      expect(week.title, `week ${week.week} title`).not.toBe("");
    }
  });

  // Growth-only is the standing law: a kid is measured against their own week-1
  // number, never against another child. The finale copy is where that would
  // slip first.
  test("the finale measures a kid against their own week-1 number", () => {
    const last = FALL_SEASON_PLAN[FALL_SEASON_PLAN.length - 1];
    expect(last.parentLine.toLowerCase()).toMatch(/never against each other/);
    expect(last.wordFraming.toLowerCase()).toMatch(/better than yesterday/);
  });
});
