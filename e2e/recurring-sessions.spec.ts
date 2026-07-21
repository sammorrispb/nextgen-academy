import { test, expect } from "@playwright/test";
import { NextRequest } from "next/server";
import { FetchStub } from "./fixtures/fetch-stub";
import {
  upcomingWeekday,
  buildTemplateRowProps,
  templateTitlePrefixes,
  ensureWeeklyTemplates,
  parseDryRunParam,
  validateTemplate,
} from "../src/lib/recurring-sessions";
import {
  RECURRING_TEMPLATES,
  ALL_LEVELS,
  type RecurringTemplate,
} from "../src/data/recurring-templates";
import { GET as seedRoute } from "../src/app/api/cron/seed-tuesday-sessions/route";

// Pure-node spec (no dev server): date math + row-prop builders are pure, and
// the ensure loop's Notion traffic rides globalThis.fetch, which FetchStub
// intercepts.
//   npx playwright test e2e/recurring-sessions.spec.ts --project=desktop

const SESSIONS_DB = "sessions-db-test";

// A day-of-week sanity check that's UTC-anchored like the implementation.
function dayOfWeek(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

function template(titleBase: string): RecurringTemplate {
  const t = RECURRING_TEMPLATES.find((t) => t.titleBase === titleBase);
  if (!t) throw new Error(`no template ${titleBase}`);
  return t;
}

// The four weeknight templates were retired to `active: false` in the
// 2026-07-21 weekend move, but the SEEDER LOGIC (idempotency, drift, 429
// retry, fail-soft) is unchanged and still worth exercising. These tests
// inject an active-weeknight fixture so they test the loop, not the data
// file's current active flags. (Mon/Tue/Wed = all four levels, Thu = Green/
// Yellow → 4+4+4+2 = 14 rows/week.)
const WEEKNIGHT_FIXTURE: RecurringTemplate[] = RECURRING_TEMPLATES.filter(
  (t) => t.weekday >= 1 && t.weekday <= 4,
).map((t) => ({ ...t, active: true }));

/** A Notion query result page carrying just what the dedup matcher reads.
 * `start` defaults to the template time so only drift tests differ. */
function notionPage(
  title: string,
  date: string,
  level: string,
  status = "Open",
  start = "6:30 PM",
) {
  return {
    properties: {
      Session: { title: [{ plain_text: title }] },
      Date: { date: { start: date } },
      Level: { select: { name: level } },
      Status: { select: { name: status } },
      "Start time": { rich_text: [{ plain_text: start }] },
    },
  };
}

const EMPTY_QUERY = { results: [], has_more: false, next_cursor: null };

test.describe("upcomingWeekday", () => {
  test("returns exactly `count` dates, all on the requested weekday, ascending, weekly", () => {
    const out = upcomingWeekday(2, "2026-06-05", 8); // Fri Jun 5 → Tuesdays
    expect(out).toHaveLength(8);
    expect(out.every((d) => dayOfWeek(d) === 2)).toBe(true);
    expect(out[0]).toBe("2026-06-09"); // next Tuesday after Fri Jun 5
    expect(out[1]).toBe("2026-06-16");
    expect(out[7]).toBe("2026-07-28");
    expect([...out].sort()).toEqual(out); // strictly ascending
  });

  test("works for every template weekday (Mon–Thu)", () => {
    // Fri 2026-07-03 → Mon 7/6, Tue 7/7, Wed 7/8, Thu 7/9
    expect(upcomingWeekday(1, "2026-07-03", 1)).toEqual(["2026-07-06"]);
    expect(upcomingWeekday(2, "2026-07-03", 1)).toEqual(["2026-07-07"]);
    expect(upcomingWeekday(3, "2026-07-03", 1)).toEqual(["2026-07-08"]);
    expect(upcomingWeekday(4, "2026-07-03", 1)).toEqual(["2026-07-09"]);
  });

  test("min lead: a run ON the requested weekday never yields today — next week instead", () => {
    // F3: same-day seeding raced the permit window; seeded dates must be
    // strictly AFTER the run date. A Tuesday run yields next Tuesday.
    const out = upcomingWeekday(2, "2026-06-09", 3); // Tue
    expect(out).toEqual(["2026-06-16", "2026-06-23", "2026-06-30"]);
    expect(out).not.toContain("2026-06-09");
    expect(upcomingWeekday(4, "2026-07-02", 2)).toEqual(["2026-07-09", "2026-07-16"]); // Thu
    // A Monday run never yields today's Monday (the spec's canonical case).
    expect(upcomingWeekday(1, "2026-07-06", 1)).toEqual(["2026-07-13"]);
  });

  test("crosses a month boundary correctly", () => {
    // 2026-06-30 IS a Tuesday — min lead pushes to July.
    expect(upcomingWeekday(2, "2026-06-30", 2)).toEqual(["2026-07-07", "2026-07-14"]);
    expect(upcomingWeekday(2, "2026-06-29", 2)).toEqual(["2026-06-30", "2026-07-07"]);
  });

  test("returns [] on bad input, non-positive count, or invalid weekday", () => {
    expect(upcomingWeekday(2, "not-a-date", 4)).toEqual([]);
    expect(upcomingWeekday(2, "2026-06-09", 0)).toEqual([]);
    expect(upcomingWeekday(7, "2026-06-09", 4)).toEqual([]);
    expect(upcomingWeekday(-1, "2026-06-09", 4)).toEqual([]);
    expect(upcomingWeekday(2.5, "2026-06-09", 4)).toEqual([]);
  });
});

test.describe("recurring templates (weekend move 2026-07-21)", () => {
  test("nothing auto-seeds right now — every template is inactive (Aug weekend block is hand-seeded)", () => {
    // The Aug 2026 weekend run has holes the weekly cron can't express (Sam is
    // away Aug 8–16; the block starts Aug 1), so it's hand-seeded in Notion and
    // all templates stay inactive. Flip the weekend templates active to resume
    // open-ended auto-seeding once the cadence runs gap-free.
    expect(RECURRING_TEMPLATES.every((t) => t.active === false)).toBe(true);
  });

  test("weekend format: Wood Sat + Walter Johnson Sun, Red/Orange 6–7 then Green/Yellow 7–8", () => {
    const sat = RECURRING_TEMPLATES.filter((t) => t.titleBase === "Wood Saturday Evening");
    expect(sat.map((t) => t.weekday)).toEqual([6, 6]);
    const [satEarly, satLate] = sat;
    expect(satEarly.startTime).toBe("6:00 PM");
    expect(satEarly.endTime).toBe("7:00 PM");
    expect(satEarly.levels).toEqual(["Red", "Orange"]);
    expect(satLate.startTime).toBe("7:00 PM");
    expect(satLate.endTime).toBe("8:00 PM");
    expect(satLate.levels).toEqual(["Green", "Yellow"]);
    expect(satEarly.location).toContain("Earle B. Wood");
    expect(satEarly.publicArea).toBe("Rockville, MD");

    const sun = RECURRING_TEMPLATES.filter(
      (t) => t.titleBase === "Walter Johnson Sunday Evening",
    );
    expect(sun.map((t) => t.weekday)).toEqual([0, 0]);
    expect(sun[0].levels).toEqual(["Red", "Orange"]);
    expect(sun[0].startTime).toBe("6:00 PM");
    expect(sun[1].levels).toEqual(["Green", "Yellow"]);
    expect(sun[1].startTime).toBe("7:00 PM");
    expect(sun[0].location).toContain("Walter Johnson");
    expect(sun[0].publicArea).toBe("Bethesda, MD");
  });

  test("retired weeknight templates are retained (row-family idempotency) but inactive", () => {
    const weeknights = RECURRING_TEMPLATES.filter((t) => t.weekday >= 1 && t.weekday <= 4);
    expect(weeknights.map((t) => t.titleBase)).toEqual([
      "Ridgeview Monday Evening",
      "Redland Tuesday Evening",
      "Westland Wednesday Evening",
      "Shannon Thursday Evening",
    ]);
    expect(weeknights.map((t) => t.weekday)).toEqual([1, 2, 3, 4]);
    expect(weeknights.every((t) => t.active === false)).toBe(true);
    // Redland keeps its legacy Olney prefix so old rows still match.
    expect(templateTitlePrefixes(template("Redland Tuesday Evening"))).toEqual([
      "Redland Tuesday Evening",
      "Olney Tuesday Evening",
    ]);
    // Thursday stayed Green/Yellow only.
    expect(template("Shannon Thursday Evening").levels).toEqual(["Green", "Yellow"]);
  });
});

test.describe("buildTemplateRowProps", () => {
  test("builds the row from the template's own fields", () => {
    const tue = template("Redland Tuesday Evening");
    const props = buildTemplateRowProps(tue, "2026-07-07", "Red");
    expect(props.Session.title[0].text.content).toBe("Redland Tuesday Evening — Red");
    expect(props.Level.select.name).toBe("Red");
    expect(props.Date.date.start).toBe("2026-07-07");
    expect(props["Start time"].rich_text[0].text.content).toBe("6:30 PM");
    expect(props["End time"].rich_text[0].text.content).toBe("7:30 PM");
    expect(props["Court count"].number).toBe(1);
    expect(props["Max courts"].number).toBe(2);
    expect(props.Location.rich_text[0].text.content).toBe(tue.location);
    expect(props["Public Area"].rich_text[0].text.content).toBe("Derwood, MD");
    expect(props.Status.select.name).toBe("Open");

    const thu = template("Shannon Thursday Evening");
    const thuProps = buildTemplateRowProps(thu, "2026-07-09", "Green");
    expect(thuProps.Session.title[0].text.content).toBe("Shannon Thursday Evening — Green");
    expect(thuProps["Max courts"].number).toBe(3);
    expect(thuProps["Public Area"].rich_text[0].text.content).toBe("Silver Spring, MD");
  });

  test("covers all four levels", () => {
    expect(ALL_LEVELS).toEqual(["Red", "Orange", "Green", "Yellow"]);
    const mon = template("Ridgeview Monday Evening");
    for (const level of ALL_LEVELS) {
      expect(buildTemplateRowProps(mon, "2026-07-06", level).Level.select.name).toBe(level);
    }
  });
});

test.describe("ensureWeeklyTemplates", () => {
  const stub = new FetchStub();
  test.beforeEach(() => {
    stub.reset();
    stub.install();
    process.env.NOTION_API_KEY = "ntn_test";
    process.env.NOTION_SESSIONS_DB_ID = SESSIONS_DB;
  });
  test.afterEach(() => stub.uninstall());

  // Fri 2026-07-03 → Mon 7/6, Tue 7/7, Wed 7/8, Thu 7/9.
  const TODAY = "2026-07-03";

  test("empty DB → seeds every active template's levels for one week (4+4+4+2 = 14 rows), Thursday only Green/Yellow", async () => {
    stub.on(`/databases/${SESSIONS_DB}/query`, EMPTY_QUERY).on("/pages", { id: "new" });
    const result = await ensureWeeklyTemplates(TODAY, 1, { templates: WEEKNIGHT_FIXTURE, throttleMs: 0 });
    expect(result.created).toHaveLength(14);
    expect(result.failed).toEqual([]);
    expect(result.skipped).toBe(0);
    expect(stub.callsTo("/pages")).toHaveLength(14);
    // Thursday seeds ONLY Green/Yellow.
    const thursdayCreates = result.created.filter((c) => c.includes("2026-07-09"));
    expect(thursdayCreates).toHaveLength(2);
    expect(thursdayCreates.join(" ")).toContain("Green");
    expect(thursdayCreates.join(" ")).toContain("Yellow");
    expect(thursdayCreates.some((c) => c.endsWith("— Red"))).toBe(false);
    expect(thursdayCreates.some((c) => c.endsWith("— Orange"))).toBe(false);
    // Every create POST targets the Sessions DB parent.
    for (const call of stub.callsTo("/pages")) {
      expect(call.body).toContain(SESSIONS_DB);
    }
  });

  test("a row matching a LEGACY title prefix blocks that date|level (hand-created Olney row)", async () => {
    stub
      .on(`/databases/${SESSIONS_DB}/query`, {
        results: [notionPage("Olney Tuesday Evening — Red", "2026-07-07", "Red")],
        has_more: false,
        next_cursor: null,
      })
      .on("/pages", { id: "new" });
    const result = await ensureWeeklyTemplates(TODAY, 1, { templates: WEEKNIGHT_FIXTURE, throttleMs: 0 });
    expect(result.skipped).toBe(1);
    expect(result.created).toHaveLength(13);
    expect(result.created.some((c) => c.includes("2026-07-07") && c.endsWith("— Red"))).toBe(false);
    // No create body may target Tuesday-Red.
    for (const call of stub.callsTo("/pages")) {
      const body = JSON.parse(call.body);
      const isTueRed =
        body.properties.Date.date.start === "2026-07-07" &&
        body.properties.Level.select.name === "Red";
      expect(isTueRed).toBe(false);
    }
  });

  test("a CANCELLED row still counts as present — never resurrected", async () => {
    stub
      .on(`/databases/${SESSIONS_DB}/query`, {
        results: [
          notionPage("Redland Tuesday Evening — Orange", "2026-07-07", "Orange", "Cancelled"),
        ],
        has_more: false,
        next_cursor: null,
      })
      .on("/pages", { id: "new" });
    const result = await ensureWeeklyTemplates(TODAY, 1, { templates: WEEKNIGHT_FIXTURE, throttleMs: 0 });
    expect(result.skipped).toBe(1);
    expect(result.created.some((c) => c.includes("2026-07-07") && c.endsWith("— Orange"))).toBe(
      false,
    );
    for (const call of stub.callsTo("/pages")) {
      const body = JSON.parse(call.body);
      const isTueOrange =
        body.properties.Date.date.start === "2026-07-07" &&
        body.properties.Level.select.name === "Orange";
      expect(isTueOrange).toBe(false);
    }
  });

  test("fail-soft per row: one bad create doesn't abort the rest", async () => {
    stub.on(`/databases/${SESSIONS_DB}/query`, EMPTY_QUERY).onDynamic("/pages", (call) => {
      const body = JSON.parse(call.body);
      // Every "Red" create is rejected; everything else lands.
      return body.properties.Level.select.name === "Red"
        ? { status: 500, json: { message: "boom" } }
        : { status: 200, json: { id: "new" } };
    });
    const result = await ensureWeeklyTemplates(TODAY, 1, { templates: WEEKNIGHT_FIXTURE, throttleMs: 0 });
    // Mon/Tue/Wed each attempt Red and fail; the other 11 rows still land.
    expect(result.failed).toHaveLength(3);
    expect(result.failed.every((f) => f.endsWith("— Red"))).toBe(true);
    expect(result.created).toHaveLength(11);
    expect(stub.callsTo("/pages")).toHaveLength(14); // kept going after each failure
  });

  test("dryRun writes NOTHING and returns the would-create list", async () => {
    stub.on(`/databases/${SESSIONS_DB}/query`, {
      results: [notionPage("Redland Tuesday Evening — Red", "2026-07-07", "Red")],
      has_more: false,
      next_cursor: null,
    });
    // Deliberately no /pages rule: any create attempt would throw loudly.
    const result = await ensureWeeklyTemplates(TODAY, 1, {
      templates: WEEKNIGHT_FIXTURE,
      dryRun: true,
      throttleMs: 0,
    });
    expect(result.dryRun).toBe(true);
    expect(stub.callsTo("/pages")).toHaveLength(0);
    expect(result.created).toEqual([]);
    expect(result.wouldCreate).toHaveLength(13); // 14 minus the existing Tue-Red
    expect(result.skipped).toBe(1);
    expect(result.wouldCreate.some((c) => c.includes("2026-07-07") && c.endsWith("— Red"))).toBe(
      false,
    );
  });

  test("an inactive template seeds nothing (and its dates aren't attempted)", async () => {
    const templates = WEEKNIGHT_FIXTURE.map((t) =>
      t.titleBase === "Shannon Thursday Evening" ? { ...t, active: false } : t,
    );
    stub.on(`/databases/${SESSIONS_DB}/query`, EMPTY_QUERY).on("/pages", { id: "new" });
    const result = await ensureWeeklyTemplates(TODAY, 1, { templates, throttleMs: 0 });
    expect(result.created).toHaveLength(12); // 14 minus Thursday's Green/Yellow
    expect(result.created.some((c) => c.includes("Shannon"))).toBe(false);
    for (const call of stub.callsTo("/pages")) {
      expect(call.body).not.toContain("Shannon Thursday Evening");
    }
  });

  test("missing env → config_missing failure entry, never a green no-op (F4)", async () => {
    delete process.env.NOTION_SESSIONS_DB_ID;
    const result = await ensureWeeklyTemplates(TODAY, 1, { templates: WEEKNIGHT_FIXTURE, throttleMs: 0 });
    expect(result.created).toEqual([]);
    expect(result.skipped).toBe(0);
    expect(stub.calls).toHaveLength(0);
    expect(result.failures).toHaveLength(1);
    expect(result.failures[0].signature).toBe("config_missing");
    expect(result.failures[0].detail).toContain("NOTION_SESSIONS_DB_ID");
  });

  test("both env vars missing → config_missing names both", async () => {
    delete process.env.NOTION_API_KEY;
    delete process.env.NOTION_SESSIONS_DB_ID;
    const result = await ensureWeeklyTemplates(TODAY, 1, { templates: WEEKNIGHT_FIXTURE, throttleMs: 0 });
    expect(result.failures).toHaveLength(1);
    expect(result.failures[0].signature).toBe("config_missing");
    expect(result.failures[0].detail).toContain("NOTION_API_KEY");
    expect(result.failures[0].detail).toContain("NOTION_SESSIONS_DB_ID");
    expect(stub.calls).toHaveLength(0);
  });

  test("existence keys are scoped per template FAMILY: a Monday-family row hand-moved onto a Tuesday date does not suppress the Tuesday seed (F2)", async () => {
    stub
      .on(`/databases/${SESSIONS_DB}/query`, {
        // A Ridgeview MONDAY row sitting on Tuesday 7/7 — same date|level as
        // the Tuesday-Red seed, but a different family.
        results: [notionPage("Ridgeview Monday Evening — Red", "2026-07-07", "Red")],
        has_more: false,
        next_cursor: null,
      })
      .on("/pages", { id: "new" });
    const result = await ensureWeeklyTemplates(TODAY, 1, { templates: WEEKNIGHT_FIXTURE, throttleMs: 0 });
    // All 14 rows still seed — including Tuesday Red.
    expect(result.skipped).toBe(0);
    expect(result.created).toHaveLength(14);
    expect(
      result.created.some((c) => c.includes("2026-07-07") && c.endsWith("— Red")),
    ).toBe(true);
  });

  test("never-resurrect stays WITHIN the family: a Cancelled Tuesday-family row still suppresses only the Tuesday seed", async () => {
    stub
      .on(`/databases/${SESSIONS_DB}/query`, {
        results: [
          notionPage("Olney Tuesday Evening — Red", "2026-07-07", "Red", "Cancelled"),
        ],
        has_more: false,
        next_cursor: null,
      })
      .on("/pages", { id: "new" });
    const result = await ensureWeeklyTemplates(TODAY, 1, { templates: WEEKNIGHT_FIXTURE, throttleMs: 0 });
    expect(result.skipped).toBe(1);
    expect(result.created).toHaveLength(13);
    expect(
      result.created.some((c) => c.includes("2026-07-07") && c.endsWith("— Red")),
    ).toBe(false);
  });

  test("time drift: an existing seeded row whose start time differs from the template rolls up into ONE time_drift failure entry (F7)", async () => {
    stub
      .on(`/databases/${SESSIONS_DB}/query`, {
        results: [
          // Two drifted rows (the live 6:00 PM August-class rows) + one clean.
          notionPage("Redland Tuesday Evening — Red", "2026-07-07", "Red", "Open", "6:00 PM"),
          notionPage("Redland Tuesday Evening — Orange", "2026-07-07", "Orange", "Open", "6:00 PM"),
          notionPage("Redland Tuesday Evening — Green", "2026-07-07", "Green", "Open", "6:30 PM"),
        ],
        has_more: false,
        next_cursor: null,
      })
      .on("/pages", { id: "new" });
    const result = await ensureWeeklyTemplates(TODAY, 1, { templates: WEEKNIGHT_FIXTURE, throttleMs: 0 });
    expect(result.skipped).toBe(3);
    const drift = result.failures.filter((f) => f.signature === "time_drift");
    expect(drift).toHaveLength(1); // rolled up, not per-row
    expect(drift[0].detail).toContain("6:00 PM"); // actual
    expect(drift[0].detail).toContain("6:30 PM"); // expected
    expect(drift[0].detail).toContain("2026-07-07");
    expect(drift[0].detail).toContain("Red");
    expect(drift[0].detail).toContain("Orange");
    expect(drift[0].detail).not.toContain("Green"); // clean row doesn't alert
    // Drift is a SIGNAL only — the existing rows are never auto-corrected.
    for (const call of stub.calls) {
      expect(call.method).not.toBe("PATCH");
    }
  });

  test("matching-time skips produce NO time_drift entry", async () => {
    stub
      .on(`/databases/${SESSIONS_DB}/query`, {
        results: [notionPage("Redland Tuesday Evening — Red", "2026-07-07", "Red")],
        has_more: false,
        next_cursor: null,
      })
      .on("/pages", { id: "new" });
    const result = await ensureWeeklyTemplates(TODAY, 1, { templates: WEEKNIGHT_FIXTURE, throttleMs: 0 });
    expect(result.failures).toEqual([]);
  });

  test("invalid template config → config_invalid failure naming the template; valid templates still seed (F8)", async () => {
    const badWeekday = {
      ...template("Ridgeview Monday Evening"),
      titleBase: "Broken Monday Evening",
      legacyTitlePrefixes: ["Broken Monday Evening"],
      weekday: 9 as unknown as RecurringTemplate["weekday"],
    };
    const badTime = {
      ...template("Westland Wednesday Evening"),
      titleBase: "Broken Wednesday Evening",
      legacyTitlePrefixes: ["Broken Wednesday Evening"],
      startTime: "six thirty",
    };
    const badLevels = {
      ...template("Shannon Thursday Evening"),
      titleBase: "Broken Thursday Evening",
      legacyTitlePrefixes: ["Broken Thursday Evening"],
      levels: [] as unknown as RecurringTemplate["levels"],
    };
    const templates = [
      badWeekday,
      { ...template("Redland Tuesday Evening"), active: true },
      badTime,
      badLevels,
    ];
    stub.on(`/databases/${SESSIONS_DB}/query`, EMPTY_QUERY).on("/pages", { id: "new" });
    const result = await ensureWeeklyTemplates(TODAY, 1, { templates, throttleMs: 0 });
    const invalid = result.failures.filter((f) => f.signature === "config_invalid");
    expect(invalid).toHaveLength(3);
    const named = invalid.map((f) => f.ref).sort();
    expect(named).toEqual([
      "Broken Monday Evening",
      "Broken Thursday Evening",
      "Broken Wednesday Evening",
    ]);
    // The valid Tuesday template still seeded its 4 level rows.
    expect(result.created).toHaveLength(4);
    expect(result.created.every((c) => c.includes("Redland Tuesday Evening"))).toBe(true);
  });

  test("validateTemplate (pure) flags weekday/levels/times/titleBase problems", () => {
    const good = template("Redland Tuesday Evening");
    expect(validateTemplate(good)).toEqual([]);
    expect(
      validateTemplate({ ...good, weekday: 7 as unknown as RecurringTemplate["weekday"] }).join(" "),
    ).toContain("weekday");
    expect(validateTemplate({ ...good, titleBase: "  " }).join(" ")).toContain("titleBase");
    expect(
      validateTemplate({ ...good, levels: [] as unknown as RecurringTemplate["levels"] }).join(" "),
    ).toContain("levels");
    expect(validateTemplate({ ...good, startTime: "1830" }).join(" ")).toContain("startTime");
    expect(validateTemplate({ ...good, endTime: "" }).join(" ")).toContain("endTime");
  });

  test("429 on create → ONE retry with backoff; retry success counts as created (F9)", async () => {
    let tueRedAttempts = 0;
    stub.on(`/databases/${SESSIONS_DB}/query`, EMPTY_QUERY).onDynamic("/pages", (call) => {
      const body = JSON.parse(call.body);
      const isTueRed =
        body.properties.Date.date.start === "2026-07-07" &&
        body.properties.Level.select.name === "Red";
      if (isTueRed) {
        tueRedAttempts += 1;
        if (tueRedAttempts === 1) return { status: 429, json: { message: "rate limited" } };
      }
      return { status: 200, json: { id: "new" } };
    });
    const result = await ensureWeeklyTemplates(TODAY, 1, { templates: WEEKNIGHT_FIXTURE, throttleMs: 0 });
    expect(tueRedAttempts).toBe(2); // first attempt 429'd, retry landed
    expect(result.created).toHaveLength(14);
    expect(result.failed).toEqual([]);
    expect(stub.callsTo("/pages")).toHaveLength(15); // 14 rows + 1 retry
  });

  test("persistent 429 → exactly one retry then fail-soft; siblings still land", async () => {
    stub.on(`/databases/${SESSIONS_DB}/query`, EMPTY_QUERY).onDynamic("/pages", (call) => {
      const body = JSON.parse(call.body);
      const isTueRed =
        body.properties.Date.date.start === "2026-07-07" &&
        body.properties.Level.select.name === "Red";
      return isTueRed
        ? { status: 429, json: { message: "rate limited" } }
        : { status: 200, json: { id: "new" } };
    });
    const result = await ensureWeeklyTemplates(TODAY, 1, { templates: WEEKNIGHT_FIXTURE, throttleMs: 0 });
    expect(result.failed).toHaveLength(1);
    expect(result.failed[0]).toContain("Redland Tuesday Evening — Red");
    expect(result.created).toHaveLength(13);
    // 13 clean creates + 2 attempts for the stuck row = 15 total, no more.
    expect(stub.callsTo("/pages")).toHaveLength(15);
  });
});

test.describe("parseDryRunParam (F6, pure)", () => {
  test("accepts 1/true/yes case-insensitively", () => {
    for (const raw of ["1", "true", "TRUE", "yes", "Yes", "YES", "True"]) {
      expect(parseDryRunParam(raw)).toEqual({ ok: true, dryRun: true });
    }
  });
  test("absent or empty → live run", () => {
    expect(parseDryRunParam(null)).toEqual({ ok: true, dryRun: false });
    expect(parseDryRunParam("")).toEqual({ ok: true, dryRun: false });
  });
  test("any other non-empty value is rejected — never silently live", () => {
    for (const raw of ["0", "false", "2", "dry", " 1", "yes "]) {
      const parsed = parseDryRunParam(raw);
      expect(parsed.ok).toBe(false);
    }
  });
});

test.describe("seed route dryRun handling (F6, route-level)", () => {
  const stub = new FetchStub();
  test.beforeEach(() => {
    stub.reset();
    stub.install();
    process.env.CRON_SECRET = "test-cron-secret";
    process.env.NOTION_API_KEY = "ntn_test";
    process.env.NOTION_SESSIONS_DB_ID = SESSIONS_DB;
  });
  test.afterEach(() => stub.uninstall());

  function seedReq(query: string): NextRequest {
    return new NextRequest(`http://localhost/api/cron/seed-tuesday-sessions${query}`, {
      headers: { authorization: "Bearer test-cron-secret" },
    });
  }

  test("unrecognized dryRun value → 400, nothing runs (never silently live)", async () => {
    const res = await seedRoute(seedReq("?dryRun=nope"));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("dryRun must be 1|true|yes");
    expect(stub.calls).toHaveLength(0);
  });

  test("dryRun=TRUE and dryRun=yes plan without writing a single row", async () => {
    for (const q of ["?dryRun=TRUE", "?dryRun=yes"]) {
      stub.reset();
      stub.on(`/databases/${SESSIONS_DB}/query`, EMPTY_QUERY);
      // Deliberately no /pages rule: any create attempt throws loudly.
      const res = await seedRoute(seedReq(q));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.dryRun).toBe(true);
      // All live templates are inactive (weekend move — Aug is hand-seeded), so
      // the route plans zero rows; the invariant under test is that a dry run
      // writes NOTHING regardless of how many rows it would create.
      expect(Array.isArray(body.wouldCreate)).toBe(true);
      expect(stub.callsTo("/pages")).toHaveLength(0);
    }
  });
});
