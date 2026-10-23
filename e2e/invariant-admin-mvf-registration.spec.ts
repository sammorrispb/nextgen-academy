import { test, expect } from "@playwright/test";
import { NextRequest } from "next/server";
import { FetchStub, type RecordedFetch } from "./fixtures/fetch-stub";
import { FakeStripeInvoicing } from "./fixtures/fake-stripe-invoices";
import { createAdminSessionValue } from "../src/lib/admin-auth";
import { createSessionCookieValue as createCoachSessionValue } from "../src/lib/coach-auth";
import { getStripe } from "../src/lib/stripe";
import { validateMvfJuniorTournament, type MvfJuniorTournamentData } from "../src/lib/validate-mvf-junior-tournament";
import { WAIVER_VERSION } from "../src/data/waiver";
import { POST } from "../src/app/api/admin/mvf-registration/route";

// An admin exception keeps the truthful DOB, and cannot invoice a child until
// signed consent and a capacity-backed, same-session preview authorize it.
const TOUCHED_ENV = ["COACH_SIGNING_SECRET", "ADMIN_ALLOWLIST", "NOTION_API_KEY",
  "NOTION_WAIVERS_DB_ID", "NOTION_MVF_TOURNAMENT_REGS_DB_ID", "NGA_SYNC_SECRET",
  "VERCEL_ENV", "LINKDINK_BASE_URL", "STRIPE_SECRET_KEY", "RESEND_API_KEY",
  "TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "SESSION_OPS_SECRET",
  "NEXT_PUBLIC_SITE_URL", "VERCEL_URL"] as const;
const savedEnv = Object.fromEntries(TOUCHED_ENV.map((key) => [key, process.env[key]]));
const ORIGIN = "https://nextgenpbacademy.com";
const WAIVERS = "11111111222233334444555555555555";
const REGS = "22222222333344445555666666666666";
const WAIVER_ID = "33333333-4444-5555-6666-777777777777";
const ROW_ID = "44444444-5555-6666-7777-888888888888";
const ACCOUNT = "acct_1TU4iSBpXOfTC961";
const SUBMISSION = "7f37c43a-d5e1-4cd9-913f-7c48e9799a8a";
const EVENT = "mvf-junior-tournament-14u-2026-10-24";
const stub = new FetchStub();
let fakeStripe: FakeStripeInvoicing;
let undoStripe: () => void;
let undoAccount: () => void;
let adminCookie: string;
let accountId: string;
let accountReads: number;
let waiverRows: unknown[];
let waiverOutage: boolean;
let notionOutage: boolean;
let notionCreateOutage: boolean;
let notionCreateResponseLost: boolean;
let rosterCreationClaimed: boolean;
let capacityFull: boolean;
let bindFails: boolean;
let syncFails: boolean;
let reservedInvoice: string | null;
let registrationRows: Record<string, unknown>[];
let notionCreates: RecordedFetch[];
let reserveIds: Set<string>;

