import { test, expect } from "@playwright/test";
import { NextRequest } from "next/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { FetchStub } from "./fixtures/fetch-stub";

/**
 * Invariant: a signed one-time waiver must be on file before a child's first
 * PAID event. Every checkout route calls hasWaiverOnFile() BEFORE it creates a
 * Stripe Checkout Session and 409s (code "waiver_required") when none exists.
 *
 * The drop-in route is driven end-to-end at runtime (its session lookup is
 * fully stubbable); the other three slop-free payment routes are OBSERVED at
 * the source level (the gate call must precede checkout.sessions.create) so a
 * refactor can't silently drop the gate. Pure-node spec — no dev server.
 */

const WAIVERS_DB = "waivers-db-test";
const DROPINS_DB = "dropins-db-test";
const SESSION_ID = "notion-session-row-gate";

process.env.NOTION_API_KEY = "ntn_test";
process.env.NOTION_WAIVERS_DB_ID = WAIVERS_DB;
process.env.NOTION_DROPINS_DB_ID = DROPINS_DB;
process.env.STRIPE_SECRET_KEY = "sk_test_dummy_offline";

import { POST as DROPIN_POST } from "../src/app/api/checkout/route";

function futureIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

// A valid, Open, in-window session row for fetchSessionById's GET /pages/<id>.
function openSessionPage(): Record<string, unknown> {
  return {
    id: SESSION_ID,
    properties: {
      Session: { title: [{ plain_text: "Green Ball Tuesday" }] },
      Date: { date: { start: futureIso(3) } },
      "Start time": { rich_text: [{ plain_text: "6:00 PM" }] },
      "End time": { rich_text: [{ plain_text: "7:00 PM" }] },
      Status: { select: { name: "Open" } },
      "Court count": { number: 1 },
      "Registered count": { number: 0 },
      Level: { select: { name: "Green" } },
      Location: { rich_text: [{ plain_text: "Redland MS" }] },
      "Public Area": { rich_text: [] },
    },
  };
}

function dropInBody(): string {
  return JSON.stringify({
    parentName: "Jordan Parent",
    email: "no-waiver@example.com",
    phone: "301-555-0142",
    childFirstName: "Riley",
    childBirthYear: String(new Date().getFullYear() - 10),
    sessionId: SESSION_ID,
    displayConsent: false,
    smsConsent: false,
  });
}

function req(payload: string): NextRequest {
  return new NextRequest("http://localhost/api/checkout", {
    method: "POST",
    body: payload,
    headers: { "content-type": "application/json" },
  });
}

const stub = new FetchStub();
test.beforeEach(() => stub.reset());
test.afterEach(() => stub.uninstall());

test.describe("drop-in checkout — waiver gate (runtime)", () => {
  test("no waiver on file → 409 waiver_required, no Stripe session created", async () => {
    process.env.STRIPE_DROPIN_PRICE_ID = "price_dropin_test";
    stub
      .on(`pages/${SESSION_ID}`, openSessionPage())
      .on(`databases/${DROPINS_DB}/query`, { results: [] })
      .on(`databases/${WAIVERS_DB}/query`, { results: [] }) // no waiver
      .install();

    const res = await DROPIN_POST(req(dropInBody()));
    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.code).toBe("waiver_required");
    expect(json.signUrl).toContain("/waiver/sign");
    expect(json.signUrl).toContain("email=");
    // The gate returns before Stripe is ever touched.
    for (const call of stub.calls) {
      expect(call.url).not.toContain("stripe");
    }
  });

  test("waiver on file → gate passes (does NOT 409 waiver_required)", async () => {
    // Price intentionally unset so the route stops at the priceId guard (500)
    // immediately AFTER the gate — proving the gate let it through without
    // needing to drive the live Stripe SDK.
    delete process.env.STRIPE_DROPIN_PRICE_ID;
    stub
      .on(`pages/${SESSION_ID}`, openSessionPage())
      .on(`databases/${DROPINS_DB}/query`, { results: [] })
      .on(`databases/${WAIVERS_DB}/query`, { results: [{ id: "w_existing" }] })
      .install();

    const res = await DROPIN_POST(req(dropInBody()));
    expect(res.status).not.toBe(409);
    const json = await res.json();
    expect(json.code).not.toBe("waiver_required");
  });
});

test.describe("all paid checkout routes — gate precedes Stripe (source invariant)", () => {
  const ROUTES = [
    "checkout/route.ts",
    "checkout-camp/route.ts",
    "checkout-league/route.ts",
    "checkout-cluster/route.ts",
  ];

  for (const rel of ROUTES) {
    test(`${rel} calls hasWaiverOnFile before checkout.sessions.create`, () => {
      const src = readFileSync(
        join(__dirname, "..", "src", "app", "api", rel),
        "utf8",
      );
      const gateAt = src.indexOf("hasWaiverOnFile(");
      const stripeAt = src.indexOf("checkout.sessions.create");
      expect(gateAt, "gate call missing").toBeGreaterThan(-1);
      expect(stripeAt, "stripe create missing").toBeGreaterThan(-1);
      expect(gateAt).toBeLessThan(stripeAt);
    });
  }
});
