import { test, expect } from "@playwright/test";
import { NextRequest } from "next/server";
import { FetchStub } from "./fixtures/fetch-stub";

process.env.NGA_ADMIN_SECRET = "test-admin-secret";
process.env.STRIPE_SECRET_KEY = "sk_test_dummy_offline";
process.env.NOTION_API_KEY = "ntn_test_key";
process.env.NOTION_DROPINS_DB_ID = "db-dropins-test";

import { POST as cancelDropIn } from "../src/app/api/cancel-registration/route";
import { POST as cancelCamp } from "../src/app/api/cancel-camp-registration/route";

// Both routes can move money (Stripe refunds) and touch child rows. The gate
// must reject BEFORE any downstream call — the stub has zero rules, so any
// network attempt both throws and is recorded.
const stub = new FetchStub();
test.beforeEach(() => {
  stub.reset();
  stub.install();
});
test.afterEach(() => stub.uninstall());

function req(path: string, secret?: string): NextRequest {
  const qs = secret !== undefined ? `?secret=${encodeURIComponent(secret)}` : "";
  return new NextRequest(`http://localhost${path}${qs}`, {
    method: "POST",
    body: JSON.stringify({ checkoutSessionId: "cs_x" }),
    headers: { "content-type": "application/json" },
  });
}

const routes = [
  { name: "cancel-registration", handler: cancelDropIn, path: "/api/cancel-registration" },
  { name: "cancel-camp-registration", handler: cancelCamp, path: "/api/cancel-camp-registration" },
] as const;

for (const r of routes) {
  test.describe(`${r.name} auth gate (refund-capable)`, () => {
    test("no secret → 401 before any downstream call", async () => {
      const res = await r.handler(req(r.path));
      expect(res.status).toBe(401);
      expect(stub.calls.length).toBe(0);
    });

    test("wrong secret → 401 before any downstream call", async () => {
      const res = await r.handler(req(r.path, "wrong-secret"));
      expect(res.status).toBe(401);
      expect(stub.calls.length).toBe(0);
    });

    test("fails closed: unset NGA_ADMIN_SECRET rejects even a matching guess", async () => {
      const original = process.env.NGA_ADMIN_SECRET;
      try {
        delete process.env.NGA_ADMIN_SECRET;
        const res = await r.handler(req(r.path, ""));
        expect(res.status).toBe(401);
        expect(stub.calls.length).toBe(0);
      } finally {
        process.env.NGA_ADMIN_SECRET = original;
      }
    });
  });
}
