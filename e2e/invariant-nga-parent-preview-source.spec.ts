import { test, expect } from "@playwright/test";
import { NextRequest } from "next/server";
import { FetchStub } from "./fixtures/fetch-stub";
import { runCoachParentCapability, runParentJourneyPreview } from "../src/lib/nga-parent-preview-source";
import { POST as coachRoute } from "../src/app/api/coach/journey-parent-capability/route";
import { POST as parentRoute } from "../src/app/api/parent/journey-preview/route";
const playerId = "00000000-0000-4000-8000-000000000001", registrationId = "00000000-0000-4000-8000-000000000004";
const coach = "synthetic-coach@example.invalid", now = "2026-10-23T16:00:00Z";
const rt = (plain_text: string) => ({ rich_text: [{ plain_text }] });
const identity = { "Parent Email": { email: "synthetic-parent@example.invalid" }, "Parent Phone": { phone_number: "3015550100" } };
const player = () => ({ id: playerId, parent: { database_id: "player-db" }, last_edited_time: "2026-10-23T12:00:00Z", properties: { ...identity, "Player Name": { title: [{ plain_text: "SyntheticChild" }] }, Audience: { select: { name: "Youth" } }, Level: { select: { name: "Green" } }, Age: { number: 10 } } });
const registration = () => ({ id: registrationId, parent: { database_id: "dropin-db" }, last_edited_time: "2026-10-23T12:00:00Z", properties: { ...identity, "Child First Name": rt("SyntheticChild"), "Child Birth Year": { number: 2016 }, Status: { select: { name: "Confirmed" } }, "Stripe Checkout Session ID": rt("cs_synthetic_registration"), "Session Date": { date: { start: "2026-10-20" } } } });
const stub = new FetchStub();
test.beforeEach(() => { process.env.NGA_JOURNEY_PREVIEW_SIGNING_SECRET = "synthetic-dedicated-parent-preview-signing-key-20261023"; process.env.COACH_ALLOWED_EMAILS = coach; process.env.NOTION_API_KEY = "synthetic-notion"; process.env.NOTION_PLAYER_CRM_DB_ID = "player-db"; process.env.NOTION_DROPINS_DB_ID = "dropin-db"; process.env.NOTION_SESSIONS_DB_ID = "sessions-db"; stub.reset(); stub.install(); });
test.afterEach(() => stub.uninstall());
function fixtures() { stub.on(`/pages/${playerId}`, player()).on(`/pages/${registrationId}`, registration()).on("/databases/sessions-db/query", { results: [], has_more: false }); }
async function issue() {
  const inspected = await runCoachParentCapability({ action: "inspect", playerId, registrationId }, coach, { now });
  const proposal = inspected.body as { associationRevision: string; assessment: { revision: string } };
  return runCoachParentCapability({ action: "issue", playerId, registrationId, associationRevision: proposal.associationRevision, associationConfirmed: true, review: { confirmed: true, assessmentRevision: proposal.assessment.revision, focusId: "skill-6" } }, coach, { now });
}

test("NGA-C9 parent source: explicit coach association and frozen focus produce an exact-scope read-only code", async () => {
  fixtures(); const issued = await issue(); expect(issued.status).toBe(200); expect(issued.body.code).toEqual(expect.any(String));
  const result = await runParentJourneyPreview(issued.body.code as string, { preferences: {}, ageConfirmed: true }, { now });
  expect(result.body).toMatchObject({ state: "no_match", nextFocus: { id: "skill-6", label: "Serve and Return" }, assessment: { level: "Green", age: 10 } });
  expect(JSON.stringify(result.body)).not.toMatch(/SyntheticChild|synthetic-parent|3015550100|2016/);
  expect(stub.calls.every((c) => c.method === "GET" || (c.method === "POST" && c.url.endsWith("/query")))).toBe(true);
});

test("NGA-C9 parent source: anonymous or revoked coach and bad parent code read no family source", async () => {
  expect((await runCoachParentCapability({ action: "inspect", playerId, registrationId }, "other@example.invalid", { now })).status).toBe(401);
  expect((await runParentJourneyPreview("forged", { preferences: {} }, { now })).status).toBe(401);
  expect((await coachRoute(new NextRequest("https://nextgenpbacademy.com/api/coach/journey-parent-capability", { method: "POST", body: "{}" }))).status).toBe(401);
  expect((await parentRoute(new NextRequest("https://nextgenpbacademy.com/api/parent/journey-preview", { method: "POST", headers: { authorization: "Bearer admin-secret" }, body: "{}" }))).status).toBe(401);
  expect(stub.calls).toHaveLength(0);
});

