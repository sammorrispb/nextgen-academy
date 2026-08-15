import { test, expect } from "@playwright/test";
import {
  validateFallRegistration,
  isDuplicateFallRegistration,
  type FallRegistrationData,
} from "../src/lib/validate-fall-registration";
import { buildFallSeasonConfirmationEmail } from "../src/lib/email/fall-season-confirmation";
import {
  FALL_SEASON_GROUPS,
  FALL_SEASON_PRICE_USD,
  FALL_SEASON_SPOTS_PER_GROUP,
} from "../src/data/fall-season-2026";
import {
  FALL_POLL_PRICE_USD,
  FALL_POLL_SPOTS_PER_GROUP,
} from "../src/data/fall-poll-2026";
import {
  FALL_RAIN_DATES,
  FALL_SUNDAYS,
  FALL_VENUE,
  FALL_YOUTH_BLOCKS,
  SLOTS_PER_GROUP,
} from "../src/data/fall-2026";

// Pure-function specs — no dev server. Run with:
//   npx playwright test e2e/fall-registration.spec.ts --project=desktop

function validForm(): FallRegistrationData {
  return {
    group: "Green",
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

test.describe("fall season product data stays consistent", () => {
  test("checkout price is the poll's operator-set price", () => {
    expect(FALL_SEASON_PRICE_USD).toBe(FALL_POLL_PRICE_USD);
    expect(FALL_SEASON_PRICE_USD).toBe(225);
  });

  test("seat cap is the derived court math, same number the poll sold", () => {
    expect(FALL_SEASON_SPOTS_PER_GROUP).toBe(SLOTS_PER_GROUP);
    expect(FALL_SEASON_SPOTS_PER_GROUP).toBe(FALL_POLL_SPOTS_PER_GROUP);
  });

  test("groups mirror the Sunday blocks with canonical ball-color labels", () => {
    expect(FALL_SEASON_GROUPS.map((g) => g.group)).toEqual(
      FALL_YOUTH_BLOCKS.map((b) => b.level),
    );
    expect(FALL_SEASON_GROUPS.map((g) => g.label)).toEqual([
      "Green Ball",
      "Yellow Ball",
    ]);
    expect(FALL_SEASON_GROUPS.map((g) => g.timeLabel)).toEqual([
      "1:00–2:30 PM",
      "2:30–4:00 PM",
    ]);
  });
});

test.describe("validateFallRegistration", () => {
  test("accepts a complete registration", () => {
    expect(validateFallRegistration(validForm())).toEqual({});
  });

  test("requires a real group", () => {
    expect(validateFallRegistration({ ...validForm(), group: "" }).group).toBeTruthy();
    expect(
      validateFallRegistration({ ...validForm(), group: "Red" }).group,
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
        validateFallRegistration({ ...validForm(), childBirthYear: bad })
          .childBirthYear,
      ).toBeTruthy();
    }
    expect(
      validateFallRegistration({
        ...validForm(),
        childBirthYear: String(thisYear - 6),
      }).childBirthYear,
    ).toBeUndefined();
  });

  test("requires parent contact + emergency contact", () => {
    const errors = validateFallRegistration({
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

test.describe("isDuplicateFallRegistration", () => {
  const keys = [
    { parentEmail: "Parent@Example.com", childFirstName: "Ava" },
    { parentEmail: "other@example.com", childFirstName: "Max" },
  ];

  test("same parent + same kid is a duplicate (case-insensitive)", () => {
    expect(isDuplicateFallRegistration(keys, "parent@example.com", "ava")).toBe(
      true,
    );
  });

  test("a sibling or a different family passes", () => {
    expect(isDuplicateFallRegistration(keys, "parent@example.com", "Max")).toBe(
      false,
    );
    expect(isDuplicateFallRegistration(keys, "new@example.com", "Ava")).toBe(
      false,
    );
  });
});

test.describe("fall season confirmation email", () => {
  function build() {
    return buildFallSeasonConfirmationEmail({
      parentFirst: "Jordan",
      childFirst: "Ava",
      groupLabel: "Green Ball",
      timeLabel: "1:00–2:30 PM",
      amountUsd: "225.00",
      venue: FALL_VENUE,
      sundays: FALL_SUNDAYS,
      rainDates: FALL_RAIN_DATES,
    });
  }

  test("carries the group, every Sunday, the venue, and the rain dates", () => {
    const { subject, text } = build();
    expect(subject).toContain("Green Ball");
    expect(text).toContain("Sundays 1:00–2:30 PM");
    expect(text).toContain("Sunday, September 20");
    expect(text).toContain("Sunday, October 25");
    for (const iso of FALL_SUNDAYS) {
      const day = Number(iso.split("-")[2]);
      expect(text).toContain(` ${day}`);
    }
    expect(text).toContain(FALL_VENUE);
    expect(text).toContain("November 1");
    expect(text).toContain("November 8");
  });

  test("quotes the real paid amount (season price exists in Stripe)", () => {
    const { text } = build();
    expect(text).toContain("Paid: $225.00 (full season).");
  });

  test("speaks Coach voice and addresses the parent", () => {
    const { text } = build();
    expect(text).toContain("Hi Jordan,");
    expect(text).toContain("better than yesterday, together");
    expect(text).toContain("301-325-4731");
  });
});
