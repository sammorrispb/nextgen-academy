import { test, expect } from "@playwright/test";
import {
  mergeCurriculum,
  CURRICULUM_DEFAULTS,
  type CurriculumDefaults,
  type CurriculumOverride,
} from "../src/lib/curriculum-merge";
import type {
  BallRules,
  SkillBlock,
  CaptainDuty,
} from "../src/data/session-curriculum";
import type { SeasonWeek } from "../src/data/fall-season-plan-2026";

// Pure-function spec (no dev server): the merge is the piece that decides what
// a coach actually reads off the run sheet on a Sunday, so it is tested against
// SYNTHETIC defaults rather than the real data files. That separation is the
// point — e2e/session-curriculum.spec.ts owns the real curriculum's content,
// this spec owns the merge's behaviour, and neither can silently absorb the
// other's failures.
//   npx playwright test e2e/curriculum-merge.spec.ts --project=desktop

function ballRule(color: BallRules["color"], over: Partial<BallRules> = {}): BallRules {
  return {
    color,
    label: `${color} Ball`,
    ball: "default ball",
    typicalAges: "6–8",
    serve: "default serve",
    serveMiss: "default serve miss",
    kitchen: "OFF. default kitchen",
    twoBounce: "OFF. default two bounce",
    court: "Full court",
    scoring: "default scoring",
    captainWatch: "default captain watch",
    ...over,
  };
}

function block(order: number, over: Partial<SkillBlock> = {}): SkillBlock {
  return {
    order,
    name: `Block ${order}`,
    alias: `B${order}`,
    teaches: "default teaches",
    setup: `default setup ${order}`,
    formation: "default formation",
    rotation: "default rotation",
    cues: [`cue ${order}a`, `cue ${order}b`, `cue ${order}c`],
    vocabulary: ["Vocab"],
    scaling: "Red: default scaling",
    captainCue: "default captain cue",
    ...over,
  };
}

function week(n: number, over: Partial<SeasonWeek> = {}): SeasonWeek {
  return {
    week: n,
    date: `2026-09-2${n}`,
    title: `Week ${n}`,
    focusBlock: 1,
    word: "Attitude",
    wordFraming: "default framing",
    games: ["a", "b"],
    ritual: "jailbreak",
    coachLooksFor: "default looks for",
    parentLine: `default parent line ${n}`,
    homeRep: "default home rep",
    ...over,
  };
}

const duties: CaptainDuty[] = [
  { phase: "15 min before", duty: "default duty 0" },
  { phase: "Arrival Rally", duty: "default duty 1" },
  { phase: "Skill Stack", duty: "default duty 2" },
];

function defaults(): CurriculumDefaults {
  return {
    ballRules: [ballRule("red"), ballRule("orange"), ballRule("green"), ballRule("yellow")],
    skillStack: [block(1), block(2), block(3)],
    captainRunOfShow: duties.map((d) => ({ ...d })),
    captainNever: ["never 0", "never 1", "never 2"],
    captainScript: ["script 0", "script 1"],
    captainKit: ["kit 0", "kit 1"],
    seasonPlan: [week(1), week(2), week(3)],
  };
}

const o = (fieldId: string, value: string): CurriculumOverride => ({ fieldId, value });

test.describe("mergeCurriculum — no overrides", () => {
  test("returns the defaults untouched, and reports nothing edited", () => {
    const d = defaults();
    const merged = mergeCurriculum(d, []);

    expect(merged.ballRules).toEqual(d.ballRules);
    expect(merged.skillStack).toEqual(d.skillStack);
    expect(merged.captainRunOfShow).toEqual(d.captainRunOfShow);
    expect(merged.captainNever).toEqual(d.captainNever);
    expect(merged.captainScript).toEqual(d.captainScript);
    expect(merged.captainKit).toEqual(d.captainKit);
    expect(merged.seasonPlan).toEqual(d.seasonPlan);

    expect(merged.editedFieldIds.size).toBe(0);
    expect(merged.unknownFieldIds).toEqual([]);
  });

  test("the real CURRICULUM_DEFAULTS merge with no overrides is a faithful copy", () => {
    const merged = mergeCurriculum(CURRICULUM_DEFAULTS, []);
    expect(merged.ballRules).toEqual(CURRICULUM_DEFAULTS.ballRules);
    expect(merged.skillStack).toEqual(CURRICULUM_DEFAULTS.skillStack);
    expect(merged.seasonPlan).toEqual(CURRICULUM_DEFAULTS.seasonPlan);
    expect(merged.editedFieldIds.size).toBe(0);
  });
});

