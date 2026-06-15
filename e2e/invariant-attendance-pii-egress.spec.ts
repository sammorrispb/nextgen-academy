import { test, expect } from "@playwright/test";
import { NextRequest } from "next/server";
import { FetchStub } from "./fixtures/fetch-stub";

process.env.ATTENDANCE_SECRET = "test-attendance-secret";
process.env.NOTION_API_KEY = "ntn_test_key";
process.env.NOTION_DROPINS_DB_ID = "db-dropins-test";
process.env.OPEN_BRAIN_INGEST_URL = "https://ob.test/ingest";
process.env.LEAD_INGEST_TOKEN = "ob-token";

import { POST as attendance } from "../src/app/api/attendance/route";

// Child-PII egress invariant for the agent-callable attendance route — the
// sibling of e2e/invariant-child-pii-egress.spec.ts for the registration path.
// On a check-in, child fields (first name + birth year, never more) may flow
// ONLY to Notion (the CRM) and the Open Brain ingest host. The JSON ack returned
// to the caller must never echo child PII (hostile-reviewer item #1).
const PLAYER_DB = "1e5e34c258384c6cb5f3e846543ecfc7";
const DROPINS_DB = "db-dropins-test";
const OB_HOST = "ob.test";
const ALLOWED_HOSTS = ["api.notion.com", OB_HOST];
const CHILD_NAME = "Egresskid";
const CHILD_YEAR = "2016";

function dropInRow() {
  return {
    id: "dropin-page-1",
    properties: {
      "Parent Name": { rich_text: [{ plain_text: "Parent Test" }] },
      "Parent Email": { email: "parent@test.com" },
      "Parent Phone": { phone_number: "" },
      "Child First Name": { rich_text: [{ plain_text: CHILD_NAME }] },
      "Child Birth Year": { number: Number(CHILD_YEAR) },
      "Session Title": { rich_text: [{ plain_text: "Green Ball Drop-in" }] },
      "Session Date": { date: { start: "2026-06-20" } },
      "Session Start Time": { rich_text: [{ plain_text: "4:00 PM" }] },
      "Location": { rich_text: [{ plain_text: "Redland" }] },
      "Attendance": { select: null },
      "Stripe Checkout Session ID": { rich_text: [{ plain_text: "cs_test" }] },
    },
  };
}

const stub = new FetchStub();
test.beforeEach(() => {
  stub.reset();
  stub.install();
});
test.afterEach(() => stub.uninstall());

function req(): NextRequest {
  return new NextRequest("http://localhost/api/attendance", {
    method: "POST",
    body: JSON.stringify({ checkoutSessionId: "cs_test", attended: "Present" }),
    headers: {
      "content-type": "application/json",
      authorization: "Bearer test-attendance-secret",
    },
  });
}

test.describe("attendance child-PII egress", () => {
  test("child fields reach only Notion + Open Brain; no third host", async () => {
    stub
      .on(`${PLAYER_DB}/query`, { results: [{ id: "player-row-1", properties: {} }] })
      .on(`${DROPINS_DB}/query`, { results: [dropInRow()] })
      .on("api.notion.com/v1/pages/", { id: "patched" })
      .on("ob.test/ingest", { ok: true })
      .install();

    await attendance(req());

    expect(stub.calls.length).toBeGreaterThan(0);
    for (const call of stub.calls) {
      const host = new URL(call.url).host;
      expect(ALLOWED_HOSTS, `unexpected egress to ${call.url}`).toContain(host);
    }

    // The OB payload carries the child first name + birth year (and session
    // context) — and nothing the route shouldn't have, because it reuses the
    // exact ingest shape the coach action does.
    const ob = stub.callsTo("ob.test/ingest");
    expect(ob).toHaveLength(1);
    expect(ob[0].body).toContain("child_first_name");
    expect(ob[0].body).toContain(CHILD_NAME);
  });

  test("JSON ack never echoes child PII back to the caller", async () => {
    stub
      .on(`${PLAYER_DB}/query`, { results: [{ id: "player-row-1", properties: {} }] })
      .on(`${DROPINS_DB}/query`, { results: [dropInRow()] })
      .on("api.notion.com/v1/pages/", { id: "patched" })
      .on("ob.test/ingest", { ok: true })
      .install();

    const res = await attendance(req());
    const text = JSON.stringify(await res.json());
    expect(text).not.toContain(CHILD_NAME);
    expect(text).not.toContain(CHILD_YEAR);
    expect(text).not.toContain("parent@test.com");
  });
});