function registration(): MvfJuniorTournamentData {
  return { division: "14u", resident: false, parentName: "Synthetic Parent", email: "parent@example.com",
    phone: "3015550100", childFirstName: "Synthetic", childLastName: "Player", childDob: "2011-08-12",
    emergencyName: "Synthetic Parent", emergencyPhone: "3015550100", allergies: "Synthetic private safety note",
    smsConsent: false };
}
function waiver() {
  return { id: WAIVER_ID, archived: false, in_trash: false, parent: { database_id: WAIVERS },
    properties: { "Parent Email": { email: "parent@example.com" },
      "Signature Name": { rich_text: [{ plain_text: "Synthetic Parent" }] },
      "Signed At": { date: { start: "2026-10-23T12:45:00Z" } },
      "Waiver Version": { rich_text: [{ plain_text: WAIVER_VERSION }] } } };
}
function input(action: "preview" | "register" = "preview", extra: Record<string, unknown> = {}): {
  action: "preview" | "register"; submissionId: string; registration: MvfJuniorTournamentData;
  ageExceptionApproved: boolean; ageExceptionReason: string; previewToken?: string;
} {
  return { action, submissionId: SUBMISSION, registration: registration(),
    ageExceptionApproved: true, ageExceptionReason: "Coach approved tournament age exception", ...extra };
}
function request(body: unknown, cookie = adminCookie, origin: string | null = ORIGIN, contentType = "application/json") {
  return new NextRequest(`${ORIGIN}/api/admin/mvf-registration`, { method: "POST",
    headers: { "content-type": contentType, ...(origin ? { origin } : {}), cookie: `nga_admin=${cookie}`,
      authorization: "Bearer ops-synthetic" }, body: JSON.stringify(body) });
}
async function call(body: unknown, cookie?: string, origin?: string | null, contentType?: string) {
  const response = await POST(request(body, cookie, origin, contentType));
  return { response, json: await response.json() };
}
async function preview(extra: Record<string, unknown> = {}) {
  const result = await call(input("preview", extra));
  expect(result.response.status).toBe(200);
  expect(typeof result.json.previewToken).toBe("string");
  return result.json.previewToken as string;
}
function mutationCalls() {
  return stub.calls.filter((c) => c.method !== "GET" && !c.url.endsWith("/query") &&
    !(c.url.endsWith("/nga-roster-add") && JSON.parse(c.body).dry_run === true));
}
function installProviders() {
  stub.onDynamic(`databases/${WAIVERS}/query`, () => ({ status: waiverOutage ? 503 : 200,
    json: waiverOutage ? { error: "synthetic waiver outage" } : { results: waiverRows, has_more: false } }));
  stub.onDynamic(`databases/${REGS}/query`, () => ({ status: notionOutage && fakeStripe.all().length > 0 ? 503 : 200,
    json: notionOutage && fakeStripe.all().length > 0 ? { error: "synthetic roster outage" } : { results: registrationRows, has_more: false } }));
  stub.onDynamic("api.notion.com/v1/pages", (c) => {
    if (c.method !== "POST") throw new Error("Unexpected synthetic Notion operation");
    if (notionOutage || notionCreateOutage) return { status: 503, json: { error: "synthetic roster outage" } };
    const body = JSON.parse(c.body); notionCreates.push(c);
    const properties = Object.fromEntries(Object.entries(body.properties).map(([name, raw]) => {
      const value = raw as Record<string, unknown>;
      const type = Array.isArray(value.rich_text) ? "rich_text" : Array.isArray(value.title) ? "title" : null;
      return [name, type ? { ...value, [type]: (value[type] as { text: { content: string } }[])
        .map((part) => ({ ...part, plain_text: part.text.content })) } : value];
    }));
    const row = { id: ROW_ID, archived: false, in_trash: false, parent: body.parent, properties };
    registrationRows.push(row);
    return notionCreateResponseLost
      ? { status: 503, json: { error: "synthetic ambiguous create response" } }
      : { status: 200, json: row };
  });
  stub.onDynamic("/nga-tournament-capacity", (c) => {
    const body = JSON.parse(c.body);
    if (body.action === "reserve") {
      if (capacityFull) return { status: 409, json: { ok: false, error: "capacity_full" } };
      reserveIds.add(body.submission_id);
      return { status: 200, json: { ok: true, state: reservedInvoice ? "payable" : "held", invoice_id: reservedInvoice } };
    }
    if (body.action === "bind") {
      if (bindFails) return { status: 503, json: { ok: false, error: "unavailable" } };
      reservedInvoice = body.invoice_id;
      return { status: 200, json: { ok: true, invoice_id: reservedInvoice } };
    }
    if (body.action === "roster_claim") {
      const claimed = !rosterCreationClaimed;
      rosterCreationClaimed = true;
      return { status: 200, json: { ok: true, claimed } };
    }
    throw new Error(`Unexpected capacity operation: ${body.action}`);
  });
  stub.onDynamic("/nga-roster-add", (c) => ({ status: syncFails && !JSON.parse(c.body).dry_run ? 503 : 200,
    json: syncFails && !JSON.parse(c.body).dry_run ? { ok: false, error: "roster_insert_failed" } : JSON.parse(c.body).dry_run
      ? { ok: true, dryRun: true, action: "would_add", eventSlug: `${EVENT}-3` }
      : { ok: true, alreadyOnRoster: false, rsvpId: "synthetic-rsvp", eventSlug: `${EVENT}-3` } }));
}

