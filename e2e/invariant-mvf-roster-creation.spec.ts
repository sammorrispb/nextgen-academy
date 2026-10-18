import { test, expect } from "@playwright/test";
import { NextRequest } from "next/server";
import { FetchStub } from "./fixtures/fetch-stub";
import { signedHeader, TEST_WEBHOOK_SECRET } from "./fixtures/stripe-sessions";
import { createMvfTournamentRegistration, type MvfTournamentRegistrationRow } from "../src/lib/notion-mvf-tournament-registrations";
import { POST as webhook } from "../src/app/api/stripe/webhook/route";

// A missing Notion row must have at most one create attempt, across both
// writers and server instances, even when the provider response is uncertain.
const KEYS = ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "NOTION_API_KEY", "NOTION_MVF_TOURNAMENT_REGS_DB_ID", "NOTION_WAIVERS_DB_ID", "RESEND_API_KEY", "VERCEL_ENV", "LINKDINK_BASE_URL", "NGA_SYNC_SECRET", "OPEN_BRAIN_INGEST_URL", "OPEN_BRAIN_INGEST_SECRET", "TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_FROM_NUMBER"] as const;
const saved = Object.fromEntries(KEYS.map(key => [key, process.env[key]]));
const stub = new FetchStub();
const invoiceId = "in_QARosterCreation";
const query = /api\.notion\.com\/v1\/databases\/qa_roster_claim\/query$/;
const create = /api\.notion\.com\/v1\/pages$/;
const capacity = "capacity.example.invalid/play/api/internal/nga-tournament-capacity";
type Page = { id: string; paid: boolean };
let pages: Page[];
let claims: Set<string>;
let restoreFetch: (() => void) | undefined;
const row: MvfTournamentRegistrationRow = { parentName: "Synthetic Parent", parentEmail: "synthetic@example.invalid", parentPhone: "3015550199", childFirstName: "Synthetic", childLastName: "Fixture", childDob: "2017-05-01", division: "10u", resident: true, amountUsd: 50, stripeInvoiceId: invoiceId, smsConsent: false, smsConsentText: "", emergencyName: "Synthetic Contact", emergencyPhone: "3015550198", allergies: "" };

test.beforeEach(() => {
  for (const key of KEYS) delete process.env[key];
  Object.assign(process.env, { STRIPE_SECRET_KEY: "sk_test_offline_roster_claim", STRIPE_WEBHOOK_SECRET: TEST_WEBHOOK_SECRET, NOTION_API_KEY: "ntn_offline_roster_claim", NOTION_MVF_TOURNAMENT_REGS_DB_ID: "qa_roster_claim", NGA_SYNC_SECRET: "qa-roster-claim", LINKDINK_BASE_URL: "https://capacity.example.invalid" });
  pages = []; claims = new Set(); stub.reset(); stub.install();
});
test.afterEach(() => { restoreFetch?.(); restoreFetch = undefined; stub.uninstall(); });
test.afterAll(() => { for (const key of KEYS) { if (saved[key] === undefined) delete process.env[key]; else process.env[key] = saved[key]; } });

function services() {
  stub.onDynamic(capacity, call => {
    const command = JSON.parse(call.body);
    expect(Object.keys(command).sort()).toEqual(["action", "event_key", "invoice_id"]);
    expect(command.invoice_id).toBe(invoiceId);
    if (command.action === "roster_claim") {
      const claimed = !claims.has(command.invoice_id);
      claims.add(command.invoice_id);
      return { status: 200, json: { ok: true, claimed } };
    }
    expect(command.action).toBe("paid");
    return { status: 200, json: { ok: true, already_paid: true, admin_notified: true, parent_notified: true, notification_retry_allowed: true, legacy_callback_deferred: false } };
  });
  stub.onDynamic(query, () => ({ status: 200, json: { results: pages.map(page => ({ id: page.id, properties: { Paid: { checkbox: page.paid } } })) } }));
  stub.onDynamic(create, call => {
    const properties = JSON.parse(call.body).properties;
    expect(properties["Stripe Invoice ID"].rich_text[0].text.content).toBe(invoiceId);
    pages.push({ id: `qa-page-${pages.length + 1}`, paid: properties.Paid.checkbox });
    return { status: 200, json: { id: pages.at(-1)!.id } };
  });
  stub.onDynamic(/api\.notion\.com\/v1\/pages\/qa-page-\d+$/, call => {
    const page = pages.find(page => call.url.endsWith(page.id))!;
    page.paid = JSON.parse(call.body).properties.Paid.checkbox;
    return { status: 200, json: { id: page.id } };
  });
}

function barrier() {
  let arrived = 0; let release!: () => void;
  const ready = new Promise<void>(resolve => { release = resolve; });
  return async () => { if (++arrived === 2) release(); await ready; };
}
function forceConcurrentMissingReads(count: 2 | 4) {
  const installed = globalThis.fetch; const barriers = [barrier(), barrier()]; let reads = 0;
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    if (query.test(url) && ++reads <= count) {
      await barriers[Math.floor((reads - 1) / 2)]();
      return Response.json({ results: [] });
    }
    return installed(input, init);
  };
  restoreFetch = () => { globalThis.fetch = installed; };
}
async function paid(type = "invoice.paid") {
  const metadata = { kind: "mvf-junior-tournament", event_date: "2026-10-24", division: "10u", division_label: "10U", parent_name: row.parentName, parent_email: row.parentEmail, parent_phone: row.parentPhone, child_first_name: row.childFirstName, child_last_name: row.childLastName, child_dob: row.childDob, emergency_name: row.emergencyName, emergency_phone: row.emergencyPhone };
  const payload = JSON.stringify({ id: "evt_QARosterCreation", object: "event", livemode: true, type, data: { object: { id: invoiceId, object: "invoice", amount_paid: 5000, customer_email: row.parentEmail, metadata } } });
  try { return (await webhook(new NextRequest("http://localhost/api/stripe/webhook", { method: "POST", body: payload, headers: { "stripe-signature": signedHeader(payload) } }))).status; }
  catch (error) { expect(String(error)).toMatch(/after.*(?:request|scope)/i); return 200; }
}

