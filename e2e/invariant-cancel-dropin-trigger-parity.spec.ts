import { test, expect } from "@playwright/test";
import { NextRequest } from "next/server";
import { FetchStub } from "./fixtures/fetch-stub";

// Env BEFORE importing the route under test (the module + its libs read these
// at call time).
process.env.NGA_ADMIN_SECRET = "test-admin-secret";
process.env.NOTION_API_KEY = "ntn_test";
process.env.NOTION_DROPINS_DB_ID = "dropins-db";
process.env.NOTION_SESSIONS_DB_ID = "sessions-db";
process.env.RESEND_API_KEY = "re_test";

import { POST } from "../src/app/api/cancel-registration/route";

// The agent/admin per-row cancel route (POST /api/cancel-registration) is one of
// FOUR entry points into the shared cancelDropIn engine (src/lib/cancel-dropin.ts)
// — alongside the coach server action, the parent self-serve page, and the
// Stripe charge.refunded webhook. cancelDropIn owns the cancel fan-out: the
// Notion Status flip, the seat decrement, AND the Coach-voice cancel
// confirmation (email + opt-in SMS) gated by the Cancellation Notified flag.
// This pins that the route drives the FULL engine fan-out — it can't regress to
// a raw Status write that silently drops the parent's cancellation email. The
// engine was already shared; this is the missing trigger-parity pin (GAP-N2 in
// docs/audits/ui-agent-parity-nga.md). Mirrors invariant-attendance/crew-confirm.
//
// NOTE: this route still authenticates via ?secret=NGA_ADMIN_SECRET in the QUERY
// STRING (the anti-pattern the audit flags). The secret-gate block below pins
// the current contract; GAP-N2's optional follow-up migrates it to a dedicated
// Authorization: Bearer header, at which point these gate tests update.

const CHECKOUT = "cs_cancel_probe";

function dropInPage(status: "Confirmed" | "Cancelled" | "Refunded" = "Confirmed") {
  return {
    id: "row-1",
    url: "https://notion.so/row-1",
    properties: {
      "Stripe Checkout Session ID": { rich_text: [{ plain_text: CHECKOUT }] },
      Status: { select: { name: status } },
      "Parent Email": { email: "parent@example.com" },
      "Parent Phone": { phone_number: "" }, // empty → no Twilio SMS path (off-fetch)
      "Parent Name": { rich_text: [{ plain_text: "Parent One" }] },
      "Child First Name": { rich_text: [{ plain_text: "Kid" }] },
      "Session Title": { rich_text: [{ plain_text: "Olney Tue" }] },
      "Session Date": { date: { start: "2026-07-01" } },
      "Session Start Time": { rich_text: [{ plain_text: "6:00 PM" }] },
      "Amount Paid": { number: 20 },
      "Cancellation Notified": { checkbox: false },
    },
  };
}

function req(
  secret: string | undefined,
  body: unknown = { checkoutSessionId: CHECKOUT, status: "Cancelled" },
): NextRequest {
  const u = new URL("http://localhost/api/cancel-registration");
  if (secret !== undefined) u.searchParams.set("secret", secret);
  return new NextRequest(u, {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

// cancelDropIn calls revalidatePath, which throws outside a Next request scope —
// AFTER the Notion writes + email. Settle either way and assert on captured
// calls (same pattern as webhook-idempotency.spec.ts).
async function settle(p: Promise<Response>) {
  return p.then(
    (res) => ({ ok: true as const, res }),
    (err) => ({ ok: false as const, err: err as Error }),
  );
}

const stub = new FetchStub();
test.beforeEach(() => {
  stub.reset();
  stub.install();
});
test.afterEach(() => stub.uninstall());

test.describe("cancel-registration route — secret gate (fail closed)", () => {
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
      const res = await POST(req("anything"));
      expect(res.status).toBe(401);
      expect(stub.calls.length).toBe(0);
    } finally {
      process.env.NGA_ADMIN_SECRET = original;
    }
  });
});

test.describe("cancel-registration route — cancelDropIn trigger fan-out", () => {
  test("authorized cancel drives the FULL engine fan-out: Status flip + cancel email + Notified flag", async () => {
    stub
      .on("/databases/dropins-db/query", { results: [dropInPage("Confirmed")] })
      .on("/databases/sessions-db/query", { results: [] }) // no session match → decrement skipped, fine
      .on("api.resend.com", { id: "email_test" })
      .on("api.notion.com/v1/pages", { id: "patched" });

    await settle(POST(req("test-admin-secret")));

    const statusWrite = stub.calls.find(
      (c) =>
        c.method === "PATCH" &&
        /\/pages\//.test(c.url) &&
        c.body.includes('"Status"') &&
        c.body.includes('"Cancelled"'),
    );
    expect(statusWrite, "drop-in Status → Cancelled write").toBeTruthy();

    const email = stub.callsTo("api.resend.com");
    expect(email.length, "exactly one parent cancel-confirmation email").toBe(1);

    const notifiedFlag = stub.calls.find(
      (c) =>
        c.method === "PATCH" &&
        /\/pages\//.test(c.url) &&
        c.body.includes("Cancellation Notified"),
    );
    expect(notifiedFlag, "Cancellation Notified flag write after a sent email").toBeTruthy();
  });

  test("idempotent re-fire (row already Cancelled) → no write, no email", async () => {
    stub
      .on("/databases/dropins-db/query", { results: [dropInPage("Cancelled")] })
      .on("/databases/sessions-db/query", { results: [] })
      .on("api.resend.com", { id: "email_test" })
      .on("api.notion.com/v1/pages", { id: "patched" });

    const { ok, res } = await settle(POST(req("test-admin-secret")));
    expect(ok, "idempotent path does not throw (no revalidate reached)").toBe(true);
    if (ok) {
      expect(res.status).toBe(200);
      expect(JSON.stringify(await res.json())).toContain('"idempotent":true');
    }
    expect(stub.calls.find((c) => c.method === "PATCH"), "no PATCH on no-op").toBeFalsy();
    expect(stub.callsTo("api.resend.com").length, "no email on no-op").toBe(0);
  });
});
