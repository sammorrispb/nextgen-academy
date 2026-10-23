import { test, expect } from "@playwright/test";
import { NextRequest } from "next/server";
import { FetchStub } from "./fixtures/fetch-stub";
import { createAdminSessionValue } from "../src/lib/admin-auth";
import { createSessionCookieValue as createCoachSessionValue } from "../src/lib/coach-auth";
import { mvfAttendeeKey, mvfRequestKey } from "../src/lib/mvf-capacity";
import { POST } from "../src/app/api/admin/mvf-capacity-export/route";

// Reconciliation can export opaque native keys, never a child's source fields
// or a payment/roster mutation. Original invoice division survives a roster move.
const TOUCHED_ENV = ["COACH_SIGNING_SECRET", "ADMIN_ALLOWLIST", "NOTION_API_KEY",
  "NOTION_MVF_TOURNAMENT_REGS_DB_ID", "NGA_SYNC_SECRET", "VERCEL_ENV",
  "NEXT_PUBLIC_SITE_URL", "VERCEL_URL", "SESSION_OPS_SECRET"] as const;
const savedEnv = Object.fromEntries(TOUCHED_ENV.map(key => [key, process.env[key]]));
const ORIGIN = "https://nextgenpbacademy.com";
const REGS = "22222222333344445555666666666666";
const INVOICE = "in_SyntheticHistoricalOne";
const SECOND = "in_SyntheticHistoricalTwo";
const stub = new FetchStub();
let adminCookie: string;
let rows: ReturnType<typeof sourceRow>[];
let providerStatus: number;
let hasMore: unknown;

function identity(division = "10u") {
  return { division, resident: false, parentName: " Synthetic Parent ", email: "Parent@example.com",
    phone: "+1 (301) 555-0100", childFirstName: "Synthetic", childLastName: "Player", childDob: "2016-08-12",
    emergencyName: "Synthetic Guardian", emergencyPhone: "301-555-0101", allergies: "Private synthetic safety note", smsConsent: false };
}
function text(content: string) { return { rich_text: [{ plain_text: content }] }; }
function sourceRow(invoiceId = INVOICE) {
  const data = identity();
  return { id: "44444444-5555-6666-7777-888888888888", archived: false, in_trash: false,
    parent: { type: "database_id", database_id: REGS }, last_edited_time: "2026-10-23T13:00:00.000Z",
    properties: { "Stripe Invoice ID": text(invoiceId), "Parent Name": { title: [{ plain_text: data.parentName }] },
      "Parent Email": { email: data.email }, "Parent Phone": { phone_number: data.phone },
      "Child First Name": text(data.childFirstName), "Child Last Name": text(data.childLastName),
      "Child DOB": { date: { start: data.childDob } }, Division: { select: { name: "14U" } },
      Resident: { checkbox: data.resident }, "Emergency Name": text(data.emergencyName),
      "Emergency Phone": { phone_number: data.emergencyPhone }, Allergies: text(data.allergies),
      "SMS Consent": { checkbox: data.smsConsent }, Status: { select: { name: "Confirmed" } }, Paid: { checkbox: true } } };
}
function input() { return { invoices: [{ invoiceId: INVOICE, originalDivision: "10u" }] }; }
function request(body: unknown, cookie = adminCookie, origin: string | null = ORIGIN, contentType = "application/json") {
  return new NextRequest(`${ORIGIN}/api/admin/mvf-capacity-export`, { method: "POST",
    headers: { "content-type": contentType, ...(origin ? { origin } : {}), cookie: `nga_admin=${cookie}`,
      authorization: "Bearer synthetic-ops" }, body: JSON.stringify(body) });
}
async function call(body: unknown = input(), cookie?: string, origin?: string | null, contentType?: string) {
  const response = await POST(request(body, cookie, origin, contentType));
  return { response, json: await response.json() };
}
test.beforeEach(() => {
  for (const key of TOUCHED_ENV) delete process.env[key];
  Object.assign(process.env, { COACH_SIGNING_SECRET: "synthetic-signing-secret", ADMIN_ALLOWLIST: "admin@example.com",
    NOTION_API_KEY: "ntn_synthetic", NOTION_MVF_TOURNAMENT_REGS_DB_ID: REGS,
    NGA_SYNC_SECRET: "synthetic-sync-secret", VERCEL_ENV: "production", SESSION_OPS_SECRET: "synthetic-ops" });
  adminCookie = createAdminSessionValue("admin@example.com");
  rows = [sourceRow()]; providerStatus = 200; hasMore = false;
  stub.reset(); stub.install();
  stub.onDynamic(`databases/${REGS}/query`, () => ({ status: providerStatus,
    json: providerStatus === 200 ? { results: rows, has_more: hasMore, next_cursor: null }
      : { error: "Synthetic provider response must never escape", private: identity() } }));
});
test.afterEach(() => stub.uninstall());
test.afterAll(() => { for (const key of TOUCHED_ENV) {
  if (savedEnv[key] === undefined) delete process.env[key]; else process.env[key] = savedEnv[key];
} });

