import { test, expect } from "@playwright/test";
import { NextRequest } from "next/server";
import { FetchStub } from "./fixtures/fetch-stub";

// Env BEFORE importing the route under test (the module + its libs read these
// at call time).
process.env.CREW_CONFIRM_SECRET = "test-crew-secret";
process.env.NOTION_API_KEY = "ntn_test";
process.env.NOTION_CREW_POLLS_DB_ID = "crew-polls-db";
process.env.NOTION_POLL_RESPONSES_DB_ID = "poll-responses-db";
process.env.RESEND_API_KEY = "re_test";

import { POST } from "../src/app/api/coach/crew-confirm/route";

// The agent-callable crew-confirm route MUST (a) fail closed on Bearer auth and
// (b) fire the SAME fan-out the coach ConfirmCrewForm does — the per-parent
// Resend email AND the poll Status → Confirmed write — through one shared path
// (confirmCrew). Writing the Notion Status directly would silently drop the
// parent emails; this pins that both fire together. The already-Confirmed early
// return is the idempotency guard (a Stripe-style redelivery / agent retry must
// not re-email a crew that is already locked).

function pollPage(status: string = "Open") {
  return {
    id: "poll-1",
    properties: {
      Slug: { rich_text: [{ plain_text: "tue-green-redland" }] },
      Title: { title: [{ plain_text: "Redland Tue Green" }] },
      Status: { select: { name: status } },
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

function responsePage(id: string, email: string, childFirst: string) {
  return {
    id,
    created_time: "2026-06-10T00:00:00.000Z",
    properties: {
      Poll: { relation: [{ id: "poll-1" }] },
      "Parent Name": { title: [{ plain_text: "Parent One" }] },
      "Parent Email": { email },
      "Parent Phone": { phone_number: "" },
      "Child First Name": { rich_text: [{ plain_text: childFirst }] },
      "Child Birth Year": { number: 2015 },
      "Child Level": { select: { name: "Green" } },
      Vote: { select: { name: "Yes" } },
      Note: { rich_text: [] },
    },
  };
}

function req(
  token: string | undefined,
  body: unknown = {
    pollSlug: "tue-green-redland",
    selectedResponseIds: ["resp-1"],
    firstSessionDate: "2026-06-23",
  },
): NextRequest {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (token !== undefined) headers.authorization = `Bearer ${token}`;
  return new NextRequest("http://localhost/api/coach/crew-confirm", {
    method: "POST",
    body: JSON.stringify(body),
    headers,
  });
}

const stub = new FetchStub();
test.beforeEach(() => {
  stub.reset();
  stub.install();
});
test.afterEach(() => stub.uninstall());

test.describe("crew-confirm route — Bearer gate (fail closed)", () => {
  test("no Authorization → 401, zero downstream calls", async () => {
    const res = await POST(req(undefined));
    expect(res.status).toBe(401);
    expect(stub.calls.length).toBe(0);
  });

  test("wrong token → 401, zero downstream calls", async () => {
    const res = await POST(req("wrong-token"));
    expect(res.status).toBe(401);
    expect(stub.calls.length).toBe(0);
  });

  test("fails closed when CREW_CONFIRM_SECRET is unset", async () => {
    const original = process.env.CREW_CONFIRM_SECRET;
    try {
      delete process.env.CREW_CONFIRM_SECRET;
      const res = await POST(req("undefined"));
      expect(res.status).toBe(401);
      expect(stub.calls.length).toBe(0);
    } finally {
      process.env.CREW_CONFIRM_SECRET = original;
    }
  });
});

test.describe("crew-confirm route — trigger parity", () => {
  test("authorized confirm fans out to a parent email + poll Status write", async () => {
    stub
      .on("/databases/crew-polls-db/query", { results: [pollPage("Open")] })
      .on("/databases/poll-responses-db/query", {
        results: [responsePage("resp-1", "parent@example.com", "Kid")],
      })
      .on("api.resend.com", { id: "email_test" })
      .on("api.notion.com/v1/pages", { id: "patched" });

    const res = await POST(req("test-crew-secret"));
    expect(res.status).toBe(200);

    const email = stub.callsTo("api.resend.com");
    expect(email.length, "exactly one parent email").toBe(1);

    const statusWrite = stub.calls.find(
      (c) =>
        c.method === "PATCH" &&
        /\/pages\//.test(c.url) &&
        c.body.includes('"Status"') &&
        c.body.includes('"Confirmed"'),
    );
    expect(statusWrite, "poll Status → Confirmed write").toBeTruthy();

    const ack = JSON.stringify(await res.json());
    expect(ack).toContain('"ok":true');
    expect(ack).toContain('"emailsSent":1');
  });

  test("idempotent re-fire on already-Confirmed poll → no email, no status write", async () => {
    stub
      .on("/databases/crew-polls-db/query", { results: [pollPage("Confirmed")] })
      .on("/databases/poll-responses-db/query", { results: [] })
      .on("api.resend.com", { id: "email_test" })
      .on("api.notion.com/v1/pages", { id: "patched" });

    const res = await POST(req("test-crew-secret"));
    expect(res.status).toBe(200);
    expect(stub.callsTo("api.resend.com").length, "no email on no-op").toBe(0);
    expect(stub.calls.find((c) => c.method === "PATCH"), "no PATCH on no-op").toBeFalsy();
    const ack = JSON.stringify(await res.json());
    expect(ack).toContain('"idempotent":true');
  });
});
