import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test, expect } from "@playwright/test";
import { FetchStub } from "./fixtures/fetch-stub";

// Env BEFORE import (read at call time, but keep the sibling-spec ordering).
process.env.NOTION_API_KEY = "test-notion-key-curriculum";

import {
  fetchCurriculumOverrides,
  CURRICULUM_OVERRIDES_PAGE_SIZE,
} from "../src/lib/notion-curriculum";
import { mergeCurriculum, CURRICULUM_DEFAULTS } from "../src/lib/curriculum-merge";
import { curriculumHealthFailures } from "../src/lib/curriculum-health";
import {
  BALL_RULES,
  SKILL_STACK,
  CAPTAIN_NEVER,
  CAPTAIN_RUN_OF_SHOW,
} from "../src/data/session-curriculum";
import { FALL_SEASON_PLAN } from "../src/data/fall-season-plan-2026";

/**
 * The curriculum override layer must hold these forever:
 *
 *  1. THE MERGE NEVER MUTATES THE IMPORTED DATA MODULES. Next.js module
 *     singletons persist across requests in one server process, so an in-place
 *     write would make an override permanent, un-revertable, and leaked into
 *     every other request until redeploy — the code "defaults" would stop being
 *     defaults. This is the most serious failure mode in the feature.
 *  2. SHIPS DARK. NOTION_CURRICULUM_DB_ID unset => zero network calls and the
 *     code defaults, byte for byte. Setting the env var is the only thing that
 *     turns the feature on.
 *  3. FAIL-SOFT, ALWAYS. Notion 500 / malformed JSON / rows missing properties
 *     must never throw and never half-merge. A run sheet must not render blank
 *     or partial on a Sunday.
 *  4. READ-ONLY, NOTION-ONLY EGRESS. Stage 1 has no write surface; the only
 *     host touched is api.notion.com. No child or parent data is involved --
 *     curriculum is coach text -- so this stays off the minor-PII surface.
 *  5. A MISCONFIGURATION IS LOUD, A DARK DEPLOY IS NOT. config_missing is the
 *     deliberate off state and must NOT alert; a failed query and a typo'd
 *     Field ID must.
 *
 * Mutation checks: (a) make the merge assign in place -> §1 reds; (b) drop the
 * Active filter -> the inactive-row test reds; (c) make config_missing push a
 * failure -> §5 reds; (d) stop reporting unknown ids -> §5 reds; (e) let a
 * query error propagate -> §3 reds.
 *
 * Siblings: e2e/curriculum-merge.spec.ts owns merge semantics;
 * e2e/session-curriculum.spec.ts owns the code defaults themselves.
 */

const DB_ID = "curriculumdb00000000000000000000";
const read = (...parts: string[]) => readFileSync(join(__dirname, "..", ...parts), "utf8");

function row(fieldId: string, value: string, active = true, id = `page-${fieldId}`) {
  return {
    id,
    properties: {
      "Field ID": { title: [{ plain_text: fieldId }] },
      Value: { rich_text: [{ plain_text: value }] },
      Active: { checkbox: active },
    },
  };
}

const query = (results: unknown[]) => ({ results, has_more: false, next_cursor: null });

test.describe("§1 the merge never mutates the imported data modules", () => {
  test("code defaults are identical after a merge that overrides them", () => {
    const before = {
      serve: BALL_RULES[0].serve,
      scoring: BALL_RULES[2].scoring,
      cue: SKILL_STACK[0].cues[0],
      setup: SKILL_STACK[1].setup,
      duty: CAPTAIN_RUN_OF_SHOW[3].duty,
      never: CAPTAIN_NEVER[4],
      parentLine: FALL_SEASON_PLAN[1].parentLine,
    };

    const merged = mergeCurriculum(CURRICULUM_DEFAULTS, [
      { fieldId: "rule.red.serve", value: "OVERRIDDEN serve" },
      { fieldId: "rule.green.scoring", value: "OVERRIDDEN scoring" },
      { fieldId: "block.1.cue.0", value: "OVERRIDDEN cue" },
      { fieldId: "block.2.setup", value: "OVERRIDDEN setup" },
      { fieldId: "captain.duty.3", value: "OVERRIDDEN duty" },
      { fieldId: "captain.never.4", value: "OVERRIDDEN never" },
      { fieldId: "week.2.parentLine", value: "OVERRIDDEN parent line" },
    ]);

    // The merge did produce the overrides...
    expect(merged.ballRules[0].serve).toBe("OVERRIDDEN serve");
    expect(merged.skillStack[0].cues[0]).toBe("OVERRIDDEN cue");
    expect(merged.captainRunOfShow[3].duty).toBe("OVERRIDDEN duty");
    expect(merged.captainNever[4]).toBe("OVERRIDDEN never");

    // ...and the module singletons are untouched.
    expect(BALL_RULES[0].serve, "BALL_RULES was mutated in place").toBe(before.serve);
    expect(BALL_RULES[2].scoring).toBe(before.scoring);
    expect(SKILL_STACK[0].cues[0], "SKILL_STACK cues were mutated in place").toBe(before.cue);
    expect(SKILL_STACK[1].setup).toBe(before.setup);
    expect(CAPTAIN_RUN_OF_SHOW[3].duty).toBe(before.duty);
    expect(CAPTAIN_NEVER[4], "CAPTAIN_NEVER was mutated in place").toBe(before.never);
    expect(FALL_SEASON_PLAN[1].parentLine).toBe(before.parentLine);
  });

  test("a second merge still starts from the code defaults, not the first merge's output", () => {
    mergeCurriculum(CURRICULUM_DEFAULTS, [
      { fieldId: "rule.red.serve", value: "FIRST PASS" },
    ]);
    const second = mergeCurriculum(CURRICULUM_DEFAULTS, []);
    expect(second.ballRules[0].serve).toBe(BALL_RULES[0].serve);
    expect(second.ballRules[0].serve).not.toBe("FIRST PASS");
    expect(second.editedFieldIds.size).toBe(0);
  });

  test("CURRICULUM_DEFAULTS exposes the real data, not a stale copy", () => {
    expect(CURRICULUM_DEFAULTS.ballRules).toEqual(BALL_RULES);
    expect(CURRICULUM_DEFAULTS.skillStack).toEqual(SKILL_STACK);
    expect(CURRICULUM_DEFAULTS.captainNever).toEqual(CAPTAIN_NEVER);
    expect(CURRICULUM_DEFAULTS.seasonPlan).toEqual(FALL_SEASON_PLAN);
  });
});

