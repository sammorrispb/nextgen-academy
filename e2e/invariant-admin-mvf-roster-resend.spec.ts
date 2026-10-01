import { test, expect } from "@playwright/test";
import { NextRequest } from "next/server";
import { FetchStub, type RecordedFetch } from "./fixtures/fetch-stub";
import { createAdminSessionValue } from "../src/lib/admin-auth";
import { createSessionCookieValue as createCoachSessionValue } from "../src/lib/coach-auth";
import { POST } from "../src/app/api/admin/mvf-roster-sync/route";

// A preview for one stored signup cannot authorize another signup, changed
// child data, another admin session, or a write before successful eligibility.
const KEYS = ["COACH_SIGNING_SECRET", "ADMIN_ALLOWLIST", "NOTION_API_KEY",
  "NOTION_MVF_TOURNAMENT_REGS_DB_ID", "NGA_SYNC_SECRET", "VERCEL_ENV",
  "LINKDINK_BASE_URL", "STRIPE_SECRET_KEY", "RESEND_API_KEY", "TWILIO_ACCOUNT_SID",
  "TWILIO_AUTH_TOKEN", "SESSION_OPS_SECRET", "NEXT_PUBLIC_SITE_URL", "VERCEL_URL"] as const;
const saved = Object.fromEntries(KEYS.map((key) => [key, process.env[key]]));
const DB = "11111111222233334444555555555555";
const INVOICE = "in_syntheticOne";
const origin = "https://nextgenpbacademy.com";
const stub = new FetchStub();
let captured: RequestInit[] = [];
let row: ReturnType<typeof registration>;
let results: ReturnType<typeof registration>[];
let hasMore = false;

function registration(division = "10U") {
  return { id: "22222222-3333-4444-5555-666666666666", archived: false,
    in_trash: false, parent: { database_id: DB }, last_edited_time: "2026-09-30T20:00:00Z",
    properties: {
      "Stripe Invoice ID": { rich_text: [{ plain_text: INVOICE }] },
      "Child First Name": { rich_text: [{ plain_text: "  Test•Child  " }] },
      "Child Last Name": { rich_text: [{ plain_text: "Example" }] },
      "Child DOB": { date: { start: division === "10U" ? "2016-12-22" : "2013-01-01" } },
      "Parent Email": { email: "synthetic@example.com" },
      Division: { select: { name: division } }, Status: { select: { name: "Pending" } },
      Paid: { checkbox: false }, "Parent Phone": { phone_number: "DO_NOT_SEND" },
      Allergies: { rich_text: [{ plain_text: "DO_NOT_SEND" }] },
    } };
}
function request(body: unknown, cookie = createAdminSessionValue("admin@example.com"), requestOrigin = origin) {
  return new NextRequest(`${origin}/api/admin/mvf-roster-sync`, { method: "POST",
    headers: { "content-type": "application/json", origin: requestOrigin,
      cookie: `nga_admin=${cookie}`, authorization: "Bearer ops-test" },
    body: JSON.stringify(body) });
}
async function call(body: unknown, cookie?: string, requestOrigin?: string) {
  const response = await POST(request(body, cookie, requestOrigin));
  return { response, json: await response.json() };
}
async function preview() {
  const result = await call({ invoiceId: INVOICE, action: "preview" });
  expect(result.response.status).toBe(200);
  expect(result.json.outcome).toBe("would_add");
  return result.json.previewToken as string;
}
test.beforeEach(() => {
  for (const key of KEYS) delete process.env[key];
  Object.assign(process.env, { COACH_SIGNING_SECRET: "signing-test", ADMIN_ALLOWLIST: "admin@example.com",
    NOTION_API_KEY: "notion-test", NOTION_MVF_TOURNAMENT_REGS_DB_ID: DB,
    NGA_SYNC_SECRET: "sync-test", VERCEL_ENV: "production", SESSION_OPS_SECRET: "ops-test" });
  captured = []; hasMore = false; row = registration(); results = [row];
  stub.reset(); stub.install();
  const stubFetch = globalThis.fetch;
  globalThis.fetch = ((url, init) => { captured.push(init ?? {}); return stubFetch(url, init); }) as typeof fetch;
  stub.on("api.notion.com", () => ({ results, has_more: hasMore }));
  stub.on("www.linkanddink.com", (c: RecordedFetch) => {
    const body = JSON.parse(c.body);
    return body.dry_run
      ? { ok: true, dryRun: true, action: "would_add", eventSlug: `${body.event_key}-4` }
      : { ok: true, alreadyOnRoster: false, rsvpId: "rsvp-synthetic", eventSlug: `${body.event_key}-4` };
  });
});
test.afterEach(() => stub.uninstall());
test.afterAll(() => { for (const key of KEYS) {
  if (saved[key] === undefined) delete process.env[key]; else process.env[key] = saved[key];
} });