for (const kind of ["missing", "tampered", "coach", "unlisted", "unset secret", "unset allowlist"]) {
  test(`${kind} cookie cannot export child identity digests`, async () => {
    let cookie = adminCookie;
    if (kind === "missing") cookie = "";
    if (kind === "tampered") cookie += "x";
    if (kind === "coach") cookie = createCoachSessionValue("admin@example.com");
    if (kind === "unlisted") cookie = createAdminSessionValue("other@example.com");
    if (kind === "unset secret") delete process.env.COACH_SIGNING_SECRET;
    if (kind === "unset allowlist") delete process.env.ADMIN_ALLOWLIST;
    expect((await call(input(), cookie)).response.status).toBe(401);
    expect(stub.calls).toHaveLength(0);
  });
}
for (const origin of [null, "https://evil.example", `${ORIGIN}.evil.example`]) {
  test(`origin ${origin} cannot export digests`, async () => {
    expect((await call(input(), undefined, origin)).response.status).toBe(403);
    expect(stub.calls).toHaveLength(0);
  });
}
test("non-JSON and malformed JSON never reach the source", async () => {
  expect((await call(input(), undefined, undefined, "text/plain")).response.status).toBe(400);
  const response = await POST(new NextRequest(`${ORIGIN}/api/admin/mvf-capacity-export`, { method: "POST",
    headers: { "content-type": "application/json", origin: ORIGIN, cookie: `nga_admin=${adminCookie}` }, body: "{" }));
  expect(response.status).toBe(400); expect(stub.calls).toHaveLength(0);
});
test("oversized authenticated payload is rejected before source access", async () => {
  const result = await call({ invoices: [], unused: "x".repeat(16_385) });
  expect(result.response.status).toBe(400); expect(stub.calls).toHaveLength(0);
});
test("bearer-only authorization cannot read reconciliation identity", async () => {
  expect((await call(input(), "")).response.status).toBe(401);
  expect(stub.calls).toHaveLength(0);
});

