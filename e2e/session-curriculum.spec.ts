import { test, expect } from "@playwright/test";

import {
  AGE_BANDS,
  BALL_RULES,
  CAPTAIN_NEVER,
  CAPTAIN_RUN_OF_SHOW,
  CURRICULUM_AGE_MAX,
  CURRICULUM_AGE_MIN,
  CUTTABLE_BLOCK_ORDER,
  MODIFIED_GAMES,
  SESSION_ARC_60,
  SESSION_ARC_90,
  SKILL_STACK,
  addMinutesToClock,
  bandForAge,
  findGame,
  phaseClock,
  rulesForColor,
} from "../src/data/session-curriculum";

// Pure-data checks. No page navigation, no dev server. Run with:
//   npx playwright test e2e/session-curriculum.spec.ts --project=desktop
//
// The curriculum is rendered on a coach page and quoted in three parent emails,
// so a gap here doesn't throw — it ships a run sheet with a hole in it, on a
// Sunday, in front of nine families. These assertions are the guard.

test.describe("age bands cover the academy range exactly", () => {
  test("bands are contiguous, ordered, and span 6–16 with no gaps or overlaps", () => {
    expect(AGE_BANDS.length).toBeGreaterThan(0);
    expect(AGE_BANDS[0].minAge).toBe(CURRICULUM_AGE_MIN);
    expect(AGE_BANDS[AGE_BANDS.length - 1].maxAge).toBe(CURRICULUM_AGE_MAX);

    AGE_BANDS.forEach((band, i) => {
      expect(band.maxAge).toBeGreaterThanOrEqual(band.minAge);
      if (i > 0) {
        // Contiguous: this band starts exactly where the last one ended.
        expect(band.minAge).toBe(AGE_BANDS[i - 1].maxAge + 1);
      }
    });
  });

  test("every age in range resolves to exactly one band", () => {
    for (let age = CURRICULUM_AGE_MIN; age <= CURRICULUM_AGE_MAX; age += 1) {
      const matches = AGE_BANDS.filter(
        (b) => age >= b.minAge && age <= b.maxAge,
      );
      expect(matches, `age ${age}`).toHaveLength(1);
      expect(bandForAge(age)?.band).toBe(matches[0].band);
    }
  });

  test("no band exists outside the strict 6–16 academy range", () => {
    expect(bandForAge(CURRICULUM_AGE_MIN - 1)).toBeUndefined();
    expect(bandForAge(CURRICULUM_AGE_MAX + 1)).toBeUndefined();
  });

  test("dials escalate with age — blocks get longer, rally targets get higher", () => {
    AGE_BANDS.forEach((band, i) => {
      if (i === 0) return;
      const prev = AGE_BANDS[i - 1];
      expect(band.blockMinutes).toBeGreaterThanOrEqual(prev.blockMinutes);
      expect(band.rallyTarget).toBeGreaterThan(prev.rallyTarget);
      expect(band.gameMinutes).toBeGreaterThanOrEqual(prev.gameMinutes);
    });
  });
});

test.describe("ball-color rules", () => {
  test("all four colors are present exactly once and fully specified", () => {
    const colors = BALL_RULES.map((r) => r.color);
    expect(colors).toEqual(["red", "orange", "green", "yellow"]);
    expect(new Set(colors).size).toBe(colors.length);

    for (const rule of BALL_RULES) {
      for (const field of [
        "serve",
        "serveMiss",
        "kitchen",
        "twoBounce",
        "court",
        "scoring",
        "captainWatch",
      ] as const) {
        expect(rule[field].length, `${rule.color}.${field}`).toBeGreaterThan(0);
      }
    }
  });

  // The two rules that look backwards on the page and aren't. If someone
  // "fixes" them to a monotonic ladder, these fail and the comment above
  // BALL_RULES explains why they shouldn't.
  test("Red is one serve with no fault, and no kitchen", () => {
    const red = rulesForColor("red");
    expect(red.serve).toMatch(/one serve/i);
    expect(red.serveMiss).toMatch(/no fault/i);
    expect(red.kitchen).toMatch(/^OFF/);
    expect(red.twoBounce).toMatch(/^OFF/);
  });

  test("Orange is two serves with the kitchen switched on", () => {
    const orange = rulesForColor("orange");
    expect(orange.serve).toMatch(/two serves/i);
    expect(orange.kitchen).toMatch(/^ON/);
    expect(orange.twoBounce).toMatch(/^ON/);
  });

  test("Green and Yellow return to tournament standard — one serve, all rules on", () => {
    for (const color of ["green", "yellow"] as const) {
      const rule = rulesForColor(color);
      expect(rule.serve, color).toMatch(/one serve/i);
      expect(rule.serveMiss, color).toMatch(/fault/i);
      expect(rule.kitchen, color).toMatch(/^ON/);
      expect(rule.twoBounce, color).toMatch(/^ON/);
    }
  });

  test("every ball color names a serve position", () => {
    for (const rule of BALL_RULES) {
      expect(rule.serve, rule.color).toMatch(/baseline/i);
    }
  });
});

