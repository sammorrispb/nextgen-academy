import { test, expect } from "@playwright/test";
import { NextRequest } from "next/server";
import { FetchStub } from "./fixtures/fetch-stub";

// Env BEFORE importing the cron route.
process.env.CRON_SECRET = "test-cron-secret";
process.env.NOTION_API_KEY = "ntn_test";
process.env.NOTION_CREW_INTEREST_DB_ID = "crew-interest-db";
process.env.NOTION_SESSIONS_DB_ID = "sessions-db";
process.env.RESEND_API_KEY = "re_test";
delete process.env.OPEN_BRAIN_INGEST_URL;
delete process.env.LEAD_INGEST_TOKEN;

import { GET } from "../src/app/api/cron/crew-followup/route";

// The crew-followup cron reads child PII (first name, birth year, level) to
// build a parent re-engagement email + an internal digest to Sam. Two pins:
// (a) Bearer auth fails closed — zero downstream calls without the secret.
// (b) Child/parent data egresses ONLY to Notion + Resend, comms go to the
//     parent/admin, and the JSON ack never echoes child PII.
const ALLOWED_HOSTS = ["api.notion.com", "api.resend.com"];
const CHILD_NAME = "Followupkid";
const PARENT_EMAIL = "followup-parent@example.com";

function crewRow(createdDaysAgo: number) {
  return {
    id: "crew-1",
    created_time: new Date(
      Date.now() - createdDaysAgo * 24 * 60 * 60 * 1000,
    ).toISOString(),
    properties: {
      "Parent Name": { title: [{ plain_text: "Followup Parent" }] },
      "Parent Email": { email: PARENT_EMAIL },
      "Parent Phone": { phone_number: "" },
      "Child First Name": { rich_text: [{ plain_text: CHILD_NAME }] },
      "Child Birth Year": { number: 2016 },
      "Child Level": { select: { name: "Green" } },
      "Skill Sub-Level": { select: { name: "Mid" } },
      "Preferred Days": { multi_select: [{ name: "Tue" }, { name: "Thu" }] },
      "Preferred Time": { rich_text: [{ plain_text: "after school" }] },
      "Preferred Location": { rich_text: [{ plain_text: "Rockville" }] },
      Status: { select: { name: "New" } },
      "Nudge Sent": { checkbox: false },
      "Reengagement Sent": { checkbox: false },
    },
  };
}

function req(token?: string): NextRequest {
  const headers: Record<string, string> = {};
  if (token !== undefined) headers.authorization = `Bearer ${token}`;
  return new NextRequest("http://localhost/api/cron/crew-followup", {
    method: "GET",
    headers,
  });
}

const stub = new FetchStub();
test.beforeEach(() => {
  stub.reset();
  stub.install();
});
test.afterEach(() => stub.uninstall());

test.describe("crew-followup cron — Bearer gate (fail closed)", () => {
  test("no Authorization → 401, zero downstream calls", async () => {
    const res = await GET(req(undefined));
    expect(res.status).toBe(401);
    expect(stub.calls.length).toBe(0);
  });

  test("wrong token → 401, zero downstream calls", async () => {
    const res = await GET(req("nope"));
    expect(res.status).toBe(401);
    expect(stub.calls.length).toBe(0);
  });
});

test.describe("crew-followup cron — PII egress", () => {
  test("a 7-day row re-engages the parent via Resend, only Notion + Resend hosts", async () => {
    stub
      .on("/databases/crew-interest-db/query", { results: [crewRow(10)] })
      .on("/databases/sessions-db/query", { results: [] })
      .on("api.notion.com/v1/pages", { id: "patched" })
      .on("api.resend.com", { id: "email_test" });

    const res = await GET(req("test-cron-secret"));
    expect(res.status).toBe(200);

    for (const call of stub.calls) {
      const host = new URL(call.url).host;
      expect(ALLOWED_HOSTS, `unexpected egress to ${call.url}`).toContain(host);
    }

    const emails = stub.callsTo("api.resend.com");
    expect(emails.length, "one parent re-engagement email").toBe(1);
    expect(emails[0].body).toContain(PARENT_EMAIL);

    const ack = JSON.stringify(await res.json());
    expect(ack).not.toContain(CHILD_NAME);
    expect(ack).not.toContain(PARENT_EMAIL);
    expect(ack).toContain('"reengaged":1');
  });
});
