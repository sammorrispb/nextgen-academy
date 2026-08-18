import { test, expect } from "@playwright/test";
import {
  CALENDAR_LEVELS,
  buildDemandMatrix,
  buildMonthGrid,
  buildSupplyByDayLevel,
  fallEntriesForMonth,
  groupByDate,
  monthBounds,
  parseMonthParam,
  sessionsToEntries,
  shiftMonth,
  type CalendarEntry,
  type DemandRow,
} from "../src/lib/coach-calendar";
import type { CalendarSessionRow } from "../src/lib/notion-sessions";
import { FALL_SUNDAYS, FALL_RAIN_DATES, SLOTS_PER_GROUP } from "../src/data/fall-2026";

function sessionRow(over: Partial<CalendarSessionRow> = {}): CalendarSessionRow {
  return {
    id: "page-1",
    title: "Earle B. Wood MS — Early",
    date: "2026-09-05",
    startTime: "6:00 PM",
    endTime: "7:00 PM",
    level: "Green",
    location: "Earle B. Wood MS, Rockville",
    publicArea: "",
    capacity: 8,
    registeredCount: 3,
    status: "Open",
    ...over,
  };
}

function demandRow(over: Partial<DemandRow> = {}): DemandRow {
  return { level: "Green", age: 11, days: ["Tue"], area: "olney", ...over };
}

test.describe("month-grid math", () => {
  test("always returns 6 full weeks, Sunday-first", () => {
    for (const month of ["2026-01", "2026-02", "2026-08", "2027-02"]) {
      const weeks = buildMonthGrid(month);
      expect(weeks).toHaveLength(6);
      for (const week of weeks) expect(week).toHaveLength(7);
    }
  });

  test("flags in-month days correctly and stays contiguous", () => {
    const weeks = buildMonthGrid("2026-03");
    const flat = weeks.flat();
    expect(flat.filter((d) => d.inMonth)).toHaveLength(31);
    expect(flat[0].iso).toBe("2026-03-01"); // Mar 1 2026 IS a Sunday
    for (let i = 1; i < flat.length; i++) {
      const prev = Date.parse(`${flat[i - 1].iso}T12:00:00Z`);
      const cur = Date.parse(`${flat[i].iso}T12:00:00Z`);
      expect(cur - prev).toBe(86_400_000);
    }
  });

  // The regression this file exists for: date-only math done in local time
  // drops or duplicates a day across a DST boundary on a UTC build server.
  test("spans the US DST fallback without losing a day", () => {
    const nov = buildMonthGrid("2026-11").flat();
    expect(nov.filter((d) => d.inMonth)).toHaveLength(30);
    expect(nov.filter((d) => d.iso === "2026-11-01")).toHaveLength(1);
    const march = buildMonthGrid("2026-03").flat();
    expect(march.filter((d) => d.iso === "2026-03-08")).toHaveLength(1);
  });

  test("shiftMonth rolls across year boundaries in both directions", () => {
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftMonth("2026-06", 0)).toBe("2026-06");
    expect(shiftMonth("2026-01", -13)).toBe("2024-12");
    expect(shiftMonth("2026-11", 14)).toBe("2028-01");
  });

  test("monthBounds handles 30/31-day months and February", () => {
    expect(monthBounds("2026-02")).toEqual({
      firstIso: "2026-02-01",
      lastIso: "2026-02-28",
    });
    expect(monthBounds("2028-02").lastIso).toBe("2028-02-29"); // leap year
    expect(monthBounds("2026-09").lastIso).toBe("2026-09-30");
    expect(monthBounds("2026-12").lastIso).toBe("2026-12-31");
  });

  test("parseMonthParam falls back to today's month on anything invalid", () => {
    const today = "2026-08-18";
    expect(parseMonthParam("2026-03", today)).toBe("2026-03");
    expect(parseMonthParam(undefined, today)).toBe("2026-08");
    expect(parseMonthParam("", today)).toBe("2026-08");
    expect(parseMonthParam("garbage", today)).toBe("2026-08");
    expect(parseMonthParam("2026-13", today)).toBe("2026-08");
    expect(parseMonthParam("2026-00", today)).toBe("2026-08");
    expect(parseMonthParam("2026-3", today)).toBe("2026-08");
  });
});