test("exports only opaque native digests using original invoice division", async () => {
  const { response, json } = await call();
  expect(response.status).toBe(200); expect(response.headers.get("cache-control")).toBe("no-store");
  expect(json).toEqual({ ok: true, count: 1, sourceRevision: expect.stringMatching(/^[a-f0-9]{64}$/),
    invoices: [{ invoiceId: INVOICE, eventKey: "mvf-junior-tournament-10u-2026-10-24",
      attendeeKey: mvfAttendeeKey(identity()), requestKey: mvfRequestKey(identity()),
      poolAttendeeKey: mvfAttendeeKey(identity("14u")) }] });
  expect(JSON.stringify(json)).not.toMatch(/Synthetic Parent|Parent@example|2016-08-12|Private synthetic|44444444/);
  expect(stub.calls).toHaveLength(1);
  expect(stub.calls[0].method).toBe("POST");
  expect(stub.calls[0].url).toBe(`https://api.notion.com/v1/databases/${REGS}/query`);
  expect(JSON.parse(stub.calls[0].body)).toEqual({ filter: { or: [
    { property: "Stripe Invoice ID", rich_text: { equals: INVOICE } },
  ] }, page_size: 100 });
});
test("source revision is stable but changes with a row edit", async () => {
  const first = (await call()).json;
  expect((await call()).json.sourceRevision).toBe(first.sourceRevision);
  rows[0].last_edited_time = "2026-10-23T13:01:00.000Z";
  expect((await call()).json.sourceRevision).not.toBe(first.sourceRevision);
});
test("batch exports preserve reviewed input order without guessing source division", async () => {
  const second = sourceRow(SECOND); second.id = "55555555-6666-7777-8888-999999999999";
  rows = [second, rows[0]];
  const result = await call({ invoices: [{ invoiceId: INVOICE, originalDivision: "10u" }, { invoiceId: SECOND, originalDivision: "14u" }] });
  expect(result.response.status).toBe(200);
  expect(result.json.count).toBe(2);
  expect(result.json.invoices.map((row: { eventKey: string }) => row.eventKey)).toEqual([
    "mvf-junior-tournament-10u-2026-10-24", "mvf-junior-tournament-14u-2026-10-24",
  ]);
  expect(result.json.invoices[1].attendeeKey).toBe(mvfAttendeeKey(identity("14u")));
  expect(result.json.invoices[0].poolAttendeeKey).toBe(result.json.invoices[1].poolAttendeeKey);
});
test("the maximum reviewed batch fits in one complete source read", async () => {
  const invoices = Array.from({ length: 24 }, (_, index) => ({ invoiceId: `in_Synthetic${index}`, originalDivision: "14u" }));
  rows = invoices.map((invoice, index) => ({ ...sourceRow(invoice.invoiceId),
    id: `${index.toString(16).padStart(8, "0")}-5555-6666-7777-888888888888` }));
  const result = await call({ invoices });
  expect(result.response.status).toBe(200); expect(result.json.count).toBe(24);
  expect(stub.calls).toHaveLength(1);
});
for (const status of ["Pending", "Confirmed", "Refunded", "Cancelled"]) {
  test(`${status} history can export identity without claiming payment or a seat`, async () => {
    rows[0].properties.Status.select.name = status;
    const result = await call();
    expect(result.response.status).toBe(200);
    expect(result.json.invoices[0]).not.toHaveProperty("status");
    expect(result.json.invoices[0]).not.toHaveProperty("paid");
  });
}
test("unknown history status requires review", async () => {
  rows[0].properties.Status.select.name = "Maybe";
  expect((await call()).response.status).toBe(409);
});

const invalidBodies: [string, unknown][] = [
  ["null", null], ["array", []], ["unknown action", { ...input(), action: "activate" }],
  ["missing invoices", {}], ["empty invoices", { invoices: [] }],
  ["non-array invoices", { invoices: INVOICE }],
  ["too many invoices", { invoices: Array.from({ length: 25 }, (_, i) => ({ invoiceId: `in_Synthetic${i}`, originalDivision: "14u" })) }],
  ["duplicate invoice", { invoices: [...input().invoices, ...input().invoices] }],
  ["invalid invoice", { invoices: [{ invoiceId: "pi_Synthetic", originalDivision: "14u" }] }],
  ["overlong invoice", { invoices: [{ invoiceId: `in_${"x".repeat(251)}`, originalDivision: "14u" }] }],
  ["whitespace invoice", { invoices: [{ invoiceId: ` ${INVOICE}`, originalDivision: "14u" }] }],
  ["missing division", { invoices: [{ invoiceId: INVOICE }] }],
  ["unknown division", { invoices: [{ invoiceId: INVOICE, originalDivision: "open" }] }],
  ["supplied contact", { invoices: [{ ...input().invoices[0], email: "must-not-be-used@example.com" }] }],
  ["null invoice", { invoices: [null] }],
];
for (const [label, body] of invalidBodies) test(`${label} is rejected before source access`, async () => {
  const result = await call(body);
  expect(result.response.status).toBe(400); expect(result.json).toEqual({ ok: false, error: "bad_input" });
  expect(stub.calls).toHaveLength(0);
});

