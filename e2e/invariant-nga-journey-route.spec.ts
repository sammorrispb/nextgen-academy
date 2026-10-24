import { test, expect } from "@playwright/test";
import { NextRequest } from "next/server";
import { FetchStub } from "./fixtures/fetch-stub";
import { runNgaJourneyPreview } from "../src/lib/nga-journey-source";
import { POST } from "../src/app/api/coach/journey-preview/route";
const playerId = "00000000-0000-4000-8000-000000000001";
const sessionId = "00000000-0000-4000-8000-000000000002";
const now = "2026-10-23T16:00:00.000Z";
const rt = (plain_text: string) => ({ rich_text: [{ plain_text }] });
const player = () => ({ id: playerId, parent: { database_id: "player-db" }, last_edited_time: "2026-10-23T12:00:00Z", properties: { Audience: { select: { name: "Youth" } }, Level: { select: { name: "Green" } }, Age: { number: 10 }, "Player Name": { title: [{ plain_text: "SyntheticChild" }] }, "Parent Email": { email: "synthetic@example.invalid" } } });
const session = () => ({ id: sessionId, parent: { database_id: "sessions-db" }, last_edited_time: "2026-10-23T12:00:00Z", properties: { Session: rt("Synthetic Green session"), Date: { date: { start: "2026-10-25" } }, "Start time": rt("1:00 PM"), "End time": rt("2:00 PM"), Level: { select: { name: "Green" } }, Location: rt("Synthetic court"), Capacity: { formula: { number: 8 } }, "Registered count": { number: 2 }, Status: { select: { name: "Open" } } } });
const stub = new FetchStub();
test.beforeEach(() => { process.env.NOTION_API_KEY = "synthetic-notion-key"; process.env.NOTION_PLAYER_CRM_DB_ID = "player-db"; process.env.NOTION_SESSIONS_DB_ID = "sessions-db"; stub.reset(); stub.install(); });
test.afterEach(() => stub.uninstall());
function fixtures() { stub.on(`/pages/${playerId}`, player()).on("/databases/sessions-db/query", { results: [session()], has_more: false }); }
async function review() { const loaded = await runNgaJourneyPreview({ playerId }, { now }); return { playerId, review: { assessmentRevision: loaded.body.assessment!.revision, focusId: "skill-6", confirmed: true, ageConfirmed: true }, preferences: {} }; }

test("NGA-C9: revoked or absent coach authority denies with zero family reads", async () => {
  const response = await POST(new NextRequest("https://nextgenpbacademy.com/api/coach/journey-preview", { method: "POST", body: JSON.stringify({ playerId }) }));
  expect(response.status).toBe(401); expect(stub.calls).toHaveLength(0);
});

test("NGA-C9: preview reads canonical assessment and programs only, zero writes or child identity projection", async () => {
  fixtures(); const result = await runNgaJourneyPreview(await review(), { now });
  expect(result.body.state).toBe("needs_confirmation");
  expect(stub.calls.every((c) => c.method === "GET" || (c.method === "POST" && c.url.endsWith("/query")))).toBe(true);
  const serialized = JSON.stringify(result.body); expect(serialized).not.toContain("SyntheticChild"); expect(serialized).not.toContain("synthetic@example.invalid");
  expect(stub.calls.every((c) => c.url.startsWith("https://api.notion.com/v1/"))).toBe(true);
});

test("NGA-C9: stale assessment rejects, read retries stay safe, parent persistence fails explicitly", async () => {
  let page = player(); stub.on(`/pages/${playerId}`, () => page).on("/databases/sessions-db/query", { results: [session()], has_more: false });
  const input = await review(); expect((await runNgaJourneyPreview(input, { now })).body).toEqual((await runNgaJourneyPreview(input, { now })).body);
  page = { ...page, last_edited_time: "2026-10-23T13:00:00Z" }; expect((await runNgaJourneyPreview(input, { now })).status).toBe(409);
  expect((await runNgaJourneyPreview({ playerId, parentToken: "synthetic" }, { now })).body.state).toBe("unsupported");
});

test("NGA-C9: inventory outage, pagination omission, wrong CRM database and archived player fail closed", async () => {
  stub.on(`/pages/${playerId}`, player()).on("/databases/sessions-db/query", { message: "unavailable" }, 503);
  const input = await review(); expect((await runNgaJourneyPreview(input, { now })).body.state).toBe("unavailable");
  stub.reset(); stub.on(`/pages/${playerId}`, player()).on("/databases/sessions-db/query", { results: [session()], has_more: true, next_cursor: null });
  expect((await runNgaJourneyPreview(input, { now })).body.state).toBe("unavailable");
  for (const patch of [{ parent: { database_id: "unrelated-db" } }, { archived: true }, { in_trash: true }]) {
    stub.reset(); stub.on(`/pages/${playerId}`, { ...player(), ...patch });
    expect((await runNgaJourneyPreview(input, { now })).status).toBe(404); expect(stub.calls).toHaveLength(1);
  }
});

test("NGA-C9: missing configuration and malformed inputs make zero downstream reads", async () => {
  delete process.env.NOTION_API_KEY; expect((await runNgaJourneyPreview({ playerId }, { now })).body.state).toBe("unavailable");
  process.env.NOTION_API_KEY = "synthetic";
  for (const input of [null, [], {}, { playerId: "../../other" }, { playerId, level: "Yellow" }]) expect((await runNgaJourneyPreview(input, { now })).status).toBe(400);
  expect(stub.calls).toHaveLength(0);
});

test("NGA-C9: assessment changes during slow inventory read reject the pending preview", async () => {
  let reads = 0;
  stub.on(`/pages/${playerId}`, () => ({ ...player(), last_edited_time: ++reads > 2 ? "2026-10-23T15:00:00Z" : player().last_edited_time })).on("/databases/sessions-db/query", { results: [session()], has_more: false });
  const result = await runNgaJourneyPreview(await review(), { now });
  expect(result.status).toBe(409); expect(result.body.reason).toBe("assessment_changed");
  expect(stub.calls.filter((c) => c.method === "PATCH")).toHaveLength(0);
});

test("NGA-C9: complete pagination is required and changed capacity never reuses a previous fit", async () => {
  let full = false;
  stub.on(`/pages/${playerId}`, player()).on("/databases/sessions-db/query", () => ({ results: [{ ...session(), properties: { ...session().properties, "Registered count": { number: full ? 8 : 2 } } }], has_more: false }));
  const input = await review(); expect((await runNgaJourneyPreview(input, { now })).body.state).toBe("needs_confirmation");
  full = true; expect((await runNgaJourneyPreview(input, { now })).body.state).toBe("no_match");
  stub.reset(); stub.on(`/pages/${playerId}`, player()).onDynamic("/databases/sessions-db/query", (call) => JSON.parse(call.body).start_cursor ? { status: 503, json: {} } : { status: 200, json: { results: [session()], has_more: true, next_cursor: "next-page" } });
  expect((await runNgaJourneyPreview(input, { now })).body.state).toBe("unavailable");
});

test("NGA-C9: a foreign program source cannot supply a verified option", async () => {
  stub.on(`/pages/${playerId}`, player()).on("/databases/sessions-db/query", { results: [{ ...session(), parent: { database_id: "foreign-db" } }], has_more: false });
  const result = await runNgaJourneyPreview(await review(), { now });
  expect(result.status).toBe(503); expect(result.body).toMatchObject({ state: "unavailable", reason: "inventory_record_invalid", programs: [] });
});
