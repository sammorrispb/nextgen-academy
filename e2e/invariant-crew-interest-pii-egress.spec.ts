import { test, expect } from "@playwright/test";
import { NextRequest } from "next/server";
import { FetchStub } from "./fixtures/fetch-stub";

// Env BEFORE importing the route — the route + its libs read these at call time.
// Open Brain + Coach OS cohort-pool envs are deliberately absent so those
// helpers self-skip (no shadow egress); only Notion + Resend should be reached.
process.env.NOTION_API_KEY = "ntn_test";
process.env.NOTION_CREW_INTEREST_DB_ID = "crew-interest-db";
process.env.NOTION_SESSIONS_DB_ID = "sessions-db";
process.env.RESEND_API_KEY = "re_test";
delete process.env.OPEN_BRAIN_INGEST_URL;
delete process.env.LEAD_INGEST_TOKEN;
delete process.env.COACH_OS_COHORT_INTAKE_URL;
delete process.env.COHORT_INTAKE_TOKEN;

import { POST } from "../src/app/api/crew-interest/route";

// Crew Interest egress invariant. Child fields — including the new optional
// skill sub-level (approved 2026-06-17) — may flow ONLY to Notion (the CRM row)
// and Resend (parent confirmation + admin notification). Any third host is a
// hostile-review trigger. The JSON ack must never echo child PII.
const ALLOWED_HOSTS = ["api.notion.com", "api.resend.com"];
const CHILD_NAME = "Egresscrewkid";
const SUB_LEVEL = "High";

function body(over: Record<string, unknown> = {}): string {
  return JSON.stringify({
    parentName: "Egress Parent",
    email: "egress-crew@example.com",
    phone: "",
    childFirstName: CHILD_NAME,
    childAge: "10",
    childLevel: "Green",
    childSubLevel: SUB_LEVEL,
    preferredDays: ["Tue", "Thu"],
    preferredTimeOfDay: ["Afternoon"],
    preferredTime: "after school",
    preferredLocation: "Rockville",
    ...over,
  });
}

function req(payload: string): NextRequest {
  return new NextRequest("http://localhost/api/crew-interest", {
    method: "POST",
    body: payload,
    headers: { "content-type": "application/json" },
  });
}

const stub = new FetchStub();
test.beforeEach(() => {
  stub.reset();
  stub
    .on("api.notion.com/v1/pages", { id: "crew-row-created" })
    .on("api.notion.com", { results: [] })
    .on("api.resend.com", { id: "email_test" })
    .install();
});
test.afterEach(() => stub.uninstall());

test.describe("crew-interest route — child-PII egress", () => {
  test("child fields (incl sub-level) reach only Notion + Resend", async () => {
    const res = await POST(req(body()));
    expect(res.status).toBe(200);

    expect(stub.calls.length).toBeGreaterThan(0);
    for (const call of stub.calls) {
      const host = new URL(call.url).host;
      expect(ALLOWED_HOSTS, `unexpected egress to ${call.url}`).toContain(host);
      expect(call.url).not.toContain("open-brain");
      expect(call.url).not.toContain("cohort");
    }

    // The new sub-level field must actually land on the Notion CRM row.
    const create = stub.callsTo("api.notion.com/v1/pages");
    expect(create).toHaveLength(1);
    expect(create[0].body).toContain(CHILD_NAME);
    expect(create[0].body).toContain("Skill Sub-Level");
    expect(create[0].body).toContain(SUB_LEVEL);
  });

  test("JSON ack never echoes child PII", async () => {
    const res = await POST(req(body()));
    const text = JSON.stringify(await res.json());
    expect(text).not.toContain(CHILD_NAME);
    expect(text).not.toContain(SUB_LEVEL);
  });
});
