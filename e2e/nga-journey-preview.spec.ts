import { test, expect } from "@playwright/test";
import { chooseNgaPrograms, type NgaAssessment, type NgaProgram } from "../src/lib/nga-journey";

const now = "2026-10-23T16:00:00.000Z";
const assessment: NgaAssessment = { playerId: "00000000-0000-4000-8000-000000000001", revision: "assessment-1", level: "Green", age: 10 };
const program: NgaProgram = { ageRange: { min: 6, max: 16 }, id: "00000000-0000-4000-8000-000000000002", revision: "program-1", title: "Synthetic Green session", date: "2026-10-25", startTime: "1:00 PM", endTime: "2:00 PM", level: "Green", location: "Synthetic court", status: "Open", capacity: 8, registeredCount: 3, url: "/schedule/synthetic-2026-10-25" };
const reviewed = { assessmentRevision: "assessment-1", focusId: "skill-6", confirmed: true as const, ageConfirmed: true };
function choose(programs: NgaProgram[], changes: Partial<NgaAssessment> = {}, preferences = {}) {
  return chooseNgaPrograms({ assessment: { ...assessment, ...changes }, programs, review: reviewed, preferences, now });
}

test("NGA-C9: explicit coach review binds next focus to canonical assessment revision", () => {
  expect(choose([program])).toMatchObject({ state: "recommendation", nextFocus: { id: "skill-6", label: "Serve and Return" }, assessment: { level: "Green" } });
  expect(chooseNgaPrograms({ assessment, programs: [program], preferences: {}, now })).toMatchObject({ state: "clarification", reason: "coach_review_required" });
  expect(choose([program], { revision: "assessment-2" })).toMatchObject({ state: "stale", reason: "assessment_changed" });
});

test("NGA-C9: known age, level, status and capacity mismatches never become fit", () => {
  for (const patch of [{ level: "Red" as const }, { status: "Full" }, { status: "Cancelled" }, { registeredCount: 8 }]) {
    expect(choose([{ ...program, ...patch }]).state).toBe("no_match");
  }
  expect(choose([{ ...program, ageRange: { min: 12, max: 16 } }]).state).toBe("no_match");
  expect(choose([{ ...program, ageRange: null }]).state).toBe("needs_confirmation");
  for (const age of [5, 17]) expect(choose([program], { age }).state).toBe("no_match");
  for (const patch of [{ capacity: null }, { registeredCount: null }, { level: null }, { status: null }, { startTime: "unknown" }, { endTime: "unknown" }]) {
    const result = choose([{ ...program, ...patch }]);
    expect(result.state).toBe("needs_confirmation");
    expect(result.programs.filter((p) => p.fit === "fit")).toHaveLength(0);
  }
  expect(choose([program], { age: null }).state).toBe("needs_confirmation");
  expect(choose([program], { level: null }).state).toBe("clarification");
});

test("NGA-C9: parent request cannot replace assessed skill or invent persistent family authority", () => {
  const before = structuredClone(assessment);
  const result = choose([program], {}, { requestedLevel: "Yellow" });
  expect(result.state).toBe("unsupported");
  expect(assessment).toEqual(before);
  expect(choose([program], {}, { persisted: true }).state).toBe("unsupported");
});

test("NGA-C9: required and preferred family schedule and venue controls stay separate", () => {
  expect(choose([program], {}, { days: { mode: "required", values: [1] } }).state).toBe("no_match");
  expect(choose([program], {}, { days: { mode: "preferred", values: [1] } }).state).toBe("recommendation");
  expect(choose([program], {}, { locations: { mode: "required", values: ["Other court"] } }).state).toBe("no_match");
  expect(choose([{ ...program, location: "" }], {}, { locations: { mode: "required", values: ["Synthetic court"] } }).state).toBe("needs_confirmation");
  expect(choose([program], {}, { time: { mode: "required", start: "14:00", end: "16:00" } }).state).toBe("no_match");
  expect(choose([program], {}, { maxDistanceMiles: 5 }).state).toBe("unsupported");
});

test("NGA-C9: deterministic ordering, deduplicated canonical destinations and explicit uncertainty", () => {
  const later = { ...program, id: "00000000-0000-4000-8000-000000000003", date: "2026-10-26", url: "/schedule/later" };
  const expected = choose([program, later]);
  expect(choose([later, program, program])).toEqual(expected);
  expect(choose([{ ...program, level: "All Levels" }]).state).toBe("recommendation");
  expect(choose([{ ...program, date: "2026-02-30" }]).state).toBe("needs_confirmation");
  expect(choose([{ ...program, date: "2026-10-22" }]).state).toBe("no_match");
  expect(choose([{ ...program, id: "other", registeredCount: 8 }, program]).state).toBe("recommendation");
  expect(choose([])).toMatchObject({ state: "no_match", programs: [] });
});

