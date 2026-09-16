import { test, expect } from "@playwright/test";
import {
  isCancelledDay,
  partitionDays,
  partitionCamps,
} from "../src/lib/admin-sessions-view";
import { CAMPS } from "../src/data/camps";

test.describe("isCancelledDay", () => {
  test("every row Cancelled → cancelled day", () => {
    expect(isCancelledDay([{ status: "Cancelled" }, { status: "Cancelled" }])).toBe(true);
  });

  test("one row still Open keeps the day on offer", () => {
    expect(isCancelledDay([{ status: "Cancelled" }, { status: "Open" }])).toBe(false);
  });

  test("an empty day is not a cancelled day", () => {
    expect(isCancelledDay([])).toBe(false);
  });
});

test.describe("partitionDays", () => {
  test("splits fully-cancelled days out and keeps order", () => {
    const groups = [
      { date: "2026-09-16", rows: [{ status: "Cancelled" }, { status: "Cancelled" }] },
      { date: "2026-09-19", rows: [{ status: "Open" }] },
      { date: "2026-09-20", rows: [{ status: "Full" }, { status: "Cancelled" }] },
      { date: "2026-09-23", rows: [{ status: "Cancelled" }] },
    ];
    const { active, cancelled } = partitionDays(groups);
    expect(active.map((g) => g.date)).toEqual(["2026-09-19", "2026-09-20"]);
    expect(cancelled.map((g) => g.date)).toEqual(["2026-09-16", "2026-09-23"]);
  });
});

test.describe("partitionCamps", () => {
  const camp = (endDate: string, makeupDate = "") => ({ slug: endDate, endDate, makeupDate });

  test("a camp ending before today is past", () => {
    const { current, past } = partitionCamps([camp("2026-08-20", "2026-08-21")], "2026-09-16");
    expect(current).toEqual([]);
    expect(past.map((c) => c.slug)).toEqual(["2026-08-20"]);
  });

  test("a camp is current through its final day", () => {
    expect(partitionCamps([camp("2026-08-20")], "2026-08-20").current).toHaveLength(1);
  });

  test("the makeup Friday keeps a camp current one more day", () => {
    const { current } = partitionCamps([camp("2026-08-20", "2026-08-21")], "2026-08-21");
    expect(current).toHaveLength(1);
  });

  test("every camp on file is history as of 2026-09-16", () => {
    const { current, past } = partitionCamps(CAMPS, "2026-09-16");
    expect(current).toEqual([]);
    expect(past).toHaveLength(CAMPS.length);
  });
});
