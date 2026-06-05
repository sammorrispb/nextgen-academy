import { test, expect } from "@playwright/test";
import {
  validateEvalConfirmation,
  to12Hour,
  formatLongDate,
  formatShortDate,
} from "../src/lib/eval-confirmation-send";

const valid = {
  parentEmail: "hun_duong@yahoo.com",
  childFirst: "Zoe",
  date: "2026-06-09",
  startTime: "10:00 AM",
  endTime: "10:45 AM",
  location: "East Norbeck Local Park, 3131 Norbeck Rd, Silver Spring, MD 20906",
};

test.describe("validateEvalConfirmation", () => {
  test("passes a complete, well-formed request", () => {
    expect(validateEvalConfirmation(valid)).toEqual([]);
  });

  test("flags a bad email", () => {
    expect(validateEvalConfirmation({ ...valid, parentEmail: "nope" })).toContain(
      "parentEmail must be a valid email",
    );
  });

  test("flags a non-ISO date", () => {
    expect(validateEvalConfirmation({ ...valid, date: "6/9/2026" })).toContain(
      "date must be YYYY-MM-DD",
    );
  });

  test("flags a 24h start time (template expects 10:00 AM form)", () => {
    const errs = validateEvalConfirmation({ ...valid, startTime: "14:00" });
    expect(errs.some((e) => e.startsWith("startTime"))).toBe(true);
  });

  test("flags missing childFirst and location", () => {
    const errs = validateEvalConfirmation({ ...valid, childFirst: "", location: "" });
    expect(errs).toContain("childFirst is required");
    expect(errs).toContain("location is required");
  });
});

test.describe("to12Hour", () => {
  test("converts 24h to 12h with AM/PM", () => {
    expect(to12Hour("10:00")).toBe("10:00 AM");
    expect(to12Hour("14:05")).toBe("2:05 PM");
    expect(to12Hour("00:30")).toBe("12:30 AM");
    expect(to12Hour("12:00")).toBe("12:00 PM");
    expect(to12Hour("23:59")).toBe("11:59 PM");
  });

  test("returns null on malformed input", () => {
    expect(to12Hour("")).toBeNull();
    expect(to12Hour("25:00")).toBeNull();
    expect(to12Hour("10:99")).toBeNull();
    expect(to12Hour("10am")).toBeNull();
  });
});

test.describe("date formatting (UTC-anchored — no off-by-one)", () => {
  test("formatLongDate renders the correct weekday/day", () => {
    expect(formatLongDate("2026-06-09")).toBe("Tuesday, June 9, 2026");
  });

  test("formatShortDate renders the short form", () => {
    expect(formatShortDate("2026-06-09")).toBe("Tue, Jun 9");
  });
});
