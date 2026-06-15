import { test, expect } from "@playwright/test";
import { NextRequest } from "next/server";
import { FetchStub } from "./fixtures/fetch-stub";

process.env.CREW_CONFIRM_SECRET = "test-crew-secret";
process.env.NOTION_API_KEY = "ntn_test";
process.env.NOTION_CREW_POLLS_DB_ID = "crew-polls-db";
process.env.NOTION_POLL_RESPONSES_DB_ID = "poll-responses-db";
process.env.RESEND_API_KEY = "re_test";

import { POST } from "../src/app/api/coach/crew-confirm/route";

// Child/parent-PII egress invariant for the agent-callable crew-confirm route —
// sibling of invariant-attendance-pii-egress.spec.ts. On a confirm, parent +
// child fields may flow ONLY to Notion (the Status write reads the poll/response
// rows) and the Resend email host. The JSON ack returned to the caller must
// never echo child or parent PII (hostile-reviewer item #1).
const ALLOWED_HOSTS = ["api.notion.com", "api.resend.com"];
const CHILD_NAME = "Egresskid";
const PARENT_EMAIL = "egress-parent@example.com";

function pollPage() {
  return {
    id: "poll-1",
    properties: {
      Slug: { rich_text: [{ plain_text: "tue-green-redland" }] },
      Title: { title: [{ plain_text: "Redland Tue Green" }] },
      Status: { select: { name: "Open" } },
      Day: { rich_text: [{ plain_text: "Tuesday" }] },
      "Start Time": { rich_text: [{ plain_text: "6:00 PM" }] },
      "End Time": { rich_text: [{ plain_text: "7:00 PM" }] },
      Location: { rich_text: [{ plain_text: "Redland MS" }] },
      Level: { select: { name: "Green" } },
      "Min Party Size": { number: 4 },
      "Coach Notes": { rich_text: [] },
    },
  };
}

function responsePage() {
  return {
    id: "resp-1",
    created_time: "2026-06-10T00:00:00.000Z",
    properties: {
      Poll: { relation: [{ id: "poll-1" }] },
      "Parent Name": { title: [{ plain_text: "Egress Parent" }] },
      "Parent Email": { email: PARENT_EMAIL },
      "Parent Phone": { phone_number: "" },
      "Child First Name": { rich_text: [{ plain_text: CHILD_NAME }] },
      "Child Birth Year": { number: 2016 },
      "Child Level": { select: { name: "Green" } },
      Vote: { select: { name: "Yes" } },
      Note: { rich_text: [] },
    },
  };
}

function req(): NextRequest {
  return new NextRequest("http://localhost/api/coach/crew-confirm", {
    method: "POST",
    body: JSON.stringify({
      pollSlug: "tue-green-redland",
      selectedResponseIds: ["resp-1"],
      firstSessionDate: "2026-06-23",
    }),
    headers: {
      "content-type": "application/json",
      authorization: "Bearer test-crew-secret",
    },
  });
}

const stub = new FetchStub();
test.beforeEach(() => {
  stub.reset();
  stub.install();
});
test.afterEach(() => stub.uninstall());

test.describe("crew-confirm route — parent/child-PII egress", () => {
  test("parent/child fields reach only Notion + Resend; no third host", async () => {
    stub
      .on("/databases/crew-polls-db/query", { results: [pollPage()] })
      .on("/databases/poll-responses-db/query", { results: [responsePage()] })
      .on("api.resend.com", { id: "email_test" })
      .on("api.notion.com/v1/pages", { id: "patched" });

    await POST(req());

    expect(stub.calls.length).toBeGreaterThan(0);
    for (const call of stub.calls) {
      const host = new URL(call.url).host;
      expect(ALLOWED_HOSTS, `unexpected egress to ${call.url}`).toContain(host);
    }
    // The parent email is the recipient — it must travel to Resend.
    const email = stub.callsTo("api.resend.com");
    expect(email).toHaveLength(1);
    expect(email[0].body).toContain(PARENT_EMAIL);
  });

  test("JSON ack never echoes child or parent PII", async () => {
    stub
      .on("/databases/crew-polls-db/query", { results: [pollPage()] })
      .on("/databases/poll-responses-db/query", { results: [responsePage()] })
      .on("api.resend.com", { id: "email_test" })
      .on("api.notion.com/v1/pages", { id: "patched" });

    const res = await POST(req());
    const text = JSON.stringify(await res.json());
    expect(text).not.toContain(CHILD_NAME);
    expect(text).not.toContain(PARENT_EMAIL);
    expect(text).not.toContain("Egress Parent");
  });
});
