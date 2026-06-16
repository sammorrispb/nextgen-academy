import { test, expect } from "@playwright/test";
import { NextRequest } from "next/server";
import { FetchStub } from "./fixtures/fetch-stub";

// Env BEFORE importing the route + auth helper (read at call time).
process.env.COACH_SIGNING_SECRET = "test-signing-secret";
process.env.ADMIN_ALLOWLIST = "admin@example.com";
process.env.SESSION_OPS_SECRET = "test-session-ops-secret";
process.env.NOTION_API_KEY = "ntn_test_key";
process.env.NOTION_DROPINS_DB_ID = "db-dropins-test";
process.env.NOTION_SESSIONS_DB_ID = "db-sessions-test";
process.env.RESEND_API_KEY = "re_test_dummy";
process.env.NEXT_PUBLIC_SITE_URL = "https://nextgenpbacademy.com";

import { POST as reschedule } from "../src/app/api/admin/sessions/reschedule/route";
import { createAdminSessionValue } from "../src/lib/admin-auth";

const SESSION_ROW_ID = "11111111-1111-1111-1111-111111111111";
const COOKIE = createAdminSessionValue("admin@example.com");

function dropInPage(id: string) {
  return {
    id,
    url: `https://www.notion.so/${id}`,
    properties: {
      "Parent Name": { rich_text: [{ plain_text: "Dana Parent" }] },
      "Parent Email": { email: "dana@example.com" },
      "Child First Name": { rich_text: [{ plain_text: "Sky" }] },
      "Session Title": { rich_text: [{ plain_text: "Green Saturday" }] },
      "Session Date": { date: { start: "2026-06-20" } },
      "Session Start Time": { rich_text: [{ plain_text: "6:00 PM" }] },
      "Session Row ID": { rich_text: [{ plain_text: SESSION_ROW_ID }] },
      Status: { select: { name: "Confirmed" } },
      "Reschedule Notified": { checkbox: false },
    },
  };
}

function seed(stub: FetchStub) {
  stub
    .on("/databases/", { results: [dropInPage("row-1")], has_more: false, next_cursor: null })
    .on("api.resend.com", { id: "email_test" })
    .on("/pages/", { id: "x", properties: {} });
}

const BODY = JSON.stringify({
  sessionRowId: SESSION_ROW_ID,
  sessionTitle: "Green Saturday",
  oldDate: "2026-06-20",
  oldStartTime: "6:00 PM",
  newDate: "2030-06-27",
  newStartTime: "6:00 PM",
  newEndTime: "7:00 PM",
});

function req(auth: { cookie?: string; bearer?: string }): NextRequest {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (auth.cookie !== undefined) headers.cookie = `nga_admin=${auth.cookie}`;
  if (auth.bearer !== undefined) headers.authorization = `Bearer ${auth.bearer}`;
  return new NextRequest("http://localhost/api/admin/sessions/reschedule", {
    method: "POST",
    headers,
    body: BODY,
  });
}

// Normalize a recorded fetch to method + path + (for writes) the property keys
// touched — enough to prove the SAME triggers fire, independent of run.
function fingerprint(stub: FetchStub): string[] {
  return stub.calls.map((c) => {
    const path = c.url.replace(/^https?:\/\/[^/]+/, "");
    let keys = "";
    if (c.method === "PATCH" && c.body) {
      try {
        keys = Object.keys(JSON.parse(c.body).properties ?? {}).sort().join(",");
      } catch {
        /* non-JSON body */
      }
    }
    return `${c.method} ${path}${keys ? ` {${keys}}` : ""}`;
  });
}

const stub = new FetchStub();
test.beforeEach(() => {
  stub.reset();
  stub.install();
});
test.afterEach(() => stub.uninstall());

test.describe("admin session-ops — Bearer gate (fail closed)", () => {
  test("no auth → 401, zero downstream calls", async () => {
    seed(stub);
    const res = await reschedule(req({}));
    expect(res.status).toBe(401);
    expect(stub.calls.length).toBe(0);
  });

  test("wrong Bearer → 401, zero downstream calls", async () => {
    seed(stub);
    const res = await reschedule(req({ bearer: "nope" }));
    expect(res.status).toBe(401);
    expect(stub.calls.length).toBe(0);
  });

  test("fails closed: unset SESSION_OPS_SECRET rejects even a matching guess", async () => {
    seed(stub);
    const original = process.env.SESSION_OPS_SECRET;
    try {
      delete process.env.SESSION_OPS_SECRET;
      const res = await reschedule(req({ bearer: "" }));
      expect(res.status).toBe(401);
      expect(stub.calls.length).toBe(0);
    } finally {
      process.env.SESSION_OPS_SECRET = original;
    }
  });
});

test("agent (Bearer) and UI (cookie) fire the IDENTICAL trigger fan-out", async () => {
  // UI path — admin session cookie.
  seed(stub);
  const uiRes = await reschedule(req({ cookie: COOKIE }));
  const uiBody = await uiRes.json();
  const uiCalls = fingerprint(stub);

  // Agent path — Bearer SESSION_OPS_SECRET.
  stub.reset();
  seed(stub);
  const agentRes = await reschedule(req({ bearer: "test-session-ops-secret" }));
  const agentBody = await agentRes.json();
  const agentCalls = fingerprint(stub);

  // Both authorized and produced the same result shape...
  expect(uiRes.status).toBe(200);
  expect(agentRes.status).toBe(200);
  expect(agentBody.ok).toBe(uiBody.ok);
  expect(agentBody.migrated).toBe(uiBody.migrated);
  expect(agentBody.emailed).toBe(uiBody.emailed);

  // ...and fired the EXACT same downstream triggers in the same order:
  // Notion roster query → updateDropInSchedule PATCH (re-date + flag resets) →
  // Resend send → markDropInFlag PATCH (Reschedule Notified) → updateSession PATCH.
  expect(agentCalls).toEqual(uiCalls);
  expect(uiCalls.length).toBeGreaterThan(0);
  expect(uiBody.emailed).toBe(1); // the parent-comms trigger actually fired
  expect(uiCalls.some((c) => c.startsWith("POST /emails"))).toBe(true); // Resend send
  expect(
    uiCalls.some((c) => c.includes("Reminder Sent") && c.includes("Session Date")),
  ).toBe(true); // updateDropInSchedule re-date + flag reset
});
