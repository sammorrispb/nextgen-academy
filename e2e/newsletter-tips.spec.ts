import { test, expect } from "@playwright/test";
import { COACH_TIPS, pickWeeklyTip } from "../src/lib/newsletter-tips";

test.describe("pickWeeklyTip", () => {
  test("always returns a real tip from the bank", () => {
    const tip = pickWeeklyTip(new Date("2026-05-21T18:00:00Z"));
    expect(COACH_TIPS).toContainEqual(tip);
    expect(tip.title.length).toBeGreaterThan(0);
    expect(tip.body.length).toBeGreaterThan(0);
  });

  test("is stable within the same week", () => {
    const mon = pickWeeklyTip(new Date("2026-05-18T08:00:00Z"));
    const wed = pickWeeklyTip(new Date("2026-05-20T20:00:00Z"));
    expect(mon).toEqual(wed);
  });

  test("advances by one tip from one week to the next", () => {
    const wk1 = pickWeeklyTip(new Date("2026-05-21T12:00:00Z"));
    const wk2 = pickWeeklyTip(new Date("2026-05-28T12:00:00Z"));
    expect(wk2).not.toEqual(wk1);
  });

  test("rotates through the whole bank over consecutive weeks", () => {
    const seen = new Set<string>();
    const start = new Date("2026-01-01T12:00:00Z").getTime();
    for (let i = 0; i < COACH_TIPS.length; i++) {
      seen.add(pickWeeklyTip(new Date(start + i * 7 * 24 * 60 * 60 * 1000)).title);
    }
    expect(seen.size).toBe(COACH_TIPS.length);
  });

  test("no tip uses ungated parent-facing jargon", () => {
    // Brand rule: 'dink', 'third shot', 'ATP', 'Erne', 'stack' are gated for parents.
    const banned = /\b(dink|third shot|atp|erne|stacking)\b/i;
    for (const tip of COACH_TIPS) {
      expect(`${tip.title} ${tip.body}`).not.toMatch(banned);
    }
  });
});
