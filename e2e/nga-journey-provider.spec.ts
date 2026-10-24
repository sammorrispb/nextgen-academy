import { test, expect } from "@playwright/test";
import { resolveNgaJourneyProvider } from "../src/lib/nga-journey-provider";
import { readNgaAssessmentEvidence, readNgaProgramInventory, runNgaJourneyPreview } from "../src/lib/nga-journey-source";
import { runCoachParentCapability, runParentJourneyPreview } from "../src/lib/nga-parent-preview-source";

const playerId = "00000000-0000-4000-8000-000000000001";
const registrationId = "00000000-0000-4000-8000-000000000004";
const playerDb = "00000000-0000-4000-8000-000000000011";
const sessionsDb = "00000000-0000-4000-8000-000000000012";
const registrationsDb = "00000000-0000-4000-8000-000000000013";
const projectRef = "abcdefghijklmnopqrst";
const baseUrl = `https://${projectRef}.supabase.co/functions/v1/player-journey-fixture`;
const readKey = "synthetic-read-key-for-contract-test-only-20261024";
const coach = "synthetic-coach@example.invalid", now = "2026-10-24T12:00:00Z";
const keys = ["NGA_JOURNEY_PROVIDER", "VERCEL_ENV", "NGA_JOURNEY_FIXTURE_PROJECT_REF", "NGA_JOURNEY_FIXTURE_URL", "NGA_JOURNEY_FIXTURE_RUN_ID", "NGA_JOURNEY_FIXTURE_READ_KEY", "NGA_JOURNEY_PLAYERS_DB_ID", "NGA_JOURNEY_SESSIONS_DB_ID", "NGA_JOURNEY_REGISTRATIONS_DB_ID", "NOTION_API_KEY", "NOTION_PLAYER_CRM_DB_ID", "NOTION_SESSIONS_DB_ID", "NOTION_DROPINS_DB_ID", "NGA_JOURNEY_PREVIEW_SIGNING_SECRET", "COACH_ALLOWED_EMAILS"] as const;
const saved = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
const originalFetch = globalThis.fetch;
type Call = { url: string; method: string; headers: Headers; options: RequestInit };
const calls: Call[] = [];
let respond: (call: Call) => Response = () => Response.json({});
const rt = (plain_text: string) => ({ rich_text: [{ plain_text }] });
const identity = { "Parent Email": { email: "synthetic-parent@example.invalid" }, "Parent Phone": { phone_number: "3015550100" } };
const assessment = () => ({ id: playerId, parent: { database_id: playerDb }, last_edited_time: "2026-10-24T10:00:00Z", properties: { ...identity, "Player Name": { title: [{ plain_text: "SyntheticChild" }] }, Audience: { select: { name: "Youth" } }, Level: { select: { name: "Green" } }, Age: { number: 10 } } });
const registration = () => ({ id: registrationId, parent: { database_id: registrationsDb }, last_edited_time: "2026-10-24T10:00:00Z", properties: { ...identity, "Child First Name": rt("SyntheticChild"), Status: { select: { name: "Confirmed" } }, "Stripe Checkout Session ID": rt("cs_synthetic"), "Session Date": { date: { start: "2026-10-20" } } } });

function fixtureConfig() {
  Object.assign(process.env, { NGA_JOURNEY_PROVIDER: "synthetic_https", VERCEL_ENV: "preview", NGA_JOURNEY_FIXTURE_PROJECT_REF: projectRef, NGA_JOURNEY_FIXTURE_URL: baseUrl, NGA_JOURNEY_FIXTURE_RUN_ID: "journey-contract-20261024", NGA_JOURNEY_FIXTURE_READ_KEY: readKey, NGA_JOURNEY_PLAYERS_DB_ID: playerDb, NGA_JOURNEY_SESSIONS_DB_ID: sessionsDb, NGA_JOURNEY_REGISTRATIONS_DB_ID: registrationsDb });
  delete process.env.NOTION_API_KEY;
  delete process.env.NOTION_PLAYER_CRM_DB_ID;
  delete process.env.NOTION_SESSIONS_DB_ID;
  delete process.env.NOTION_DROPINS_DB_ID;
}

test.beforeEach(() => {
  for (const key of keys) delete process.env[key];
  calls.length = 0;
  respond = () => Response.json({});
  globalThis.fetch = (async (input: RequestInfo | URL, options: RequestInit = {}) => {
    const call = { url: String(input), method: options.method ?? "GET", headers: new Headers(options.headers), options };
    calls.push(call);
    return respond(call);
  }) as typeof fetch;
});
test.afterEach(() => {
  globalThis.fetch = originalFetch;
  for (const key of keys) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
});

