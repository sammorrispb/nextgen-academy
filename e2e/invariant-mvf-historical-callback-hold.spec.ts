import { createRequire } from "node:module";
import { test, expect } from "@playwright/test";
import { NextRequest } from "next/server";
import { FetchStub } from "./fixtures/fetch-stub";
import { signedHeader, TEST_WEBHOOK_SECRET } from "./fixtures/stripe-sessions";
import { markMvfSeatPaid } from "../src/lib/mvf-capacity";
import { POST as webhook } from "../src/app/api/stripe/webhook/route";

// A historical hold acknowledges only the paid ledger receipt. It must not
// repair a roster, announce an old payment or schedule background work.
const KEYS = ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "NOTION_API_KEY", "NOTION_MVF_TOURNAMENT_REGS_DB_ID", "RESEND_API_KEY", "VERCEL_ENV", "LINKDINK_BASE_URL", "NGA_SYNC_SECRET", "OPEN_BRAIN_INGEST_URL", "LEAD_INGEST_TOKEN", "TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_FROM_NUMBER"] as const;
const savedEnv = Object.fromEntries(KEYS.map(key => [key, process.env[key]]));
const nextServer = createRequire(`${process.cwd()}/package.json`)("next/server") as typeof import("next/server");
const stub = new FetchStub();
const capacity = "capacity.example.invalid/play/api/internal/nga-tournament-capacity";
const aliases = ["invoice.payment_succeeded", "invoice.paid"] as const;
const paidReceipt = {
  ok: true, already_paid: true, admin_notified: false, parent_notified: false,
  notification_retry_allowed: false, legacy_callback_deferred: true,
};
let originalAfter: typeof nextServer.after;
let afterCalls: number;

test.beforeEach(() => {
  for (const key of KEYS) delete process.env[key];
  Object.assign(process.env, {
    STRIPE_SECRET_KEY: "sk_test_offline_historical_hold",
    STRIPE_WEBHOOK_SECRET: TEST_WEBHOOK_SECRET,
    NOTION_API_KEY: "ntn_offline_historical_hold",
    NOTION_MVF_TOURNAMENT_REGS_DB_ID: "qa_historical_hold",
    RESEND_API_KEY: "re_offline_historical_hold",
    NGA_SYNC_SECRET: "qa-historical-hold",
    LINKDINK_BASE_URL: "https://capacity.example.invalid",
    OPEN_BRAIN_INGEST_URL: "https://brain.example.invalid",
    LEAD_INGEST_TOKEN: "qa-offline-brain",
  });
  afterCalls = 0;
  originalAfter = nextServer.after;
  nextServer.after = () => { afterCalls++; };
  stub.reset();
  stub.install();
});
test.afterEach(() => {
  nextServer.after = originalAfter;
  stub.uninstall();
});
test.afterAll(() => {
  for (const key of KEYS) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
});

async function deliver(type: typeof aliases[number]) {
  const payload = JSON.stringify({
    id: "evt_QAHistoricalHold", object: "event", type,
    data: { object: {
      id: "in_QAHistoricalHold", object: "invoice", amount_paid: 5000,
      customer_email: "synthetic@example.invalid",
      metadata: {
        kind: "mvf-junior-tournament", division: "10u", division_label: "10U",
        event_date: "2026-10-24", parent_name: "Synthetic Parent",
        parent_email: "synthetic@example.invalid", child_first_name: "Synthetic",
        child_last_name: "Fixture", child_dob: "2017-05-01",
      },
    } },
  });
  return webhook(new NextRequest("http://localhost/api/stripe/webhook", {
    method: "POST", body: payload, headers: { "stripe-signature": signedHeader(payload) },
  }));
}

function expectOnlyPaidCommands(count = 1) {
  expect(stub.calls).toHaveLength(count);
  for (const call of stub.calls) {
    expect(call.url).toContain(capacity);
    expect(JSON.parse(call.body)).toEqual({
      action: "paid", event_key: "mvf-junior-tournament-10u-2026-10-24",
      invoice_id: "in_QAHistoricalHold",
    });
  }
  expect(afterCalls).toBe(0);
}