test("NGA-C9: unconfirmed recorded age and malformed date stay explicit uncertainty", () => {
  const base = { assessment, programs: [program], preferences: {}, now };
  expect(chooseNgaPrograms({ ...base, review: { ...reviewed, ageConfirmed: false } }).state).toBe("needs_confirmation");
  for (const date of ["2026-99-99", "invalid", "2026-02-30"]) expect(choose([{ ...program, date }]).state).toBe("needs_confirmation");
  for (const preferences of [{ days: { mode: "required", values: [] } }, { time: { mode: "required", start: "16:00", end: "14:00" } }]) expect(choose([program], {}, preferences).state).toBe("clarification");
});


const independentlyDenied: { name: string; patch: Partial<NgaProgram>; preferences?: object }[] = [
  { name: "cancelled", patch: { status: "Cancelled" } },
  { name: "full", patch: { registeredCount: 8 } },
  { name: "wrong level", patch: { level: "Red" } },
  { name: "wrong age", patch: { ageRange: { min: 12, max: 16 } } },
  { name: "wrong required day", patch: { date: "2026-10-26" }, preferences: { days: { mode: "required", values: [0] } } },
  { name: "past", patch: { date: "2026-10-22" } },
  { name: "wrong required venue", patch: { location: "Other court" }, preferences: { locations: { mode: "required", values: ["Synthetic court"] } } },
  { name: "wrong required time", patch: { startTime: "3:00 PM", endTime: "4:00 PM" }, preferences: { time: { mode: "required", start: "12:00", end: "14:00" } } },
];
for (const scenario of independentlyDenied) test(`NGA-C9: ${scenario.name} records cannot escape through destination deduplication`, () => {
  const denied = { ...program, ...scenario.patch, id: "denied-a" };
  const deniedAgain = { ...denied, id: "denied-b", revision: "different-source-revision" };
  expect(choose([denied, deniedAgain], {}, scenario.preferences)).toMatchObject({ state: "no_match", programs: [] });
  const valid = choose([program, denied], {}, scenario.preferences);
  expect(valid.state).toBe("recommendation");
  expect(valid.programs).toEqual(choose([program], {}, scenario.preferences).programs);
});
test("NGA-C9: source IDs and revisions do not invent destination authority conflicts", () => {
  const corroborating = { ...program, id: "other-source-id", revision: "other-source-revision", title: "Another source label" };
  expect(choose([corroborating, program])).toEqual(choose([program]));
  expect(choose([{ ...program, id: "other-source-id", startTime: "3:00 PM", endTime: "4:00 PM" }, program])).toMatchObject({ state: "needs_confirmation", programs: [{ fit: "needs_confirmation", reasons: ["conflicting_destination_evidence"] }] });
});

test("NGA-C9: unconfirmed recorded age never becomes an authoritative age denial", () => {
  for (const age of [5, 17]) {
    const input = { assessment: { ...assessment, age }, programs: [program], preferences: {}, now };
    expect(chooseNgaPrograms({ ...input, review: { ...reviewed, ageConfirmed: false } })).toMatchObject({ state: "needs_confirmation", programs: [{ fit: "needs_confirmation", reasons: ["age_confirmation_required"] }] });
    expect(chooseNgaPrograms({ ...input, review: reviewed })).toMatchObject({ state: "no_match", reason: "outside_youth_age_policy" });
  }
  expect(chooseNgaPrograms({ assessment, programs: [{ ...program, ageRange: { min: 12, max: 16 } }], review: { ...reviewed, ageConfirmed: false }, preferences: {}, now }).state).toBe("needs_confirmation");
});

test("NGA-C9: invalid program age ranges and invalid recorded ages stay unverified", () => {
  for (const ageRange of [{ min: NaN, max: 16 }, { min: 6, max: Infinity }, { min: 16, max: 6 }, { min: -1, max: 16 }, { min: 6.5, max: 16 }]) {
    expect(choose([{ ...program, ageRange }])).toMatchObject({ state: "needs_confirmation", programs: [{ fit: "needs_confirmation", reasons: ["program_age_policy_unknown"] }] });
  }
  for (const age of [NaN, Infinity, 10.5]) expect(choose([program], { age })).toMatchObject({ state: "needs_confirmation", programs: [{ fit: "needs_confirmation", reasons: ["age_confirmation_required"] }] });
});