test("NGA hosted provider: absent fixture mode preserves canonical and local intercepted Notion reads", async () => {
  Object.assign(process.env, { NOTION_API_KEY: "synthetic-local-notion-key", NOTION_PLAYER_CRM_DB_ID: "local-player-db", NOTION_SESSIONS_DB_ID: "local-session-db", NOTION_DROPINS_DB_ID: "local-registration-db" });
  const provider = resolveNgaJourneyProvider();
  expect(provider).toMatchObject({ kind: "notion", playerDbId: "local-player-db", sessionsDbId: "local-session-db", registrationsDbId: "local-registration-db" });
  await provider.request(`/v1/pages/${playerId}`);
  expect(calls[0].url).toBe(`https://api.notion.com/v1/pages/${playerId}`);
  expect(calls[0].headers.get("authorization")).toBe("Bearer synthetic-local-notion-key");
});

test("NGA hosted provider: complete preview-only config uses the dedicated read credential without Notion configuration", async () => {
  fixtureConfig();
  const provider = resolveNgaJourneyProvider();
  expect(provider).toMatchObject({ kind: "synthetic_https", playerDbId: playerDb, sessionsDbId: sessionsDb, registrationsDbId: registrationsDb });
  await provider.request(`/v1/pages/${playerId}`);
  await provider.request(`/v1/databases/${sessionsDb}/query`, { page_size: 100 });
  expect(calls.map((c) => [c.url, c.method])).toEqual([[`${baseUrl}/v1/pages/${playerId}`, "GET"], [`${baseUrl}/v1/databases/${sessionsDb}/query`, "POST"]]);
  for (const call of calls) {
    expect(call.headers.get("authorization")).toBe(`Bearer ${readKey}`);
    expect(call.headers.get("x-player-journey-run")).toBe("journey-contract-20261024");
    expect(call.options.redirect).toBe("error");
    expect(call.options.cache).toBe("no-store");
    expect(call.options.signal).toBeInstanceOf(AbortSignal);
    expect(call.headers.has("notion-version")).toBe(false);
  }
});

test("NGA hosted provider: mixed-case fixture database IDs read canonical page parents", async () => {
  fixtureConfig();
  const players = "ab000000-0000-4000-8000-000000000011";
  const sessions = "cd000000-0000-4000-8000-000000000012";
  const registrations = "ef000000-0000-4000-8000-000000000013";
  const sessionId = "00000000-0000-4000-8000-000000000020";
  Object.assign(process.env, {
    NGA_JOURNEY_PLAYERS_DB_ID: players.toUpperCase(), NGA_JOURNEY_SESSIONS_DB_ID: sessions.replace("cd", "cD"),
    NGA_JOURNEY_REGISTRATIONS_DB_ID: registrations.replace("ef", "Ef"),
    NGA_JOURNEY_PREVIEW_SIGNING_SECRET: "synthetic-dedicated-parent-preview-signing-key-20261024", COACH_ALLOWED_EMAILS: coach,
  });
  respond = (call) => {
    if (call.url.endsWith(`/v1/pages/${playerId}`)) return Response.json({ ...assessment(), parent: { database_id: players } });
    if (call.url.endsWith(`/v1/pages/${registrationId}`)) return Response.json({ ...registration(), parent: { database_id: registrations } });
    if (call.url.endsWith(`/v1/databases/${sessions}/query`)) return Response.json({ results: [{
      id: sessionId, parent: { database_id: sessions }, last_edited_time: "2026-10-24T10:00:00Z",
      properties: { Session: rt("Synthetic session"), Date: { date: { start: "2026-10-25" } }, Level: { select: { name: "Green" } } },
    }], has_more: false });
    throw new Error("unexpected fixture request");
  };
  const provider = resolveNgaJourneyProvider();
  expect((await readNgaAssessmentEvidence(playerId, provider)).assessment).toMatchObject({ playerId, level: "Green", age: 10 });
  expect(await readNgaProgramInventory(now, provider)).toMatchObject([{ id: sessionId, level: "Green" }]);
  expect(await runCoachParentCapability({ action: "inspect", playerId, registrationId }, coach, { now })).toMatchObject({ status: 200, body: { registration: { id: registrationId } } });
  expect(provider).toMatchObject({ playerDbId: players, sessionsDbId: sessions, registrationsDbId: registrations });
  expect(calls).toHaveLength(4);
  expect(calls.every((call) => call.url.startsWith(`${baseUrl}/`))).toBe(true);
});