for (const type of aliases) {
  for (const receipts of [
    { admin_notified: false, parent_notified: false },
    { admin_notified: true, parent_notified: false },
    { admin_notified: false, parent_notified: true },
    { admin_notified: true, parent_notified: true },
  ]) {
    test(`${type}: repeated held events preserve receipts ${JSON.stringify(receipts)} and have no side effects`, async () => {
      const receipt = { ...paidReceipt, ...receipts };
      stub.on(capacity, receipt);
      for (let attempt = 0; attempt < 3; attempt++) {
        const response = await deliver(type);
        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({ received: true, mvfTournament: true, reconciliationDeferred: true });
      }
      expect(receipt).toEqual({ ...paidReceipt, ...receipts });
      expectOnlyPaidCommands(3);
    });
  }

  for (const legacy_callback_deferred of [undefined, null, "true", "false", 0, 1, {}, []]) {
    test(`${type}: malformed hold ${JSON.stringify(legacy_callback_deferred)} fails closed`, async () => {
      stub.on(capacity, { ...paidReceipt, notification_retry_allowed: true, admin_notified: true, parent_notified: true, legacy_callback_deferred });
      const response = await deliver(type);
      expect(response.status).toBe(503);
      expect(await response.json()).toEqual({ error: "mvf tournament capacity reconciliation required" });
      expectOnlyPaidCommands();
    });
  }

  test(`${type}: contradictory hold and retry permission fails closed`, async () => {
    stub.on(capacity, { ...paidReceipt, notification_retry_allowed: true });
    expect((await deliver(type)).status).toBe(503);
    expectOnlyPaidCommands();
  });

  for (const error of ["reservation_conflict", "reservation_missing", "capacity_unavailable"]) {
    test(`${type}: ${error} is never acknowledged as deferred`, async () => {
      stub.on(capacity, { ok: false, error, legacy_callback_deferred: true }, 503);
      expect((await deliver(type)).status).toBe(503);
      expectOnlyPaidCommands();
    });
  }
}

for (const key of ["already_paid", "admin_notified", "parent_notified", "notification_retry_allowed"] as const) {
  test(`a hold with malformed ${key} cannot bypass receipt validation`, async () => {
    stub.on(capacity, { ...paidReceipt, [key]: "false" });
    await expect(markMvfSeatPaid("10u", "in_QAHistoricalHold")).rejects.toMatchObject({ code: "unavailable" });
    expectOnlyPaidCommands();
  });
}

test("the capacity adapter exposes the explicit hold and preserves acknowledged recipients", async () => {
  stub.on(capacity, { ...paidReceipt, admin_notified: true });
  expect(await markMvfSeatPaid("10u", "in_QAHistoricalHold")).toEqual({
    adminNotified: true, parentNotified: false, retryAllowed: false, legacyCallbackDeferred: true,
  });
  expectOnlyPaidCommands();
});

test("an explicit false hold retains normal already-paid processing", async () => {
  stub.on(capacity, { ...paidReceipt, admin_notified: true, parent_notified: true, notification_retry_allowed: true, legacy_callback_deferred: false });
  stub.on("api.notion.com", { results: [{ id: "qa-normal-row", properties: { Paid: { checkbox: true } } }] });
  const response = await deliver("invoice.paid");
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ received: true, mvfTournament: true });
  expect(stub.callsTo("api.notion.com")).toHaveLength(1);
  expect(stub.callsTo("api.resend.com")).toHaveLength(0);
  expect(stub.callsTo("brain.example.invalid")).toHaveLength(0);
  expect(afterCalls).toBe(0);
});

test("normal newly-marked payment still schedules its existing background work", async () => {
  stub.on(capacity, { ...paidReceipt, admin_notified: true, parent_notified: true, notification_retry_allowed: true, legacy_callback_deferred: false });
  stub.onDynamic("api.notion.com", call => ({ status: 200, json: call.method === "PATCH"
    ? { id: "qa-normal-row" }
    : { results: [{ id: "qa-normal-row", properties: { Paid: { checkbox: false } } }] },
  }));
  const response = await deliver("invoice.payment_succeeded");
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ received: true, mvfTournament: true });
  expect(stub.callsTo("api.notion.com").map(call => call.method)).toEqual(["POST", "PATCH"]);
  expect(afterCalls).toBe(1); // Positive control for the deferred tests' after() spy.
  expect(stub.callsTo("api.resend.com")).toHaveLength(0);
  expect(stub.callsTo("brain.example.invalid")).toHaveLength(0);
});