test.describe("mergeCurriculum — the six ID namespaces Sam named", () => {
  test("rule.<color>.<prop> replaces exactly that one string", () => {
    const d = defaults();
    const merged = mergeCurriculum(d, [o("rule.red.serve", "One serve, underhand")]);

    expect(merged.ballRules[0].serve).toBe("One serve, underhand");
    // Only that field on that colour moved.
    expect(merged.ballRules[0].scoring).toBe("default scoring");
    expect(merged.ballRules[0].kitchen).toBe("OFF. default kitchen");
    expect(merged.ballRules[1].serve).toBe("default serve");
    expect(merged.ballRules[2].serve).toBe("default serve");
    expect(merged.ballRules[3].serve).toBe("default serve");
    expect(merged.editedFieldIds.has("rule.red.serve")).toBe(true);
    expect(merged.unknownFieldIds).toEqual([]);
  });

  test("rule.green.scoring resolves by colour, not by array position", () => {
    const d = defaults();
    const merged = mergeCurriculum(d, [o("rule.green.scoring", "Games to 11, win by 2")]);
    expect(merged.ballRules[2].color).toBe("green");
    expect(merged.ballRules[2].scoring).toBe("Games to 11, win by 2");
    expect(merged.ballRules[0].scoring).toBe("default scoring");
  });

  test("block.<order>.cue.<i> replaces one cue, keeping order and siblings", () => {
    const d = defaults();
    const merged = mergeCurriculum(d, [o("block.1.cue.0", "Push it, don't hit it.")]);

    expect(merged.skillStack[0].cues[0]).toBe("Push it, don't hit it.");
    expect(merged.skillStack[0].cues[1]).toBe("cue 1b");
    expect(merged.skillStack[0].cues[2]).toBe("cue 1c");
    expect(merged.skillStack[0].cues).toHaveLength(3);
    expect(merged.skillStack[1].cues[0]).toBe("cue 2a");
  });

  test("block.<order> resolves by `order`, not by array index", () => {
    // A defaults set whose array order does NOT match `order` — the ID must
    // still land on block 2.
    const d = defaults();
    const shuffled: CurriculumDefaults = {
      ...d,
      skillStack: [block(3), block(2), block(1)],
    };
    const merged = mergeCurriculum(shuffled, [o("block.2.setup", "new setup")]);
    const two = merged.skillStack.find((b) => b.order === 2);
    expect(two?.setup).toBe("new setup");
    expect(merged.skillStack.find((b) => b.order === 1)?.setup).toBe("default setup 1");
    expect(merged.skillStack.find((b) => b.order === 3)?.setup).toBe("default setup 3");
  });

  test("captain.duty.<i> is 0-based and replaces `duty`, never `phase`", () => {
    const d = defaults();
    const merged = mergeCurriculum(d, [o("captain.duty.2", "Hold the clock.")]);

    expect(merged.captainRunOfShow[2].duty).toBe("Hold the clock.");
    expect(merged.captainRunOfShow[2].phase).toBe("Skill Stack");
    expect(merged.captainRunOfShow[0].duty).toBe("default duty 0");
  });

  test("captain.never.<i> is 0-based on the flat string array", () => {
    const d = defaults();
    const merged = mergeCurriculum(d, [
      o("captain.never.2", "Never let the court go silent. EQ — Encourage and Question"),
    ]);
    expect(merged.captainNever[2]).toBe(
      "Never let the court go silent. EQ — Encourage and Question",
    );
    expect(merged.captainNever[0]).toBe("never 0");
    expect(merged.captainNever).toHaveLength(3);
  });

  test("captain.script.<i> and captain.kit.<i> ride the same flat-array path", () => {
    const d = defaults();
    const merged = mergeCurriculum(d, [
      o("captain.script.1", "new script"),
      o("captain.kit.0", "new kit"),
    ]);
    expect(merged.captainScript[1]).toBe("new script");
    expect(merged.captainScript[0]).toBe("script 0");
    expect(merged.captainKit[0]).toBe("new kit");
    expect(merged.unknownFieldIds).toEqual([]);
  });

  test("week.<n>.parentLine is 1-based, resolved by week number", () => {
    const d = defaults();
    const merged = mergeCurriculum(d, [o("week.2.parentLine", "We worked the Slinky.")]);

    const w2 = merged.seasonPlan.find((w) => w.week === 2);
    expect(w2?.parentLine).toBe("We worked the Slinky.");
    expect(w2?.homeRep).toBe("default home rep");
    expect(merged.seasonPlan.find((w) => w.week === 1)?.parentLine).toBe(
      "default parent line 1",
    );
  });

  test("the other SeasonWeek strings are overridable too", () => {
    const d = defaults();
    const merged = mergeCurriculum(d, [
      o("week.1.coachLooksFor", "new looks for"),
      o("week.1.wordFraming", "new framing"),
      o("week.1.homeRep", "new home rep"),
      o("week.1.title", "new title"),
    ]);
    const w1 = merged.seasonPlan[0];
    expect(w1.coachLooksFor).toBe("new looks for");
    expect(w1.wordFraming).toBe("new framing");
    expect(w1.homeRep).toBe("new home rep");
    expect(w1.title).toBe("new title");
    expect(merged.unknownFieldIds).toEqual([]);
  });

  test("several overrides across namespaces all land in one pass", () => {
    const d = defaults();
    const merged = mergeCurriculum(d, [
      o("rule.yellow.kitchen", "ON, strict"),
      o("block.3.captainCue", "new cue"),
      o("captain.never.0", "new never"),
      o("week.3.parentLine", "new line"),
    ]);
    expect(merged.ballRules[3].kitchen).toBe("ON, strict");
    expect(merged.skillStack[2].captainCue).toBe("new cue");
    expect(merged.captainNever[0]).toBe("new never");
    expect(merged.seasonPlan[2].parentLine).toBe("new line");
    expect(merged.editedFieldIds.size).toBe(4);
  });
});

