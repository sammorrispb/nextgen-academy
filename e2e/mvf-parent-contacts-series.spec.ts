import { createHmac } from "node:crypto";
import { test, expect } from "@playwright/test";
import { NextRequest } from "next/server";
import { FetchStub } from "./fixtures/fetch-stub";
import { POST } from "../src/app/api/internal/mvf-parent-contacts/route";
import { buildMvfSeriesRosterSyncBody } from "../src/lib/linkdink-roster-sync";

// The November-onward MVF series (12U/16U) on the same server-to-server
// surface as October. A series L&D key reads ONLY the series registrations DB,
// ONLY that tournament's rows (one DB holds every month), and ONLY paid seats:
// the series webhook seats a child on L&D once the seat is published paid, so a
// Pending or Review-required row is never on the roster this audience mirrors.
const ENV = ["NOTION_API_KEY", "NOTION_MVF_TOURNAMENT_REGS_DB_ID", "NOTION_MVF_SERIES_REGS_DB_ID",
  "NGA_SYNC_SECRET", "VERCEL_ENV"] as const;
const saved = Object.fromEntries(ENV.map((key) => [key, process.env[key]]));
const SECRET = "sync-synthetic";
const OCTOBER_DB = "11111111222233334444555555555555";
const SERIES_DB = "99999999888877776666555555555555";
const NOV_12U = "mvf-junior-tournament-12u-2026-11-14";
const NOV_LEDGER_12U = "mvf-junior-tournament-november-2026-12u";
const stub = new FetchStub();
let rows: ReturnType<typeof seat>[];

/** L&D's ngaSyncKey, written out independently of the reader under test. */
function ldKey(email: string, first: string, last: string): string {
  const material = [email, first, last].map((part) => part.trim().toLowerCase()).join("|");
  return `nga:${createHmac("sha256", SECRET).update(`nga-roster-sync:${material}`).digest("base64url").slice(0, 22)}`;
}
const KEY = ldKey("parent@example.com", "Test", "Example");
const SIBLING = ldKey("parent@example.com", "Sibling", "Example");
const SECOND = ldKey("second@example.com", "Second", "Example");

function seat(first = "Test", email = "Parent@Example.com", options: {
  division?: string; status?: string; paid?: boolean; eventKey?: string;
} = {}) {
  return { id: `synthetic-${first}`, archived: false, in_trash: false, parent: { database_id: SERIES_DB }, properties: {
    Division: { select: { name: options.division ?? "12U" } },
    Status: { select: { name: options.status ?? "Confirmed" } },
    Paid: { checkbox: options.paid ?? true },
    "Event Key": { rich_text: [{ plain_text: options.eventKey ?? NOV_LEDGER_12U }] },
    "Child First Name": { rich_text: [{ plain_text: first }] },
    "Child Last Name": { rich_text: [{ plain_text: "Example" }] },
    "Parent Email": { email }, "Parent Phone": { phone_number: "DO_NOT_RETURN" },
    "Child DOB": { date: { start: "2015-03-09" } },
    "Stripe Invoice ID": { rich_text: [{ plain_text: "in_DO_NOT_RETURN" }] },
  } };
}
async function call(body: unknown) {
  const response = await POST(new NextRequest("https://nextgenpbacademy.com/api/internal/mvf-parent-contacts", {
    method: "POST", headers: { "content-type": "application/json", "x-nga-sync-secret": SECRET }, body: JSON.stringify(body),
  }));
  return { response, json: await response.json() };
}
test.beforeEach(() => {
  for (const key of ENV) delete process.env[key];
  Object.assign(process.env, { NOTION_API_KEY: "notion-synthetic", NOTION_MVF_TOURNAMENT_REGS_DB_ID: OCTOBER_DB,
    NOTION_MVF_SERIES_REGS_DB_ID: SERIES_DB, NGA_SYNC_SECRET: SECRET, VERCEL_ENV: "production" });
  rows = [seat()]; stub.reset(); stub.install();
  stub.on("api.notion.com", () => ({ results: rows, has_more: false, next_cursor: null }));
});
test.afterEach(() => stub.uninstall());
test.afterAll(() => { for (const key of ENV) {
  if (saved[key] === undefined) delete process.env[key]; else process.env[key] = saved[key];
} });

