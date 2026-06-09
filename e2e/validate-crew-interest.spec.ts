import { test, expect } from "@playwright/test";
import {
  validateCrewInterestForm,
  CREW_DAYS,
  type CrewInterestFormData,
} from "../src/lib/validate-crew-interest";

const validForm: CrewInterestFormData = {
  parentName: "Lauren P",
  email: "lauren@example.com",
  phone: "301-555-0142",
  childFirstName: "Mia",
  childAge: "10",
  childLevel: "Green",
  preferredDays: ["Tue", "Thu"],
  preferredTimeOfDay: ["Afternoon"],
  preferredTime: "after school",
  preferredLocation: "Bethesda",
  friendsWanted: "Theo (10)",
  notes: "",
};

test.describe("validateCrewInterestForm", () => {
  test("a complete, valid submission returns no errors", () => {
    expect(validateCrewInterestForm(validForm)).toEqual({});
  });

  test("requires parent name + email + child first name", () => {
    const errors = validateCrewInterestForm({
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
    const errors = validateCrewInterestForm({ ...validForm, email: "no-at" });
    expect(errors.email).toBeTruthy();
  });

  test("phone is optional but validated when present", () => {
    expect(
      validateCrewInterestForm({ ...validForm, phone: "" }).phone,
    ).toBeUndefined();
    expect(
      validateCrewInterestForm({ ...validForm, phone: "abc" }).phone,
    ).toBeTruthy();
  });

  test("child age must be 6..16", () => {
    expect(
      validateCrewInterestForm({ ...validForm, childAge: "5" }).childAge,
    ).toBeTruthy();
    expect(
      validateCrewInterestForm({ ...validForm, childAge: "17" }).childAge,
    ).toBeTruthy();
    expect(
      validateCrewInterestForm({ ...validForm, childAge: "6" }).childAge,
    ).toBeUndefined();
    expect(
      validateCrewInterestForm({ ...validForm, childAge: "16" }).childAge,
    ).toBeUndefined();
  });

  test("child level must be one of the four ball colors", () => {
    expect(
      validateCrewInterestForm({ ...validForm, childLevel: "Pro" }).childLevel,
    ).toBeTruthy();
    expect(
      validateCrewInterestForm({ ...validForm, childLevel: "" }).childLevel,
    ).toBeTruthy();
  });

  test("at least one preferred day required", () => {
    expect(
      validateCrewInterestForm({ ...validForm, preferredDays: [] }).preferredDays,
    ).toBeTruthy();
  });

  test("rejects unknown day codes", () => {
    expect(
      validateCrewInterestForm({
        ...validForm,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        preferredDays: ["Tue", "Funday" as any],
      }).preferredDays,
    ).toBeTruthy();
  });

  test("accepts every valid day code", () => {
    expect(
      validateCrewInterestForm({
        ...validForm,
        preferredDays: [...CREW_DAYS],
      }).preferredDays,
    ).toBeUndefined();
  });

  test("at least one time of day required", () => {
    expect(
      validateCrewInterestForm({ ...validForm, preferredTimeOfDay: [] })
        .preferredTimeOfDay,
    ).toBeTruthy();
  });

  test("preferred time required", () => {
    expect(
      validateCrewInterestForm({ ...validForm, preferredTime: " " }).preferredTime,
    ).toBeTruthy();
  });
});
