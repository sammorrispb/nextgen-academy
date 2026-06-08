import { test, expect } from "@playwright/test";
import {
  validateLeagueInterestForm,
  type LeagueInterestFormData,
} from "../src/lib/validate-league-interest";

const validForm: LeagueInterestFormData = {
  parentName: "Lauren P",
  email: "lauren@example.com",
  phone: "301-555-0142",
  childFirstName: "Mia",
  childAge: "10",
  preferredBand: "10U",
  childLevel: "Green",
  notes: "",
};

test.describe("validateLeagueInterestForm", () => {
  test("a complete, valid submission returns no errors", () => {
    expect(validateLeagueInterestForm(validForm)).toEqual({});
  });

  test("requires parent name + email + child first name", () => {
    const errors = validateLeagueInterestForm({
      ...validForm,
      parentName: "",
      email: "",
      childFirstName: "",
    });
    expect(errors.parentName).toBeTruthy();
    expect(errors.email).toBeTruthy();
    expect(errors.childFirstName).toBeTruthy();
  });

  test("flags malformed email", () => {
    const errors = validateLeagueInterestForm({ ...validForm, email: "no-at" });
    expect(errors.email).toBeTruthy();
  });

  test("phone is optional but validated when present", () => {
    expect(
      validateLeagueInterestForm({ ...validForm, phone: "" }).phone,
    ).toBeUndefined();
    expect(
      validateLeagueInterestForm({ ...validForm, phone: "abc" }).phone,
    ).toBeTruthy();
  });

  test("child age must be within 6..16 (strict academy range)", () => {
    expect(
      validateLeagueInterestForm({ ...validForm, childAge: "5" }).childAge,
    ).toBeTruthy();
    expect(
      validateLeagueInterestForm({ ...validForm, childAge: "17" }).childAge,
    ).toBeTruthy();
    expect(
      validateLeagueInterestForm({ ...validForm, childAge: "6" }).childAge,
    ).toBeUndefined();
    expect(
      validateLeagueInterestForm({ ...validForm, childAge: "16" }).childAge,
    ).toBeUndefined();
  });

  test("preferred band must be one of the four divisions", () => {
    expect(
      validateLeagueInterestForm({ ...validForm, preferredBand: "12U" })
        .preferredBand,
    ).toBeTruthy();
    expect(
      validateLeagueInterestForm({ ...validForm, preferredBand: "" })
        .preferredBand,
    ).toBeTruthy();
  });

  test("accepts every valid band", () => {
    for (const band of ["7U", "10U", "14U", "16U"]) {
      expect(
        validateLeagueInterestForm({ ...validForm, preferredBand: band })
          .preferredBand,
      ).toBeUndefined();
    }
  });

  test("level is optional but validated when present", () => {
    expect(
      validateLeagueInterestForm({ ...validForm, childLevel: "" }).childLevel,
    ).toBeUndefined();
    expect(
      validateLeagueInterestForm({ ...validForm, childLevel: undefined })
        .childLevel,
    ).toBeUndefined();
    expect(
      validateLeagueInterestForm({ ...validForm, childLevel: "Pro" }).childLevel,
    ).toBeTruthy();
  });
});
