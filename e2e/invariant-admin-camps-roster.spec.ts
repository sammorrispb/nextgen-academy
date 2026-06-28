import { test, expect } from "@playwright/test";
import { NextRequest } from "next/server";
import { FetchStub } from "./fixtures/fetch-stub";
import {
  toAdminCampCamper,
  type AdminCampCamper,
} from "../src/lib/admin-camp-roster";
import type { CampRosterEntry } from "../src/lib/notion-camp-roster";

// The admin camps roster route returns child PII as JSON over a NEW egress path,
// so two invariants guard it:
//  1. The projection DROPS the camp-safety fields (allergies, emergency contact)
//     — those live only on the coach day-of roster, never on this admin surface.
//  2. The route fails closed: no admin cookie AND no Bearer → 401 before any
//     downstream read (the stub has zero rules, so any network attempt throws).
process.env.COACH_SIGNING_SECRET = "test-signing-secret";
process.env.ADMIN_ALLOWLIST = "admin@example.com";

import { GET as campsRoute } from "../src/app/api/admin/sessions/camps/route";

// --- 1. projection never carries allergy / emergency-contact PII ---

const ALLOWED_KEYS: (keyof AdminCampCamper)[] = [
  "stripeSessionId",
  "parentName",
  "parentEmail",
  "parentPhone",
  "childFirstName",
  "childBirthYear",
  "optionLabel",
  "optionKey",
  "selectedDay",
  "registeredAt",
];

const FULL_ENTRY: CampRosterEntry = {
  stripeSessionId: "cs_test_abc",
  parentName: "Dana Parent",
  parentEmail: "dana@example.com",
  parentPhone: "+13015550000",
  childFirstName: "Mia",
  childBirthYear: 2015,
  campSlug: "june-29",
  campTitle: "Summer Camp — Week 1",
  campWeek: "June 29 – July 2, 2026",
  optionLabel: "Full week (Mon–Thu)",
  optionKey: "week",
  selectedDay: "",
  allergies: "SENTINEL_PEANUT_ALLERGY",
  emergencyName: "SENTINEL_EMERGENCY_NAME",
  emergencyPhone: "SENTINEL_EMERGENCY_PHONE",
  registeredAt: "2026-06-01",
};

test("admin camp projection omits allergies + emergency contact", () => {
  const out = toAdminCampCamper(FULL_ENTRY);
  const serialized = JSON.stringify(out);
  // The day-of safety fields must never reach the admin roster surface.
  expect(serialized).not.toContain("SENTINEL_PEANUT_ALLERGY");
  expect(serialized).not.toContain("SENTINEL_EMERGENCY_NAME");
  expect(serialized).not.toContain("SENTINEL_EMERGENCY_PHONE");
  expect(Object.keys(out).sort()).toEqual([...ALLOWED_KEYS].sort());
  // ...while still carrying the registration-management fields the UI needs.
  expect(out.childFirstName).toBe("Mia");
  expect(out.stripeSessionId).toBe("cs_test_abc");
  expect(out.optionLabel).toBe("Full week (Mon–Thu)");
});

// --- 2. route auth gate fails closed before any downstream read ---

const stub = new FetchStub();
test.beforeEach(() => {
  stub.reset();
  stub.install();
});
test.afterEach(() => stub.uninstall());

function req(cookie?: string): NextRequest {
  const headers: Record<string, string> = {};
  if (cookie !== undefined) headers.cookie = `nga_admin=${cookie}`;
  return new NextRequest("http://localhost/api/admin/sessions/camps", {
    method: "GET",
    headers,
  });
}

test("no admin cookie + no Bearer → 401 before any downstream read", async () => {
  const res = await campsRoute(req());
  expect(res.status).toBe(401);
  expect(stub.calls.length).toBe(0);
});

test("garbage cookie → 401 before any downstream read", async () => {
  const res = await campsRoute(req("not-a-valid-token"));
  expect(res.status).toBe(401);
  expect(stub.calls.length).toBe(0);
});

test("fails closed: unset secrets still reject a presented token", async () => {
  const signing = process.env.COACH_SIGNING_SECRET;
  const ops = process.env.SESSION_OPS_SECRET;
  try {
    delete process.env.COACH_SIGNING_SECRET;
    delete process.env.SESSION_OPS_SECRET;
    const res = await campsRoute(req("ab.cd"));
    expect(res.status).toBe(401);
    expect(stub.calls.length).toBe(0);
  } finally {
    process.env.COACH_SIGNING_SECRET = signing;
    if (ops !== undefined) process.env.SESSION_OPS_SECRET = ops;
  }
});
