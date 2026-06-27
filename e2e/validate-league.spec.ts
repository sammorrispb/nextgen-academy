import { test, expect } from "@playwright/test";
import { validateLeagueForm, type LeagueFormData } from "../src/lib/validate-league";
import { LEAGUE_SEASONS, LEAGUE_PRICE_OPTIONS } from "../src/data/leagues";

const thisYear = new Date().getFullYear();

function validForm(overrides: Partial<LeagueFormData> = {}): LeagueFormData {
  return {
    seasonSlug: LEAGUE_SEASONS[0].slug,
    priceKey: "season",
    parentName: "Jordan Parent",
    email: "jordan@example.com",
    phone: "301-555-0142",
    childFirstName: "Riley",
    childBirthYear: String(thisYear - 10), // age 10 — inside 6–16
    emergencyName: "Sam Backup",
    emergencyPhone: "240-555-0199",
    allergies: "",
    smsConsent: false,
    ...overrides,
  };
}

test.describe("validateLeagueForm", () => {
  test("a fully valid form has no errors", () => {
    expect(validateLeagueForm(validForm())).toEqual({});
  });

  test("each price option key is accepted", () => {
    for (const opt of LEAGUE_PRICE_OPTIONS) {
      expect(validateLeagueForm(validForm({ priceKey: opt.key }))).toEqual({});
    }
  });

  test("unknown season slug is rejected", () => {
    expect(validateLeagueForm(validForm({ seasonSlug: "not-a-season" })).seasonSlug).toBeTruthy();
  });

  test("unknown price key is rejected", () => {
    expect(validateLeagueForm(validForm({ priceKey: "vip" })).priceKey).toBeTruthy();
  });

  test("emergency contact name + phone are required", () => {
    const e = validateLeagueForm(validForm({ emergencyName: "", emergencyPhone: "" }));
    expect(e.emergencyName).toBeTruthy();
    expect(e.emergencyPhone).toBeTruthy();
  });

  test("a too-short phone is rejected", () => {
    expect(validateLeagueForm(validForm({ phone: "12345" })).phone).toBeTruthy();
  });

  test("an invalid email is rejected", () => {
    expect(validateLeagueForm(validForm({ email: "nope" })).email).toBeTruthy();
  });

  test("a child too old (above age 16 ceiling) is rejected", () => {
    // born 18 years ago → age 18 → out of the 6–16 band
    expect(
      validateLeagueForm(validForm({ childBirthYear: String(thisYear - 18) })).childBirthYear,
    ).toBeTruthy();
  });

  test("a child too young (under age 6 floor) is rejected", () => {
    // born 3 years ago → age 3 → out of range
    expect(
      validateLeagueForm(validForm({ childBirthYear: String(thisYear - 3) })).childBirthYear,
    ).toBeTruthy();
  });

  test("a non-numeric birth year is rejected", () => {
    expect(validateLeagueForm(validForm({ childBirthYear: "twenty" })).childBirthYear).toBeTruthy();
  });

  test("required text fields are enforced", () => {
    const e = validateLeagueForm(validForm({ parentName: "", childFirstName: "" }));
    expect(e.parentName).toBeTruthy();
    expect(e.childFirstName).toBeTruthy();
  });
});