test("NGA hosted provider: every missing fixture pin fails before canonical lookup or network", async () => {
  const required = ["VERCEL_ENV", "NGA_JOURNEY_FIXTURE_PROJECT_REF", "NGA_JOURNEY_FIXTURE_URL", "NGA_JOURNEY_FIXTURE_RUN_ID", "NGA_JOURNEY_FIXTURE_READ_KEY", "NGA_JOURNEY_PLAYERS_DB_ID", "NGA_JOURNEY_SESSIONS_DB_ID", "NGA_JOURNEY_REGISTRATIONS_DB_ID"] as const;
  for (const key of required) {
    fixtureConfig(); delete process.env[key];
    Object.assign(process.env, { NOTION_API_KEY: "must-never-be-used", NOTION_SESSIONS_DB_ID: "canonical-fallback-must-not-run" });
    expect(() => resolveNgaJourneyProvider(), key).toThrow("source_not_configured");
    expect(await runNgaJourneyPreview({ playerId }, { now }), key).toMatchObject({ status: 503, body: { state: "unavailable", reason: "source_not_configured" } });
  }
  expect(calls).toHaveLength(0);
});

test("NGA hosted provider: production, unowned origins and unsafe URL components are refused", () => {
  const invalid: Record<string, string>[] = [
    { VERCEL_ENV: "production" }, { VERCEL_ENV: "development" }, { NGA_JOURNEY_PROVIDER: "unknown" },
    ...["hivuxgbiczpeqtnfzhnm", `tqqh${"a".repeat(16)}`, `czrir${"a".repeat(15)}`].map((ref) => ({ NGA_JOURNEY_FIXTURE_PROJECT_REF: ref, NGA_JOURNEY_FIXTURE_URL: `https://${ref}.supabase.co/functions/v1/player-journey-fixture` })),
    { NGA_JOURNEY_FIXTURE_PROJECT_REF: "not-a-project-ref" },
    { NGA_JOURNEY_FIXTURE_URL: baseUrl.replace("https:", "http:") },
    { NGA_JOURNEY_FIXTURE_URL: baseUrl.replace(projectRef, "zyxwvutsrqponmlkjihg") },
    { NGA_JOURNEY_FIXTURE_URL: `${baseUrl}?secret=not-allowed` }, { NGA_JOURNEY_FIXTURE_URL: `${baseUrl}#fragment` },
    { NGA_JOURNEY_FIXTURE_URL: baseUrl.replace("https://", "https://user:pass@") }, { NGA_JOURNEY_FIXTURE_URL: `${baseUrl}/` },
    { NGA_JOURNEY_FIXTURE_URL: baseUrl.replace(".supabase.co", ".supabase.co.evil.invalid") },
  ];
  for (const patch of invalid) { fixtureConfig(); Object.assign(process.env, patch); expect(() => resolveNgaJourneyProvider()).toThrow("source_not_configured"); }
  expect(calls).toHaveLength(0);
});

test("NGA hosted provider: isolated UUIDs, bounded run IDs and a dedicated safe credential are required", () => {
  const invalid = [
    { NGA_JOURNEY_PLAYERS_DB_ID: "player-db" }, { NGA_JOURNEY_SESSIONS_DB_ID: playerDb }, { NGA_JOURNEY_REGISTRATIONS_DB_ID: sessionsDb },
    { NGA_JOURNEY_REGISTRATIONS_DB_ID: playerDb.toUpperCase() },
    { NGA_JOURNEY_PLAYERS_DB_ID: "1e5e34c2-5838-4c6c-b5f3-e846543ecfc7" },
    { NGA_JOURNEY_FIXTURE_RUN_ID: "short" }, { NGA_JOURNEY_FIXTURE_RUN_ID: "run-id\nheader" },
    { NGA_JOURNEY_FIXTURE_RUN_ID: "Invalid-Run" }, { NGA_JOURNEY_FIXTURE_RUN_ID: "invalid_run" }, { NGA_JOURNEY_FIXTURE_RUN_ID: "a".repeat(41) },
    { NGA_JOURNEY_FIXTURE_READ_KEY: "short" }, { NGA_JOURNEY_FIXTURE_READ_KEY: `${readKey}\n` }, { NGA_JOURNEY_FIXTURE_READ_KEY: `${readKey} value` }, { NGA_JOURNEY_FIXTURE_READ_KEY: "a".repeat(129) },
  ];
  for (const patch of invalid) { fixtureConfig(); Object.assign(process.env, patch); expect(() => resolveNgaJourneyProvider()).toThrow("source_not_configured"); }
  expect(calls).toHaveLength(0);
});

