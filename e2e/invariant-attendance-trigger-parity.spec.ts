import { test, expect } from "@playwright/test";
import { NextRequest } from "next/server";
import { FetchStub } from "./fixtures/fetch-stub";

// Env BEFORE importing the route under test (the module reads these at load /
// call time). Player DB id is hard-coded in notion-player-sync.
process.env.NGA_ADMIN_SECRET = "test-admin-secret";
process.env.NOTION_API_KEY = "ntn_test";
process.env.NOTION_DROPINS_DB_ID = "dropins-db";
process.env.OPEN_BRAIN_INGEST_URL = "https://ob.test/ingest";
process.env.LEAD_INGEST_TOKEN = "ob-token";

const PLAYER_DB = "1e5e34c258384c6cb5f3e846543ecfc7";

import { POST } from "../src/app/api/coach/attendance/route";

// The agent-callable check-in route MUST (a) fail closed on auth and (b) fire
// the SAME fan-out the coach dashboard does — the Notion Attendance write, the
// Open Brain nga_attendance activity, AND the player-profile stat recompute.
// Writing the Notion row directly drops the last two; this pins that they all
// fire from one shared path.
const stub = new FetchStub();
test.beforeEach(() => {
  stub.reset();
  stub.install();
});
test.afterEach(() => stub.uninstall());

const dropInPage = {
  id: "row-1",
  url: "https://notion.so/row-1",
  properties: {
    "Parent Email": { email: "parent@example.com" },
    "Parent Phone": { phone_number: "" },
    "Parent Name": { rich_text: [{ plain_text: "Parent One" }] },
    "Child First Name": { rich_text: [{ plain_text: "Kid" }] },
    "Child Birth Year": { number: 2015 },
    "Session Title": { rich_text: [{ plain_text: "Walter Johnson HS" }] },
    "Session Date": { date: { start: "2026-06-14" } },
    "Session Start Time": { rich_text: [{ plain_text: "10:00 AM" }] },
    Location: { rich_text: [{ plain_text: "WJ HS" }] },
    Attendance: { select: { name: "Present" } },
    "Stripe Checkout Session ID": { rich_text: [{ plain_text: "cs_test_1" }] },
  },
};

function req(
  secret: string | undefined,
  body: unknown = { checkoutSessionId: "cs_test_1", attended: "Present" },
): NextRequest {
  const qs = secret !== undefined ? `?secret=${encodeURIComponent(secret)}` : "";
  return new NextRequest(`http://localhost/api/coach/attendance${qs}`, {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

test.describe("attendance route — admin gate (fail closed)", () => {
  test("no secret → 401, zero downstream calls", async () => {
    const res = await POST(req(undefined));
    expect(res.status).toBe(401);
    expect(stub.calls.length).toBe(0);
  });

  test("wrong secret → 401, zero downstream calls", async () => {
    const res = await POST(req("wrong-secret"));
    expect(res.status).toBe(401);
    expect(stub.calls.length).toBe(0);
  });

  test("fails closed when NGA_ADMIN_SECRET is unset", async () => {
    const original = process.env.NGA_ADMIN_SECRET;
    try {
      delete process.env.NGA_ADMIN_SECRET;
      const res = await POST(req(""));
      expect(res.status).toBe(401);
      expect(stub.calls.length).toBe(0);
    } finally {
      process.env.NGA_ADMIN_SECRET = original;
    }
  });
});

test.describe("attendance route — trigger parity", () => {
  test("authorized check-in fans out to Notion + OB ingest + player recompute", async () => {
    stub
      .on(`/databases/${PLAYER_DB}/query`, { results: [{ id: "player-1" }] })
      .on("/databases/dropins-db/query", { results: [dropInPage] })
      .on("ob.test/ingest", { ok: true })
      .on("api.notion.com/v1/pages", { id: "patched" });

    const res = await POST(req("test-admin-secret"));
    expect(res.status).toBe(200);

    // Primary write: the Attendance select on the drop-in row.
    const attendanceWrite = stub.calls.find(
      (c) =>
        c.method === "PATCH" &&
        /\/pages\//.test(c.url) &&
        c.body.includes('"Attendance"') &&
        c.body.includes('"select"'),
    );
    expect(attendanceWrite, "drop-in Attendance write").toBeTruthy();

    // Trigger 1: the Open Brain nga_attendance check-in activity.
    const ob = stub.callsTo("ob.test/ingest");
    expect(ob.length, "exactly one OB ingest").toBe(1);
    expect(ob[0].body).toContain("nga_attendance");

    // Trigger 2: the player-profile stat recompute (writes Attendance Count).
    const recompute = stub.calls.find(
      (c) => c.method === "PATCH" && c.body.includes("Attendance Count"),
    );
    expect(recompute, "player-profile attendance recompute").toBeTruthy();
  });
});
