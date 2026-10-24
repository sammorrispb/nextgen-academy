import { test, expect } from "@playwright/test";
import { NGA_PROGRAM_AGE_REGISTRY, resolveNgaProgramAgePolicy, type NgaProgramAgeRule } from "../src/data/nga-program-age-registry";

const input = { sessionsDbId: "ab000000-0000-4000-8000-000000000012", programId: "cd000000-0000-4000-8000-000000000020", eventDate: "2026-10-25", now: "2026-10-24T12:00:00Z" };
const rule: NgaProgramAgeRule = {
  sessionsDbId: input.sessionsDbId, programId: input.programId, reviewStatus: "reviewed",
  ageRange: { min: 8, max: 12 }, policySourceUrl: "https://example.invalid/synthetic-program-policy",
  policyRevision: "synthetic-policy-1", reviewedBy: "synthetic-policy-reviewer", reviewedAt: "2026-10-23T12:00:00Z",
  effectiveFrom: "2026-10-25", effectiveThrough: "2026-11-01", additionalEligibility: "no_additional_restrictions",
};
const resolve = (registry: readonly unknown[] = [rule], patch: Partial<typeof input> = {}) => resolveNgaProgramAgePolicy({ ...input, ...patch }, registry);

test("NGA reviewed registry: no production program mapping is invented", () => {
  expect(NGA_PROGRAM_AGE_REGISTRY).toEqual([]);
  expect(Object.isFrozen(NGA_PROGRAM_AGE_REGISTRY)).toBe(true);
  expect(resolveNgaProgramAgePolicy(input)).toBeNull();
});

test("NGA reviewed registry: one reviewed exact database and program match resolves", () => {
  expect(resolve()).toEqual({ ageRange: { min: 8, max: 12 }, revision: "synthetic-policy-1", additionalEligibility: "no_additional_restrictions" });
  expect(resolve([rule], { sessionsDbId: input.sessionsDbId.replaceAll("-", "").toUpperCase(), programId: input.programId.toUpperCase() })).toEqual(resolve());
  expect(resolve([{ ...rule, sessionsDbId: rule.sessionsDbId.toUpperCase(), programId: rule.programId.replaceAll("-", "") }])).toEqual(resolve());
});

test("NGA reviewed registry: database and program identities cannot substitute for one another", () => {
  expect(resolve([rule], { sessionsDbId: "ef000000-0000-4000-8000-000000000012" })).toBeNull();
  expect(resolve([rule], { programId: "ef000000-0000-4000-8000-000000000020" })).toBeNull();
  for (const programId of ["Synthetic Green session ages 8-12", "synthetic-green-2026-10-25", "*", "", `${input.programId} `]) expect(resolve([rule], { programId })).toBeNull();
  expect(resolve([{ ...rule, programId: "Synthetic Green session ages 8-12" }])).toBeNull();
  expect(resolve([{ ...rule, sessionsDbId: "*" }])).toBeNull();
});

test("NGA reviewed registry: duplicate or conflicting entries always need confirmation", () => {
  for (const other of [rule, { ...rule, ageRange: { min: 6, max: 16 } }, { ...rule, reviewStatus: "pending" }, { ...rule, sessionsDbId: rule.sessionsDbId.toUpperCase(), programId: rule.programId.replaceAll("-", "") }]) {
    expect(resolve([rule, other])).toBeNull();
    expect(resolve([other, rule])).toBeNull();
  }
  expect(resolve([{ ...rule, programId: "ef000000-0000-4000-8000-000000000020" }, rule])).toEqual(resolve());
});

