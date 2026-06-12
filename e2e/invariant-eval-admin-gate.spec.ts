import { test, expect } from "@playwright/test";
import { NextRequest } from "next/server";
import { FetchStub } from "./fixtures/fetch-stub";

process.env.NGA_ADMIN_SECRET = "test-admin-secret";
process.env.NOTION_API_KEY = "ntn_test_key";
process.env.RESEND_API_KEY = "re_test_key";

import { POST as evalConfirmation } from "../src/app/api/eval-confirmation/route";
import { POST as evalReengagement } from "../src/app/api/eval-reengagement/route";
import { POST as postEvalFollowup } from "../src/app/api/post-eval-followup/route";

// All three endpoints read the lead/player CRM (child PII) and send real email.
// Each must fail CLOSED: 401 on wrong secret AND 401 when the secret env is
// unset — zero downstream calls either way.
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
    body: JSON.stringify({ dryRun: true }),
    headers: { "content-type": "application/json" },
  });
}

const routes = [
  { name: "eval-confirmation", handler: evalConfirmation, path: "/api/eval-confirmation" },
  { name: "eval-reengagement", handler: evalReengagement, path: "/api/eval-reengagement" },
  { name: "post-eval-followup", handler: postEvalFollowup, path: "/api/post-eval-followup" },
] as const;

for (const r of routes) {
  test.describe(`${r.name} admin gate`, () => {
    test("no secret → 401, zero downstream calls", async () => {
      const res = await r.handler(req(r.path));
      expect(res.status).toBe(401);
      expect(stub.calls.length).toBe(0);
    });

    test("wrong secret → 401, zero downstream calls", async () => {
      const res = await r.handler(req(r.path, "wrong-secret"));
      expect(res.status).toBe(401);
      expect(stub.calls.length).toBe(0);
    });

    test("fails closed when NGA_ADMIN_SECRET is unset", async () => {
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