test("NGA hosted provider: request capability permits only UUID page reads and the owned session query", async () => {
  fixtureConfig(); const provider = resolveNgaJourneyProvider();
  for (const [path, body] of [
    [`/v1/pages/${playerId}`, {}], [`/v1/pages/${playerId}?query=extra`, undefined], ["/v1/pages/../other", undefined],
    [`/v1/databases/${registrationsDb}/query`, {}], [`/v1/databases/${sessionsDb}/query`, undefined],
    ["/v1/pages", {}], ["/v1/model", {}], ["https://api.notion.com/v1/pages/other", undefined],
  ] as const) await expect(provider.request(path, body)).rejects.toThrow("source_unavailable");
  expect(calls).toHaveLength(0);
});

test("NGA hosted provider: redirects and provider failures expose only fixed sanitized errors", async () => {
  fixtureConfig(); const provider = resolveNgaJourneyProvider();
  for (const response of [new Response("private-provider-detail", { status: 302, headers: { location: "https://api.notion.com" } }), new Response(readKey, { status: 503 }), new Response("not json", { status: 200 })]) {
    respond = () => response;
    await expect(provider.request(`/v1/pages/${playerId}`)).rejects.toThrow(/^source_unavailable$/);
  }
  respond = () => { throw new Error(`provider echoed ${readKey}`); };
  await expect(provider.request(`/v1/pages/${playerId}`)).rejects.toThrow(/^source_unavailable$/);
  const redirected = Response.json({}); Object.defineProperty(redirected, "redirected", { value: true });
  respond = () => redirected;
  await expect(provider.request(`/v1/pages/${playerId}`)).rejects.toThrow(/^source_unavailable$/);
  respond = () => new Response("private-missing-page", { status: 404 });
  await expect(provider.request(`/v1/pages/${playerId}`)).rejects.toMatchObject({ message: "source_unavailable", status: 404 });
  await expect(provider.request(`/v1/databases/${sessionsDb}/query`, {})).rejects.toMatchObject({ message: "source_unavailable", status: 503 });
});

test("NGA hosted provider: a resolved request pins configuration across assessment, inventory and recheck", async () => {
  fixtureConfig();
  respond = (call) => {
    if (call.url.endsWith(`/v1/pages/${playerId}`)) return Response.json(assessment());
    if (call.url.endsWith(`/v1/databases/${sessionsDb}/query`)) {
      process.env.NGA_JOURNEY_FIXTURE_URL = "https://drift.invalid";
      process.env.NGA_JOURNEY_PLAYERS_DB_ID = registrationsDb;
      return Response.json({ results: [], has_more: false });
    }
    throw new Error("unexpected request");
  };
  const first = await runNgaJourneyPreview({ playerId }, { now });
  const result = await runNgaJourneyPreview({ playerId, review: { confirmed: true, ageConfirmed: true, focusId: "skill-6", assessmentRevision: first.body.assessment!.revision } }, { now });
  expect(result).toMatchObject({ status: 200, body: { state: "no_match" } });
  expect(calls).toHaveLength(4);
  expect(calls.every((call) => call.url.startsWith(`${baseUrl}/`))).toBe(true);
});

test("NGA hosted provider: parent association and preview use the same pinned source without writes", async () => {
  fixtureConfig();
  process.env.NGA_JOURNEY_PREVIEW_SIGNING_SECRET = "synthetic-dedicated-parent-preview-signing-key-20261024";
  process.env.COACH_ALLOWED_EMAILS = coach;
  respond = (call) => {
    if (call.url.endsWith(`/v1/pages/${playerId}`)) return Response.json(assessment());
    if (call.url.endsWith(`/v1/pages/${registrationId}`)) return Response.json(registration());
    if (call.url.endsWith(`/v1/databases/${sessionsDb}/query`)) { process.env.NGA_JOURNEY_REGISTRATIONS_DB_ID = playerDb; return Response.json({ results: [], has_more: false }); }
    throw new Error("unexpected request");
  };
  const inspected = await runCoachParentCapability({ action: "inspect", playerId, registrationId }, coach, { now });
  const a = inspected.body.assessment as { revision: string };
  const issued = await runCoachParentCapability({ action: "issue", playerId, registrationId, associationRevision: inspected.body.associationRevision, associationConfirmed: true, review: { confirmed: true, focusId: "skill-6", assessmentRevision: a.revision } }, coach, { now });
  expect(issued.status).toBe(200);
  const result = await runParentJourneyPreview(issued.body.code, { preferences: {}, ageConfirmed: true }, { now });
  expect(result).toMatchObject({ status: 200, body: { state: "no_match", assessment: { level: "Green", age: 10 } } });
  expect(JSON.stringify(result.body)).not.toMatch(/SyntheticChild|synthetic-parent|3015550100/);
  expect(calls.every((c) => c.method === "GET" || (c.method === "POST" && c.url.endsWith(`/v1/databases/${sessionsDb}/query`)))).toBe(true);
});
