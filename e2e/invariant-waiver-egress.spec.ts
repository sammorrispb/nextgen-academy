import { test, expect } from "@playwright/test";
import { NextRequest } from "next/server";
import { FetchStub } from "./fixtures/fetch-stub";

// Env BEFORE importing the route — the route + libs read these at call time.
// Open Brain env is deliberately absent so that helper self-skips (no shadow
// egress); only Notion + Resend should be reached.
process.env.NOTION_API_KEY = "ntn_test";
process.env.NOTION_WAIVERS_DB_ID = "waivers-db-test";
process.env.RESEND_API_KEY = "re_test";
delete process.env.OPEN_BRAIN_INGEST_URL;
delete process.env.LEAD_INGEST_TOKEN;

import { POST } from "../src/app/api/waiver-sign/route";

// Waiver-sign egress invariant. The signature is parent-scoped PII; it may flow
// ONLY to Notion (the waiver row) and Resend (the parent's record-copy email).
// Any third host is a hostile-review trigger. The JSON ack must never echo the
// signature. No child data is collected here at all (parent-level record).
const ALLOWED_HOSTS = ["api.notion.com", "api.resend.com"];
const SIGNATURE = "Jordan A. Parent";

function body(over: Record<string, unknown> = {}): string {
  return JSON.stringify({
    parentName: "Jordan Parent",
    email: "egress-waiver@example.com",
    phone: "301-555-0142",
    signatureName: SIGNATURE,
    agree: true,
    ...over,
  });
}

function req(payload: string): NextRequest {
  return new NextRequest("http://localhost/api/waiver-sign", {
    method: "POST",
    body: payload,
    headers: { "content-type": "application/json" },
  });
}

const stub = new FetchStub();
test.beforeEach(() => {
  stub.reset();
  stub
    .on("api.notion.com/v1/pages", { id: "waiver-row-created" })
    .on("api.notion.com", { results: [] }) // dedup query → not found → create
    .on("api.resend.com", { id: "email_test" })
    .install();
});
test.afterEach(() => stub.uninstall());

test.describe("waiver-sign route — egress + ack", () => {
  test("signature reaches only Notion + Resend", async () => {
    const res = await POST(req(body()));
    expect(res.status).toBe(200);

    expect(stub.calls.length).toBeGreaterThan(0);
    for (const call of stub.calls) {
      const host = new URL(call.url).host;
      expect(ALLOWED_HOSTS, `unexpected egress to ${call.url}`).toContain(host);
      expect(call.url).not.toContain("open-brain");
    }

    // The signature actually lands on the Notion row.
    const create = stub.callsTo("api.notion.com/v1/pages");
    expect(create).toHaveLength(1);
    expect(create[0].body).toContain(SIGNATURE);
    // Version + signer audit fields travel with it.
    expect(create[0].body).toContain("Waiver Version");
    expect(create[0].body).toContain("Signed At");
  });

  test("JSON ack never echoes the signature", async () => {
    const res = await POST(req(body()));
    const text = JSON.stringify(await res.json());
    expect(text).not.toContain(SIGNATURE);
  });

  test("a re-sign dedups (no duplicate row created)", async () => {
    stub.reset();
    stub
      .on("api.notion.com/v1/pages", { id: "should-not-be-called" })
      .on("api.notion.com", { results: [{ id: "existing-waiver" }] }) // already on file
      .on("api.resend.com", { id: "email_test" })
      .install();

    const res = await POST(req(body()));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.alreadyOnFile).toBe(true);
    // No page-create call when a row already exists.
    expect(stub.callsTo("api.notion.com/v1/pages")).toHaveLength(0);
  });
});