test.describe("§2 ships dark", () => {
  const stub = new FetchStub();
  test.beforeEach(() => {
    stub.reset();
    stub.install();
    delete process.env.NOTION_CURRICULUM_DB_ID;
  });
  test.afterEach(() => stub.uninstall());

  test("env unset => config_missing, no overrides, and ZERO network calls", async () => {
    const res = await fetchCurriculumOverrides();
    expect(res.status).toBe("config_missing");
    expect(res.overrides).toEqual([]);
    expect(stub.calls, "a dark deploy must not talk to Notion at all").toHaveLength(0);
  });

  test("env unset => the page would render the code defaults exactly", async () => {
    const res = await fetchCurriculumOverrides();
    const merged = mergeCurriculum(CURRICULUM_DEFAULTS, res.overrides);
    expect(merged.ballRules).toEqual(BALL_RULES);
    expect(merged.skillStack).toEqual(SKILL_STACK);
    expect(merged.seasonPlan).toEqual(FALL_SEASON_PLAN);
    expect(merged.editedFieldIds.size).toBe(0);
  });

  test("a missing NOTION_API_KEY is also config_missing, not a query attempt", async () => {
    process.env.NOTION_CURRICULUM_DB_ID = DB_ID;
    const key = process.env.NOTION_API_KEY;
    delete process.env.NOTION_API_KEY;
    try {
      const res = await fetchCurriculumOverrides();
      expect(res.status).toBe("config_missing");
      expect(stub.calls).toHaveLength(0);
    } finally {
      process.env.NOTION_API_KEY = key;
      delete process.env.NOTION_CURRICULUM_DB_ID;
    }
  });
});

test.describe("§3 fail-soft on every Notion failure mode", () => {
  const stub = new FetchStub();
  test.beforeEach(() => {
    stub.reset();
    stub.install();
    process.env.NOTION_API_KEY = "test-notion-key-curriculum";
    process.env.NOTION_CURRICULUM_DB_ID = DB_ID;
  });
  test.afterEach(() => {
    stub.uninstall();
    delete process.env.NOTION_CURRICULUM_DB_ID;
  });

  test("a 500 from Notion => query_failed, never a throw", async () => {
    stub.onDynamic(/api\.notion\.com/, () => ({ status: 500, json: { message: "boom" } }));
    const res = await fetchCurriculumOverrides();
    expect(res.status).toBe("query_failed");
    expect(res.overrides).toEqual([]);
  });

  test("a 401 from Notion => query_failed, never a throw", async () => {
    stub.onDynamic(/api\.notion\.com/, () => ({ status: 401, json: { message: "unauthorized" } }));
    const res = await fetchCurriculumOverrides();
    expect(res.status).toBe("query_failed");
  });

  test("a query failure still merges to full code defaults", async () => {
    stub.onDynamic(/api\.notion\.com/, () => ({ status: 500, json: {} }));
    const res = await fetchCurriculumOverrides();
    const merged = mergeCurriculum(CURRICULUM_DEFAULTS, res.overrides);
    expect(merged.ballRules).toEqual(BALL_RULES);
    expect(merged.captainNever).toEqual(CAPTAIN_NEVER);
  });

  test("rows missing properties are skipped, not crashed on", async () => {
    stub.on(/api\.notion\.com/, query([
      { id: "a", properties: {} },
      { id: "b", properties: { "Field ID": { title: [] }, Value: { rich_text: [] } } },
      { id: "c" },
      row("rule.red.serve", "the good row"),
    ]));
    const res = await fetchCurriculumOverrides();
    expect(res.status).toBe("ok");
    expect(res.overrides).toEqual([
      { fieldId: "rule.red.serve", value: "the good row", pageId: "page-rule.red.serve" },
    ]);
  });

  test("a genuinely empty DB is ok, NOT query_failed", async () => {
    stub.on(/api\.notion\.com/, query([]));
    const res = await fetchCurriculumOverrides();
    expect(res.status).toBe("ok");
    expect(res.overrides).toEqual([]);
  });
});

