import { test, expect } from "@playwright/test";
import {
  validateFallInterest,
  type FallInterestFormData,
} from "../src/lib/validate-fall-interest";

// The fall survey asks one form to serve two audiences: a parent answering
// about their kid, an adult answering about themselves, or someone doing both.
// The load-bearing behavior is that branch fields are required ONLY for the
// tracks actually picked — an adult must never be asked for a child's name.

function youthOnly(
  over: Partial<FallInterestFormData> = {},
): Partial<FallInterestFormData> {
  return {
    respondentName: "Test Parent",
    email: "parent@example.com",
    track: ["youth"],
    childFirstName: "Ava",
    childAge: "10",
    childLevel: "Green",
    days: ["Sunday"],
    commitment: "Yes — full season, paid up front",
    ...over,
  };
}

function adultOnly(
  over: Partial<FallInterestFormData> = {},
): Partial<FallInterestFormData> {
  return {
    respondentName: "Test Adult",
    email: "adult@example.com",
    track: ["adult"],
    adultBracket: "Playing",
    days: ["Sunday"],
    commitment: "Maybe — depends on price and dates",
    ...over,
  };
}

test.describe("validateFallInterest — shared fields", () => {
  test("a complete youth-only submission is valid", () => {
    expect(validateFallInterest(youthOnly())).toEqual({});
  });

  test("a complete adult-only submission is valid", () => {
    expect(validateFallInterest(adultOnly())).toEqual({});
  });

  test("a both-tracks submission needs both branches filled", () => {
    const both = {
      ...youthOnly(),
      track: ["youth", "adult"] as FallInterestFormData["track"],
    };
    expect(validateFallInterest(both).adultBracket).toBeTruthy();
    expect(
      validateFallInterest({ ...both, adultBracket: "Competing" }),
    ).toEqual({});
  });

  test("name and email are always required", () => {
    expect(
      validateFallInterest(youthOnly({ respondentName: "  " })).respondentName,
    ).toBeTruthy();
    expect(validateFallInterest(youthOnly({ email: "" })).email).toBeTruthy();
    expect(
      validateFallInterest(youthOnly({ email: "not-an-email" })).email,
    ).toBeTruthy();
  });

  test("phone is optional but validated when present", () => {
    expect(validateFallInterest(youthOnly({ phone: "" })).phone).toBeUndefined();
    expect(
      validateFallInterest(youthOnly({ phone: "301-555-0100" })).phone,
    ).toBeUndefined();
    expect(validateFallInterest(youthOnly({ phone: "abc" })).phone).toBeTruthy();
  });

  test("at least one track must be picked", () => {
    expect(validateFallInterest(youthOnly({ track: [] })).track).toBeTruthy();
  });

  test("an unknown track is rejected", () => {
    const bad = youthOnly({
      track: ["coach"] as unknown as FallInterestFormData["track"],
    });
    expect(validateFallInterest(bad).track).toBeTruthy();
  });

  test("a day answer is required — including 'Sunday doesn't work'", () => {
    expect(validateFallInterest(youthOnly({ days: [] })).days).toBeTruthy();
    expect(
      validateFallInterest(youthOnly({ days: ["Sunday doesn't work"] })).days,
    ).toBeUndefined();
  });

  test("an unknown day is rejected", () => {
    const bad = youthOnly({
      days: ["Tuesday"] as unknown as FallInterestFormData["days"],
    });
    expect(validateFallInterest(bad).days).toBeTruthy();
  });

  test("commitment is required and must be one of the three answers", () => {
    expect(
      validateFallInterest(youthOnly({ commitment: "" })).commitment,
    ).toBeTruthy();
    const bad = youthOnly({
      commitment: "Sure" as unknown as FallInterestFormData["commitment"],
    });
    expect(validateFallInterest(bad).commitment).toBeTruthy();
  });
});

test.describe("validateFallInterest — youth branch", () => {
  test("child fields are required when the youth track is picked", () => {
    const errors = validateFallInterest(
      youthOnly({ childFirstName: "", childAge: "", childLevel: "" }),
    );
    expect(errors.childFirstName).toBeTruthy();
    expect(errors.childAge).toBeTruthy();
    expect(errors.childLevel).toBeTruthy();
  });

  test("child fields are NOT required for an adult-only submission", () => {
    const errors = validateFallInterest(adultOnly());
    expect(errors.childFirstName).toBeUndefined();
    expect(errors.childAge).toBeUndefined();
    expect(errors.childLevel).toBeUndefined();
  });

  test("age gate is 6–16 inclusive", () => {
    expect(
      validateFallInterest(youthOnly({ childAge: "6" })).childAge,
    ).toBeUndefined();
    expect(
      validateFallInterest(youthOnly({ childAge: "16" })).childAge,
    ).toBeUndefined();
    expect(validateFallInterest(youthOnly({ childAge: "5" })).childAge).toBeTruthy();
    expect(
      validateFallInterest(youthOnly({ childAge: "17" })).childAge,
    ).toBeTruthy();
    expect(
      validateFallInterest(youthOnly({ childAge: "abc" })).childAge,
    ).toBeTruthy();
  });

  test("color group must be one of the four — never a synonym", () => {
    for (const level of ["Red", "Orange", "Green", "Yellow"] as const) {
      expect(
        validateFallInterest(youthOnly({ childLevel: level })).childLevel,
      ).toBeUndefined();
    }
    const bad = youthOnly({
      childLevel: "Beginner" as unknown as FallInterestFormData["childLevel"],
    });
    expect(validateFallInterest(bad).childLevel).toBeTruthy();
  });
});

test.describe("validateFallInterest — adult branch", () => {
  test("bracket is required when the adult track is picked", () => {
    expect(
      validateFallInterest(adultOnly({ adultBracket: "" })).adultBracket,
    ).toBeTruthy();
  });

  test("bracket is NOT required for a youth-only submission", () => {
    expect(validateFallInterest(youthOnly()).adultBracket).toBeUndefined();
  });

  test("bracket must be a canonical L&D bracket label", () => {
    for (const b of [
      "New",
      "Rallying",
      "Playing",
      "Competing",
      "Tournament Level",
    ] as const) {
      expect(
        validateFallInterest(adultOnly({ adultBracket: b })).adultBracket,
      ).toBeUndefined();
    }
    const bad = adultOnly({
      adultBracket: "3.5" as unknown as FallInterestFormData["adultBracket"],
    });
    expect(validateFallInterest(bad).adultBracket).toBeTruthy();
  });
});

test.describe("validateFallInterest — price bands", () => {
  test("price bands are optional", () => {
    expect(
      validateFallInterest(youthOnly({ youthPriceBand: "" })).youthPriceBand,
    ).toBeUndefined();
    expect(
      validateFallInterest(adultOnly({ adultPriceBand: "" })).adultPriceBand,
    ).toBeUndefined();
  });

  test("a supplied band must be one of the offered ranges", () => {
    expect(
      validateFallInterest(youthOnly({ youthPriceBand: "$20–25 an hour" }))
        .youthPriceBand,
    ).toBeUndefined();
    const bad = youthOnly({
      youthPriceBand:
        "$1000 an hour" as unknown as FallInterestFormData["youthPriceBand"],
    });
    expect(validateFallInterest(bad).youthPriceBand).toBeTruthy();
  });
});
