import { test, expect } from "@playwright/test";
import {
  formatSessionDateTimeIso,
  isSessionEnded,
  lifecycleStatusFor,
  parseStartTime,
} from "../src/lib/session-time";

test.describe("formatSessionDateTimeIso", () => {
  test("EDT date emits -04:00 offset", () => {
    expect(formatSessionDateTimeIso("2026-05-30", "10:00 AM")).toBe(
      "2026-05-30T10:00:00-04:00",
    );
  });

  test("PM converts to 24-hour clock", () => {
    expect(formatSessionDateTimeIso("2026-05-30", "4:30 PM")).toBe(
      "2026-05-30T16:30:00-04:00",
    );
  });

  test("12 AM is hour 00, 12 PM is hour 12", () => {
    expect(formatSessionDateTimeIso("2026-05-30", "12:00 AM")).toBe(
      "2026-05-30T00:00:00-04:00",
    );
    expect(formatSessionDateTimeIso("2026-05-30", "12:00 PM")).toBe(
      "2026-05-30T12:00:00-04:00",
    );
  });

  test("EST date emits -05:00 offset", () => {
    expect(formatSessionDateTimeIso("2026-01-15", "10:00 AM")).toBe(
      "2026-01-15T10:00:00-05:00",
    );
  });

  test("output is a valid Schema.org ISO 8601 datetime", () => {
    const iso = formatSessionDateTimeIso("2026-05-30", "10:00 AM");
    expect(iso).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/);
    // Node Date should parse it without producing NaN.
    expect(Number.isNaN(new Date(iso!).getTime())).toBe(false);
  });

  test("unparseable startTime returns null", () => {
    expect(formatSessionDateTimeIso("2026-05-30", "10am")).toBe(null);
    expect(formatSessionDateTimeIso("2026-05-30", "")).toBe(null);
  });

  test("malformed dateIso returns null", () => {
    expect(formatSessionDateTimeIso("2026/05/30", "10:00 AM")).toBe(null);
    expect(formatSessionDateTimeIso("May 30 2026", "10:00 AM")).toBe(null);
  });
});

test.describe("parseStartTime (sanity)", () => {
  test("known good inputs", () => {
    expect(parseStartTime("10:00 AM")).toEqual({ h: 10, m: 0 });
    expect(parseStartTime("4:30 PM")).toEqual({ h: 16, m: 30 });
    expect(parseStartTime("12:00 AM")).toEqual({ h: 0, m: 0 });
    expect(parseStartTime("12:00 PM")).toEqual({ h: 12, m: 0 });
  });
});

test.describe("isSessionEnded", () => {
  test("returns true once the end time has passed in ET", () => {
    // 20:00 UTC = 4 PM EDT, past an 11 AM ET end.
    expect(
      isSessionEnded("2026-05-30", "11:00 AM", new Date("2026-05-30T20:00:00Z")),
    ).toBe(true);
  });

  test("returns false before the end time", () => {
    // 12:00 UTC = 8 AM EDT, before an 11 AM ET end.
    expect(
      isSessionEnded("2026-05-30", "11:00 AM", new Date("2026-05-30T12:00:00Z")),
    ).toBe(false);
  });

  test("fails open (false) on an unparseable end time", () => {
    expect(
      isSessionEnded("2026-05-30", "11am", new Date("2026-05-30T20:00:00Z")),
    ).toBe(false);
    expect(
      isSessionEnded("2026-05-30", "", new Date("2026-05-30T20:00:00Z")),
    ).toBe(false);
  });
});

test.describe("lifecycleStatusFor", () => {
  test("Completed when anyone registered, Passed when none", () => {
    expect(lifecycleStatusFor(2)).toBe("Completed");
    expect(lifecycleStatusFor(0)).toBe("Passed");
    expect(lifecycleStatusFor(1)).toBe("Completed");
  });
});

test.describe("isSessionClosed", () => {
  test("ended Open session is closed", () => {
    expect(
      isSessionClosed("Open", "2026-05-30", "11:00 AM", new Date("2026-05-30T20:00:00Z")),
    ).toBe(true);
  });

  test("future Open session is not closed", () => {
    expect(
      isSessionClosed("Open", "2026-05-30", "11:00 AM", new Date("2026-05-30T12:00:00Z")),
    ).toBe(false);
  });

  test("terminal statuses are always closed", () => {
    expect(isSessionClosed("Completed", "2099-01-01", "10:00 AM")).toBe(true);
    expect(isSessionClosed("Passed", "2099-01-01", "10:00 AM")).toBe(true);
    expect(isSessionClosed("Cancelled", "2099-01-01", "10:00 AM")).toBe(true);
  });

  test("future Open with unparseable end time is not closed (fail-open)", () => {
    expect(
      isSessionClosed("Open", "2026-05-30", "noon", new Date("2026-05-30T12:00:00Z")),
    ).toBe(false);
  });
});