for (const key of ["NOTION_API_KEY", "NOTION_MVF_TOURNAMENT_REGS_DB_ID", "NGA_SYNC_SECRET", "VERCEL_ENV"] as const) {
  test(`missing ${key} fails closed`, async () => {
    delete process.env[key];
    expect((await call()).response.status).toBe(503); expect(stub.calls).toHaveLength(0);
  });
}
test("preview runtime never exports production keys", async () => {
  process.env.VERCEL_ENV = "preview";
  expect((await call()).response.status).toBe(503); expect(stub.calls).toHaveLength(0);
});

for (const problem of ["missing", "duplicate", "unrelated", "archived", "trash", "wrong database", "missing revision", "invalid revision", "more pages", "unknown completeness"]) {
  test(`${problem} source rows cannot yield a partial manifest`, async () => {
    if (problem === "missing") rows = [];
    if (problem === "duplicate") rows.push(sourceRow());
    if (problem === "unrelated") rows.push(sourceRow(SECOND));
    if (problem === "archived") rows[0].archived = true;
    if (problem === "trash") rows[0].in_trash = true;
    if (problem === "wrong database") rows[0].parent.database_id = "99999999888877776666555555555555";
    if (problem === "missing revision") rows[0].last_edited_time = "";
    if (problem === "invalid revision") rows[0].last_edited_time = "yesterday";
    if (problem === "more pages") hasMore = true;
    if (problem === "unknown completeness") hasMore = undefined;
    const result = await call();
    expect(result.response.status).toBeGreaterThanOrEqual(409);
    expect(result.json).not.toHaveProperty("invoices");
    expect(JSON.stringify(result.json)).not.toContain("Synthetic");
    expect(stub.calls).toHaveLength(1);
  });
}
for (const field of ["Parent Name", "Parent Email", "Parent Phone", "Child First Name", "Child Last Name", "Child DOB", "Resident", "Emergency Name", "Emergency Phone", "Allergies", "SMS Consent"]) {
  test(`missing typed ${field} cannot invent a historical identity`, async () => {
    delete (rows[0].properties as Record<string, unknown>)[field];
    const result = await call();
    expect(result.response.status).toBe(409); expect(result.json).toEqual({ ok: false, error: "source_identity_invalid" });
  });
}
test("malformed field types and impossible DOB fail without disclosing source", async () => {
  (rows[0].properties as Record<string, unknown>)["Parent Email"] = { rich_text: [{ plain_text: "parent@example.com" }] };
  expect((await call()).response.status).toBe(409);
  rows = [sourceRow()]; rows[0].properties["Child DOB"].date.start = "2016-02-30";
  expect((await call()).response.status).toBe(409);
});
test("provider failure returns no source contents and performs no fallback", async () => {
  providerStatus = 503;
  const result = await call();
  expect(result.response.status).toBe(502); expect(result.json).toEqual({ ok: false, error: "source_unavailable" });
  expect(stub.calls).toHaveLength(1);
});
test("no raw source field escapes when all native source strings change", async () => {
  rows[0].properties["Parent Name"].title[0].plain_text = "SENTINEL_PARENT";
  rows[0].properties["Parent Email"].email = "sentinel-parent@example.com";
  rows[0].properties["Child First Name"].rich_text[0].plain_text = "SENTINEL_CHILD";
  rows[0].properties.Allergies.rich_text[0].plain_text = "SENTINEL_MEDICAL";
  const result = await call();
  expect(result.response.status).toBe(200); expect(JSON.stringify(result.json)).not.toContain("SENTINEL");
  expect(JSON.stringify(result.json)).not.toContain("sentinel-parent@example.com");
});