for (const kind of ["missing", "tampered", "coach", "unlisted", "unset secret", "unset allowlist"]) {
  test(`rejects ${kind} admin auth before any network read`, async () => {
    let cookie = createAdminSessionValue("admin@example.com");
    if (kind === "missing") cookie = "";
    if (kind === "tampered") cookie += "x";
    if (kind === "coach") cookie = createCoachSessionValue("admin@example.com");
    if (kind === "unlisted") cookie = createAdminSessionValue("other@example.com");
    if (kind === "unset secret") delete process.env.COACH_SIGNING_SECRET;
    if (kind === "unset allowlist") delete process.env.ADMIN_ALLOWLIST;
    expect((await call({ invoiceId: INVOICE, action: "preview" }, cookie)).response.status).toBe(401);
    expect(stub.calls).toHaveLength(0);
  });
}
test("cross-origin POST cannot read or sync a signup", async () => {
  expect((await call({ invoiceId: INVOICE, action: "preview" }, undefined, "https://attacker.example")).response.status).toBe(403);
  expect(stub.calls).toHaveLength(0);
});
test("an attacker-controlled request host cannot satisfy the origin gate", async () => {
  const cookie = createAdminSessionValue("admin@example.com");
  const response = await POST(new NextRequest("https://attacker.example/api/admin/mvf-roster-sync", {
    method: "POST", headers: { cookie: `nga_admin=${cookie}`, origin: "https://attacker.example",
      "content-type": "application/json" }, body: JSON.stringify({ invoiceId: INVOICE, action: "preview" }),
  }));
  expect(response.status).toBe(403); expect(stub.calls).toHaveLength(0);
});
for (const body of [null, [], { invoiceId: INVOICE, action: "anything" },
  { invoiceId: "bad", action: "preview" }, { invoiceId: INVOICE, action: "replay" },
  { invoiceId: INVOICE, action: "preview", email: "attacker@example.com" },
  { invoiceId: INVOICE, action: "preview", previewToken: "extra" }]) {
  test(`rejects malformed or widened input ${JSON.stringify(body)}`, async () => {
    expect((await call(body)).response.status).toBe(400); expect(stub.calls).toHaveLength(0);
  });
}
for (const key of ["NOTION_API_KEY", "NOTION_MVF_TOURNAMENT_REGS_DB_ID", "NGA_SYNC_SECRET"]) {
  test(`missing ${key} fails closed`, async () => {
    delete process.env[key]; expect((await call({ invoiceId: INVOICE, action: "preview" })).response.status).toBe(503);
    expect(stub.calls).toHaveLength(0);
  });
}
test("preview deployments cannot send children to production even with URL override", async () => {
  process.env.VERCEL_ENV = "preview"; process.env.LINKDINK_BASE_URL = origin;
  expect((await call({ invoiceId: INVOICE, action: "preview" })).response.status).toBe(503);
  expect(stub.calls).toHaveLength(0);
});
test("production destination is fixed, never the override", async () => {
  process.env.LINKDINK_BASE_URL = "https://attacker.example"; await preview();
  expect(stub.calls[1].url).toBe("https://www.linkanddink.com/play/api/internal/nga-roster-add");
});
for (const division of ["10U", "14U"]) {
  test(`${division} preview/replay sends original cleaned identity only and no payment actions`, async () => {
    row = registration(division); results = [row]; const token = await preview();
    const result = await call({ invoiceId: INVOICE, action: "replay", previewToken: token });
    expect(result.response.status).toBe(200); expect(result.json.outcome).toBe("added");
    const calls = stub.callsTo("linkanddink"); expect(calls).toHaveLength(2);
    const expected = { event_key: `mvf-junior-tournament-${division.toLowerCase()}-2026-10-24`,
      first_name: "Test Child", last_name: "Example", email: "synthetic@example.com" };
    expect(JSON.parse(calls[0].body)).toEqual({ ...expected, dry_run: true });
    expect(JSON.parse(calls[1].body)).toEqual(expected);
    for (const init of captured) {
      expect(init.redirect).toBe("error"); expect(init.cache).toBe("no-store");
    }
    expect(new Headers(captured[1].headers).get("x-nga-sync-secret")).toBe("sync-test");
    expect(stub.callsTo("api.notion.com").every((c) => c.url.endsWith("/query") && c.method === "POST")).toBe(true);
    expect(JSON.stringify(result.json)).not.toMatch(/Test Child|Example|synthetic@|sync-test|notion-test|DO_NOT_SEND/);
    expect(result.response.headers.get("cache-control")).toContain("no-store");
  });
}
for (const fault of ["missing", "duplicate", "pagination", "wrong database", "wrong invoice", "archived",
  "cancelled", "division", "email", "name", "too young", "too old", "invalid DOB"]) {
  test(`ineligible source (${fault}) cannot reach L&D`, async () => {
    if (fault === "missing") results = [];
    if (fault === "duplicate") results = [row, row];
    if (fault === "pagination") hasMore = true;
    if (fault === "wrong database") row.parent.database_id = "another-db";
    if (fault === "wrong invoice") row.properties["Stripe Invoice ID"].rich_text[0].plain_text = "in_other";
    if (fault === "archived") row.archived = true;
    if (fault === "cancelled") row.properties.Status.select.name = "Cancelled";
    if (fault === "division") row.properties.Division.select.name = "16U";
    if (fault === "email") row.properties["Parent Email"].email = "bad email";
    if (fault === "name") row.properties["Child First Name"].rich_text[0].plain_text = "!!!";
    if (fault === "too young") row.properties["Child DOB"].date.start = "2019-01-01";
    if (fault === "too old") row.properties["Child DOB"].date.start = "2014-01-01";
    if (fault === "invalid DOB") row.properties["Child DOB"].date.start = "2016-02-31";
    expect((await call({ invoiceId: INVOICE, action: "preview" })).response.status).toBeGreaterThanOrEqual(400);
    expect(stub.callsTo("linkanddink")).toHaveLength(0);
  });
}
for (const fault of ["tampered", "other invoice", "changed source", "other session", "expired"]) {
  test(`preview receipt rejects ${fault} without upstream write`, async () => {
    let token = await preview(); const oldNow = Date.now;
    let invoiceId = INVOICE; let cookie: string | undefined;
    if (fault === "tampered") token += "x";
    if (fault === "other invoice") { invoiceId = "in_other"; row.properties["Stripe Invoice ID"].rich_text[0].plain_text = invoiceId; }
    if (fault === "changed source") row.properties["Child First Name"].rich_text[0].plain_text = "Different";
    if (fault === "other session") { process.env.ADMIN_ALLOWLIST += ",second@example.com"; cookie = createAdminSessionValue("second@example.com"); }
    if (fault === "expired") Date.now = () => oldNow() + 11 * 60_000;
    try { expect((await call({ invoiceId, action: "replay", previewToken: token }, cookie)).response.status).toBe(409); }
    finally { Date.now = oldNow; }
    expect(stub.callsTo("linkanddink")).toHaveLength(1);
  });
}
test("a repeat replay delegates idempotency to the same protected endpoint", async () => {
  stub.reset(); stub.on("api.notion.com", () => ({ results, has_more: false }));
  let writes = 0;
  stub.on("linkanddink", (c: RecordedFetch) => JSON.parse(c.body).dry_run
    ? { ok: true, dryRun: true, action: "would_add", eventSlug: "mvf-junior-tournament-10u-2026-10-24-4" }
    : { ok: true, alreadyOnRoster: writes++ > 0, rsvpId: "same-rsvp", eventSlug: "mvf-junior-tournament-10u-2026-10-24-4" });
  const token = await preview();
  expect((await call({ invoiceId: INVOICE, action: "replay", previewToken: token })).json.outcome).toBe("added");
  expect((await call({ invoiceId: INVOICE, action: "replay", previewToken: token })).json.outcome).toBe("already_on_roster");
  expect(stub.callsTo("linkanddink")[1].body).toBe(stub.callsTo("linkanddink")[2].body);
});
for (const phase of ["preview", "replay"]) {
  test(`${phase} rejects upstream eligibility failure without echo or false success`, async () => {
    const token = await preview();
    stub.reset(); stub.on("api.notion.com", () => ({ results, has_more: false }))
      .on("linkanddink", { ok: false, error: "private synthetic@example.com TestChild sync-test" }, 409);
    const result = await call({ invoiceId: INVOICE, action: phase, ...(phase === "replay" ? { previewToken: token } : {}) });
    expect(result.response.status).toBe(502);
    expect(result.json).toEqual({ ok: false, error: "sync_failed" });
  });
}
test("unconfirmed upstream write is not reported as a completed sync", async () => {
  const token = await preview();
  stub.reset(); stub.on("api.notion.com", () => ({ results, has_more: false })).on("linkanddink", { ok: true });
  expect((await call({ invoiceId: INVOICE, action: "replay", previewToken: token })).response.status).toBe(502);
});
test("an existing RSVP gets no replay capability", async () => {
  stub.reset(); stub.on("api.notion.com", () => ({ results, has_more: false }))
    .on("linkanddink", { ok: true, dryRun: true, action: "already_on_roster", eventSlug: "mvf-junior-tournament-10u-2026-10-24-4" });
  const result = await call({ invoiceId: INVOICE, action: "preview" });
  expect(result.json.outcome).toBe("already_on_roster");
  expect(result.json).not.toHaveProperty("previewToken");
});
test("Notion query failure cannot fall through to a sync", async () => {
  stub.reset(); stub.on("api.notion.com", { private: "synthetic@example.com" }, 503);
  const result = await call({ invoiceId: INVOICE, action: "preview" });
  expect(result.response.status).toBe(502);
  expect(result.json).toEqual({ ok: false, error: "registration_lookup_failed" });
  expect(stub.callsTo("linkanddink")).toHaveLength(0);
});
test("only an explicitly confirmed dry-run can authorize replay", async () => {
  stub.reset(); stub.on("api.notion.com", () => ({ results, has_more: false }))
    .on("linkanddink", { ok: true, eventSlug: "mvf-junior-tournament-10u-2026-10-24-4", action: "would_add" });
  const result = await call({ invoiceId: INVOICE, action: "preview" });
  expect(result.response.status).toBe(502); expect(result.json).not.toHaveProperty("previewToken");
});
for (const [division, dob, eligible] of [
  ["10U", "2018-10-24", true], ["10U", "2018-10-25", false],
  ["10U", "2015-10-25", true], ["10U", "2015-10-24", false],
  ["14U", "2015-10-24", true], ["14U", "2015-10-25", false],
  ["14U", "2011-10-25", true], ["14U", "2011-10-24", false],
] as const) {
  test(`${division} age boundary ${dob} eligible=${eligible}`, async () => {
    row = registration(division); row.properties["Child DOB"].date.start = dob; results = [row];
    const result = await call({ invoiceId: INVOICE, action: "preview" });
    expect(result.response.status).toBe(eligible ? 200 : 409);
    expect(stub.callsTo("linkanddink")).toHaveLength(eligible ? 1 : 0);
  });
}
