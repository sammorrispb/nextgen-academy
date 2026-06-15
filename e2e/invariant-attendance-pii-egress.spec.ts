import { test, expect } from "@playwright/test";
import { NextRequest } from "next/server";
import { FetchStub } from "./fixtures/fetch-stub";

process.env.ATTENDANCE_SECRET = "test-attendance-secret";
process.env.NOTION_API_KEY = "ntn_test";
process.env.NOTION_DROPINS_DB_ID = "dropins-db";
process.env.OPEN_BRAIN_INGEST_URL = "https://ob.test/ingest";
process.env.LEAD_INGEST_TOKEN = "ob-token";

const PLAYER_DB = "1e5e34c258384c6cb5f3e846543ecfc7";

import { POST } from "../src/app/api/coach/attendance/route";

// Child-PII egress invariant for the agent-callable attendance route — sibling
// of invariant-child-pii-egress.spec.ts (registration path). On a check-in,
// child fields (first name + birth year, never more) may flow ONLY to Notion
// and the Open Brain ingest host. The JSON ack returned to the caller must never
// echo child or parent PII (hostile-reviewer item #1).
const OB_HOST = "ob.test";
const ALLOWED_HOSTS = ["api.notion.com", OB_HOST];
const CHILD_NAME = "Egresskid";
const CHILD_YEAR = "2016";

function dropInPage() {
  return {
    id: "row-1",
    properties: {
      "Parent Email": { email: "parent@example.com" },
      "Parent Phone": { phone_number: "" },
      "Parent Name": { rich_text: [{ plain_text: "Parent One" }] },
      "Child First Name": { rich_text: [{ plain_text: CHILD_NAME }] },
      "Child Birth Year": { number: Number(CHILD_YEAR) },
      "Session Title": { rich_text: [{ plain_text: "Walter Johnson HS" }] },
      "Session Date": { date: { start: "2026-06-14" } },
      "Session Start Time": { rich_text: [{ plain_text: "10:00 AM" }] },
      Location: { rich_text: [{ plain_text: "WJ HS" }] },
      Attendance: { select: null },
      "Stripe Checkout Session ID": { rich_text: [{ plain_text: "cs_test_1" }] },
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
  return new NextRequest("http://localhost/api/coach/attendance", {
    method: "POST",
    body: JSON.stringify({ checkoutSessionId: "cs_test_1", attended: "Present" }),
    headers: {
      "content-type": "application/json",
      authorization: "Bearer test-attendance-secret",
    },
  });
}

test.describe("attendance route — child-PII egress", () => {
  test("child fields reach only Notion + Open Brain; no third host", async () => {
    stub
      .on(`/databases/${PLAYER_DB}/query`, { results: [{ id: "player-1" }] })
      .on("/databases/dropins-db/query", { results: [dropInPage()] })
      .on("ob.test/ingest", { ok: true })
      .on("api.notion.com/v1/pages", { id: "patched" });

    await POST(req());

    expect(stub.calls.length).toBeGreaterThan(0);
    for (const call of stub.calls) {
      const host = new URL(call.url).host;
      expect(ALLOWED_HOSTS, `unexpected egress to ${call.url}`).toContain(host);
    }
    const ob = stub.callsTo("ob.test/ingest");
    expect(ob).toHaveLength(1);
    expect(ob[0].body).toContain("child_first_name");
    expect(ob[0].body).toContain(CHILD_NAME);
  });

  test("JSON ack never echoes child or parent PII", async () => {
    stub
      .on(`/databases/${PLAYER_DB}/query`, { results: [{ id: "player-1" }] })
      .on("/databases/dropins-db/query", { results: [dropInPage()] })
      .on("ob.test/ingest", { ok: true })
      .on("api.notion.com/v1/pages", { id: "patched" });

    const res = await POST(req());
    const text = JSON.stringify(await res.json());
    expect(text).not.toContain(CHILD_NAME);
    expect(text).not.toContain(CHILD_YEAR);
    expect(text).not.toContain("parent@example.com");
  });
});
