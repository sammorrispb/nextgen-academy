import { test, expect } from "@playwright/test";
import { validateCampForm, type CampFormData } from "../src/lib/validate-camp";
import {
  CAMPS,
  CAMP_OPTIONS,
  CAMP_AGE_MIN,
  CAMP_AGE_MAX,
  findCampOption,
} from "../src/data/camps";

const thisYear = new Date().getFullYear();

function validForm(overrides: Partial<CampFormData> = {}): CampFormData {
  return {
    campSlug: CAMPS[0].slug,
    optionKey: "am",
    parentName: "Jordan Parent",
    email: "jordan@example.com",
    phone: "301-555-0142",
    childFirstName: "Riley",
    childBirthYear: String(thisYear - 10), // age 10 — inside 6–16
    emergencyName: "Sam Backup",
    emergencyPhone: "240-555-0199",
    allergies: "",
    waiverAccepted: true,
    smsConsent: false,
    ...overrides,
  };
}

test.describe("validateCampForm", () => {
  test("a fully valid form has no errors", () => {
    expect(validateCampForm(validForm())).toEqual({});
  });

  test("each camp option key is accepted", () => {
    for (const opt of CAMP_OPTIONS) {
      expect(validateCampForm(validForm({ optionKey: opt.key }))).toEqual({});
    }
  });

  test("unknown camp slug is rejected", () => {
    expect(validateCampForm(validForm({ campSlug: "not-a-week" })).campSlug).toBeTruthy();
  });

  test("unknown option key is rejected", () => {
    expect(validateCampForm(validForm({ optionKey: "vip" })).optionKey).toBeTruthy();
  });

  test("camp offers only the morning half-day option", () => {
    expect(CAMP_OPTIONS.map((o) => o.key)).toEqual(["am"]);
  });

  test("the retired full/pm options are no longer registrable", () => {
    expect(findCampOption("full")).toBeUndefined();
    expect(findCampOption("pm")).toBeUndefined();
    // The checkout-camp route delegates to validateCampForm first, so a stale
    // client/bookmarked form posting a removed key is cleanly rejected (400),
    // never a confusing 503.
    expect(validateCampForm(validForm({ optionKey: "full" })).optionKey).toBeTruthy();
    expect(validateCampForm(validForm({ optionKey: "pm" })).optionKey).toBeTruthy();
  });

  test("the morning option is priced at $50/week", () => {
    expect(findCampOption("am")?.priceUsd).toBe(50);
  });

  test("waiver must be accepted", () => {
    expect(validateCampForm(validForm({ waiverAccepted: false })).waiverAccepted).toBeTruthy();
  });

  test("emergency contact name + phone are required", () => {
    const e = validateCampForm(validForm({ emergencyName: "", emergencyPhone: "" }));
    expect(e.emergencyName).toBeTruthy();
    expect(e.emergencyPhone).toBeTruthy();
  });

  test("a too-short emergency phone is rejected", () => {
    expect(validateCampForm(validForm({ emergencyPhone: "12345" })).emergencyPhone).toBeTruthy();
  });

  test("a child too old (under age 6 floor) is rejected", () => {
    // born 17 years ago → age 17 → out of range
    expect(
      validateCampForm(validForm({ childBirthYear: String(thisYear - 17) })).childBirthYear,
    ).toBeTruthy();
  });

  test("a child too young (over age 16... i.e. under 6) is rejected", () => {
    // born 4 years ago → age 4 → out of range
    expect(
      validateCampForm(validForm({ childBirthYear: String(thisYear - 4) })).childBirthYear,
    ).toBeTruthy();
  });

  test("age boundaries track CAMP_AGE_MIN/MAX (camp narrowed to 8+ in data)", () => {
    expect(
      validateCampForm(validForm({ childBirthYear: String(thisYear - CAMP_AGE_MIN) })),
    ).toEqual({});
    expect(
      validateCampForm(validForm({ childBirthYear: String(thisYear - CAMP_AGE_MAX) })),
    ).toEqual({});
    expect(
      validateCampForm(validForm({ childBirthYear: String(thisYear - CAMP_AGE_MIN + 1) }))
        .childBirthYear,
    ).toBeTruthy();
  });

  test("a non-numeric birth year is rejected", () => {
    expect(validateCampForm(validForm({ childBirthYear: "twelve" })).childBirthYear).toBeTruthy();
  });

  test("an invalid email is rejected", () => {
    expect(validateCampForm(validForm({ email: "nope" })).email).toBeTruthy();
  });

  test("empty required fields are all flagged", () => {
    const e = validateCampForm({});
    expect(e.parentName).toBeTruthy();
    expect(e.email).toBeTruthy();
    expect(e.phone).toBeTruthy();
    expect(e.childFirstName).toBeTruthy();
    expect(e.childBirthYear).toBeTruthy();
    expect(e.emergencyName).toBeTruthy();
    expect(e.emergencyPhone).toBeTruthy();
    expect(e.waiverAccepted).toBeTruthy();
  });
});
