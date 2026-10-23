import { test, expect } from "@playwright/test";
import { NextRequest } from "next/server";
import { FetchStub, type RecordedFetch } from "./fixtures/fetch-stub";
import { POST } from "../src/app/api/internal/mvf-parent-contacts/route";

// Only an authenticated L&D server may resolve already-known, sibling-safe
// roster keys. The projection contains parent delivery contacts, never children.
const ENV = ["NOTION_API_KEY", "NOTION_MVF_TOURNAMENT_REGS_DB_ID", "NGA_SYNC_SECRET", "VERCEL_ENV"] as const;
const saved = Object.fromEntries(ENV.map((key) => [key, process.env[key]]));
const DB = "11111111222233334444555555555555";
const EVENT = "mvf-junior-tournament-10u-2026-10-24";
const KEY = "nga:WrMPV86DAj8AR_fm-Cjk-9";
const SIBLING = "nga:_FF9B_ehpSq3KH0QDuQY4n";
const SECOND = "nga:sLLqwHyrk55jZinfHuGVRI";
const UNKNOWN = "nga:aaaaaaaaaaaaaaaaaaaaaa";
const PAGE_ID = "11111111-2222-3333-4444-555555555555";
const OTHER_PAGE_ID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
const REF = `nga-notion-${PAGE_ID}`;
const OTHER_REF = `nga-notion-${OTHER_PAGE_ID}`;
const stub = new FetchStub();
let rows: ReturnType<typeof registration>[];
let captured: RequestInit[];

function registration(first = "  Test•Child  ", email = "  Parent@Example.com  ", division = "10U", status = "Confirmed") {
  return { id: `synthetic-${first}`, archived: false, in_trash: false, parent: { database_id: DB }, properties: {
    Division: { select: { name: division } }, Status: { select: { name: status } },
    "Child First Name": { rich_text: [{ plain_text: first }] },
    "Child Last Name": { rich_text: [{ plain_text: "Example" }] },
    "Parent Email": { email }, "Parent Phone": { phone_number: "DO_NOT_RETURN" },
    "Child DOB": { date: { start: "2016-12-22" } },
    "Stripe Invoice ID": { rich_text: [{ plain_text: "in_DO_NOT_RETURN" }] },
    Allergies: { rich_text: [{ plain_text: "DO_NOT_RETURN" }] },
  } };
}
function request(body: unknown, options: { secret?: string; contentType?: string; raw?: string; length?: string; origin?: string } = {}) {
  return new NextRequest("https://nextgenpbacademy.com/api/internal/mvf-parent-contacts", {
    method: "POST", headers: {
      "content-type": options.contentType ?? "application/json",
      "x-nga-sync-secret": options.secret ?? "sync-synthetic",
      ...(options.length ? { "content-length": options.length } : {}),
      ...(options.origin ? { origin: options.origin } : {}),
    }, body: options.raw ?? JSON.stringify(body),
  });
}
async function call(body: unknown = { event_key: EVENT, sync_keys: [KEY] }, options?: Parameters<typeof request>[1]) {
  const response = await POST(request(body, options));
  return { response, json: await response.json() };
}
test.beforeEach(() => {
  for (const key of ENV) delete process.env[key];
  Object.assign(process.env, { NOTION_API_KEY: "notion-synthetic", NOTION_MVF_TOURNAMENT_REGS_DB_ID: DB,
    NGA_SYNC_SECRET: "sync-synthetic", VERCEL_ENV: "production" });
  rows = [registration()]; captured = []; stub.reset(); stub.install();
  const fetch = globalThis.fetch;
  globalThis.fetch = ((url, init) => { captured.push(init ?? {}); return fetch(url, init); }) as typeof fetch;
  stub.on("api.notion.com", () => ({ results: rows, has_more: false, next_cursor: null }));
});
test.afterEach(() => stub.uninstall());
test.afterAll(() => { for (const key of ENV) {
  if (saved[key] === undefined) delete process.env[key]; else process.env[key] = saved[key];
} });

