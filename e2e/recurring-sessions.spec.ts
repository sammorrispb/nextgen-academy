import { test, expect } from "@playwright/test";
import {
  upcomingTuesdays,
  buildTuesdayRowProps,
  TUESDAY_LEVELS,
  TUESDAY_TITLE_BASE,
} from "../src/lib/recurring-sessions";

// A day-of-week sanity check that's UTC-anchored like the implementation.
function isTuesday(iso: string): boolean {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay() === 2;
}

test.describe("upcomingTuesdays", () => {
  test("returns exactly `weeks` dates, all Tuesdays, ascending, weekly", () => {
    const out = upcomingTuesdays("2026-06-05", 8); // Fri Jun 5
    expect(out).toHaveLength(8);
    expect(out.every(isTuesday)).toBe(true);
    expect(out[0]).toBe("2026-06-09"); // next Tuesday after Fri Jun 5
    expect(out[1]).toBe("2026-06-16");
    expect(out[7]).toBe("2026-07-28");
    // strictly ascending
    expect([...out].sort()).toEqual(out);
  });

  test("includes today when today IS a Tuesday", () => {
    const out = upcomingTuesdays("2026-06-09", 3); // Tue
    expect(out[0]).toBe("2026-06-09");
    expect(out).toEqual(["2026-06-09", "2026-06-16", "2026-06-23"]);
  });

  test("crosses a month boundary correctly", () => {
    const out = upcomingTuesdays("2026-06-30", 2); // Tue Jun 30
    expect(out).toEqual(["2026-06-30", "2026-07-07"]);
  });

  test("returns [] on bad input or non-positive weeks", () => {
    expect(upcomingTuesdays("not-a-date", 4)).toEqual([]);
    expect(upcomingTuesdays("2026-06-09", 0)).toEqual([]);
  });
});

test.describe("buildTuesdayRowProps", () => {
  test("builds a hidden-location Olney 6–7 PM row for the given level", () => {
    const props = buildTuesdayRowProps("2026-06-30", "Red");
    expect(props.Session.title[0].text.content).toBe(`${TUESDAY_TITLE_BASE} — Red`);
    expect(props.Level.select.name).toBe("Red");
    expect(props.Date.date.start).toBe("2026-06-30");
    expect(props["Start time"].rich_text[0].text.content).toBe("6:00 PM");
    expect(props["End time"].rich_text[0].text.content).toBe("7:00 PM");
    expect(props["Court count"].number).toBe(1);
    expect(props["Public Area"].rich_text[0].text.content).toBe("Olney, MD");
    expect(props.Status.select.name).toBe("Open");
    // Location is intentionally NOT set — hidden until the reveal cron.
    expect("Location" in props).toBe(false);
  });

  test("covers all four levels", () => {
    expect(TUESDAY_LEVELS).toEqual(["Red", "Orange", "Green", "Yellow"]);
    for (const level of TUESDAY_LEVELS) {
      expect(buildTuesdayRowProps("2026-06-30", level).Level.select.name).toBe(level);
    }
  });
});
