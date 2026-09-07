import { test, expect } from "@playwright/test";
import {
  MONDAY_GIRLS_AGE_MAX,
  MONDAY_GIRLS_AGE_MIN,
  MONDAY_GIRLS_GROUP,
  MONDAY_GIRLS_MONDAYS,
  MONDAY_GIRLS_RAIN_DATES,
  MONDAY_GIRLS_SEASON_SESSIONS,
  MONDAY_GIRLS_SKIPPED_DATE,
  MONDAY_GIRLS_SLOTS_BY_GROUP,
  mondayGirlsSlotsFor,
} from "../src/data/monday-girls-2026";
import {
  MONDAY_GIRLS_SEASON_GROUPS,
  MONDAY_GIRLS_SEASON_PRICE_USD,
  findMondayGirlsSeasonGroup,
  mondayGirlsSeasonSlotsFor,
} from "../src/data/monday-girls-season-2026";
import { PLAYERS_PER_PICKLEBALL_COURT } from "../src/data/venue-parking";
import {
  mondayGirlsProratedRefundCents,
  mondayGirlsRefundPolicyFor,
  mondayGirlsSessionsRemaining,
} from "../src/lib/monday-girls-refund-policy";
import { buildMondayGirlsConfirmationEmail } from "../src/lib/email/monday-girls-confirmation";
import {
  isDuplicateMondayGirlsRegistration,
  validateMondayGirlsRegistration,
} from "../src/lib/validate-monday-girls-registration";

// Pure-function spec for the Monday Girls Beginner Group. No dev server.
//   npx playwright test e2e/monday-girls-season.spec.ts --project=desktop

test.describe("Monday Girls — the calendar", () => {
  test("every session date is actually a Monday", () => {
    for (const iso of [...MONDAY_GIRLS_MONDAYS, ...MONDAY_GIRLS_RAIN_DATES]) {
      // Noon UTC so the weekday can't slide on a UTC build server.
      const day = new Date(`${iso}T12:00:00Z`).getUTCDay();
      expect(day, `${iso} is not a Monday`).toBe(1);
    }
  });

  test("delivers the promised number of sessions", () => {
    expect(MONDAY_GIRLS_MONDAYS).toHaveLength(MONDAY_GIRLS_SEASON_SESSIONS);
  });

  test("SKIPS the Yom Kippur / MCPS closure — the whole reason the block was re-dated", () => {
    // This is the invariant a naive "six consecutive Mondays" range would
    // silently break, putting a session on a day the school is shut.
    expect(MONDAY_GIRLS_MONDAYS).not.toContain(MONDAY_GIRLS_SKIPPED_DATE);
    expect(MONDAY_GIRLS_SKIPPED_DATE).toBe("2026-09-21");
    // ...and the skipped date sits INSIDE the block, not before or after it —
    // otherwise the callout on the page would be explaining nothing.
    expect(MONDAY_GIRLS_SKIPPED_DATE > MONDAY_GIRLS_MONDAYS[0]).toBe(true);
    expect(
      MONDAY_GIRLS_SKIPPED_DATE <
        MONDAY_GIRLS_MONDAYS[MONDAY_GIRLS_MONDAYS.length - 1],
    ).toBe(true);
  });

  test("dates are strictly ascending and unique", () => {
    const sorted = [...MONDAY_GIRLS_MONDAYS].sort();
    expect([...MONDAY_GIRLS_MONDAYS]).toEqual(sorted);
    expect(new Set(MONDAY_GIRLS_MONDAYS).size).toBe(
      MONDAY_GIRLS_MONDAYS.length,
    );
  });

  test("rain dates fall after the block ends", () => {
    const last = MONDAY_GIRLS_MONDAYS[MONDAY_GIRLS_MONDAYS.length - 1];
    for (const rain of MONDAY_GIRLS_RAIN_DATES) {
      expect(rain > last, `${rain} is not after the final session`).toBe(true);
    }
  });
});