test("NGA reviewed registry: review and policy metadata must be complete and well formed", () => {
  const invalid: Record<string, unknown>[] = [
    { reviewStatus: "pending" }, { reviewStatus: "rejected" }, { reviewStatus: "approved" },
    { policySourceUrl: "" }, { policySourceUrl: "not a URL" }, { policySourceUrl: "http://example.invalid/policy" },
    { policySourceUrl: "https://user:pass@example.invalid/policy" }, { policySourceUrl: "https://example.invalid/policy?token=synthetic" },
    { policyRevision: "" }, { policyRevision: " revision " }, { policyRevision: "revision\nunsafe" }, { policyRevision: "a".repeat(129) },
    { reviewedBy: "" }, { reviewedBy: " reviewer " }, { reviewedAt: "2026-10-25T00:00:00Z" },
    { reviewedAt: "2026-02-30T00:00:00Z" }, { reviewedAt: "2026-10-23" }, { reviewedAt: "invalid" },
    { additionalEligibility: undefined }, { additionalEligibility: "inferred_from_title" }, { title: "ages 8-12" },
  ];
  for (const patch of invalid) expect(resolve([{ ...rule, ...patch }]), JSON.stringify(patch)).toBeNull();
  for (const key of Object.keys(rule)) {
    const missing: Record<string, unknown> = { ...rule }; delete missing[key];
    expect(resolve([missing]), key).toBeNull();
  }
});

test("NGA reviewed registry: bounds are explicit nonnegative safe integers", () => {
  for (const ageRange of [null, {}, { min: 12, max: 8 }, { min: -1, max: 12 }, { min: 8.5, max: 12 }, { min: 8, max: Infinity }, { min: NaN, max: 12 }, { min: 8, max: Number.MAX_SAFE_INTEGER + 1 }, { min: "8", max: 12 }, { min: 8, max: 12, inferred: true }]) expect(resolve([{ ...rule, ageRange }])).toBeNull();
  expect(resolve([{ ...rule, ageRange: { min: 10, max: 10 } }])?.ageRange).toEqual({ min: 10, max: 10 });
});

test("NGA reviewed registry: event dates use the inclusive reviewed effective interval", () => {
  expect(resolve([rule], { eventDate: "2026-10-24" })).toBeNull();
  expect(resolve([rule], { eventDate: "2026-11-02" })).toBeNull();
  expect(resolve([rule], { eventDate: rule.effectiveFrom })).not.toBeNull();
  expect(resolve([rule], { eventDate: rule.effectiveThrough })).not.toBeNull();
  for (const patch of [{ effectiveFrom: "2026-11-02" }, { effectiveThrough: "2026-10-24" }, { effectiveFrom: "2026-02-30" }, { effectiveThrough: "invalid" }]) expect(resolve([{ ...rule, ...patch }])).toBeNull();
  for (const eventDate of ["2026-02-30", "2026-10-25T00:00:00Z", "invalid"]) expect(resolve([rule], { eventDate })).toBeNull();
});

test("NGA reviewed registry: expired policies and future reviews cannot authorize a preview", () => {
  expect(resolve([rule], { now: "2026-11-02T12:00:00Z" })).toBeNull();
  expect(resolve([rule], { now: "2026-10-23T11:59:59Z" })).toBeNull();
  expect(resolve([rule], { now: rule.reviewedAt })).not.toBeNull();
  // Through-date expiry follows the program's ET calendar, including midnight.
  expect(resolve([rule], { now: "2026-11-02T04:59:59Z" })).not.toBeNull();
  expect(resolve([rule], { now: "2026-11-02T05:00:00Z" })).toBeNull();
  for (const now of ["invalid", "2026-02-30T12:00:00Z", "2026-10-24"]) expect(resolve([rule], { now })).toBeNull();
});

test("NGA reviewed registry: additional eligibility is explicit and never cleared by age bounds", () => {
  expect(resolve([{ ...rule, additionalEligibility: "requires_coach_confirmation" }])).toEqual({ ageRange: rule.ageRange, revision: rule.policyRevision, additionalEligibility: "requires_coach_confirmation" });
});

test("NGA reviewed registry: policy revisions and returned objects remain independent", () => {
  const before = structuredClone(rule);
  const resolved = resolve()!;
  resolved.ageRange.min = 1;
  expect(rule).toEqual(before);
  expect(resolve([{ ...rule, policyRevision: "synthetic-policy-2" }])?.revision).toBe("synthetic-policy-2");
});
