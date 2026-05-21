import { test, expect } from "@playwright/test";
import { validateNewsletterForm } from "../src/lib/validate-newsletter";

test.describe("validateNewsletterForm", () => {
  test("accepts a complete, valid signup", () => {
    expect(
      validateNewsletterForm({
        parentName: "Alex Parent",
        email: "alex@example.com",
        childAge: "10",
      }),
    ).toEqual({});
  });

  test("requires a parent name", () => {
    const errors = validateNewsletterForm({
      parentName: "   ",
      email: "alex@example.com",
      childAge: "10",
    });
    expect(errors.parentName).toBeTruthy();
  });

  test("requires an email", () => {
    const errors = validateNewsletterForm({
      parentName: "Alex Parent",
      email: "",
      childAge: "10",
    });
    expect(errors.email).toBeTruthy();
  });

  test("rejects a malformed email", () => {
    const errors = validateNewsletterForm({
      parentName: "Alex Parent",
      email: "not-an-email",
      childAge: "10",
    });
    expect(errors.email).toContain("valid email");
  });

  test("has no phone fallback — a phone number is not a valid email", () => {
    const errors = validateNewsletterForm({
      parentName: "Alex Parent",
      email: "3015551234",
      childAge: "10",
    });
    expect(errors.email).toBeTruthy();
  });

  test("requires a child age", () => {
    const errors = validateNewsletterForm({
      parentName: "Alex Parent",
      email: "alex@example.com",
      childAge: "",
    });
    expect(errors.childAge).toBeTruthy();
  });

  test("rejects ages below 7 and above 17 (boundaries)", () => {
    expect(
      validateNewsletterForm({
        parentName: "Alex Parent",
        email: "alex@example.com",
        childAge: "6",
      }).childAge,
    ).toBeTruthy();
    expect(
      validateNewsletterForm({
        parentName: "Alex Parent",
        email: "alex@example.com",
        childAge: "18",
      }).childAge,
    ).toBeTruthy();
  });

  test("accepts the inclusive 7 and 17 bounds", () => {
    expect(
      validateNewsletterForm({
        parentName: "Alex Parent",
        email: "alex@example.com",
        childAge: "7",
      }),
    ).toEqual({});
    expect(
      validateNewsletterForm({
        parentName: "Alex Parent",
        email: "alex@example.com",
        childAge: "17",
      }),
    ).toEqual({});
  });

  test("flags every missing field at once on an empty submit", () => {
    const errors = validateNewsletterForm({});
    expect(errors.parentName).toBeTruthy();
    expect(errors.email).toBeTruthy();
    expect(errors.childAge).toBeTruthy();
  });
});
