import { test, expect } from "@playwright/test";
import {
  LEAD_LOCATIONS,
  MAX_KIDS_PER_SUBMISSION,
  normalizeKids,
  validateLeadForm,
} from "../src/lib/validate-lead";
import { validateContactForm } from "../src/lib/validate-contact";

// Pure-function specs — these don't need a dev server. Run with:
//   npx playwright test e2e/validate-lead.spec.ts --project=desktop

test.describe("normalizeKids", () => {
  test("prefers kids[] when present", () => {
    const kids = normalizeKids({
      kids: [{ name: "Riley", age: 9 }],
      childAge: "11",
    });
    expect(kids).toEqual([{ name: "Riley", age: 9 }]);
  });

  test("falls back to legacy childAge when kids[] is missing or empty", () => {
    expect(normalizeKids({ childAge: "10" })).toEqual([
      { name: "", age: 10 },
    ]);
    expect(normalizeKids({ kids: [], childAge: "10" })).toEqual([
      { name: "", age: 10 },
    ]);
  });

  test("returns an empty array when neither kids[] nor childAge is set", () => {
    expect(normalizeKids({})).toEqual([]);
  });
});

test.describe("validateLeadForm — kids[] payload", () => {
  const base = { parentName: "Patrick Casey", contact: "pat@example.com" };

  test("accepts a single named kid", () => {
    expect(
      validateLeadForm({ ...base, kids: [{ name: "Cameron", age: 7 }] }),
    ).toEqual({});
  });

  test("accepts multiple named kids", () => {
    expect(
      validateLeadForm({
        ...base,
        kids: [
          { name: "Cameron", age: 7 },
          { name: "Parker", age: 9 },
        ],
      }),
    ).toEqual({});
  });

  test("flags a missing name on the new payload but not on the legacy payload", () => {
    const newPayload = validateLeadForm({
      ...base,
      kids: [{ name: "", age: 9 }],
    });
    expect(newPayload["kids.0.name"]).toBeTruthy();

    // Legacy callers (no kids[]) shouldn't be punished for the new field.
    const legacy = validateLeadForm({ ...base, childAge: "9" });
    expect(legacy).toEqual({});
  });

  test("flags out-of-range age on the right kid index", () => {
    const errs = validateLeadForm({
      ...base,
      kids: [
        { name: "Riley", age: 9 },
        { name: "Sam", age: 5 },
      ],
    });
    expect(errs["kids.1.age"]).toBeTruthy();
    expect(errs["kids.0.age"]).toBeUndefined();
  });

  test(`caps submissions at ${MAX_KIDS_PER_SUBMISSION} kids`, () => {
    const kids = Array.from(
      { length: MAX_KIDS_PER_SUBMISSION + 1 },
      (_, i) => ({ name: `Kid${i}`, age: 10 }),
    );
    const errs = validateLeadForm({ ...base, kids });
    expect(errs.kids).toBeTruthy();
  });

  test("legacy childAge=missing still yields the old `childAge` error key", () => {
    const errs = validateLeadForm({ ...base });
    expect(errs.childAge).toBeTruthy();
    expect(errs["kids.0.age"]).toBeUndefined();
  });
});

test.describe("validateLeadForm — location allowlist", () => {
  const base = {
    parentName: "Patrick Casey",
    contact: "pat@example.com",
    kids: [{ name: "Cameron", age: 7 }],
  };

  test("every LEAD_LOCATIONS value passes", () => {
    for (const location of LEAD_LOCATIONS) {
      expect(validateLeadForm({ ...base, location })).toEqual({});
    }
  });

  test("Frederick uses the exact Notion select string", () => {
    // One canonical literal (em dash included) everywhere, or the Notion
    // Location select forks into near-identical options.
    expect(LEAD_LOCATIONS).toContain("Frederick — The Pickl Park");
  });

  test("an unknown location is rejected", () => {
    const errs = validateLeadForm({ ...base, location: "elsewhere" });
    expect(errs.location).toBeTruthy();
  });

  test("absent location stays valid (legacy + MoCo-default path)", () => {
    expect(validateLeadForm({ ...base })).toEqual({});
  });
});

test.describe("validateContactForm — location allowlist", () => {
  const base = {
    name: "Patrick Casey",
    email: "pat@example.com",
    interest: "private-lessons" as const,
    kids: [{ name: "Cameron", age: 7 }],
  };

  test("accepts LEAD_LOCATIONS values and absence", () => {
    for (const location of LEAD_LOCATIONS) {
      expect(validateContactForm({ ...base, location })).toEqual({});
    }
    expect(validateContactForm({ ...base })).toEqual({});
  });

  test("rejects an unknown location", () => {
    const errs = validateContactForm({ ...base, location: "elsewhere" });
    expect(errs.location).toBeTruthy();
  });
});