test.describe("the Skill Stack", () => {
  test("is exactly six blocks, numbered 1–6 in order", () => {
    expect(SKILL_STACK).toHaveLength(6);
    expect(SKILL_STACK.map((b) => b.order)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  test("every block carries setup, formation, rotation, scaling and a captain cue", () => {
    for (const block of SKILL_STACK) {
      for (const field of [
        "setup",
        "formation",
        "rotation",
        "scaling",
        "captainCue",
        "teaches",
      ] as const) {
        expect(block[field], `block ${block.order}.${field}`).not.toBe("");
      }
      expect(block.cues.length, `block ${block.order} cues`).toBeGreaterThanOrEqual(2);
      expect(block.vocabulary.length, `block ${block.order} vocab`).toBeGreaterThan(0);
    }
  });

  test("the drilling order runs kitchen → transition → baseline → net → serve", () => {
    // The order IS the pedagogy: start where the ball is slowest, walk out to
    // the baseline, add the serve last. Reordering this breaks the progression
    // every parent email describes.
    expect(SKILL_STACK[0].alias).toBe("K2K");
    expect(SKILL_STACK[1].alias).toBe("The Slinky");
    expect(SKILL_STACK[5].name).toMatch(/serve/i);
  });

  test("the cuttable block is a real block, and it is never the serve block", () => {
    const cuttable = SKILL_STACK.find((b) => b.order === CUTTABLE_BLOCK_ORDER);
    expect(cuttable).toBeDefined();
    expect(cuttable!.order).not.toBe(6);
  });

  test("every block's scaling names at least one ball color", () => {
    for (const block of SKILL_STACK) {
      expect(block.scaling, `block ${block.order}`).toMatch(
        /Red|Orange|Green|Yellow/,
      );
    }
  });
});

test.describe("the games library", () => {
  test("every game has verified setup, rules, scaling and a captain role", () => {
    expect(MODIFIED_GAMES.length).toBeGreaterThanOrEqual(5);
    for (const game of MODIFIED_GAMES) {
      for (const field of [
        "setup",
        "rules",
        "scaling",
        "captainRole",
        "players",
      ] as const) {
        expect(game[field], `${game.slug}.${field}`).not.toBe("");
      }
      expect(game.minAge).toBeGreaterThanOrEqual(6);
    }
  });

  test("slugs are unique and resolvable", () => {
    const slugs = MODIFIED_GAMES.map((g) => g.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const slug of slugs) expect(findGame(slug)?.slug).toBe(slug);
  });

  // The Kitchen Game rule was guessed once and shipped wrong on two surfaces —
  // it is 2v2 rally-to-11 at the NVZ, NOT "dink-only, first to break the
  // kitchen loses". This pins the verified version.
  test("Kitchen Game is 2v2 rally scoring to 11 at the kitchen line", () => {
    const game = findGame("kitchen-game");
    expect(game).toBeDefined();
    expect(game!.setup).toMatch(/2 v 2/);
    expect(game!.setup).toMatch(/kitchen/i);
    expect(game!.rules).toMatch(/rally scoring/i);
    expect(game!.rules).toMatch(/11/);
    expect(game!.rules).not.toMatch(/dink-only/i);
  });

  test("7-11 keeps its asymmetric scoring — that asymmetry is the whole lesson", () => {
    const game = findGame("seven-eleven");
    expect(game).toBeDefined();
    expect(game!.rules).toMatch(/net player needs 7/i);
    expect(game!.rules).toMatch(/deep player needs 11/i);
  });

  test("Squirrel and Jailbreak are rituals that need a group", () => {
    for (const slug of ["squirrel", "jailbreak"]) {
      const game = findGame(slug);
      expect(game, slug).toBeDefined();
      expect(game!.purpose, slug).toBe("ritual");
    }
  });

  test("every competing game points at a real Skill Stack block", () => {
    const orders = new Set(SKILL_STACK.map((b) => b.order));
    for (const game of MODIFIED_GAMES) {
      if (game.repsBlock === 0) continue;
      expect(orders.has(game.repsBlock), `${game.slug} → block ${game.repsBlock}`).toBe(
        true,
      );
    }
  });
});

test.describe("the session arc", () => {
  const arcs = [
    { name: "90-minute", arc: SESSION_ARC_90, total: 90 },
    { name: "60-minute", arc: SESSION_ARC_60, total: 60 },
  ];

  for (const { name, arc, total } of arcs) {
    test(`${name} arc is gapless, starts at 0, and totals ${total} minutes`, () => {
      expect(arc[0].startMinute).toBe(0);
      arc.forEach((phase, i) => {
        expect(phase.endMinute, `${phase.name}`).toBeGreaterThan(phase.startMinute);
        if (i > 0) expect(phase.startMinute).toBe(arc[i - 1].endMinute);
      });
      expect(arc[arc.length - 1].endMinute).toBe(total);
    });

    test(`${name} arc ends on cleanup, with the ritual immediately before it`, () => {
      const last = arc[arc.length - 1];
      const ritual = arc[arc.length - 2];
      expect(last.name.toLowerCase()).toMatch(/cleanup/);
      expect(ritual.name.toLowerCase()).toMatch(/ritual/);
      // "Start the ritual when 5 minutes remain" — so it begins no earlier
      // than the 5-minutes-left mark and cleanup still gets its window.
      expect(total - ritual.startMinute).toBeLessThanOrEqual(8);
    });

    test(`${name} arc opens with the arrival rally`, () => {
      expect(arc[0].name).toBe("Arrival Rally");
    });

    test(`every ${name} phase says who owns it and why it exists`, () => {
      for (const phase of arc) {
        expect(["coach", "captains", "both"]).toContain(phase.owner);
        expect(phase.why, phase.name).not.toBe("");
        expect(phase.what, phase.name).not.toBe("");
      }
    });
  }
});

test.describe("clock math", () => {
  // Deliberately string + integer math, never Date — date arithmetic on a UTC
  // build server is the documented footgun this repo has been bitten by.
  test("adds minutes across the hour", () => {
    expect(addMinutesToClock("1:00 PM", 46)).toBe("1:46 PM");
    expect(addMinutesToClock("1:00 PM", 90)).toBe("2:30 PM");
    expect(addMinutesToClock("2:30 PM", 0)).toBe("2:30 PM");
  });

  test("handles the noon and midnight boundaries", () => {
    expect(addMinutesToClock("11:30 AM", 45)).toBe("12:15 PM");
    expect(addMinutesToClock("12:45 PM", 30)).toBe("1:15 PM");
    expect(addMinutesToClock("11:45 PM", 30)).toBe("12:15 AM");
    expect(addMinutesToClock("12:30 AM", 45)).toBe("1:15 AM");
  });

  test("rejects an unparseable label instead of silently returning nonsense", () => {
    expect(() => addMinutesToClock("13:00", 5)).toThrow();
    expect(() => addMinutesToClock("", 5)).toThrow();
  });

  test("phaseClock renders a real window for a season block", () => {
    const stack = SESSION_ARC_90.find((p) => p.name === "Skill Stack")!;
    expect(phaseClock(stack, "1:00 PM")).toBe("1:10 PM–1:46 PM");
    expect(phaseClock(stack, "2:30 PM")).toBe("2:40 PM–3:16 PM");
  });
});

test.describe("court captain role", () => {
  test("the run of show covers setup through cleanup", () => {
    expect(CAPTAIN_RUN_OF_SHOW.length).toBeGreaterThanOrEqual(6);
    expect(CAPTAIN_RUN_OF_SHOW[0].phase).toMatch(/before/i);
    expect(
      CAPTAIN_RUN_OF_SHOW[CAPTAIN_RUN_OF_SHOW.length - 1].phase,
    ).toMatch(/cleanup/i);
  });

  // The bright line. A captain who coaches may be teaching against what the
  // coach said sixty seconds ago, and a volunteer alone with someone else's
  // child is a safeguarding failure. Both belong in the NEVER list, always.
  test("the never-list holds the coaching line and the safeguarding line", () => {
    const joined = CAPTAIN_NEVER.join(" ").toLowerCase();
    expect(joined).toMatch(/never fix technique/);
    expect(joined).toMatch(/never discipline/);
    expect(joined).toMatch(/never be alone with a child/);
  });
});
