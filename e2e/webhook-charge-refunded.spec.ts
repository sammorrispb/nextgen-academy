import { test, expect } from "@playwright/test";
import { NextRequest } from "next/server";
import { FetchStub } from "./fixtures/fetch-stub";
import {
  setWebhookTestEnv,
  checkoutEvent,
  signedHeader,
  TEST_DROPINS_DB,
} from "./fixtures/stripe-sessions";

setWebhookTestEnv();

import { POST } from "../src/app/api/stripe/webhook/route";

// A charge.refunded event whose charge points at `pi`. This mirrors what Stripe
// delivers when a refund posts out-of-band (Dashboard / MCP / admin API) — the
// exact path that left the 2026-06-16 rows stuck on Confirmed.
function refundEvent(pi: string | null): string {
  return checkoutEvent(
    { id: "ch_test_refund", object: "charge", payment_intent: pi },
    "charge.refunded",
  );
}

function webhookRequest(payload: string): NextRequest {
  return new NextRequest("http://localhost/api/stripe/webhook", {
    method: "POST",
    body: payload,
    headers: { "stripe-signature": signedHeader(payload) },
  });
}

// Roster row as returned by the dropins query, keyed on the Payment Intent.
function dropInPageByPi(pi: string, status: string) {
  return {
    id: "notion-row-by-pi",
    properties: {
      Status: { select: { name: status } },
      "Stripe Payment Intent ID": { rich_text: [{ plain_text: pi }] },
      "Stripe Checkout Session ID": { rich_text: [{ plain_text: "cs_x" }] },
      "Session Title": { rich_text: [{ plain_text: "Green Ball Tuesday" }] },
      "Session Date": { date: { start: "2026-07-01" } },
      "Session Start Time": { rich_text: [{ plain_text: "6:00 PM" }] },
      "Parent Email": { email: "parent@example.com" },
      "Amount Paid": { number: 20 },
    },
  };
}

// revalidatePath throws outside a Next request scope, AFTER the Status PATCH —
// so settle and assert on the captured Notion write (same pattern as the
// idempotency spec).
async function settle(p: Promise<Response>) {
  return p.then(
    (res) => ({ ok: true as const, res }),
    (err) => ({ ok: false as const, err: err as Error }),
  );
}

/** PATCHes to /pages/<id> that set Status, with the status value applied. */
function statusWrites(stub: FetchStub): string[] {
  return stub.calls
    .filter((c) => c.method === "PATCH" && /\/v1\/pages\//.test(c.url))
    .map((c) => {
      try {
        return JSON.parse(c.body).properties?.Status?.select?.name ?? "";
      } catch {
        return "";
      }
    })
    .filter(Boolean);
}

const stub = new FetchStub();
test.beforeEach(() => stub.reset());
test.afterEach(() => stub.uninstall());

test("charge.refunded flips the matching row to Refunded via the Payment Intent lookup", async () => {
  stub
    .on(`databases/${TEST_DROPINS_DB}/query`, {
      results: [dropInPageByPi("pi_refund_1", "Confirmed")],
    })
    .on("api.notion.com/v1/pages", { id: "notion-row-by-pi" })
    .install();

  const settled = await settle(POST(webhookRequest(refundEvent("pi_refund_1"))));

  // The row was found by PI and flipped to Refunded — the core fix. (No
  // checkout.sessions.list round-trip; the dropins query carried the match.)
  expect(statusWrites(stub)).toEqual(["Refunded"]);
  expect(stub.callsTo(`databases/${TEST_DROPINS_DB}/query`).length).toBeGreaterThan(0);
  if (settled.ok) {
    expect(settled.res.status).toBe(200);
    expect(await settled.res.json()).toMatchObject({ refunded: true });
  }
});

test("redelivered charge.refunded for an already-Refunded row → idempotent, no second write", async () => {
  stub
    .on(`databases/${TEST_DROPINS_DB}/query`, {
      results: [dropInPageByPi("pi_refund_1", "Refunded")],
    })
    .on("api.notion.com/v1/pages", { id: "x" })
    .install();

  const res = await POST(webhookRequest(refundEvent("pi_refund_1")));
  expect(res.status).toBe(200);
  expect(await res.json()).toMatchObject({ idempotent: true });
  expect(statusWrites(stub)).toHaveLength(0);
});

test("charge.refunded with no matching row → skipped not_found, no write", async () => {
  stub
    .on(`databases/${TEST_DROPINS_DB}/query`, { results: [] })
    .on("api.notion.com/v1/pages", { id: "x" })
    .install();

  const res = await POST(webhookRequest(refundEvent("pi_unknown")));
  expect(res.status).toBe(200);
  expect(await res.json()).toMatchObject({ skipped: "not_found" });
  expect(statusWrites(stub)).toHaveLength(0);
});

test("charge with no payment_intent → skipped no_pi, zero Notion calls", async () => {
  stub
    .on(`databases/${TEST_DROPINS_DB}/query`, { results: [] })
    .install();

  const res = await POST(webhookRequest(refundEvent(null)));
  expect(res.status).toBe(200);
  expect(await res.json()).toMatchObject({ skipped: "no_pi" });
  expect(stub.calls.length).toBe(0);
});
