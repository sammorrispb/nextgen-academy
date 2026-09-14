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
  FALL_SEASON_PLAN_GREEN,
  FALL_SEASON_PLAN_YELLOW,
  FALL_SEASON_PLANS,
  findWeek,
  focusBlockFor,
  gamesFor,
  ritualFor,
  seasonPlanFor,
  weekForDate,
  type SeasonPlanGroup,
  type SeasonWeek,
} from "../src/data/fall-season-plan-2026";
import { SKILL_STACK } from "../src/data/session-curriculum";

// Pure-data checks. Run with:
//   npx playwright test e2e/fall-season-plan.spec.ts --project=desktop
//
// Thirteen families have paid for a six-week progression — two of them, since
// 2026-09-14: Green is the fundamentals ladder and Yellow builds on it. Each
// plan and the season's real dates are different files, and a plan that points
// at a Sunday the season doesn't run — or at a drill that no longer exists — is
// a run sheet that fails on court, not at build time. Every structural check
// therefore runs over BOTH arcs.

const ARCS = Object.entries(FALL_SEASON_PLANS) as [SeasonPlanGroup, readonly SeasonWeek[]][];

for (const [group, plan] of ARCS) {
  test.describe(`${group} arc — the plan matches the season it plans`, () => {
    test("there is exactly one planned week per season Sunday", () => {
      expect(plan).toHaveLength(FALL_SEASON_WEEKS);
      expect(plan).toHaveLength(FALL_SUNDAYS.length);
      expect(FALL_PLAN_WEEKS).toBe(FALL_SEASON_WEEKS);
    });

    test("week numbers are 1..N in order with no gaps", () => {
      expect(plan.map((w) => w.week)).toEqual(FALL_SUNDAYS.map((_, i) => i + 1));
    });

    test("each week sits on the matching season Sunday, in calendar order", () => {
      plan.forEach((week, i) => {
        expect(week.date, `week ${week.week}`).toBe(FALL_SUNDAYS[i]);
      });
      const sorted = [...plan.map((w) => w.date)].sort();
      expect(plan.map((w) => w.date)).toEqual(sorted);
    });

    test("no week is scheduled on a rain date — those are holds, not season weeks", () => {
      for (const week of plan) {
        expect(FALL_RAIN_DATES).not.toContain(week.date);
      }
    });

    test("lookups resolve both ways, for this arc", () => {
      for (const week of plan) {
        expect(findWeek(week.week, group)?.date).toBe(week.date);
        expect(findWeek(week.week, group)?.title).toBe(week.title);
        expect(weekForDate(week.date, group)?.week).toBe(week.week);
        expect(weekForDate(week.date, group)?.title).toBe(week.title);
      }
      expect(findWeek(FALL_SEASON_WEEKS + 1, group)).toBeUndefined();
      expect(weekForDate("2026-01-01", group)).toBeUndefined();
    });
  });

  test.describe(`${group} arc — every week points at content that exists`, () => {
    test("focus blocks resolve to real Skill Stack blocks", () => {
      const orders = new Set(SKILL_STACK.map((b) => b.order));
      for (const week of plan) {
        expect(orders.has(week.focusBlock), `week ${week.week}`).toBe(true);
        expect(() => focusBlockFor(week)).not.toThrow();
        expect(focusBlockFor(week).order).toBe(week.focusBlock);
      }
    });

    test("each week names two real games and one real ritual", () => {
      for (const week of plan) {
        expect(week.games, `week ${week.week}`).toHaveLength(2);
        expect(() => gamesFor(week)).not.toThrow();
        expect(gamesFor(week)).toHaveLength(2);

        expect(() => ritualFor(week)).not.toThrow();
        expect(ritualFor(week).purpose, `week ${week.week} ritual`).toBe("ritual");
      }
    });
  });

  test.describe(`${group} arc — a progression, not six of the same session`, () => {
    test("the six weeks go deep on distinct blocks", () => {
      const focuses = plan.map((w) => w.focusBlock);
      expect(new Set(focuses).size).toBe(focuses.length);
    });

    // Both arcs open with a measured baseline at the kitchen: Green because
    // that is where the ladder starts, Yellow because spin is felt first where
    // the ball is slow — and the finale needs a week-1 number to point at.
    test("week 1 is the baseline and starts at the kitchen", () => {
      const first = plan[0];
      expect(first.focusBlock).toBe(1);
      expect(first.coachLooksFor.toLowerCase()).toMatch(/baseline/);
    });

    test("all four EASE values get used as a Word of the Day across the season", () => {
      const words = new Set(plan.map((w) => w.word));
      for (const value of ["Ethics", "Attitude", "Skills", "Excellence"]) {
        expect(words.has(value as never), value).toBe(true);
      }
    });

    test("every week gives parents a plain sentence and a five-minute home rep", () => {
      for (const week of plan) {
        expect(week.parentLine.length, `week ${week.week} parentLine`).toBeGreaterThan(20);
        expect(week.homeRep.length, `week ${week.week} homeRep`).toBeGreaterThan(5);
        expect(week.wordFraming.length, `week ${week.week} wordFraming`).toBeGreaterThan(20);
        expect(week.title, `week ${week.week} title`).not.toBe("");
      }
    });

    // Growth-only is the standing law for the coaching measurement: a kid is
    // measured against their own week-1 number, never against another child.
    // The finale copy is where that would slip first — in either arc.
    test("the finale measures a kid against their own week-1 number", () => {
      const last = plan[plan.length - 1];
      expect(last.parentLine.toLowerCase()).toMatch(/never against each other/);
      expect(last.wordFraming.toLowerCase()).toMatch(/better than yesterday/);
    });
  });
}

