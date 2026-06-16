import { test, expect } from "@playwright/test";
import { NextRequest } from "next/server";
import { FetchStub } from "./fixtures/fetch-stub";

// These admin routes mutate child rows and (cancel) move money. The cookie gate
// must reject BEFORE any downstream call — the stub has zero rules, so any
// network attempt both throws and is recorded.
process.env.COACH_SIGNING_SECRET = "test-signing-secret";
process.env.ADMIN_ALLOWLIST = "admin@example.com";
process.env.NOTION_API_KEY = "ntn_test_key";
process.env.NOTION_DROPINS_DB_ID = "db-dropins-test";
process.env.NOTION_SESSIONS_DB_ID = "db-sessions-test";

import { POST as cancelRoute } from "../src/app/api/admin/sessions/cancel/route";
import { POST as rescheduleRoute } from "../src/app/api/admin/sessions/reschedule/route";

const stub = new FetchStub();
test.beforeEach(() => {
  stub.reset();
  stub.install();
});
test.afterEach(() => stub.uninstall());

function req(path: string, cookie?: string): NextRequest {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (cookie !== undefined) headers.cookie = `nga_admin=${cookie}`;
  return new NextRequest(`http://localhost${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      sessionRowId: "11111111-1111-1111-1111-111111111111",
      sessionTitle: "Green Saturday",
      sessionDate: "2030-06-20",
      sessionStartTime: "6:00 PM",
      reason: "weather",
      newDate: "2030-06-27",
      newStartTime: "6:00 PM",
    }),
  });
}

const routes = [
  { name: "admin/sessions/cancel", handler: cancelRoute, path: "/api/admin/sessions/cancel" },
  { name: "admin/sessions/reschedule", handler: rescheduleRoute, path: "/api/admin/sessions/reschedule" },
] as const;

for (const r of routes) {
  test.describe(`${r.name} auth gate`, () => {
    test("no admin cookie → 401 before any downstream call", async () => {
      const res = await r.handler(req(r.path));
      expect(res.status).toBe(401);
      expect(stub.calls.length).toBe(0);
    });

    test("garbage cookie → 401 before any downstream call", async () => {
      const res = await r.handler(req(r.path, "not-a-valid-token"));
      expect(res.status).toBe(401);
      expect(stub.calls.length).toBe(0);
    });

    test("fails closed: unset COACH_SIGNING_SECRET still rejects", async () => {
      const original = process.env.COACH_SIGNING_SECRET;
      try {
        delete process.env.COACH_SIGNING_SECRET;
        const res = await r.handler(req(r.path, "ab.cd"));
        expect(res.status).toBe(401);
        expect(stub.calls.length).toBe(0);
      } finally {
        process.env.COACH_SIGNING_SECRET = original;
      }
    });
  });
}
