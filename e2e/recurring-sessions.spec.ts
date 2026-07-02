import { test, expect } from "@playwright/test";
import { FetchStub } from "./fixtures/fetch-stub";
import {
  upcomingWeekday,
  buildTemplateRowProps,
  templateTitlePrefixes,
  ensureWeeklyTemplates,
} from "../src/lib/recurring-sessions";
import {
  RECURRING_TEMPLATES,
  ALL_LEVELS,
  type RecurringTemplate,
} from "../src/data/recurring-templates";

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

/** A Notion query result page carrying just what the dedup matcher reads. */
function notionPage(title: string, date: string, level: string, status = "Open") {
  return {
    properties: {
      Session: { title: [{ plain_text: title }] },
      Date: { date: { start: date } },
      Level: { select: { name: level } },
      Status: { select: { name: status } },
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

  test("includes today when today IS the requested weekday", () => {
    const out = upcomingWeekday(2, "2026-06-09", 3); // Tue
    expect(out).toEqual(["2026-06-09", "2026-06-16", "2026-06-23"]);
    expect(upcomingWeekday(4, "2026-07-02", 2)).toEqual(["2026-07-02", "2026-07-09"]); // Thu
  });

  test("crosses a month boundary correctly", () => {
    expect(upcomingWeekday(2, "2026-06-30", 2)).toEqual(["2026-06-30", "2026-07-07"]);
  });

  test("returns [] on bad input, non-positive count, or invalid weekday", () => {
    expect(upcomingWeekday(2, "not-a-date", 4)).toEqual([]);
    expect(upcomingWeekday(2, "2026-06-09", 0)).toEqual([]);
    expect(upcomingWeekday(7, "2026-06-09", 4)).toEqual([]);
    expect(upcomingWeekday(-1, "2026-06-09", 4)).toEqual([]);
    expect(upcomingWeekday(2.5, "2026-06-09", 4)).toEqual([]);
  });
});

test.describe("recurring templates (audit-verified 2026-07-01)", () => {
  test("all four weekday evenings exist, active, Mon–Thu", () => {
    expect(RECURRING_TEMPLATES.map((t) => t.titleBase)).toEqual([
      "Ridgeview Monday Evening",
      "Redland Tuesday Evening",
      "Westland Wednesday Evening",
      "Shannon Thursday Evening",
    ]);
    expect(RECURRING_TEMPLATES.map((t) => t.weekday)).toEqual([1, 2, 3, 4]);
    expect(RECURRING_TEMPLATES.every((t) => t.active)).toBe(true);
  });

  test("Tuesday runs 6:30–7:30 PM (MCPS permit #684275 covers 6:30+ only) and keeps the legacy Olney prefix", () => {
    const tue = template("Redland Tuesday Evening");
    expect(tue.startTime).toBe("6:30 PM");
    expect(tue.endTime).toBe("7:30 PM");
    expect(templateTitlePrefixes(tue)).toEqual([
      "Redland Tuesday Evening",
      "Olney Tuesday Evening",
    ]);
    expect(tue.location).toBe(
      "Redland Middle School Tennis Courts, 6505 Muncaster Mill Rd, Rockville, MD 20855",
    );
    expect(tue.publicArea).toBe("Derwood, MD");
    expect(tue.levels).toEqual(["Red", "Orange", "Green", "Yellow"]);
    expect(tue.maxCourts).toBe(2);
  });

  test("Mon/Wed run all four levels at max 2 courts; every evening is 6:30–7:30 PM", () => {
    for (const name of ["Ridgeview Monday Evening", "Westland Wednesday Evening"]) {
      const t = template(name);
      expect(t.levels).toEqual(["Red", "Orange", "Green", "Yellow"]);
      expect(t.maxCourts).toBe(2);
    }
    for (const t of RECURRING_TEMPLATES) {
      expect(t.startTime).toBe("6:30 PM");
      expect(t.endTime).toBe("7:30 PM");
    }
    expect(template("Ridgeview Monday Evening").location).toBe(
      "Ridgeview Middle School Tennis Courts, 16600 Raven Rock Dr, Gaithersburg, MD 20878",
    );
    expect(template("Ridgeview Monday Evening").publicArea).toBe("Gaithersburg, MD");
    expect(template("Westland Wednesday Evening").location).toBe(
      "Westland Middle School Tennis Courts, 5511 Massachusetts Ave, Bethesda, MD 20816",
    );
    expect(template("Westland Wednesday Evening").publicArea).toBe("Bethesda, MD");
  });

  test("Thursday (Shannon) seeds Green/Yellow ONLY, at max 3 courts", () => {
    const thu = template("Shannon Thursday Evening");
    expect(thu.levels).toEqual(["Green", "Yellow"]);
    expect(thu.maxCourts).toBe(3);
    expect(thu.location).toBe(
      "Odessa Shannon Middle School Tennis Courts, 11800 Monticello Ave, Silver Spring, MD 20902",
    );
    expect(thu.publicArea).toBe("Silver Spring, MD");
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
    const result = await ensureWeeklyTemplates(TODAY, 1);
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
    const result = await ensureWeeklyTemplates(TODAY, 1);
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
    const result = await ensureWeeklyTemplates(TODAY, 1);
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
    const result = await ensureWeeklyTemplates(TODAY, 1);
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
    const result = await ensureWeeklyTemplates(TODAY, 1, { dryRun: true });
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
    const inactiveThu: RecurringTemplate = { ...template("Shannon Thursday Evening"), active: false };
    const templates = RECURRING_TEMPLATES.map((t) =>
      t.titleBase === "Shannon Thursday Evening" ? inactiveThu : t,
    );
    stub.on(`/databases/${SESSIONS_DB}/query`, EMPTY_QUERY).on("/pages", { id: "new" });
    const result = await ensureWeeklyTemplates(TODAY, 1, { templates });
    expect(result.created).toHaveLength(12); // 14 minus Thursday's Green/Yellow
    expect(result.created.some((c) => c.includes("Shannon"))).toBe(false);
    for (const call of stub.callsTo("/pages")) {
      expect(call.body).not.toContain("Shannon Thursday Evening");
    }
  });

  test("missing env or zero weeks → no-op, no network", async () => {
    delete process.env.NOTION_SESSIONS_DB_ID;
    const result = await ensureWeeklyTemplates(TODAY, 1);
    expect(result.created).toEqual([]);
    expect(result.skipped).toBe(0);
    expect(stub.calls).toHaveLength(0);
  });
});