test.describe("Monday Girls — seats", () => {
  test("seats are DERIVED from the court booking, not typed", () => {
    // 1 tennis court → 2 pickleball courts → 4 players each.
    expect(mondayGirlsSlotsFor(MONDAY_GIRLS_GROUP)).toBe(
      1 * 2 * PLAYERS_PER_PICKLEBALL_COURT,
    );
  });

  test("the seat cap is keyed per group, not a shared scalar", () => {
    // The shape that prevents the invariant-fall-seat-cap-per-group bug from
    // reappearing when a second cohort is added.
    expect(typeof MONDAY_GIRLS_SLOTS_BY_GROUP).toBe("object");
    expect(Object.keys(MONDAY_GIRLS_SLOTS_BY_GROUP)).toContain(
      MONDAY_GIRLS_GROUP,
    );
    expect(mondayGirlsSeasonSlotsFor(MONDAY_GIRLS_GROUP)).toBe(
      MONDAY_GIRLS_SLOTS_BY_GROUP[MONDAY_GIRLS_GROUP],
    );
  });

  test("the one group resolves, and an unknown group does not", () => {
    expect(MONDAY_GIRLS_SEASON_GROUPS).toHaveLength(1);
    expect(findMondayGirlsSeasonGroup(MONDAY_GIRLS_GROUP)).toBeDefined();
    expect(findMondayGirlsSeasonGroup("Green/Yellow")).toBeUndefined();
    expect(findMondayGirlsSeasonGroup(undefined)).toBeUndefined();
  });
});

test.describe("Monday Girls — validation", () => {
  const base = {
    group: MONDAY_GIRLS_GROUP,
    parentName: "Test Parent",
    email: "parent@example.com",
    phone: "3015550142",
    childFirstName: "Testkid",
    childBirthYear: String(new Date().getFullYear() - 9),
    emergencyName: "Emergency Person",
    emergencyPhone: "3015550143",
    allergies: "",
    smsConsent: false,
  };

  test("a complete registration passes", () => {
    expect(validateMondayGirlsRegistration(base)).toEqual({});
  });

  test("a 7-year-old is NOT blocked — the confirmed player in this block is 7", () => {
    // The group is ADVERTISED 7–10 but VALIDATED against NGA's site-wide 6–16.
    // A validator pinned to the advertised band would have rejected the one
    // family who had already said yes. This is the regression that matters.
    const sevenYearOld = {
      ...base,
      childBirthYear: String(new Date().getFullYear() - 7),
    };
    expect(validateMondayGirlsRegistration(sevenYearOld)).toEqual({});
    expect(MONDAY_GIRLS_AGE_MIN).toBeLessThanOrEqual(7);
    expect(MONDAY_GIRLS_AGE_MAX).toBeGreaterThanOrEqual(10);
  });

  test("a wrong group is refused", () => {
    const errors = validateMondayGirlsRegistration({
      ...base,
      group: "Green/Yellow",
    });
    expect(errors.group).toBeTruthy();
  });

  test("missing required fields are each reported", () => {
    const errors = validateMondayGirlsRegistration({ group: MONDAY_GIRLS_GROUP });
    for (const field of [
      "parentName",
      "email",
      "phone",
      "childFirstName",
      "childBirthYear",
      "emergencyName",
      "emergencyPhone",
    ]) {
      expect(errors, `${field} not reported`).toHaveProperty(field);
    }
  });

  test("the duplicate guard is case-insensitive but lets a sibling through", () => {
    const keys = [{ parentEmail: "A@Example.com", childFirstName: "Ava" }];
    expect(isDuplicateMondayGirlsRegistration(keys, "a@example.com", "ava")).toBe(
      true,
    );
    expect(isDuplicateMondayGirlsRegistration(keys, "a@example.com", "Mia")).toBe(
      false,
    );
  });
});