test.describe("mergeCurriculum — unknown IDs are ignored AND reported", () => {
  // A typo'd Field ID that silently does nothing is the exact failure mode the
  // fetchApprovedNewsletterDrafts work exists to prevent. Ignoring it protects
  // the run sheet; REPORTING it is what stops a dud edit sitting in Notion for
  // a season while Sam believes the copy changed.
  const cases: Array<[string, string]> = [
    ["a misspelled prop", "rule.red.serv"],
    ["a colour that does not exist", "rule.purple.serve"],
    ["a block order that does not exist", "block.99.cue.0"],
    ["a cue index past the end", "block.1.cue.7"],
    ["a week that does not exist", "week.9.parentLine"],
    ["a captain duty index past the end", "captain.duty.42"],
    ["a never index past the end", "captain.never.9"],
    ["a negative index", "captain.never.-1"],
    ["a non-numeric index", "captain.never.two"],
    ["an unknown namespace", "garbage.1.thing"],
    ["free text", "please fix the serve rule"],
    ["an empty id", ""],
    ["a bare namespace", "rule"],
    ["a trailing dot", "rule.red."],
  ];

  for (const [label, fieldId] of cases) {
    test(`${label} (${JSON.stringify(fieldId)}) changes nothing and is reported`, () => {
      const d = defaults();
      const merged = mergeCurriculum(d, [o(fieldId, "SHOULD NEVER APPEAR")]);

      expect(JSON.stringify(merged.ballRules)).not.toContain("SHOULD NEVER APPEAR");
      expect(JSON.stringify(merged.skillStack)).not.toContain("SHOULD NEVER APPEAR");
      expect(JSON.stringify(merged.captainRunOfShow)).not.toContain("SHOULD NEVER APPEAR");
      expect(JSON.stringify(merged.captainNever)).not.toContain("SHOULD NEVER APPEAR");
      expect(JSON.stringify(merged.seasonPlan)).not.toContain("SHOULD NEVER APPEAR");

      expect(merged.unknownFieldIds).toContain(fieldId);
      expect(merged.editedFieldIds.has(fieldId)).toBe(false);
    });
  }

  test("one bad id does not stop the good ones in the same batch", () => {
    const d = defaults();
    const merged = mergeCurriculum(d, [
      o("rule.red.serve", "good one"),
      o("rule.red.serv", "typo"),
      o("block.1.cue.0", "good two"),
    ]);
    expect(merged.ballRules[0].serve).toBe("good one");
    expect(merged.skillStack[0].cues[0]).toBe("good two");
    expect(merged.unknownFieldIds).toEqual(["rule.red.serv"]);
    expect(merged.editedFieldIds.size).toBe(2);
  });

  test("structural and non-string fields are unreachable", () => {
    const d = defaults();
    const merged = mergeCurriculum(d, [
      o("rule.red.color", "purple"),
      o("block.1.order", "99"),
      o("block.1.vocabulary", "nope"),
      o("week.1.week", "9"),
      o("week.1.date", "2099-01-01"),
      o("week.1.focusBlock", "6"),
      o("week.1.games", "x"),
      o("week.1.ritual", "nope"),
    ]);

    expect(merged.ballRules[0].color).toBe("red");
    expect(merged.skillStack[0].order).toBe(1);
    expect(merged.skillStack[0].vocabulary).toEqual(["Vocab"]);
    expect(merged.seasonPlan[0].week).toBe(1);
    expect(merged.seasonPlan[0].date).toBe("2026-09-21");
    expect(merged.seasonPlan[0].focusBlock).toBe(1);
    expect(merged.seasonPlan[0].games).toEqual(["a", "b"]);
    expect(merged.seasonPlan[0].ritual).toBe("jailbreak");
    expect(merged.unknownFieldIds).toHaveLength(8);
    expect(merged.editedFieldIds.size).toBe(0);
  });

  test("captain.duty.<i>.phase cannot be reached through a longer id", () => {
    const d = defaults();
    const merged = mergeCurriculum(d, [o("captain.duty.0.phase", "nope")]);
    expect(merged.captainRunOfShow[0].phase).toBe("15 min before");
    expect(merged.unknownFieldIds).toContain("captain.duty.0.phase");
  });
});