test("NGA-C9 parent source: mismatched family and unreviewed association cannot issue authority", async () => {
  stub.on(`/pages/${registrationId}`, { ...registration(), properties: { ...registration().properties, "Parent Email": { email: "other-family@example.invalid" } } }).on(`/pages/${playerId}`, player());
  expect((await runCoachParentCapability({ action: "inspect", playerId, registrationId }, coach, { now })).status).toBe(409);
  stub.reset(); fixtures();
  expect((await runCoachParentCapability({ action: "issue", playerId, registrationId, associationConfirmed: false }, coach, { now })).status).toBe(400);
  const inspected = await runCoachParentCapability({ action: "inspect", playerId, registrationId }, coach, { now });
  stub.calls.length = 0;
  for (const associationConfirmed of [false, undefined, "true", 1]) {
    const result = await runCoachParentCapability({ action: "issue", playerId, registrationId, associationRevision: inspected.body.associationRevision, associationConfirmed, review: { confirmed: true, assessmentRevision: (inspected.body.assessment as { revision: string }).revision, focusId: "skill-6" } }, coach, { now });
    expect(result.status).toBe(400); expect(result.body.code).toBe("explicit_association_review_required"); expect(stub.calls).toHaveLength(0);
  }
});

for (const change of ["cancel", "erase", "assessment", "reassignment"] as const) test(`NGA-C9 parent source: ${change} invalidates the exact-source code`, async () => {
  let p = player(); let r = registration();
  stub.on(`/pages/${registrationId}`, () => r).on(`/pages/${playerId}`, () => p).on("/databases/sessions-db/query", { results: [], has_more: false });
  const code = (await issue()).body.code as string;
  if (change === "cancel") r = { ...r, properties: { ...r.properties, Status: { select: { name: "Cancelled" } } } };
  if (change === "erase") Object.assign(r, { archived: true });
  if (change === "assessment") p = { ...p, last_edited_time: "2026-10-23T13:00:00Z" };
  if (change === "reassignment") r = { ...r, properties: { ...r.properties, "Child First Name": rt("OtherSyntheticChild") } };
  const result = await runParentJourneyPreview(code, { preferences: {} }, { now });
  expect([401, 404, 409]).toContain(result.status); expect(result.body).not.toHaveProperty("assessment");
});

test("NGA-C9 parent source: no selectors, writes, persistent preferences or focus replacement through parent input", async () => {
  fixtures(); const code = (await issue()).body.code as string;
  for (const input of [{ playerId }, { registrationId }, { focusId: "skill-1" }, { level: "Yellow" }, { save: true }, { preferences: { persisted: true } }]) {
    const result = await runParentJourneyPreview(code, input, { now });
    expect([400, 422]).toContain(result.status);
  }
  const a = await runParentJourneyPreview(code, { preferences: {} }, { now });
  expect(await runParentJourneyPreview(code, { preferences: {} }, { now })).toEqual(a);
  expect(stub.calls.every((c) => c.method !== "PATCH" && (c.method !== "POST" || c.url.endsWith("/query")))).toBe(true);
});

for (const change of ["registration", "assessment", "issuer"] as const) test(`NGA-C9 parent source: ${change} revocation during inventory returns no private result`, async () => {
  let p = player(), r = registration();
  stub.on(`/pages/${registrationId}`, () => r).on(`/pages/${playerId}`, () => p).on("/databases/sessions-db/query", () => {
    if (change === "registration") r = { ...r, properties: { ...r.properties, Status: { select: { name: "Cancelled" } } } };
    if (change === "assessment") p = { ...p, last_edited_time: "2026-10-23T13:00:00Z" };
    if (change === "issuer") process.env.COACH_ALLOWED_EMAILS = "other@example.invalid";
    return { results: [], has_more: false };
  });
  const code = (await issue()).body.code as string;
  const result = await runParentJourneyPreview(code, { preferences: {} }, { now });
  expect([401, 409]).toContain(result.status); expect(result.body).not.toHaveProperty("assessment");
  expect(result.body).not.toHaveProperty("programs");
});

test("NGA-C9 parent source: inventory outage stays unavailable and a changed association cannot be minted", async () => {
  let p = player(); stub.on(`/pages/${registrationId}`, registration()).on(`/pages/${playerId}`, () => p).on("/databases/sessions-db/query", {}, 503);
  const inspected = await runCoachParentCapability({ action: "inspect", playerId, registrationId }, coach, { now });
  p = { ...p, last_edited_time: "2026-10-23T13:00:00Z" };
  expect((await runCoachParentCapability({ action: "issue", playerId, registrationId, associationRevision: inspected.body.associationRevision, associationConfirmed: true, review: { confirmed: true, assessmentRevision: (inspected.body.assessment as { revision: string }).revision, focusId: "skill-6" } }, coach, { now })).status).toBe(409);
  const code = (await issue()).body.code as string;
  expect((await runParentJourneyPreview(code, { preferences: {} }, { now })).status).toBe(503);
});

test("NGA-C9 parent source: malformed action enums cannot bypass explicit association review", async () => {
  fixtures(); const inspected = await runCoachParentCapability({ action: "inspect", playerId, registrationId }, coach, { now });
  const base = { playerId, registrationId, associationRevision: inspected.body.associationRevision, associationConfirmed: false, review: { confirmed: true, assessmentRevision: (inspected.body.assessment as { revision: string }).revision, focusId: "skill-6" } };
  stub.calls.length = 0;
  for (const action of [["issue"], ["inspect"], { value: "issue" }, null, undefined, 1, true]) {
    const result = await runCoachParentCapability({ ...base, action }, coach, { now });
    expect(result.status).toBe(400); expect(result.body.code).toBe("invalid_input");
    expect(stub.calls).toHaveLength(0);
  }
});