test.beforeEach(() => {
  for (const key of TOUCHED_ENV) delete process.env[key];
  Object.assign(process.env, { COACH_SIGNING_SECRET: "synthetic-signing-secret", ADMIN_ALLOWLIST: "admin@example.com",
    NOTION_API_KEY: "ntn_synthetic", NOTION_WAIVERS_DB_ID: WAIVERS, NOTION_MVF_TOURNAMENT_REGS_DB_ID: REGS,
    NGA_SYNC_SECRET: "synthetic-sync-secret", VERCEL_ENV: "production", STRIPE_SECRET_KEY: "sk_live_synthetic_only",
    SESSION_OPS_SECRET: "ops-synthetic" });
  adminCookie = createAdminSessionValue("admin@example.com");
  accountId = ACCOUNT; accountReads = 0; waiverRows = [waiver()]; waiverOutage = false; notionOutage = false;
  notionCreateOutage = false; notionCreateResponseLost = false; rosterCreationClaimed = false;
  capacityFull = false; bindFails = false; syncFails = false; reservedInvoice = null;
  registrationRows = []; notionCreates = []; reserveIds = new Set();
  stub.reset(); stub.install(); installProviders();
  fakeStripe = new FakeStripeInvoicing(); const stripe = getStripe(); undoStripe = fakeStripe.install(stripe);
  const original = stripe.accounts.retrieve;
  stripe.accounts.retrieve = (async () => { accountReads++; return { id: accountId }; }) as unknown as typeof stripe.accounts.retrieve;
  undoAccount = () => { stripe.accounts.retrieve = original; };
});
test.afterEach(() => { undoAccount(); undoStripe(); stub.uninstall(); });
test.afterAll(() => { for (const key of TOUCHED_ENV) {
  if (savedEnv[key] === undefined) delete process.env[key]; else process.env[key] = savedEnv[key];
} });

for (const kind of ["missing", "tampered", "coach", "unlisted", "unset secret", "unset allowlist"]) {
  test(`${kind} authentication cannot read or mutate a junior registration`, async () => {
    let cookie = adminCookie;
    if (kind === "missing") cookie = "";
    if (kind === "tampered") cookie += "x";
    if (kind === "coach") cookie = createCoachSessionValue("admin@example.com");
    if (kind === "unlisted") cookie = createAdminSessionValue("other@example.com");
    if (kind === "unset secret") delete process.env.COACH_SIGNING_SECRET;
    if (kind === "unset allowlist") delete process.env.ADMIN_ALLOWLIST;
    expect((await call(input(), cookie)).response.status).toBe(401);
    expect(stub.calls).toHaveLength(0); expect(accountReads).toBe(0); expect(fakeStripe.all()).toHaveLength(0);
  });
}
test("preview permits the truthful approved 15-year-old, without a write", async () => {
  expect(validateMvfJuniorTournament(registration())).toHaveProperty("childDob");
  const result = await call(input());
  expect(result.response.status).toBe(200); expect(result.json).toHaveProperty("previewToken");
  expect(accountReads).toBe(1); expect(fakeStripe.all()).toHaveLength(0); expect(mutationCalls()).toHaveLength(0);
});
test("missing signed waiver blocks even an approved age exception", async () => {
  waiverRows = [];
  const result = await call(input());
  expect(result.response.status).toBe(409); expect(fakeStripe.all()).toHaveLength(0); expect(mutationCalls()).toHaveLength(0);
});

