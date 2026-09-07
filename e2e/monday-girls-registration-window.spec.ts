import { test, expect } from "@playwright/test";
import {
  MONDAY_GIRLS_REGISTRATION_CLOSES,
  mondayGirlsRegistrationOpen,
} from "../src/lib/monday-girls-registration-window";
import { MONDAY_GIRLS_MONDAYS } from "../src/data/monday-girls-2026";

// The three-leg registration gate. Pure and injected, so these pin the
// boundaries rather than the clock or the environment.

const OPEN = {
  todayIso: "2026-09-08",
  flag: undefined,
  priceConfigured: true,
};

test.describe("Monday Girls registration window — the price leg", () => {
  test("NO Stripe price ⇒ closed, whatever the flag and date say", () => {
    // The leg /picklpark doesn't have. Without it a hand-recruited parent can
    // fill in their child's birth year and only then meet a 503.
    expect(
      mondayGirlsRegistrationOpen({ ...OPEN, priceConfigured: false }),
    ).toBe(false);
    expect(
      mondayGirlsRegistrationOpen({
        ...OPEN,
        flag: "true",
        priceConfigured: false,
      }),
    ).toBe(false);
  });

  test("price configured ⇒ open on an in-window day", () => {
    expect(mondayGirlsRegistrationOpen(OPEN)).toBe(true);
  });
});

test.describe("Monday Girls registration window — the kill switch", () => {
  test("unset and 'true' both mean 'let the calendar decide'", () => {
    expect(mondayGirlsRegistrationOpen({ ...OPEN, flag: undefined })).toBe(true);
    expect(mondayGirlsRegistrationOpen({ ...OPEN, flag: "" })).toBe(true);
    expect(mondayGirlsRegistrationOpen({ ...OPEN, flag: "true" })).toBe(true);
    expect(mondayGirlsRegistrationOpen({ ...OPEN, flag: "  TRUE  " })).toBe(
      true,
    );
  });

  test("ANY other value closes — an operator setting this is trying to stop sales", () => {
    for (const flag of ["false", "False", "no", "0", "off", "ture", "yes"]) {
      expect(
        mondayGirlsRegistrationOpen({ ...OPEN, flag }),
        `flag "${flag}" should close registration`,
      ).toBe(false);
    }
  });
});

test.describe("Monday Girls registration window — the calendar", () => {
  test("closes after the FIRST session, not the last", () => {
    // A 6-session prepaid block: selling the full price in week four would
    // charge for sessions nobody delivered.
    expect(MONDAY_GIRLS_REGISTRATION_CLOSES).toBe(MONDAY_GIRLS_MONDAYS[0]);
  });

  test("open up to and including the first session day", () => {
    expect(
      mondayGirlsRegistrationOpen({ ...OPEN, todayIso: "2026-09-13" }),
    ).toBe(true);
    expect(
      mondayGirlsRegistrationOpen({ ...OPEN, todayIso: "2026-09-14" }),
    ).toBe(true);
  });

  test("closed the day after the first session", () => {
    expect(
      mondayGirlsRegistrationOpen({ ...OPEN, todayIso: "2026-09-15" }),
    ).toBe(false);
    expect(
      mondayGirlsRegistrationOpen({ ...OPEN, todayIso: "2026-10-26" }),
    ).toBe(false);
  });

  test("open today — the block is being sold right now", () => {
    expect(
      mondayGirlsRegistrationOpen({ ...OPEN, todayIso: "2026-09-07" }),
    ).toBe(true);
  });
});
