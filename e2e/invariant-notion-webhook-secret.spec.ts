import { test, expect } from "@playwright/test";
import { NextRequest } from "next/server";
import { FetchStub } from "./fixtures/fetch-stub";

process.env.NOTION_WEBHOOK_SECRET = "test-notion-webhook-secret";
process.env.NOTION_API_KEY = "ntn_test_key";

import { POST } from "../src/app/api/notion-session-webhook/route";

// Notion-automation → waitlist-blast trigger. Auth accepts the secret via the
// x-nga-webhook-secret header OR a ?secret= query param (Notion's built-in
// webhook action can't set custom headers on some plans — the tradeoff is
// documented in the route at lines ~209-212 and tracked in
// docs/source-inventory.md risk log #2: query-param secrets land in access
// logs, and the compare is plain !==, not timing-safe. This spec pins the
// CURRENT contract; changing it is a slop-free-zone edit needing separate
// approval.
const stub = new FetchStub();
test.beforeEach(() => {
  stub.reset();
  stub.install();
});
test.afterEach(() => stub.uninstall());

function req(opts: { header?: string; query?: string; body?: string }): NextRequest {
  const qs = opts.query !== undefined ? `?secret=${encodeURIComponent(opts.query)}` : "";
  return new NextRequest(`http://localhost/api/notion-session-webhook${qs}`, {
    method: "POST",
    body: opts.body ?? "not-json",
    headers: {
      "content-type": "application/json",
      ...(opts.header !== undefined ? { "x-nga-webhook-secret": opts.header } : {}),
    },
  });
}

test.describe("notion-session-webhook secret gate", () => {
  test("fails closed (503) when NOTION_WEBHOOK_SECRET is unset", async () => {
    const original = process.env.NOTION_WEBHOOK_SECRET;
    try {
      delete process.env.NOTION_WEBHOOK_SECRET;
      const res = await POST(req({}));
      expect(res.status).toBe(503);
      expect(stub.calls.length).toBe(0);
    } finally {
      process.env.NOTION_WEBHOOK_SECRET = original;
    }
  });

  test("no secret anywhere → 401, zero downstream calls", async () => {
    const res = await POST(req({}));
    expect(res.status).toBe(401);
    expect(stub.calls.length).toBe(0);
  });

  test("wrong header secret → 401", async () => {
    const res = await POST(req({ header: "wrong" }));
    expect(res.status).toBe(401);
    expect(stub.calls.length).toBe(0);
  });

  test("wrong query-param secret → 401", async () => {
    const res = await POST(req({ query: "wrong" }));
    expect(res.status).toBe(401);
    expect(stub.calls.length).toBe(0);
  });

  test("correct HEADER secret passes the gate (then 400 on bad JSON, no side effects)", async () => {
    const res = await POST(req({ header: "test-notion-webhook-secret" }));
    expect(res.status).toBe(400); // auth passed; body parse failed
    expect(stub.calls.length).toBe(0);
  });

  test("correct QUERY-PARAM secret passes the gate (documented fallback)", async () => {
    const res = await POST(req({ query: "test-notion-webhook-secret" }));
    expect(res.status).toBe(400);
    expect(stub.calls.length).toBe(0);
  });

  test("header takes precedence: wrong header + correct query param → 401", async () => {
    // The ?? chain reads the header FIRST; a present-but-wrong header is not
    // rescued by a correct query param.
    const res = await POST(
      req({ header: "wrong", query: "test-notion-webhook-secret" }),
    );
    expect(res.status).toBe(401);
    expect(stub.calls.length).toBe(0);
  });
});