for (const origin of [null, "https://attacker.example"]) {
  test(`origin ${origin ?? "missing"} rejects before provider reads`, async () => {
    expect((await call(input(), undefined, origin)).response.status).toBe(403);
    expect(stub.calls).toHaveLength(0); expect(accountReads).toBe(0);
  });
}
test("attacker request host cannot substitute for the canonical origin", async () => {
  const response = await POST(new NextRequest("https://attacker.example/api/admin/mvf-registration", {
    method: "POST", headers: { origin: "https://attacker.example", "content-type": "application/json",
      cookie: `nga_admin=${adminCookie}` }, body: JSON.stringify(input()) }));
  expect(response.status).toBe(403); expect(stub.calls).toHaveLength(0); expect(accountReads).toBe(0);
});
test("non-JSON content is rejected before provider reads", async () => {
  expect((await call(input(), undefined, undefined, "text/plain")).response.status).toBe(400);
  expect(stub.calls).toHaveLength(0); expect(accountReads).toBe(0);
});
for (const [index, body] of [null, [], {}, { action: "preview" }, input("preview", { action: "unknown" }),
  input("preview", { submissionId: "not-an-operation" }), input("preview", { amount: 1 }),
  input("preview", { registration: { ...registration(), amountUsd: 1 } }),
  input("preview", { previewToken: "unexpected" }), input("register"),
  input("preview", { registration: {} }), input("preview", { registration: { ...registration(), email: "bad" } })].entries()) {
  test(`malformed or widened payload ${index + 1} is inert`, async () => {
    expect((await call(body)).response.status).toBe(400);
    expect(stub.calls).toHaveLength(0); expect(accountReads).toBe(0); expect(fakeStripe.all()).toHaveLength(0);
  });
}
for (const key of ["NOTION_API_KEY", "NOTION_WAIVERS_DB_ID", "NOTION_MVF_TOURNAMENT_REGS_DB_ID",
  "NGA_SYNC_SECRET", "STRIPE_SECRET_KEY"]) {
  test(`missing ${key} fails closed before network or money`, async () => {
    delete process.env[key];
    expect((await call(input())).response.status).toBe(503);
    expect(stub.calls).toHaveLength(0); expect(accountReads).toBe(0); expect(fakeStripe.all()).toHaveLength(0);
  });
}
for (const mode of ["preview", "development", "unset", "test key"]) {
  test(`unsafe environment ${mode} never touches production`, async () => {
    if (mode === "unset") delete process.env.VERCEL_ENV;
    else if (mode === "test key") process.env.STRIPE_SECRET_KEY = "sk_test_synthetic_only";
    else process.env.VERCEL_ENV = mode;
    process.env.LINKDINK_BASE_URL = "https://attacker.example";
    expect((await call(input())).response.status).toBe(503);
    expect(stub.calls).toHaveLength(0); expect(accountReads).toBe(0); expect(fakeStripe.all()).toHaveLength(0);
  });
}
test("a foreign Stripe account cannot reserve or invoice", async () => {
  accountId = "acct_syntheticForeign";
  expect((await call(input())).response.status).toBeGreaterThanOrEqual(400);
  expect(mutationCalls()).toHaveLength(0); expect(fakeStripe.all()).toHaveLength(0);
});
test("a production destination override is refused before provider reads", async () => {
  process.env.LINKDINK_BASE_URL = "https://attacker.example";
  expect((await call(input())).response.status).toBe(503);
  expect(stub.calls).toHaveLength(0); expect(accountReads).toBe(0); expect(fakeStripe.all()).toHaveLength(0);
});
for (const fault of ["unsigned", "old version", "wrong parent", "archived", "duplicate", "outage"]) {
  test(`waiver ${fault} cannot authorize money or a seat`, async () => {
    const row = waiver();
    if (fault === "unsigned") row.properties["Signature Name"].rich_text = [];
    if (fault === "old version") row.properties["Waiver Version"].rich_text[0].plain_text = "stale-version";
    if (fault === "wrong parent") row.properties["Parent Email"].email = "other@example.com";
    if (fault === "archived") row.archived = true;
    waiverRows = fault === "duplicate" ? [row, row] : [row];
    if (fault === "outage") waiverOutage = true;
    expect((await call(input())).response.status).toBeGreaterThanOrEqual(400);
    expect(fakeStripe.all()).toHaveLength(0); expect(mutationCalls()).toHaveLength(0);
  });
}
for (const [dob, approved, reason, eligible] of [
  ["2014-01-01", false, "", true], ["2015-10-24", false, "", true],
  ["2011-10-25", false, "", true], ["2011-08-12", false, "", false],
  ["2011-08-12", true, "", false], ["2011-08-12", true, "Approved by Coach", true],
  ["2010-10-24", true, "Approved by Coach", true], ["2009-10-24", true, "Approved by Coach", false],
  ["2015-10-25", true, "Approved by Coach", false], ["2011-02-31", true, "Approved by Coach", false],
] as const) {
  test(`admin age boundary ${dob}, approval=${approved} eligible=${eligible}`, async () => {
    const result = await call(input("preview", { registration: { ...registration(), childDob: dob },
      ageExceptionApproved: approved, ageExceptionReason: reason }));
    expect(result.response.status).toBe(eligible ? 200 : 400);
    expect(fakeStripe.all()).toHaveLength(0); expect(mutationCalls()).toHaveLength(0);
  });
}
test("the canceled 10U division cannot be registered through an admin exception", async () => {
  expect((await call(input("preview", { registration: { ...registration(), division: "10u", childDob: "2016-01-01" } }))).response.status).toBe(400);
  expect(stub.calls).toHaveLength(0); expect(fakeStripe.all()).toHaveLength(0);
});
for (const fault of ["tampered token", "DOB", "resident price", "approval", "reason", "submission", "renewed session", "expired", "waiver removed"]) {
  test(`preview changed ${fault} cannot authorize a write`, async () => {
    const token = await preview(); const realNow = Date.now;
    const body = input("register", { previewToken: token }); let cookie = adminCookie;
    if (fault === "tampered token") body.previewToken = `${token}x`;
    if (fault === "DOB") body.registration.childDob = "2010-01-01";
    if (fault === "resident price") body.registration.resident = true;
    if (fault === "approval") body.ageExceptionApproved = false;
    if (fault === "reason") body.ageExceptionReason = "Different approval";
    if (fault === "submission") body.submissionId = "d16b6bc1-0d95-414a-a127-88dd590b151e";
    if (fault === "renewed session") { Date.now = () => realNow() + 2_000; cookie = createAdminSessionValue("admin@example.com"); }
    if (fault === "expired") Date.now = () => realNow() + 601_000;
    if (fault === "waiver removed") waiverRows = [];
    try { expect((await call(body, cookie)).response.status).toBeGreaterThanOrEqual(400); }
    finally { Date.now = realNow; }
    expect(fakeStripe.all()).toHaveLength(0); expect(mutationCalls()).toHaveLength(0);
  });
}
test("full capacity never creates an invoice", async () => {
  const token = await preview(); capacityFull = true;
  const result = await call(input("register", { previewToken: token }));
  expect(result.response.status).toBe(409); expect(fakeStripe.all()).toHaveLength(0); expect(notionCreates).toHaveLength(0);
});
test("failed capacity bind leaves the only invoice unpayable and unsent", async () => {
  const token = await preview(); bindFails = true;
  const result = await call(input("register", { previewToken: token }));
  expect(result.response.status).toBeGreaterThanOrEqual(400);
  expect(fakeStripe.all()).toHaveLength(1);
  expect(fakeStripe.all()[0]).toMatchObject({ status: "draft", auto_advance: false, sends: 0, hosted_invoice_url: null });
  expect(notionCreates).toHaveLength(0); expect(stub.callsTo("/nga-roster-add").filter((c) => !JSON.parse(c.body).dry_run)).toHaveLength(0);
});
test("approved registration preserves real DOB and server $60, one pending NGA row, protected L&D identity", async () => {
  const token = await preview();
  const result = await call(input("register", { previewToken: token }));
  expect(result.response.status).toBe(200); expect(result.json.completed).toBe(true);
  expect(fakeStripe.all()).toHaveLength(1);
  const invoice = fakeStripe.all()[0];
  expect(result.json.invoiceId).toBe(invoice.id);
  expect(invoice).toMatchObject({ status: "open", auto_advance: false, sends: 1 });
  expect(invoice.lines.map((line) => line.amount)).toEqual([6000]);
  expect(invoice.metadata).toMatchObject({ child_dob: "2011-08-12", amount_usd: "60.00", resident: "false", waiver_accepted: "true" });
  expect(invoice.metadata).toHaveProperty("age_exception_approved", "true");
  expect(JSON.stringify(invoice.metadata)).toContain("admin@example.com");
  expect(JSON.stringify(invoice.metadata)).toContain("Coach approved tournament age exception");
  expect(notionCreates).toHaveLength(1);
  expect(JSON.parse(notionCreates[0].body)).toMatchObject({ parent: { database_id: REGS }, properties: {
    "Child DOB": { date: { start: "2011-08-12" } }, Paid: { checkbox: false },
    "Amount Paid": { number: 60 }, Resident: { checkbox: false } } });
  const sync = stub.callsTo("/nga-roster-add").filter((c) => !JSON.parse(c.body).dry_run);
  expect(sync).toHaveLength(1);
  expect(JSON.parse(sync[0].body)).toEqual({ event_key: EVENT, first_name: "Synthetic", last_name: "Player", email: "parent@example.com" });
  expect(stub.calls.filter((c) => c.url.includes("attacker.example"))).toHaveLength(0);
  expect(result.response.headers.get("cache-control")).toContain("no-store");
});
test("same operation retry reuses its invoice and one logical seat without repeated payment email", async () => {
  const token = await preview(); const body = input("register", { previewToken: token });
  const first = await call(body); const again = await call(body);
  expect(first.response.status).toBe(200); expect(again.response.status).toBe(200);
  expect(first.json.completed).toBe(true); expect(again.json.completed).toBe(true);
  expect(again.json.invoiceId).toBe(first.json.invoiceId); expect(fakeStripe.all()).toHaveLength(1);
  expect(fakeStripe.all()[0].lines.map((line) => line.amount)).toEqual([6000]);
  expect(fakeStripe.all()[0].sends).toBe(1); expect(reserveIds.size).toBe(1); expect(notionCreates).toHaveLength(1);
});
for (const provider of ["Notion", "Link & Dink"]) {
  test(`${provider} failure preserves sent invoice and reports incomplete work`, async () => {
    const token = await preview();
    if (provider === "Notion") notionOutage = true; else syncFails = true;
    const result = await call(input("register", { previewToken: token }));
    expect(result.response.status).toBe(200); expect(result.json.completed).toBe(false);
    expect(fakeStripe.all()).toHaveLength(1); expect(result.json.invoiceId).toBe(fakeStripe.all()[0].id);
    expect(fakeStripe.all()[0]).toMatchObject({ status: "open", sends: 1 });
    expect(fakeStripe.all()[0].lines.map((line) => line.amount)).toEqual([6000]);
    if (provider === "Notion") {
      expect(result.json).toMatchObject({ registrationSaved: false, rosterSynced: false });
      expect(stub.callsTo("/nga-roster-add")).toHaveLength(0);
    }
  });
}