test.describe("Monday Girls — refund policy", () => {
  test("a parent withdrawal is never refunded", () => {
    expect(mondayGirlsRefundPolicyFor("2026-09-15")).toBe("none");
    expect(
      mondayGirlsRefundPolicyFor("2026-09-15", { reason: "parent_withdrawal" }),
    ).toBe("none");
  });

  test("an NGA cancellation prorates", () => {
    expect(
      mondayGirlsRefundPolicyFor("2026-09-15", { reason: "nga_cancelled" }),
    ).toBe("prorated");
  });

  test("sessions remaining counts today INCLUSIVE", () => {
    expect(mondayGirlsSessionsRemaining("2026-09-01")).toBe(6);
    // On the morning of session 1, that session has not been played.
    expect(mondayGirlsSessionsRemaining("2026-09-14")).toBe(6);
    expect(mondayGirlsSessionsRemaining("2026-09-15")).toBe(5);
    expect(mondayGirlsSessionsRemaining("2026-11-01")).toBe(0);
  });

  test("the skipped Monday is never counted as owed", () => {
    // Between session 1 and session 2 there are five left, not six — 9/21
    // isn't in the list at all, so it can't inflate a refund.
    expect(mondayGirlsSessionsRemaining(MONDAY_GIRLS_SKIPPED_DATE)).toBe(5);
  });

  test("proration rounds in the parent's favour and never exceeds what they paid", () => {
    const paid = MONDAY_GIRLS_SEASON_PRICE_USD * 100;
    expect(mondayGirlsProratedRefundCents("2026-09-01", paid)).toBe(paid);
    expect(mondayGirlsProratedRefundCents("2026-11-01", paid)).toBe(0);
    const midBlock = mondayGirlsProratedRefundCents("2026-10-05", paid);
    // 4 of 6 sessions left → ceil(22500 * 4 / 6) = 15000.
    expect(midBlock).toBe(15000);
    expect(midBlock).toBeLessThanOrEqual(paid);
  });
});

test.describe("Monday Girls — confirmation email", () => {
  const input = {
    parentFirst: "Dana",
    childFirst: "Ada",
    timeLabel: "6:00–7:00 PM",
    amountUsd: "225.00",
    venue: "Earle B. Wood Middle School Tennis Courts, 14615 Bauer Dr, Rockville, MD 20853",
    mondays: MONDAY_GIRLS_MONDAYS,
    skippedDate: MONDAY_GIRLS_SKIPPED_DATE,
    rainDates: MONDAY_GIRLS_RAIN_DATES,
  };

  test("names the skipped Monday and why — families were quoted the old dates", () => {
    const { text } = buildMondayGirlsConfirmationEmail(input);
    expect(text).toContain("Monday, September 21");
    expect(text).toMatch(/Yom Kippur/i);
    expect(text).toMatch(/MCPS/);
  });

  test("lists every session date", () => {
    const { text } = buildMondayGirlsConfirmationEmail(input);
    expect(text).toContain("Monday, September 14");
    expect(text).toContain("Monday, September 28");
    expect(text).toContain("Monday, October 26");
    // The skipped date must not appear as a bullet in the date list.
    expect(text).not.toContain("- Monday, September 21");
  });

  test("states the price paid and the non-refundable term where the money was taken", () => {
    const { text } = buildMondayGirlsConfirmationEmail(input);
    expect(text).toContain("$225.00");
    expect(text).toMatch(/non-refundable/i);
  });

  test("addresses the parent and never implies the child is the recipient", () => {
    const { subject, text } = buildMondayGirlsConfirmationEmail(input);
    expect(text.startsWith("Hi Dana,")).toBe(true);
    expect(subject).toContain("Ada");
  });

  test("degrades cleanly when there is no skipped date", () => {
    const { text } = buildMondayGirlsConfirmationEmail({
      ...input,
      skippedDate: null,
    });
    expect(text).toContain("Your 6 Mondays:");
    expect(text).not.toMatch(/Yom Kippur/i);
  });
});