test.describe("entry normalization", () => {
  test("carries level, fill and a coach link — and no child fields", () => {
    const [entry] = sessionsToEntries([sessionRow()]);
    expect(entry.level).toBe("Green");
    expect(entry.timeLabel).toBe("6:00 PM – 7:00 PM");
    expect(entry.registered).toBe(3);
    expect(entry.capacity).toBe(8);
    expect(entry.href).toBe("/coach/earle-b-wood-ms-2026-09-05-early");
    expect(entry.source).toBe("session");
    expect(Object.keys(entry)).not.toContain("roster");
    expect(Object.keys(entry)).not.toContain("ageStats");
  });

  test("a row with no Level select becomes an unassigned entry, not a crash", () => {
    const [entry] = sessionsToEntries([sessionRow({ level: null })]);
    expect(entry.level).toBeNull();
    const supply = buildSupplyByDayLevel([entry]);
    for (const level of CALENDAR_LEVELS) {
      expect(supply.Sat[level]).toBe(0);
    }
  });

  test("an unpublished start time yields an empty label, never an invented one", () => {
    const [entry] = sessionsToEntries([sessionRow({ startTime: "", endTime: "" })]);
    expect(entry.timeLabel).toBe("");
  });

  test("fall Sundays render both color blocks; rain dates are tentative", () => {
    const sept = fallEntriesForMonth("2026-09");
    const septSundays = FALL_SUNDAYS.filter((d) => d.startsWith("2026-09"));
    expect(sept).toHaveLength(septSundays.length * 2);
    expect(sept.every((e) => e.status === "Open")).toBe(true);
    expect(sept.map((e) => e.level)).toContain("Green");
    expect(sept.map((e) => e.level)).toContain("Yellow");
    // Fall seats live only in Stripe metadata — capacity is known, fill is not.
    expect(sept.every((e) => e.capacity === SLOTS_PER_GROUP)).toBe(true);
    expect(sept.every((e) => e.registered === null)).toBe(true);
    expect(sept.every((e) => e.href === null)).toBe(true);

    const nov = fallEntriesForMonth("2026-11");
    expect(nov).toHaveLength(FALL_RAIN_DATES.length * 2);
    expect(nov.every((e) => e.status === "Tentative")).toBe(true);

    expect(fallEntriesForMonth("2026-12")).toHaveLength(0);
  });

  test("groupByDate buckets by day and orders Red→Yellow", () => {
    const entries = sessionsToEntries([
      sessionRow({ id: "a", level: "Yellow", title: "Wood — Late" }),
      sessionRow({ id: "b", level: "Red", title: "Wood — Early" }),
      sessionRow({ id: "c", level: "Green", date: "2026-09-06" }),
    ]);
    const byDate = groupByDate(entries);
    expect(byDate.get("2026-09-05")?.map((e) => e.level)).toEqual([
      "Red",
      "Yellow",
    ]);
    expect(byDate.get("2026-09-06")).toHaveLength(1);
  });
});

test.describe("supply", () => {
  test("counts running groupings per weekday and level", () => {
    // 2026-09-05 is a Saturday, 2026-09-06 a Sunday.
    const supply = buildSupplyByDayLevel(
      sessionsToEntries([
        sessionRow({ id: "a", level: "Red" }),
        sessionRow({ id: "b", level: "Green" }),
        sessionRow({ id: "c", level: "Green", date: "2026-09-06" }),
      ]),
    );
    expect(supply.Sat.Red).toBe(1);
    expect(supply.Sat.Green).toBe(1);
    expect(supply.Sun.Green).toBe(1);
    expect(supply.Tue.Green).toBe(0);
  });

  test("a cancelled evening is not supply", () => {
    const supply = buildSupplyByDayLevel(
      sessionsToEntries([sessionRow({ status: "Cancelled" })]),
    );
    expect(supply.Sat.Green).toBe(0);
  });
});

test.describe("demand", () => {
  test("counts a family once per named preferred day", () => {
    const m = buildDemandMatrix([demandRow({ days: ["Tue", "Thu"] })]);
    expect(m.byDayLevel.Tue.Green).toBe(1);
    expect(m.byDayLevel.Thu.Green).toBe(1);
    expect(m.byDayLevel.Mon.Green).toBe(0);
    expect(m.byLevel.Green.total).toBe(1);
    expect(m.total).toBe(1);
  });

  test("tallies age bands via the league banding and tracks the age range", () => {
    const m = buildDemandMatrix([
      demandRow({ age: 6 }),
      demandRow({ age: 9 }),
      demandRow({ age: 11 }),
      demandRow({ age: 14 }),
      demandRow({ age: 16 }),
    ]);
    expect(m.byLevel.Green.bands["7U"]).toBe(1);
    expect(m.byLevel.Green.bands["10U"]).toBe(1);
    expect(m.byLevel.Green.bands["14U"]).toBe(2);
    expect(m.byLevel.Green.bands["16U"]).toBe(1);
    expect(m.byLevel.Green.minAge).toBe(6);
    expect(m.byLevel.Green.maxAge).toBe(16);
  });

  // A count that quietly omits rows reads as "nobody wants Tuesday" when it
  // actually means "nobody said" — both gaps must be reported, not dropped.
  test("reports dayless and ageless rows instead of swallowing them", () => {
    const m = buildDemandMatrix([
      demandRow({ days: [] }),
      demandRow({ age: null }),
      demandRow(),
    ]);
    expect(m.total).toBe(3);
    expect(m.dayless).toBe(1);
    expect(m.ageless).toBe(1);
    expect(m.byLevel.Green.total).toBe(3);
    // The dayless row still counts at its level, just not on the grid.
    expect(m.byDayLevel.Tue.Green).toBe(2);
  });

  test("an out-of-range age counts at its level but lands in no band", () => {
    const m = buildDemandMatrix([demandRow({ age: 40 })]);
    expect(m.byLevel.Green.total).toBe(1);
    expect(m.ageless).toBe(0);
    const banded = Object.values(m.byLevel.Green.bands).reduce((a, b) => a + b, 0);
    expect(banded).toBe(0);
  });

  test("an empty pool yields zeroes for every level and day, not undefined", () => {
    const m = buildDemandMatrix([]);
    expect(m.total).toBe(0);
    for (const level of CALENDAR_LEVELS) {
      expect(m.byLevel[level].total).toBe(0);
      expect(m.byLevel[level].minAge).toBeNull();
      expect(m.byDayLevel.Mon[level]).toBe(0);
    }
  });

  test("supply and demand share one weekday key space", () => {
    const entries: CalendarEntry[] = sessionsToEntries([sessionRow({ level: "Green" })]);
    const supply = buildSupplyByDayLevel(entries);
    const demand = buildDemandMatrix([demandRow({ days: ["Sat"] })]);
    expect(Object.keys(supply)).toEqual(Object.keys(demand.byDayLevel));
    expect(demand.byDayLevel.Sat.Green).toBe(1);
    expect(supply.Sat.Green).toBe(1);
  });
});
