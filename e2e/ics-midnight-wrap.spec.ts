import { test, expect } from "@playwright/test";
import { buildDropInIcs } from "../src/lib/email/ics";
import { parseSlotTimes } from "../src/lib/notion-eval-slots";

// F7 (PR #244 code review): an eval slot starting near midnight (e.g. the
// default +30min end on an 11:45 PM start) must NEVER emit a
// negative-duration VEVENT — when the computed end clock-time is earlier than
// the start, DTEND belongs on the NEXT calendar day. Pure clock/date
// arithmetic, fixed dates, no wall-clock dependence (run under TZ=UTC in CI).

function icsFor(date: string, startTime: string, endTime: string): string {
  const ics = buildDropInIcs({
    uid: `wrap-test-${date}@nextgenpbacademy.com`,
    date,
    startTime,
    endTime,
    title: "Wrap Test",
    location: "Cabin John MS",
    description: "midnight wrap spec",
  });
  expect(ics, "ics builds").not.toBeNull();
  return ics as string;
}

function dtValue(ics: string, prop: "DTSTART" | "DTEND"): string {
  const m = ics.match(new RegExp(`${prop};TZID=America/New_York:(\\d{8}T\\d{6})`));
  expect(m, `${prop} present`).toBeTruthy();
  return m![1];
}

test.describe("ics — midnight wrap (F7)", () => {
  test("11:45 PM slot with the default +30min end rolls DTEND to the next day", () => {
    // The Notion row: date-with-time start at 11:45 PM, no end → the slots
    // lib defaults a 30-minute eval ending 12:15 AM.
    const times = parseSlotTimes("2036-07-10T23:45:00.000-04:00", null);
    expect(times).toEqual({
      date: "2036-07-10",
      startTime: "11:45 PM",
      endTime: "12:15 AM",
    });

    const ics = icsFor(times!.date, times!.startTime, times!.endTime);
    expect(dtValue(ics, "DTSTART")).toBe("20360710T234500");
    expect(dtValue(ics, "DTEND"), "DTEND rolls to the NEXT day").toBe(
      "20360711T001500",
    );
  });

  test("month + year rollover: Dec 31 11:45 PM → DTEND Jan 1 of the next year", () => {
    const ics = icsFor("2036-12-31", "11:45 PM", "12:15 AM");
    expect(dtValue(ics, "DTSTART")).toBe("20361231T234500");
    expect(dtValue(ics, "DTEND")).toBe("20370101T001500");
  });

  test("leap-day rollover: Feb 28 11:45 PM in a leap year → Feb 29", () => {
    const ics = icsFor("2036-02-28", "11:45 PM", "12:15 AM");
    expect(dtValue(ics, "DTEND")).toBe("20360229T001500");
  });

  test("ordinary same-day event is unchanged (no rollover)", () => {
    const ics = icsFor("2036-07-10", "5:30 PM", "6:00 PM");
    expect(dtValue(ics, "DTSTART")).toBe("20360710T173000");
    expect(dtValue(ics, "DTEND")).toBe("20360710T180000");
  });

  test("DTEND is never before DTSTART (no negative-duration VEVENT)", () => {
    const cases: [string, string, string][] = [
      ["2036-07-10", "11:45 PM", "12:15 AM"],
      ["2036-07-10", "11:59 PM", "12:00 AM"],
      ["2036-07-10", "9:00 AM", "9:30 AM"],
    ];
    for (const [date, start, end] of cases) {
      const ics = icsFor(date, start, end);
      // The fixed-width local format sorts lexicographically.
      expect(
        dtValue(ics, "DTEND") > dtValue(ics, "DTSTART"),
        `${date} ${start}–${end} has positive duration`,
      ).toBe(true);
    }
  });

  test("email range strings render the wrap correctly (clock labels, no date math)", () => {
    const times = parseSlotTimes("2036-07-10T23:45:00.000-04:00", null);
    expect(`${times!.startTime}–${times!.endTime}`).toBe(
      "11:45 PM–12:15 AM",
    );
  });
});