test.describe("a week pointing at content that doesn't exist throws instead of rendering blank", () => {
  test("unknown game / unknown block", () => {
    const broken = { ...FALL_SEASON_PLAN[0], games: ["nope", "kitchen-game"] as const };
    expect(() => gamesFor(broken)).toThrow(/nope/);
    const brokenBlock = { ...FALL_SEASON_PLAN[0], focusBlock: 99 };
    expect(() => focusBlockFor(brokenBlock)).toThrow(/99/);
  });

  test("the re-exported blocks are the season's own blocks", () => {
    expect(FALL_BLOCKS).toBe(FALL_YOUTH_BLOCKS);
  });
});

test.describe("two arcs, one calendar", () => {
  test("there is exactly one arc per Sunday block, keyed on the block's level", () => {
    expect(Object.keys(FALL_SEASON_PLANS).sort()).toEqual(
      FALL_YOUTH_BLOCKS.map((b) => b.level).sort(),
    );
    for (const block of FALL_YOUTH_BLOCKS) {
      expect(seasonPlanFor(block.level)).toHaveLength(FALL_SEASON_WEEKS);
    }
  });

  // The override layer's `week.<n>.<prop>` ids resolve against FALL_SEASON_PLAN,
  // so the original export MUST stay the Green arc — silently re-pointing it at
  // Yellow would move every override Sam has already written.
  test("FALL_SEASON_PLAN is the Green arc and the default for the single-arc lookups", () => {
    expect(FALL_SEASON_PLAN).toBe(FALL_SEASON_PLAN_GREEN);
    expect(seasonPlanFor("Green")).toBe(FALL_SEASON_PLAN);
    expect(seasonPlanFor("Yellow")).toBe(FALL_SEASON_PLAN_YELLOW);
    expect(FALL_SEASON_PLAN_YELLOW).not.toBe(FALL_SEASON_PLAN);
    for (const week of FALL_SEASON_PLAN) {
      expect(findWeek(week.week)).toBe(week);
      expect(weekForDate(week.date)).toBe(week);
    }
  });

  test("both arcs share the Sunday and the Word of the Day — one word per Sunday for the coach", () => {
    FALL_SEASON_PLAN_GREEN.forEach((green, i) => {
      const yellow = FALL_SEASON_PLAN_YELLOW[i];
      expect(yellow.week).toBe(green.week);
      expect(yellow.date).toBe(green.date);
      expect(yellow.word, `week ${green.week} word`).toBe(green.word);
    });
  });

  test("Yellow is a different progression from Green, not a copy at a faster pace", () => {
    FALL_SEASON_PLAN_GREEN.forEach((green, i) => {
      const yellow = FALL_SEASON_PLAN_YELLOW[i];
      expect(yellow.title, `week ${green.week} title`).not.toBe(green.title);
      expect(yellow.parentLine, `week ${green.week} parentLine`).not.toBe(green.parentLine);
      expect(yellow.coachLooksFor, `week ${green.week} coachLooksFor`).not.toBe(green.coachLooksFor);
    });
    expect(FALL_SEASON_PLAN_YELLOW.map((w) => w.focusBlock)).not.toEqual(
      FALL_SEASON_PLAN_GREEN.map((w) => w.focusBlock),
    );
  });

  // Sam's list, in Sam's order (2026-09-14): spins, shot selection, shot
  // patterns, opponent weaknesses, your strengths, learning to win. The arc
  // exists to deliver those six things; a rewrite that drops one is a change
  // to what Yellow families were promised, so it should be deliberate.
  test("the Yellow arc is the six things Yellow builds on Green, in order", () => {
    const themes = [/spin/i, /shot selection/i, /pattern/i, /weakness/i, /strength/i, /win/i];
    themes.forEach((theme, i) => {
      const week = FALL_SEASON_PLAN_YELLOW[i];
      expect(`${week.title} ${week.parentLine}`, `week ${week.week}`).toMatch(theme);
    });
  });
});