for (const fault of ["amount", "currency"]) {
  test(`tampered existing draft ${fault} cannot be finalized or emailed`, async () => {
    const token = await preview(); const body = input("register", { previewToken: token });
    bindFails = true;
    expect((await call(body)).response.status).toBeGreaterThanOrEqual(400);
    expect(fakeStripe.all()).toHaveLength(1);
    const invoice = fakeStripe.all()[0];
    // Model a durable reservation whose bind response was lost, then a
    // separately changed draft. A retry must inspect the current amount.
    reservedInvoice = invoice.id; bindFails = false;
    if (fault === "amount") invoice.lines[0].amount = 100;
    else invoice.currency = "eur";
    const retry = await call(body);
    expect(retry.response.status).toBeGreaterThanOrEqual(400);
    expect(fakeStripe.all()).toHaveLength(1);
    expect(invoice).toMatchObject({ status: "draft", auto_advance: false, sends: 0, hosted_invoice_url: null });
    expect(notionCreates).toHaveLength(0);
    expect(stub.callsTo("/nga-roster-add").filter((c) => !JSON.parse(c.body).dry_run)).toHaveLength(0);
  });
}
for (const status of ["Cancelled", "Refunded"]) {
  test(`existing ${status.toLowerCase()} registration cannot be revived by a stale preview`, async () => {
    const token = await preview(); const body = input("register", { previewToken: token });
    expect((await call(body)).json.completed).toBe(true);
    const properties = registrationRows[0].properties as Record<string, { select: { name: string } }>;
    properties.Status.select.name = status;
    const before = stub.callsTo("/nga-roster-add").filter((c) => !JSON.parse(c.body).dry_run).length;
    expect((await call(body)).response.status).toBeGreaterThanOrEqual(400);
    expect(fakeStripe.all()).toHaveLength(1); expect(fakeStripe.all()[0].sends).toBe(1); expect(notionCreates).toHaveLength(1);
    expect(properties.Status.select.name).toBe(status);
    expect(stub.callsTo("/nga-roster-add").filter((c) => !JSON.parse(c.body).dry_run)).toHaveLength(before);
  });
}

