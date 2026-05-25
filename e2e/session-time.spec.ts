import { test, expect } from "@playwright/test";
import {
  formatSessionDateTimeIso,
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
