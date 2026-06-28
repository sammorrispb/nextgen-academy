import { test, expect } from "@playwright/test";
import { NextRequest } from "next/server";
import { FetchStub } from "./fixtures/fetch-stub";

// The admin camps cancel route moves money (Stripe refund) via the shared
// cancelCampRegistration engine. The gate must reject BEFORE the engine runs,
// and a malformed authorized call must 400 before any refund. The stub has zero
// rules, so any downstream network attempt both throws and is recorded.
process.env.COACH_SIGNING_SECRET = "test-signing-secret";
process.env.ADMIN_ALLOWLIST = "admin@example.com";
process.env.SESSION_OPS_SECRET = "test-ops-secret";

import { POST as cancelRoute } from "../src/app/api/admin/sessions/camps/cancel/route";

const stub = new FetchStub();
test.beforeEach(() => {
  stub.reset();
  stub.install();
});
test.afterEach(() => stub.uninstall());

function req(opts: { cookie?: string; bearer?: string; body?: unknown }): NextRequest {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (opts.cookie !== undefined) headers.cookie = `nga_admin=${opts.cookie}`;
  if (opts.bearer !== undefined) headers.authorization = `Bearer ${opts.bearer}`;
  return new NextRequest("http://localhost/api/admin/sessions/camps/cancel", {
    method: "POST",
    headers,
    body: JSON.stringify(opts.body ?? { checkoutSessionId: "cs_test_x", refund: "full" }),
  });
}

test("no auth → 401 before any refund", async () => {
  const res = await cancelRoute(req({}));
  expect(res.status).toBe(401);
  expect(stub.calls.length).toBe(0);
});

test("garbage cookie → 401 before any refund", async () => {
  const res = await cancelRoute(req({ cookie: "not-a-valid-token" }));
  expect(res.status).toBe(401);
  expect(stub.calls.length).toBe(0);
});

test("fails closed: unset SESSION_OPS_SECRET rejects a Bearer token", async () => {
  const ops = process.env.SESSION_OPS_SECRET;
  try {
    delete process.env.SESSION_OPS_SECRET;
    const res = await cancelRoute(req({ bearer: "test-ops-secret" }));
    expect(res.status).toBe(401);
    expect(stub.calls.length).toBe(0);
  } finally {
    process.env.SESSION_OPS_SECRET = ops;
  }
});

test("authorized but no checkoutSessionId/parentEmail → 400 before any refund", async () => {
  const res = await cancelRoute(req({ bearer: "test-ops-secret", body: { refund: "full" } }));
  expect(res.status).toBe(400);
  expect(stub.calls.length).toBe(0);
});