test("an uncertain Notion create keeps its durable claim after provider restoration", async () => {
  const token = await preview(); const body = input("register", { previewToken: token });
  notionCreateOutage = true;
  const first = await call(body);
  expect(first.response.status).toBe(200);
  expect(first.json).toMatchObject({ completed: false, registrationSaved: false });
  expect(rosterCreationClaimed).toBe(true);
  const creates = () => stub.callsTo("api.notion.com/v1/pages").filter((c) => c.method === "POST");
  expect(creates()).toHaveLength(1); expect(registrationRows).toHaveLength(0);
  expect(stub.callsTo("/nga-roster-add")).toHaveLength(0);
  notionCreateOutage = false;
  const retry = await call(body);
  expect(retry.response.status).toBe(200);
  expect(retry.json).toMatchObject({ completed: false, registrationSaved: false, invoiceId: first.json.invoiceId });
  expect(creates()).toHaveLength(1); expect(registrationRows).toHaveLength(0);
  expect(retry.json.rosterSynced).toBe(false);
  expect(stub.callsTo("/nga-roster-add")).toHaveLength(0);
  expect(fakeStripe.all()).toHaveLength(1); expect(fakeStripe.all()[0].sends).toBe(1);
});

test("an ambiguous create may sync only after an active matching NGA row is read back", async () => {
  const token = await preview(); notionCreateResponseLost = true;
  const result = await call(input("register", { previewToken: token }));
  expect(result.response.status).toBe(200);
  expect(result.json).toMatchObject({ completed: true, registrationSaved: true, rosterSynced: true });
  expect(notionCreates).toHaveLength(1); expect(registrationRows).toHaveLength(1);
  expect(stub.callsTo("/nga-roster-add")).toHaveLength(1);
  expect(fakeStripe.all()).toHaveLength(1); expect(fakeStripe.all()[0].sends).toBe(1);
});

for (const fault of ["amount", "currency"]) {
  test(`tampered already-paid invoice ${fault} cannot resume registration writes`, async () => {
    const token = await preview(); const body = input("register", { previewToken: token });
    expect((await call(body)).json.completed).toBe(true);
    const invoice = fakeStripe.all()[0];
    (invoice as { status: string }).status = "paid";
    if (fault === "amount") invoice.lines[0].amount = 100;
    else invoice.currency = "eur";
    const notionWrites = stub.callsTo("api.notion.com/v1/pages").length;
    const rosterWrites = stub.callsTo("/nga-roster-add").length;
    const retry = await call(body);
    expect(retry.response.status).toBeGreaterThanOrEqual(400);
    expect(stub.callsTo("api.notion.com/v1/pages")).toHaveLength(notionWrites);
    expect(stub.callsTo("/nga-roster-add")).toHaveLength(rosterWrites);
    expect(fakeStripe.all()).toHaveLength(1); expect(invoice.sends).toBe(1);
  });
}