test.describe("§4 read-only, Notion-only egress", () => {
  const stub = new FetchStub();
  test.beforeEach(() => {
    stub.reset();
    stub.install();
    process.env.NOTION_API_KEY = "test-notion-key-curriculum";
    process.env.NOTION_CURRICULUM_DB_ID = DB_ID;
  });
  test.afterEach(() => {
    stub.uninstall();
    delete process.env.NOTION_CURRICULUM_DB_ID;
  });

  test("the only host touched is api.notion.com", async () => {
    // Deliberately the ONLY rule: any other host throws out of FetchStub.
    stub.on(/api\.notion\.com/, query([row("rule.red.serve", "x")]));
    await fetchCurriculumOverrides();
    expect(stub.calls.length).toBeGreaterThan(0);
    for (const call of stub.calls) {
      expect(call.url).toContain("https://api.notion.com/v1/");
    }
  });

  test("every call is a query POST against the configured DB — no page writes", async () => {
    stub.on(/api\.notion\.com/, query([row("rule.red.serve", "x")]));
    await fetchCurriculumOverrides();
    for (const call of stub.calls) {
      expect(call.url).toBe(`https://api.notion.com/v1/databases/${DB_ID}/query`);
      expect(call.method).toBe("POST");
    }
    // A write would be PATCH, or POST to /pages.
    expect(stub.callsTo("/pages")).toHaveLength(0);
    expect(stub.calls.filter((c) => c.method === "PATCH")).toHaveLength(0);
    expect(stub.calls.filter((c) => c.method === "DELETE")).toHaveLength(0);
  });

  test("the read is capped, so a runaway DB cannot hang a Sunday render", async () => {
    stub.on(/api\.notion\.com/, query([]));
    await fetchCurriculumOverrides();
    const body = JSON.parse(stub.calls[0].body || "{}");
    expect(body.page_size).toBe(CURRICULUM_OVERRIDES_PAGE_SIZE);
    expect(CURRICULUM_OVERRIDES_PAGE_SIZE).toBeLessThanOrEqual(100);
  });

  test("source pin: the lib contains no Notion write verb", () => {
    const src = read("src", "lib", "notion-curriculum.ts");
    expect(src, "Stage 1 is read-only").not.toContain('"PATCH"');
    expect(src).not.toContain('"DELETE"');
    expect(src).not.toContain("/pages");
  });

  test("inactive rows never reach the merge", async () => {
    stub.on(/api\.notion\.com/, query([
      row("rule.red.serve", "SHOULD NOT APPLY", false),
      row("rule.orange.serve", "should apply", true),
    ]));
    const res = await fetchCurriculumOverrides();
    const merged = mergeCurriculum(CURRICULUM_DEFAULTS, res.overrides);
    expect(merged.ballRules[0].serve).toBe(BALL_RULES[0].serve);
    expect(merged.ballRules[1].serve).toBe("should apply");
  });
});

test.describe("§5 a misconfiguration is loud, a dark deploy is not", () => {
  test("config_missing does NOT alert — it is the deliberate off state", () => {
    const failures = curriculumHealthFailures(
      { overrides: [], status: "config_missing" },
      [],
    );
    expect(failures).toEqual([]);
  });

  test("query_failed alerts with a stable signature", () => {
    const failures = curriculumHealthFailures({ overrides: [], status: "query_failed" }, []);
    expect(failures).toHaveLength(1);
    expect(failures[0].signature).toBe("curriculum_overrides_query_failed");
  });

  test("an unresolvable Field ID alerts — a typo must not sit silent for a season", () => {
    const failures = curriculumHealthFailures(
      { overrides: [{ fieldId: "rule.red.serv", value: "x" }], status: "ok" },
      ["rule.red.serv"],
    );
    expect(failures).toHaveLength(1);
    expect(failures[0].signature).toBe("curriculum_override_unknown_field");
    expect(failures[0].detail).toContain("rule.red.serv");
  });

  test("a healthy configured run alerts about nothing", () => {
    const failures = curriculumHealthFailures(
      { overrides: [{ fieldId: "rule.red.serve", value: "x" }], status: "ok" },
      [],
    );
    expect(failures).toEqual([]);
  });

  test("alert bodies carry field ids only — no override prose", () => {
    const failures = curriculumHealthFailures(
      { overrides: [{ fieldId: "bad.id", value: "SOME COACH PROSE" }], status: "ok" },
      ["bad.id"],
    );
    expect(JSON.stringify(failures)).not.toContain("SOME COACH PROSE");
  });
});