test("a paid November 12U seat resolves to its parent from the series DB only", async () => {
  const { response, json } = await call({ event_key: NOV_12U, sync_keys: [KEY] });
  expect(response.status).toBe(200);
  expect(json).toEqual({ contacts: [{ sync_key: KEY, email: "parent@example.com" }], missing_sync_keys: [] });
  expect(JSON.stringify(json)).not.toMatch(/Test|Example|2015|DO_NOT_RETURN|november/);
  expect(stub.calls).toHaveLength(1);
  expect(stub.calls[0].url).toBe(`https://api.notion.com/v1/databases/${SERIES_DB}/query`);
  expect(JSON.parse(stub.calls[0].body)).toEqual({ filter: { and: [
    { property: "Event Key", rich_text: { equals: NOV_LEDGER_12U } },
    { property: "Division", select: { equals: "12U" } },
    { property: "Status", select: { equals: "Confirmed" } },
  ] }, page_size: 100 });
});

test("the reader's key is the key L&D computed from what the series sync sent", async () => {
  // A messy typed name: the roster sync cleans it before sending, and L&D
  // hashes what it received. The reader must land on that same key.
  rows = [seat("  Zoë-Ann!!  ")];
  const sent = buildMvfSeriesRosterSyncBody({ event: "november-2026", division: "12u",
    childFirstName: "  Zoë-Ann!!  ", childLastName: "Example", parentEmail: "parent@example.com" });
  expect(sent?.event_key).toBe(NOV_12U);
  const key = ldKey(sent!.email, sent!.first_name, sent!.last_name);
  expect((await call({ event_key: NOV_12U, sync_keys: [key] })).json)
    .toEqual({ contacts: [{ sync_key: key, email: "parent@example.com" }], missing_sync_keys: [] });
});

test("siblings and separate families keep their own keys", async () => {
  rows = [seat(), seat("Sibling", "parent@example.com"), seat("Second", "second@example.com")];
  expect((await call({ event_key: NOV_12U, sync_keys: [SECOND, SIBLING, KEY] })).json).toEqual({ contacts: [
    { sync_key: SECOND, email: "second@example.com" },
    { sync_key: SIBLING, email: "parent@example.com" },
    { sync_key: KEY, email: "parent@example.com" },
  ], missing_sync_keys: [] });
});

for (const [label, options] of [
  ["Pending", { status: "Pending" }],
  ["Review required", { status: "Review required" }],
  ["Cancelled", { status: "Cancelled" }],
  ["Confirmed but not marked paid", { paid: false }],
  ["another month's seat", { eventKey: "mvf-junior-tournament-january-2027-12u" }],
  ["the other division", { division: "16U", eventKey: "mvf-junior-tournament-november-2026-16u" }],
  ["a seat with no Event Key", { eventKey: "" }],
] as const) {
  test(`${label} never yields a contact even when the source returns it`, async () => {
    rows = [seat("Test", "Parent@Example.com", options)];
    expect((await call({ event_key: NOV_12U, sync_keys: [KEY] })).json).toEqual({ contacts: [], missing_sync_keys: [KEY] });
  });
}

for (const [ldEventKey, ledger, division] of [
  ["mvf-junior-tournament-16u-2026-11-14", "mvf-junior-tournament-november-2026-16u", "16U"],
  ["mvf-junior-tournament-12u-2027-01-17", "mvf-junior-tournament-january-2027-12u", "12U"],
  ["mvf-junior-tournament-16u-2027-01-17", "mvf-junior-tournament-january-2027-16u", "16U"],
  ["mvf-junior-tournament-12u-2027-02-14", "mvf-junior-tournament-february-2027-12u", "12U"],
  ["mvf-junior-tournament-16u-2027-02-14", "mvf-junior-tournament-february-2027-16u", "16U"],
] as const) {
  test(`${ldEventKey} is derived from the series data and reads its own seats`, async () => {
    rows = [seat("Test", "parent@example.com", { division, eventKey: ledger })];
    const { json } = await call({ event_key: ldEventKey, sync_keys: [KEY] });
    expect(json).toEqual({ contacts: [{ sync_key: KEY, email: "parent@example.com" }], missing_sync_keys: [] });
    expect(JSON.parse(stub.calls[0].body).filter.and[0]).toEqual({ property: "Event Key", rich_text: { equals: ledger } });
  });
}

