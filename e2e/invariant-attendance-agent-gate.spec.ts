import { test, expect } from "@playwright/test";
import { NextRequest } from "next/server";
import { FetchStub } from "./fixtures/fetch-stub";

process.env.ATTENDANCE_SECRET = "test-attendance-secret";
process.env.NOTION_API_KEY = "ntn_test_key";
process.env.NOTION_DROPINS_DB_ID = "db-dropins-test";

import { POST as attendance } from "../src/app/api/attendance/route";

// The agent-callable attendance write touches minor PII (drop-in roster + the
// player profile) and fans out to Open Brain. It must fail CLOSED: 401 on a
// missing/wrong Bearer token AND when ATTENDANCE_SECRET is unset — zero
// downstream Notion/OB I/O either way (auth precedes every fetch).
const stub = new FetchStub();
test.beforeEach(() => {
  stub.reset();
  stub.install();
});
test.afterEach(() => stub.uninstall());

function req(token?: string): NextRequest {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (token !== undefined) headers.authorization = `Bearer ${token}`;
  return new NextRequest("http://localhost/api/attendance", {
    method: "POST",
    body: JSON.stringify({ checkoutSessionId: "cs_x", attended: "Present" }),
    headers,
  });
}

test.describe("attendance agent gate", () => {
  test("no Authorization header → 401, zero downstream calls", async () => {
    const res = await attendance(req());
    expect(res.status).toBe(401);
    expect(stub.calls.length).toBe(0);
  });

  test("wrong Bearer token → 401, zero downstream calls", async () => {
    const res = await attendance(req("wrong-token"));
    expect(res.status).toBe(401);
    expect(stub.calls.length).toBe(0);
  });

  test("fails closed when ATTENDANCE_SECRET is unset", async () => {
    const original = process.env.ATTENDANCE_SECRET;
    try {
      delete process.env.ATTENDANCE_SECRET;
      // Even a literal "Bearer undefined" attempt must be rejected.
      const res = await attendance(req("undefined"));
      expect(res.status).toBe(401);
      expect(stub.calls.length).toBe(0);
    } finally {
      process.env.ATTENDANCE_SECRET = original;
    }
  });
});
