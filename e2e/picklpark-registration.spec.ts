import { test, expect } from "@playwright/test";
import {
  validatePicklParkRegistration,
  isDuplicatePicklParkRegistration,
  type PicklParkRegistrationData,
} from "../src/lib/validate-picklpark-registration";
import { buildPicklParkSeasonConfirmationEmail } from "../src/lib/email/picklpark-season-confirmation";
import {
  PICKLPARK_INDOOR_NOTE,
  PICKLPARK_MAKEUP_DATES,
  PICKLPARK_SATURDAYS,
  PICKLPARK_SESSION_FORMAT,
  PICKLPARK_VENUE,
} from "../src/data/picklpark-2026";

// Pure-function + route specs — no dev server. Run with:
//   npx playwright test e2e/picklpark-registration.spec.ts --project=desktop

const PICKLPARK_DB = "picklpark-regs-db-test";
process.env.NOTION_API_KEY = "ntn_test";
process.env.NOTION_PICKLPARK_REGS_DB_ID = PICKLPARK_DB;
process.env.STRIPE_SECRET_KEY = "sk_test_dummy_offline";


function validForm(): PicklParkRegistrationData {
  return {
    group: "Red/Orange",
    parentName: "Test Parent",
    email: "parent@example.com",
    phone: "301-555-0142",
    childFirstName: "Testkid",
    childBirthYear: String(new Date().getFullYear() - 10),
    emergencyName: "Emergency Person",
    emergencyPhone: "301-555-0143",
    allergies: "",
    smsConsent: false,
  };
}


/** A Confirmed roster row for the capacity/duplicate queries. */


test.describe("validatePicklParkRegistration", () => {
  test("accepts a complete registration", () => {
    expect(validatePicklParkRegistration(validForm())).toEqual({});
  });

  test("requires a real group", () => {
    expect(
      validatePicklParkRegistration({ ...validForm(), group: "" }).group,
    ).toBeTruthy();
    expect(
      validatePicklParkRegistration({ ...validForm(), group: "Red" }).group,
    ).toBeTruthy();
  });

  test("rejects out-of-range birth years (season is ages 6–16)", () => {
    const thisYear = new Date().getFullYear();
    for (const bad of [
      String(thisYear - 3),
      String(thisYear - 20),
      "not-a-year",
    ]) {
      expect(
        validatePicklParkRegistration({ ...validForm(), childBirthYear: bad })
          .childBirthYear,
      ).toBeTruthy();
    }
    expect(
      validatePicklParkRegistration({
        ...validForm(),
        childBirthYear: String(thisYear - 6),
      }).childBirthYear,
    ).toBeUndefined();
  });

  test("requires parent contact + emergency contact", () => {
    const errors = validatePicklParkRegistration({
      ...validForm(),
      parentName: "",
      email: "bad-email",
      phone: "123",
      emergencyName: "",
      emergencyPhone: "456",
    });
    expect(errors.parentName).toBeTruthy();
    expect(errors.email).toBeTruthy();
    expect(errors.phone).toBeTruthy();
    expect(errors.emergencyName).toBeTruthy();
    expect(errors.emergencyPhone).toBeTruthy();
  });
});

test.describe("isDuplicatePicklParkRegistration", () => {
  const keys = [
    { parentEmail: "Parent@Example.com", childFirstName: "Ava" },
    { parentEmail: "other@example.com", childFirstName: "Max" },
  ];

  test("same parent + same kid is a duplicate (case-insensitive)", () => {
    expect(
      isDuplicatePicklParkRegistration(keys, "parent@example.com", "ava"),
    ).toBe(true);
  });

  test("a sibling or a different family passes", () => {
    expect(
      isDuplicatePicklParkRegistration(keys, "parent@example.com", "Max"),
    ).toBe(false);
    expect(
      isDuplicatePicklParkRegistration(keys, "new@example.com", "Ava"),
    ).toBe(false);
  });
});

test.describe("picklpark season confirmation email", () => {
  function build() {
    return buildPicklParkSeasonConfirmationEmail({
      parentFirst: "Jordan",
      childFirst: "Ava",
      groupLabel: "Red & Orange Ball",
      timeLabel: "3:00–4:00 PM",
      amountUsd: "225.00",
      venue: PICKLPARK_VENUE,
      saturdays: PICKLPARK_SATURDAYS,
      makeupDates: PICKLPARK_MAKEUP_DATES,
    });
  }

  test("carries the group, every Saturday, the venue, and the makeup date", () => {
    const { subject, text } = build();
    expect(subject).toContain("Red & Orange Ball");
    expect(text).toContain("Saturdays 3:00–4:00 PM");
    expect(text).toContain("Saturday, September 19");
    expect(text).toContain("Saturday, October 24");
    for (const iso of PICKLPARK_SATURDAYS) {
      const day = Number(iso.split("-")[2]);
      expect(text).toContain(` ${day}`);
    }
    expect(text).toContain(PICKLPARK_VENUE);
    expect(text).toContain("October 31");
  });

  test("spells out the hour — 30 minutes of drills, 30 of games (Sam, 2026-09-05)", () => {
    const { text } = build();
    expect(text).toContain(PICKLPARK_SESSION_FORMAT);
    expect(PICKLPARK_SESSION_FORMAT).toContain("30 minutes of coached drills");
    expect(PICKLPARK_SESSION_FORMAT).toContain("30 minutes of game play");
  });

  test("quotes the real paid amount (season price exists in Stripe)", () => {
    const { text } = build();
    expect(text).toContain("Paid: $225.00 (full season).");
  });

  test("carries the indoor promise that earns price parity with MoCo", () => {
    // $225 buys a 60-minute block here against Walter Johnson's 90. The
    // reason is the venue, not the clock — a confirmation that quotes the
    // price without it is selling the shorter hour and none of the reason.
    const { text } = build();
    expect(text).toContain(PICKLPARK_INDOOR_NOTE);
  });

  test("states the non-refundable terms and speaks Coach voice", () => {
    const { text } = build();
    expect(text).toContain("Hi Jordan,");
    expect(text).toContain("non-refundable");
    expect(text).toContain("better than yesterday, together");
    expect(text).toContain("301-325-4731");
  });
});
