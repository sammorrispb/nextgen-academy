import { test, expect } from "@playwright/test";
import { FetchStub } from "./fixtures/fetch-stub";
import { ingestToOpenBrain } from "../src/lib/open-brain-ingest";
import { buildAgeStats } from "../src/lib/notion-sessions";
import { socialProofLine } from "../src/components/SessionInfoBlock";
import type { NgaSession } from "../src/lib/notion-sessions";

// ── Open Brain child-field cap ──────────────────────────────────────────────
// Sam's call (2026-08-30, recorded in open-brain nga-crm-sync/index.ts): Open
// Brain may hold a child's first name and age — nothing further. No birth
// year, date of birth, last name, allergies, emergency contact, school or
// medical note. 27 call sites feed ingestToOpenBrain, and the webhook ones run
// inside after() where the pure harness can't observe them, so the cap is
// enforced (and tested) in the helper itself, where every caller passes.
const OB_URL = "https://ob.test.local/functions/v1/leads-ingest";

const FORBIDDEN_VALUES = {
  child_birth_year: 2015,
  child_dob: "2015-04-02",
  child_last_name: "Forbiddenlast",
  allergies: "peanuts-forbidden",
  emergency_name: "Forbidden Contact",
  emergency_phone: "3015550199",
  child_school: "Forbidden Elementary",
  medical_notes: "forbidden-asthma",
  birthdate: "2015-04-02",
};

const stub = new FetchStub();
test.beforeEach(() => {
  process.env.OPEN_BRAIN_INGEST_URL = OB_URL;
  process.env.LEAD_INGEST_TOKEN = "ob_token_cap";
  stub.reset();
  stub.on("ob.test.local", { ok: true }).install();
});
test.afterEach(() => {
  stub.uninstall();
  delete process.env.OPEN_BRAIN_INGEST_URL;
  delete process.env.LEAD_INGEST_TOKEN;
});

async function sentBody(metadata: Record<string, unknown>) {
  await ingestToOpenBrain({
    email: "parent-cap@example.com",
    name: "Cap Parent",
    business: "nga",
    source: "nga_summer_camp",
    metadata,
  });
  const calls = stub.callsTo("ob.test.local");
  expect(calls).toHaveLength(1);
  return { raw: calls[0].body, json: JSON.parse(calls[0].body) };
}

test.describe("Open Brain ingest carries a child's first name + age and nothing further", () => {
  test("every forbidden child field is stripped, at the top level", async () => {
    const { raw } = await sentBody({ ...FORBIDDEN_VALUES, child_first_name: "Allowedkid" });
    for (const [key, value] of Object.entries(FORBIDDEN_VALUES)) {
      expect(raw, `metadata.${key} reached Open Brain`).not.toContain(String(value));
    }
  });

  test("…and when nested inside arrays or objects", async () => {
    const { raw } = await sentBody({
      kids: [{ name: "Allowedkid", age: 9, birth_year: 2016, allergies: "nested-forbidden" }],
      registration: { emergency_contact: { name: "Nested Forbidden", phone: "3015550100" } },
    });
    expect(raw).not.toContain("nested-forbidden");
    expect(raw).not.toContain("Nested Forbidden");
    expect(raw).not.toContain("2016");
  });

  test("child name fields keep only the first name", async () => {
    const { json } = await sentBody({
      child_name: "Allowedkid Forbiddensurname",
      child_first_name: "Allowedkid Forbiddensurname",
      kids: [{ name: "Allowedkid Forbiddensurname", age: 9 }],
    });
    expect(JSON.stringify(json)).not.toContain("Forbiddensurname");
    expect(json.metadata.child_name).toBe("Allowedkid");
    expect(json.metadata.kids[0]).toEqual({ name: "Allowedkid", age: 9 });
  });

  test("approved fields and parent/ops fields survive (no over-stripping)", async () => {
    const { json } = await sentBody({
      child_first_name: "Allowedkid",
      child_age: 9,
      child_level: "Green",
      kid_count: 2,
      kids: [{ name: "Allowedkid", age: 9 }],
      pipeline_stage: "new",
      landing_page: "/camp",
      message_id: "abc",
      average: 3,
      usage: "x",
      stripe_session: "cs_test_1",
      amount_paid_usd: 225,
    });
    expect(json.metadata).toEqual({
      child_first_name: "Allowedkid",
      child_age: 9,
      child_level: "Green",
      kid_count: 2,
      kids: [{ name: "Allowedkid", age: 9 }],
      pipeline_stage: "new",
      landing_page: "/camp",
      message_id: "abc",
      average: 3,
      usage: "x",
      stripe_session: "cs_test_1",
      amount_paid_usd: 225,
    });
    expect(json.email).toBe("parent-cap@example.com");
  });
});

// ── Public schedule social proof (M3 + D9) ──────────────────────────────────
// ageStats renders on public /schedule cards next to a venue, date and time.
// Only families who consented to public display contribute an age, and the
// line appears only when at least two players are going — "1 going" alone
// tells a stranger one child will be at that place at that time.
const THIS_YEAR = new Date().getUTCFullYear();
const kid = (age: number, displayConsent: boolean) => ({
  childBirthYear: THIS_YEAR - age,
  displayConsent,
});
function line(stats: NgaSession["ageStats"]): string | null {
  return socialProofLine({ ageStats: stats } as NgaSession);
}

test.describe("schedule social proof respects display consent", () => {
  test("a non-consented registrant's age is never shown", () => {
    const stats = buildAgeStats([kid(12, false), kid(8, true)]);
    expect(stats).toEqual({ count: 2, minAge: 8, maxAge: 8 });
    expect(line(stats)).toBe("2 going · age 8");
  });

  test("two registrants, neither consented → a count with no ages", () => {
    const stats = buildAgeStats([kid(12, false), kid(9, false)]);
    expect(line(stats)).toBe("2 going");
  });

  test("a single registrant renders nothing, consented or not", () => {
    expect(line(buildAgeStats([kid(9, true)]))).toBeNull();
    expect(line(buildAgeStats([kid(9, false)]))).toBeNull();
  });

  test("no registrants → null stats", () => {
    expect(buildAgeStats([])).toBeNull();
  });

  test("all consented → the full range, unchanged from before", () => {
    expect(line(buildAgeStats([kid(8, true), kid(11, true)]))).toBe("2 going · ages 8–11");
  });
});