test.describe("mergeCurriculum — empty value means revert, not blank", () => {
  // Stage 1 has no editor, so blanking Value (or unticking Active, which drops
  // the row upstream) is Sam's only revert. An empty override must therefore
  // fall through to the code default — never blank the run sheet.
  for (const [label, value] of [
    ["an empty string", ""],
    ["whitespace", "   "],
    ["a newline", "\n"],
    ["a tab", "\t"],
  ] as Array<[string, string]>) {
    test(`${label} leaves the code default in place`, () => {
      const d = defaults();
      const merged = mergeCurriculum(d, [o("rule.red.serve", value)]);
      expect(merged.ballRules[0].serve).toBe("default serve");
      expect(merged.editedFieldIds.has("rule.red.serve")).toBe(false);
    });
  }

  test("an empty value is NOT reported as an unknown field", () => {
    const d = defaults();
    const merged = mergeCurriculum(d, [o("rule.red.serve", "")]);
    // The id is perfectly valid — blanking it is a deliberate revert, so it
    // must not raise the typo alert.
    expect(merged.unknownFieldIds).toEqual([]);
  });

  test("a value that is only trimmed-away whitespace around real text still applies", () => {
    const d = defaults();
    const merged = mergeCurriculum(d, [o("rule.red.serve", "  Two serves  ")]);
    expect(merged.ballRules[0].serve).toBe("Two serves");
  });
});

test.describe("mergeCurriculum — duplicates and edited-set bookkeeping", () => {
  test("last writer wins on a duplicated id", () => {
    const d = defaults();
    const merged = mergeCurriculum(d, [
      o("rule.red.serve", "first"),
      o("rule.red.serve", "second"),
    ]);
    expect(merged.ballRules[0].serve).toBe("second");
    expect(merged.editedFieldIds.size).toBe(1);
  });

  test("editedFieldIds contains exactly the ids that changed something", () => {
    const d = defaults();
    const merged = mergeCurriculum(d, [
      o("rule.red.serve", "applied"),
      o("rule.red.scoring", ""),
      o("nonsense.id", "ignored"),
    ]);
    expect([...merged.editedFieldIds]).toEqual(["rule.red.serve"]);
  });
});
