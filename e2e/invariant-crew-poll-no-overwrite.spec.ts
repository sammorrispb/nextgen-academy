import { test, expect } from "@playwright/test";
import { NextRequest } from "next/server";
import { FetchStub } from "./fixtures/fetch-stub";

process.env.NOTION_API_KEY = "ntn_test_poll";
process.env.NOTION_CREW_POLLS_DB_ID = "db-polls";
process.env.NOTION_POLL_RESPONSES_DB_ID = "db-poll-responses";
process.env.RESEND_API_KEY = "re_test_poll";
delete process.env.OPEN_BRAIN_INGEST_URL;
delete process.env.LEAD_INGEST_TOKEN;

import { POST } from "../src/app/api/crew-poll/vote/route";

// Security review 2026-09-28, M4. The public vote form is unauthenticated and
// used to UPSERT by email — anyone who knew a parent's address could replace
// that family's vote, child name, age, level and phone. The first response
// from an address now stands; a change goes through Coach Sam.

const POLL_PAGE = {
  id: "poll-1",
  properties: {
    Slug: { rich_text: [{ plain_text: "sat-green" }] },
    Title: { rich_text: [{ plain_text: "Saturday Green crew" }] },
    Status: { select: { name: "Open" } },
    Level: { select: { name: "Green" } },
    "Min Party Size": { number: 4 },
  },
};

let ip = 0;
function voteReq(email: string): NextRequest {
  ip += 1;
  return new NextRequest("http://localhost/api/crew-poll/vote", {
    method: "POST",
    body: JSON.stringify({
      pollSlug: "sat-green",
      parentName: "Other Person",
      email,
      phone: "3015550100",
      childFirstName: "Newkid",
      childAge: "10",
      childLevel: "Green",
      vote: "No",
    }),
    headers: { "content-type": "application/json", "x-forwarded-for": `10.6.0.${ip}` },
  });
}

const stub = new FetchStub();
test.afterEach(() => stub.uninstall());

test("a vote for an address that already voted changes nothing and emails no one", async () => {
  stub.reset();
  stub
    .on("databases/db-polls/query", { results: [POLL_PAGE] })
    .on("databases/db-poll-responses/query", {
      results: [{ id: "resp-existing", properties: {} }],
    })
    .on("api.notion.com/v1/pages", { id: "should-not-write" })
    .on("api.resend.com", { id: "email_test" })
    .install();

  const res = await POST(voteReq("victim-parent@example.com"));
  expect(res.status).toBe(409);
  const body = await res.json();
  expect(body.error).toMatch(/already have a response/i);
  expect(stub.callsTo("/v1/pages"), "no PATCH to the existing row, no new row").toHaveLength(0);
  expect(stub.callsTo("api.resend.com"), "no email to the address").toHaveLength(0);
});

test("a first vote is still recorded and confirmed", async () => {
  stub.reset();
  stub
    .on("databases/db-polls/query", { results: [POLL_PAGE] })
    .on("databases/db-poll-responses/query", { results: [] })
    .on("api.notion.com/v1/pages", { id: "resp-new" })
    .on("api.resend.com", { id: "email_test" })
    .install();

  const res = await POST(voteReq("first-voter@example.com"));
  expect(res.status).toBe(200);
  const writes = stub.callsTo("/v1/pages");
  expect(writes).toHaveLength(1);
  expect(writes[0].method).toBe("POST");
  expect(stub.callsTo("api.resend.com").length).toBeGreaterThanOrEqual(1);
});

test("if Notion can't say whether the address voted, nothing is written", async () => {
  stub.reset();
  stub
    .on("databases/db-polls/query", { results: [POLL_PAGE] })
    .on("databases/db-poll-responses/query", { error: "rate_limited" }, 429)
    .on("api.notion.com/v1/pages", { id: "should-not-write" })
    .on("api.resend.com", { id: "email_test" })
    .install();

  const res = await POST(voteReq("unknown@example.com"));
  expect(res.status).toBe(503);
  expect(stub.callsTo("/v1/pages")).toHaveLength(0);
});