for (const eventKey of [
  "mvf-junior-tournament-2026-11-14",          // the generic event: no division
  "mvf-junior-tournament-12u-2026-11-15",      // not a series date
  "mvf-junior-tournament-12u-2027-01-23",      // a makeup date is not a roster key
  "mvf-junior-tournament-12u-2026-10-24",      // October's date, series division
  "mvf-junior-tournament-10u-2026-11-14",      // series date, October division
  "mvf-junior-tournament-14u-2027-02-14",
  "mvf-junior-tournament-12u-2026-11-14-2",    // L&D resolves the suffix; the key never carries it
  "mvf-junior-tournament-november-2026-12u",   // the series ledger key is not an L&D key
]) {
  test(`${eventKey} is refused before any source read`, async () => {
    expect((await call({ event_key: eventKey, sync_keys: [KEY] })).response.status).toBe(400);
    expect(stub.calls).toHaveLength(0);
  });
}

test("a series key with the series DB unset is unconfigured, not an empty audience", async () => {
  delete process.env.NOTION_MVF_SERIES_REGS_DB_ID;
  const { response, json } = await call({ event_key: NOV_12U, sync_keys: [KEY] });
  expect(response.status).toBe(503);
  expect(json).toEqual({ error: "not_configured" });
  expect(stub.calls).toHaveLength(0);
});

test("the series DB can never be the October DB", async () => {
  process.env.NOTION_MVF_SERIES_REGS_DB_ID = OCTOBER_DB.replace(/^(.{8})(.{4})(.{4})(.{4})/, "$1-$2-$3-$4-").toUpperCase();
  expect((await call({ event_key: NOV_12U, sync_keys: [KEY] })).response.status).toBe(503);
  expect(stub.calls).toHaveLength(0);
});

test("an invalid series DB id cannot redirect the provider request", async () => {
  process.env.NOTION_MVF_SERIES_REGS_DB_ID = "../../other-query";
  expect((await call({ event_key: NOV_12U, sync_keys: [KEY] })).response.status).toBe(503);
  expect(stub.calls).toHaveLength(0);
});

test("October still works with only its own DB, and never reads the series DB", async () => {
  delete process.env.NOTION_MVF_SERIES_REGS_DB_ID;
  await call({ event_key: "mvf-junior-tournament-14u-2026-10-24", sync_keys: [KEY] });
  expect(stub.calls).toHaveLength(1);
  expect(stub.calls[0].url).toBe(`https://api.notion.com/v1/databases/${OCTOBER_DB}/query`);
});

test("an October key with only the series DB configured is unconfigured", async () => {
  delete process.env.NOTION_MVF_TOURNAMENT_REGS_DB_ID;
  expect((await call({ event_key: "mvf-junior-tournament-14u-2026-10-24", sync_keys: [KEY] })).response.status).toBe(503);
  expect(stub.calls).toHaveLength(0);
});

test("an October row returned for a series key fails closed as a wrong-database row", async () => {
  rows[0].parent.database_id = OCTOBER_DB;
  const { response, json } = await call({ event_key: NOV_12U, sync_keys: [KEY] });
  expect(response.status).toBe(502);
  expect(json).toEqual({ error: "contact_lookup_failed" });
});

test("a series lookup that fails on a later page returns no partial audience", async () => {
  stub.reset();
  stub.onDynamic("api.notion.com", () => stub.calls.length > 1
    ? { status: 503, json: {} }
    : { status: 200, json: { results: rows, has_more: true, next_cursor: "next-synthetic" } });
  const { response, json } = await call({ event_key: NOV_12U, sync_keys: [KEY] });
  expect(response.status).toBe(502);
  expect(json).toEqual({ error: "contact_lookup_failed" });
});

for (const env of ["preview", ""]) {
  test(`a ${env || "unknown"} runtime cannot read series parents`, async () => {
    process.env.VERCEL_ENV = env;
    expect((await call({ event_key: NOV_12U, sync_keys: [KEY] })).response.status).toBe(503);
    expect(stub.calls).toHaveLength(0);
  });
}