test("known NGA key resolves the cleaned registration identity to the normalized parent email only", async () => {
  const { response, json } = await call();
  expect(response.status).toBe(200);
  expect(json).toEqual({ contacts: [{ sync_key: KEY, email: "parent@example.com" }], missing_sync_keys: [] });
  expect(response.headers.get("cache-control")).toContain("no-store");
  expect(response.headers.has("access-control-allow-origin")).toBe(false);
  expect(JSON.stringify(json)).not.toMatch(/Test|Child|Example|2016|DO_NOT_RETURN|synthetic/);
  expect(stub.calls).toHaveLength(1);
  expect(stub.calls[0].url).toBe(`https://api.notion.com/v1/databases/${DB}/query`);
  expect(stub.calls[0].method).toBe("POST");
  expect(JSON.parse(stub.calls[0].body)).toEqual({ filter: { and: [
    { property: "Division", select: { equals: "10U" } },
    { or: [{ property: "Status", select: { equals: "Pending" } }, { property: "Status", select: { equals: "Confirmed" } }] },
  ] }, page_size: 100 });
  expect(captured[0].cache).toBe("no-store");
  expect(captured[0].redirect).toBe("error");
  expect(captured[0].signal).toBeTruthy();
});
test("siblings retain separate roster keys while delivering to the same parent", async () => {
  rows = [registration(), registration("Sibling", "parent@example.com")];
  expect((await call({ event_key: EVENT, sync_keys: [SIBLING, KEY, UNKNOWN] })).json).toEqual({
    contacts: [{ sync_key: SIBLING, email: "parent@example.com" }, { sync_key: KEY, email: "parent@example.com" }],
    missing_sync_keys: [UNKNOWN],
  });
});
test("two families never resolve to each other's contact", async () => {
  rows = [registration(), registration("Second", "second@example.com")];
  expect((await call({ event_key: EVENT, sync_keys: [SECOND] })).json).toEqual({
    contacts: [{ sync_key: SECOND, email: "second@example.com" }], missing_sync_keys: [],
  });
});
test("14U selects only its own division even when the source returns other rows", async () => {
  const result = await call({ event_key: "mvf-junior-tournament-14u-2026-10-24", sync_keys: [KEY] });
  expect(result.json).toEqual({ contacts: [], missing_sync_keys: [KEY] });
  expect(JSON.parse(stub.calls[0].body).filter.and[0]).toEqual({ property: "Division", select: { equals: "14U" } });
});
test("an active 14U registration resolves without changing its original sibling-safe key", async () => {
  rows[0].properties.Division.select.name = "14U";
  expect((await call({ event_key: "mvf-junior-tournament-14u-2026-10-24", sync_keys: [KEY] })).json).toEqual({
    contacts: [{ sync_key: KEY, email: "parent@example.com" }], missing_sync_keys: [],
  });
});
for (const status of ["Cancelled", "Canceled", "Refunded", "", "Paid"]) {
  test(`a ${status || "missing"} status cannot yield a contact`, async () => {
    rows = [registration(undefined, undefined, undefined, status)];
    expect((await call()).json).toEqual({ contacts: [], missing_sync_keys: [KEY] });
  });
}
test("Pending registrations retain their operational parent contact", async () => {
  rows = [registration(undefined, undefined, undefined, "Pending")];
  expect((await call()).json.contacts).toEqual([{ sync_key: KEY, email: "parent@example.com" }]);
});
for (const fault of ["invalid email", "missing email", "unprintable name", "unknown division", "archived", "trashed"]) {
  test(`${fault} is missing rather than exposing an unrelated contact`, async () => {
    if (fault === "invalid email") rows[0].properties["Parent Email"].email = "bad email";
    if (fault === "missing email") rows[0].properties["Parent Email"].email = "";
    if (fault === "unprintable name") rows[0].properties["Child First Name"].rich_text[0].plain_text = "!!!";
    if (fault === "unknown division") rows[0].properties.Division.select.name = "16U";
    if (fault === "archived") rows[0].archived = true;
    if (fault === "trashed") rows[0].in_trash = true;
    expect((await call()).json).toEqual({ contacts: [], missing_sync_keys: [KEY] });
  });
}
test("duplicate rows with the same normalized contact do not duplicate recipients", async () => {
  rows.push({ ...registration(), id: "synthetic-duplicate" });
  expect((await call()).json).toEqual({ contacts: [{ sync_key: KEY, email: "parent@example.com" }], missing_sync_keys: [] });
});
test("empty requested keys produce no source read", async () => {
  expect((await call({ event_key: EVENT, sync_keys: [] })).json).toEqual({ contacts: [], missing_sync_keys: [] });
  expect(stub.calls).toHaveLength(0);
});
test("the maximum 100 requested keys is valid and never widens to all source contacts", async () => {
  const keys = Array.from({ length: 100 }, (_, index) => `nga:${String(index).padStart(22, "0")}`);
  expect((await call({ event_key: EVENT, sync_keys: keys })).json).toEqual({ contacts: [], missing_sync_keys: keys });
  expect(stub.calls).toHaveLength(1);
});
test("a stable registration reference resolves a renamed child under the original roster key", async () => {
  rows[0].id = PAGE_ID;
  rows[0].properties["Child First Name"].rich_text[0].plain_text = "Corrected";
  rows[0].properties["Child Last Name"].rich_text[0].plain_text = "Spelling";
  const result = await call({ event_key: EVENT, sync_keys: [KEY], registration_refs: [{ sync_key: KEY, registration_ref: REF }] });
  expect(result.response.status).toBe(200);
  expect(result.json).toEqual({ contacts: [{ sync_key: KEY, email: "parent@example.com" }], missing_sync_keys: [] });
  expect(JSON.stringify(result.json)).not.toMatch(/Corrected|Spelling|nga-notion|11111111|child|page_id/);
});
test("the same renamed child remains missing without the explicit stable reference", async () => {
  rows[0].id = PAGE_ID;
  rows[0].properties["Child First Name"].rich_text[0].plain_text = "Corrected";
  expect((await call()).json).toEqual({ contacts: [], missing_sync_keys: [KEY] });
});
test("a stable source identity does not require a printable child name for parent delivery", async () => {
  rows[0].id = PAGE_ID;
  rows[0].properties["Child First Name"].rich_text[0].plain_text = "!!!";
  expect((await call({ event_key: EVENT, sync_keys: [KEY], registration_refs: [{ sync_key: KEY, registration_ref: REF }] })).json)
    .toEqual({ contacts: [{ sync_key: KEY, email: "parent@example.com" }], missing_sync_keys: [] });
});
test("reference UUID/prefix case normalizes without changing the response contract", async () => {
  rows[0].id = OTHER_PAGE_ID.toUpperCase();
  expect((await call({ event_key: EVENT, sync_keys: [KEY], registration_refs: [{ sync_key: KEY, registration_ref: OTHER_REF.toUpperCase() }] })).json)
    .toEqual({ contacts: [{ sync_key: KEY, email: "parent@example.com" }], missing_sync_keys: [] });
});
test("mixed stable references and legacy keys preserve caller order and family separation", async () => {
  rows[0].id = PAGE_ID;
  rows[0].properties["Child First Name"].rich_text[0].plain_text = "Corrected";
  rows.push(registration("Second", "second@example.com"));
  expect((await call({ event_key: EVENT, sync_keys: [SECOND, KEY], registration_refs: [{ sync_key: KEY, registration_ref: REF }] })).json)
    .toEqual({ contacts: [{ sync_key: SECOND, email: "second@example.com" }, { sync_key: KEY, email: "parent@example.com" }], missing_sync_keys: [] });
});
test("an explicit missing reference never falls back to a matching legacy key", async () => {
  rows[0].id = OTHER_PAGE_ID;
  expect((await call({ event_key: EVENT, sync_keys: [KEY], registration_refs: [{ sync_key: KEY, registration_ref: REF }] })).json)
    .toEqual({ contacts: [], missing_sync_keys: [KEY] });
});
for (const fault of ["wrong division", "Cancelled", "Refunded", "archived", "trashed", "invalid email", "missing email"]) {
  test(`referenced ${fault} registration cannot fall back to a matching legacy registration`, async () => {
    const explicit = registration("Corrected");
    explicit.id = PAGE_ID;
    if (fault === "wrong division") explicit.properties.Division.select.name = "14U";
    if (fault === "Cancelled" || fault === "Refunded") explicit.properties.Status.select.name = fault;
    if (fault === "archived") explicit.archived = true;
    if (fault === "trashed") explicit.in_trash = true;
    if (fault === "invalid email") explicit.properties["Parent Email"].email = "bad email";
    if (fault === "missing email") explicit.properties["Parent Email"].email = "";
    rows.push(explicit);
    expect((await call({ event_key: EVENT, sync_keys: [KEY], registration_refs: [{ sync_key: KEY, registration_ref: REF }] })).json)
      .toEqual({ contacts: [], missing_sync_keys: [KEY] });
  });
}
test("a referenced source row from another database fails closed without any parent response", async () => {
  rows[0].id = PAGE_ID;
  rows[0].parent.database_id = "aaaaaaaa222233334444555555555555";
  const result = await call({ event_key: EVENT, sync_keys: [KEY], registration_refs: [{ sync_key: KEY, registration_ref: REF }] });
  expect(result.response.status).toBe(502);
  expect(result.json).toEqual({ error: "contact_lookup_failed" });
});
test("a conflicting repeated page identity cannot silently choose one family's email", async () => {
  rows[0].id = PAGE_ID;
  const conflict = registration("Corrected", "another@example.com");
  conflict.id = PAGE_ID;
  rows.push(conflict);
  const result = await call({ event_key: EVENT, sync_keys: [KEY], registration_refs: [{ sync_key: KEY, registration_ref: REF }] });
  expect(result.response.status).toBe(502);
  expect(result.json).toEqual({ error: "contact_lookup_failed" });
});
for (const [index, registration_refs] of [null, "all", [{}], [{ sync_key: KEY }], [{ registration_ref: REF }],
  [{ sync_key: UNKNOWN, registration_ref: REF }], [{ sync_key: KEY, registration_ref: PAGE_ID }],
  [{ sync_key: KEY, registration_ref: "nga-notion-not-a-uuid" }],
  [{ sync_key: KEY, registration_ref: REF, parent_email: "evil@example.com" }],
  [{ sync_key: KEY, registration_ref: REF }, { sync_key: KEY, registration_ref: OTHER_REF }],
  [{ sync_key: KEY, registration_ref: REF }, { sync_key: SECOND, registration_ref: REF.toUpperCase() }]].entries()) {
  test(`malformed/duplicate/unrequested stable mapping ${index} reads nothing`, async () => {
    const result = await call({ event_key: EVENT, sync_keys: [KEY, SECOND], registration_refs });
    expect(result.response.status).toBe(400);
    expect(stub.calls).toHaveLength(0);
  });
}
test("an empty explicit-reference list preserves the legacy request behavior", async () => {
  expect((await call({ event_key: EVENT, sync_keys: [KEY], registration_refs: [] })).json)
    .toEqual({ contacts: [{ sync_key: KEY, email: "parent@example.com" }], missing_sync_keys: [] });
});
test("100 references plus keys fit the bounded 16 KiB request", async () => {
  const sync_keys = Array.from({ length: 100 }, (_, index) => `nga:${String(index).padStart(22, "0")}`);
  const registration_refs = sync_keys.map((sync_key, index) => ({ sync_key,
    registration_ref: `nga-notion-11111111-2222-3333-4444-${index.toString(16).padStart(12, "0")}` }));
  const body = { event_key: EVENT, sync_keys, registration_refs };
  const bytes = Buffer.byteLength(JSON.stringify(body));
  expect(bytes).toBeGreaterThan(8192);
  expect(bytes).toBeLessThanOrEqual(16384);
  const result = await call(body);
  expect(result.response.status).toBe(200);
  expect(result.json).toEqual({ contacts: [], missing_sync_keys: sync_keys });
});
test("stable references do not bypass the service credential gate", async () => {
  const result = await call({ event_key: EVENT, sync_keys: [KEY], registration_refs: [{ sync_key: KEY, registration_ref: REF }] }, { secret: "wrong" });
  expect(result.response.status).toBe(401);
  expect(stub.calls).toHaveLength(0);
});
for (const secret of ["", "wrong", "sync-syntheticX"]) {
  test(`invalid server credential (${secret || "absent"}) rejects before reading`, async () => {
    expect((await call(undefined, { secret })).response.status).toBe(401);
    expect(stub.calls).toHaveLength(0);
  });
}
for (const key of ENV) {
  test(`missing ${key} fails closed before source read`, async () => {
    delete process.env[key];
    expect((await call()).response.status).toBe(503);
    expect(stub.calls).toHaveLength(0);
  });
}
for (const env of ["preview", "development", ""]) {
  test(`${env || "unknown"} runtime cannot read production parents`, async () => {
    process.env.VERCEL_ENV = env;
    expect((await call()).response.status).toBe(503);
    expect(stub.calls).toHaveLength(0);
  });
}
test("invalid database configuration cannot redirect the fixed provider request", async () => {
  process.env.NOTION_MVF_TOURNAMENT_REGS_DB_ID = "../../other-query";
  expect((await call()).response.status).toBe(503);
  expect(stub.calls).toHaveLength(0);
});
test("browser Origin is rejected even with a valid server credential", async () => {
  expect((await call(undefined, { origin: "https://www.linkanddink.com" })).response.status).toBe(403);
  expect(stub.calls).toHaveLength(0);
});
for (const body of [null, [], {}, { event_key: EVENT }, { event_key: EVENT, sync_keys: "all" },
  { event_key: `${EVENT}-3`, sync_keys: [KEY] }, { event_key: "unrelated-event", sync_keys: [KEY] },
  { event_key: EVENT, sync_keys: [KEY, KEY] }, { event_key: EVENT, sync_keys: ["nga:bad"] },
  { event_key: EVENT, sync_keys: [123] }, { event_key: EVENT, sync_keys: [KEY], email: "evil@example.com" },
  { event_key: EVENT, sync_keys: Array.from({ length: 101 }, (_, i) => `nga:${String(i).padStart(22, "0")}`) }]) {
  test(`malformed or widened body cannot read source: ${JSON.stringify(body).slice(0, 95)}`, async () => {
    expect((await call(body)).response.status).toBe(400);
    expect(stub.calls).toHaveLength(0);
  });
}
for (const options of [{ contentType: "text/plain" }, { raw: "{" }, { length: "bad" }]) {
  test(`invalid request encoding ${JSON.stringify(options)} reads nothing`, async () => {
    expect((await call(undefined, options)).response.status).toBe(400);
    expect(stub.calls).toHaveLength(0);
  });
}
for (const [index, options] of [{ length: "20000" }, { raw: " ".repeat(16385) }, { raw: "é".repeat(8193) }].entries()) {
  test(`oversize input ${index} is bounded before source read`, async () => {
    expect((await call(undefined, options)).response.status).toBe(413);
    expect(stub.calls).toHaveLength(0);
  });
}
test("complete cursor pagination resolves a contact found only on the second page", async () => {
  stub.reset();
  stub.on("api.notion.com", (request: RecordedFetch) => JSON.parse(request.body).start_cursor
    ? { results: rows, has_more: false, next_cursor: null }
    : { results: [], has_more: true, next_cursor: "next-synthetic" });
  expect((await call()).json.contacts).toEqual([{ sync_key: KEY, email: "parent@example.com" }]);
  expect(stub.calls).toHaveLength(2);
  expect(JSON.parse(stub.calls[1].body).start_cursor).toBe("next-synthetic");
  expect(captured[0].signal).toBe(captured[1].signal);
});
for (const fault of ["missing cursor", "repeated cursor", "page cap", "malformed envelope", "wrong database", "malformed row", "upstream refusal", "unavailable", "later-page failure"]) {
  test(`${fault} never returns a partial contact list`, async () => {
    stub.reset();
    stub.onDynamic("api.notion.com", () => {
      if (fault === "upstream refusal") return { status: 500, json: { error: "parent@example.com DO_NOT_RETURN" } };
      if (fault === "unavailable") throw new Error("parent@example.com DO_NOT_RETURN");
      if (fault === "later-page failure" && stub.calls.length > 1) return { status: 503, json: {} };
      if (fault === "malformed envelope") return { status: 200, json: { results: rows } };
      if (fault === "wrong database") rows[0].parent.database_id = "another-database";
      return { status: 200, json: { results: fault === "malformed row" ? [null] : rows,
        has_more: !["wrong database", "malformed row"].includes(fault),
        next_cursor: fault === "missing cursor" ? null : fault === "page cap" ? `cursor-${stub.calls.length}` : "same-cursor" } };
    });
    const result = await call();
    expect(result.response.status).toBe(502);
    expect(result.json).toEqual({ error: "contact_lookup_failed" });
    expect(result.response.headers.get("cache-control")).toContain("no-store");
    expect(stub.calls.length).toBeLessThanOrEqual(20);
  });
}
