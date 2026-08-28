import { test, expect } from "@playwright/test";
import { NextRequest } from "next/server";
import { FetchStub } from "./fixtures/fetch-stub";

// Env BEFORE importing the route — the route + its libs read these at call time.
process.env.NOTION_API_KEY = "ntn_test";
process.env.NOTION_WAITLIST_DB_ID = "waitlist-db";
process.env.RESEND_API_KEY = "re_test";
// Open Brain is deliberately CONFIGURED here, unlike the crew-interest egress
// spec which deletes these so the helper self-skips. On this route the ingest
// is a live egress on every submission, so proving "the call didn't happen"
// would prove nothing. We let it fire and assert its PAYLOAD is child-free —
// that is the assertion that survives someone adding child_age to the metadata.
process.env.OPEN_BRAIN_INGEST_URL = "https://ob.test.local/functions/v1/leads-ingest";
process.env.LEAD_INGEST_TOKEN = "ob_token_test";

import { POST } from "../src/app/api/waitlist/route";

// Waitlist child-PII egress invariant. Child fields (first name, age, level)
// may reach ONLY Notion (the row) and Resend (the admin notification, which is
// addressed to Sam). Open Brain may be CALLED — it carries the parent — but
// must never carry a child field. Any other host is a hostile-review trigger.
const NOTION = "api.notion.com";
const RESEND = "api.resend.com";
const OPEN_BRAIN = "ob.test.local";
const ALLOWED_HOSTS = [NOTION, RESEND, OPEN_BRAIN];

const CHILD_NAME = "Egresswaitkid";
const CHILD_AGE = "11";
const CHILD_LEVEL = "Green";
const PARENT_EMAIL = "egress-waitlist@example.com";

let ipCounter = 0;

function body(over: Record<string, unknown> = {}): string {
  return JSON.stringify({
    parentName: "Egress Parent",
    contact: PARENT_EMAIL,
    preferredArea: "Olney",
    marketingOptIn: false,
    childFirstName: CHILD_NAME,
    childAge: CHILD_AGE,
    childLevel: CHILD_LEVEL,
    ...over,
  });
}

function req(payload: string): NextRequest {
  // Unique IP per call — the route's in-memory limiter is 5/hr per IP and
  // this file makes more than five submissions.
  ipCounter += 1;
  return new NextRequest("http://localhost/api/waitlist", {
    method: "POST",
    body: payload,
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": `10.0.0.${ipCounter}`,
    },
  });
}

const stub = new FetchStub();
test.beforeEach(() => {
  stub.reset();
  stub
    .on("api.notion.com/v1/pages", { id: "waitlist-row-created" })
    .on("api.notion.com", { results: [] })
    .on("api.resend.com", { id: "email_test" })
    .on("ob.test.local", { ok: true })
    .install();
});
test.afterEach(() => stub.uninstall());

function callsToHost(host: string) {
  return stub.calls.filter((c) => new URL(c.url).host === host);
}

test.describe("waitlist route — child-PII egress", () => {
  test("child fields reach only Notion + Resend; no third host is contacted", async () => {
    const res = await POST(req(body()));
    expect(res.status).toBe(200);

    // The stub throws on any unstubbed URL, so reaching here already proves no
    // unexpected host. Belt-and-braces: verify every recorded call.
    expect(stub.calls.length).toBeGreaterThan(0);
    for (const call of stub.calls) {
      const host = new URL(call.url).host;
      expect(ALLOWED_HOSTS, `unexpected egress to ${call.url}`).toContain(host);
    }

    // Every request body that carries a child field must belong to Notion or
    // Resend — nothing else may even mention the child.
    for (const call of stub.calls) {
      if (
        call.body.includes(CHILD_NAME) ||
        call.body.includes(`"Child Level"`)
      ) {
        const host = new URL(call.url).host;
        expect([NOTION, RESEND], `child data sent to ${call.url}`).toContain(
          host,
        );
      }
    }
  });

  test("the Open Brain ingest fires but carries no child field", async () => {
    await POST(req(body()));

    const obCalls = callsToHost(OPEN_BRAIN);
    // If this is 0 the test is asserting nothing — fail loudly rather than
    // pass vacuously.
    expect(
      obCalls.length,
      "Open Brain did not fire; this spec would prove nothing",
    ).toBeGreaterThan(0);

    for (const call of obCalls) {
      expect(call.body).toContain(PARENT_EMAIL); // the parent is the point
      expect(call.body).not.toContain(CHILD_NAME);
      expect(call.body.toLowerCase()).not.toContain("child_first_name");
      expect(call.body.toLowerCase()).not.toContain("child_age");
      expect(call.body.toLowerCase()).not.toContain("child_level");
      expect(call.body).not.toContain(CHILD_LEVEL);
    }
  });

  test("the Notion row — the intended destination — does receive the child", async () => {
    await POST(req(body()));

    const creates = stub.calls.filter((c) => c.url.includes("/v1/pages"));
    expect(creates).toHaveLength(1);
    expect(creates[0].body).toContain(CHILD_NAME);
    expect(creates[0].body).toContain("Child First Name");
    expect(creates[0].body).toContain("Child Age");
    expect(creates[0].body).toContain("Child Level");
  });

  test("the JSON response never echoes child PII back to the caller", async () => {
    const res = await POST(req(body()));
    const text = await res.text();
    expect(text).not.toContain(CHILD_NAME);
    expect(text).not.toContain(PARENT_EMAIL);
    expect(text.toLowerCase()).not.toContain("child");
  });

  test("an age outside 6-16 is rejected before any write", async () => {
    for (const age of ["5", "17", "0", "abc"]) {
      stub.reset();
      stub
        .on("api.notion.com/v1/pages", { id: "should-not-happen" })
        .on("api.notion.com", { results: [] })
        .on("api.resend.com", { id: "email_test" })
        .on("ob.test.local", { ok: true })
        .install();

      const res = await POST(req(body({ childAge: age })));
      expect(res.status, `age ${age} should be rejected`).toBe(400);
      expect(
        stub.calls.length,
        `age ${age} must not reach any service`,
      ).toBe(0);
    }
  });

  test("a missing child first name is rejected before any write", async () => {
    const res = await POST(req(body({ childFirstName: "  " })));
    expect(res.status).toBe(400);
    expect(stub.calls.length).toBe(0);
  });
});