test("two checkout writers with simultaneous missing reads create one row", async () => {
  services(); forceConcurrentMissingReads(2);
  const results = await Promise.all([createMvfTournamentRegistration(row), createMvfTournamentRegistration(row)]);
  expect(results.sort()).toEqual(["ok", "transient"]);
  expect(pages).toHaveLength(1); expect(stub.callsTo(create)).toHaveLength(1);
});
test("concurrent paid aliases with a missing row create one paid row", async () => {
  services(); forceConcurrentMissingReads(4);
  const results = await Promise.all([paid("invoice.payment_succeeded"), paid("invoice.paid")]);
  expect(results.sort()).toEqual([200, 500]);
  expect(pages).toEqual([{ id: "qa-page-1", paid: true }]);
  expect(stub.callsTo(create)).toHaveLength(1); expect(stub.callsTo("api.resend.com")).toHaveLength(0);
  expect(await paid()).toBe(200); expect(pages).toHaveLength(1);
});
test("checkout creation racing paid backfill never creates a second pending row", async () => {
  services();
  const installed = globalThis.fetch; const firstTwo = barrier(); let reads = 0;
  let thirdRead!: () => void; const thirdReady = new Promise<void>(resolve => { thirdRead = resolve; });
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    if (query.test(url)) {
      const read = ++reads;
      if (read <= 2) { await firstTwo(); return Response.json({ results: [] }); }
      if (read === 3) { thirdRead(); return Response.json({ results: [] }); }
    }
    if (create.test(url)) await thirdReady;
    return installed(input, init);
  };
  restoreFetch = () => { globalThis.fetch = installed; };
  await Promise.all([createMvfTournamentRegistration(row), paid()]);
  expect(stub.callsTo(create)).toHaveLength(1); expect(pages).toHaveLength(1);
  expect(await paid()).toBe(200);
  expect(pages).toEqual([{ id: "qa-page-1", paid: true }]);
  expect(await createMvfTournamentRegistration(row)).toBe("ok");
  expect(pages[0].paid).toBe(true);
});
test("an unavailable authoritative lookup claims nothing and writes nothing", async () => {
  stub.on(query, {}, 503);
  expect(await createMvfTournamentRegistration(row)).toBe("transient");
  expect(stub.callsTo(capacity)).toHaveLength(0); expect(stub.callsTo(create)).toHaveLength(0);
});
test("an unavailable creation claim fails closed before the Notion write", async () => {
  stub.on(query, { results: [] }); stub.on(capacity, { error: "capacity_unavailable" }, 503);
  expect(await createMvfTournamentRegistration(row)).toBe("transient");
  expect(stub.callsTo(create)).toHaveLength(0);
});
for (const claimed of [undefined, null, "true", {}]) {
  test(`a malformed claim receipt ${JSON.stringify(claimed)} never authorizes a create`, async () => {
    stub.on(query, { results: [] }); stub.on(capacity, { ok: true, claimed });
    expect(await createMvfTournamentRegistration(row)).toBe("transient");
    expect(stub.callsTo(create)).toHaveLength(0);
  });
}
test("lost create response recovers through a positive lookup without recreating", async () => {
  services(); const installed = globalThis.fetch;
  globalThis.fetch = async (input, init) => { const response = await installed(input, init); if (create.test(String(input))) throw new Error("response lost after create"); return response; };
  restoreFetch = () => { globalThis.fetch = installed; };
  expect(await createMvfTournamentRegistration(row)).toBe("transient");
  expect(await createMvfTournamentRegistration(row)).toBe("ok");
  expect(stub.callsTo(create)).toHaveLength(1); expect(pages).toHaveLength(1);
});
test("uncertain create plus missing reads never issues a blind second create", async () => {
  services(); const installed = globalThis.fetch; let createAttempts = 0;
  globalThis.fetch = async (input, init) => { if (create.test(String(input))) { createAttempts++; throw new Error("provider outcome unknown"); } return installed(input, init); };
  restoreFetch = () => { globalThis.fetch = installed; };
  for (let retry = 0; retry < 3; retry++) expect(await createMvfTournamentRegistration(row)).toBe("transient");
  expect(claims.size).toBe(1);
  expect(stub.callsTo(capacity)).toHaveLength(3);
  expect(createAttempts).toBe(1);
  // The POST was intercepted before the provider simulation; no create happened.
  expect(pages).toHaveLength(0);
  expect(stub.callsTo(create)).toHaveLength(0);
});
test("a lost claim response cannot authorize a create or a later duplicate attempt", async () => {
  services(); const installed = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const response = await installed(input, init);
    if (String(input).includes(capacity) && (await response.clone().json()).claimed === true) throw new Error("claim response lost");
    return response;
  };
  restoreFetch = () => { globalThis.fetch = installed; };
  expect(await createMvfTournamentRegistration(row)).toBe("transient");
  expect(await createMvfTournamentRegistration(row)).toBe("transient");
  expect(claims.size).toBe(1); expect(stub.callsTo(create)).toHaveLength(0);
});
