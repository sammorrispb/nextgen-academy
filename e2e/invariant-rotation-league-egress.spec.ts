import { test, expect } from "@playwright/test";
import { FetchStub } from "./fixtures/fetch-stub";

process.env.NOTION_API_KEY = "ntn_test_rotation_league";
process.env.NOTION_FALL_REGS_DB_ID = "fall-regs-rotation-league";

import { buildRosterPlayers, readSeasonRegistrations } from "../src/lib/rotation-league/roster";
import { callRotationLeague, rotationLeagueTarget } from "../src/lib/rotation-league/client";
import { syncSeason } from "../src/lib/rotation-league/view";
import { ROTATION_LEAGUE_SEASONS } from "../src/data/rotation-league-seasons";

// The rotation-league coach screens send child data to Link & Dink (Sam,
// 2026-10-19: first + last name, from the picked registrations DB). Pinned here:
//   - what a roster row may carry: the registration page id, first name, last
//     name, active/withdrawn, and nothing else, whatever the Notion row holds;
//   - where it may go: Notion (read) and the one L&D endpoint, nowhere else;
//   - when: only from production, or a build LINKDINK_BASE_URL points at L&D;
//   - the secret rides the X-NGA-Sync-Secret header, never the body or URL.

const SEASON = ROTATION_LEAGUE_SEASONS[0];
const LD = "https://ld.example.test";
const CHILD = { first: "Egressfirst", last: "Egresslast" };
const PII = {
  allergies: "Bee stings - carries an EpiPen",
  emergency: "Egressemergencyperson",
  parentEmail: "egress-parent@example.com",
  parentPhone: "3015550199",
  birthYear: 2015,
};

function notionRow(over: Record<string, unknown> = {}) {
  return {
    id: "11111111-2222-4333-8444-555555555555",
    properties: {
      "Parent Name": { title: [{ plain_text: "Egress Parent" }] },
      "Parent Email": { email: PII.parentEmail },
      "Parent Phone": { phone_number: PII.parentPhone },
      "Child First Name": { rich_text: [{ plain_text: CHILD.first }] },
      "Child Last Name": { rich_text: [{ plain_text: CHILD.last }] },
      "Child Birth Year": { number: PII.birthYear },
      Allergies: { rich_text: [{ plain_text: PII.allergies }] },
      "Emergency Name": { rich_text: [{ plain_text: PII.emergency }] },
      "Emergency Phone": { phone_number: "3015550198" },
      "SMS Consent Text": { rich_text: [{ plain_text: "I agree to texts" }] },
      Group: { select: { name: SEASON.rosterGroup } },
      Status: { select: { name: "Confirmed" } },
      ...over,
    },
  };
}

function setEnv(env: Record<string, string | undefined>) {
  for (const [k, v] of Object.entries(env)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
}

const stub = new FetchStub();
test.beforeEach(() => {
  stub.reset();
  setEnv({ VERCEL_ENV: undefined, LINKDINK_BASE_URL: undefined, NGA_SYNC_SECRET: undefined });
});
test.afterEach(() => stub.uninstall());

test.describe("roster projection", () => {
  test("a roster player is the page id, first name, last name and status, and nothing else", () => {
    const { players } = buildRosterPlayers([
      { pageId: "abc-123", firstName: CHILD.first, lastName: CHILD.last, status: "Confirmed" },
    ]);
    expect(players).toEqual([
      { external_ref: "abc-123", first_name: CHILD.first, last_name: CHILD.last, status: "active" },
    ]);
  });

  test("only Confirmed is active; refunded, cancelled and blank are withdrawn", () => {
    const { players } = buildRosterPlayers(
      ["Confirmed", "Refunded", "Cancelled", ""].map((status, i) => ({
        pageId: `p${i}`,
        firstName: "Ava",
        lastName: "",
        status,
      })),
    );
    expect(players.map((p) => p.status)).toEqual(["active", "withdrawn", "withdrawn", "withdrawn"]);
    expect(players.every((p) => p.last_name === null)).toBe(true);
  });

  test("a first name that isn't a name skips the row; a bad last name is sent as none", () => {
    const { players, skipped } = buildRosterPlayers([
      { pageId: "p1", firstName: "123", lastName: "Walker", status: "Confirmed" },
      { pageId: "p2", firstName: "Aiden W.", lastName: "parent@example.com", status: "Confirmed" },
      { pageId: "p3", firstName: "Zoë", lastName: "O'Brien-Lee", status: "Confirmed" },
      { pageId: "bad id with spaces", firstName: "Max", lastName: "", status: "Confirmed" },
    ]);
    expect(skipped).toBe(2);
    expect(players.map((p) => [p.first_name, p.last_name])).toEqual([
      ["Aiden W.", null],
      ["Zoë", "O'Brien-Lee"],
    ]);
  });

  test("the Notion read keeps no field beyond the projection", async () => {
    stub.on("api.notion.com", { results: [notionRow()], has_more: false }).install();
    const read = await readSeasonRegistrations(SEASON);
    expect(read.status).toBe("ok");
    const dumped = JSON.stringify(read.rows);
    for (const leak of [PII.allergies, PII.emergency, PII.parentEmail, PII.parentPhone, String(PII.birthYear)]) {
      expect(dumped).not.toContain(leak);
    }
    expect(read.rows).toEqual([
      { pageId: "11111111-2222-4333-8444-555555555555", firstName: CHILD.first, lastName: CHILD.last, status: "Confirmed" },
    ]);
  });

  test("a failed Notion read is loud, never an empty roster", async () => {
    stub.on("api.notion.com", { message: "boom" }, 500).install();
    expect((await readSeasonRegistrations(SEASON)).status).toBe("query_failed");
  });
});

test.describe("when and where it sends", () => {
  test("a non-production build with no LINKDINK_BASE_URL sends nothing", async () => {
    setEnv({ NGA_SYNC_SECRET: "s3cret", VERCEL_ENV: "preview" });
    stub.install();
    const r = await callRotationLeague({ action: "standings", season_slug: SEASON.slug });
    expect(r).toEqual({ ok: false, code: "not_production" });
    expect(stub.calls).toHaveLength(0);
  });

  test("production without the secret sends nothing", async () => {
    setEnv({ VERCEL_ENV: "production" });
    stub.install();
    const r = await callRotationLeague({ action: "standings", season_slug: SEASON.slug });
    expect(r).toEqual({ ok: false, code: "secret_unset" });
    expect(stub.calls).toHaveLength(0);
  });

  test("production targets www.linkanddink.com/play; an override targets only itself", () => {
    setEnv({ VERCEL_ENV: "production", NGA_SYNC_SECRET: "s3cret" });
    expect(rotationLeagueTarget()).toEqual({
      url: "https://www.linkanddink.com/play/api/internal/nga-rotation-league",
      secret: "s3cret",
    });
    setEnv({ VERCEL_ENV: "preview", LINKDINK_BASE_URL: `${LD}/` });
    expect(rotationLeagueTarget()).toEqual({ url: `${LD}/play/api/internal/nga-rotation-league`, secret: "s3cret" });
  });

  test("a sync reads Notion, then sends the season and the narrowed roster to L&D only", async () => {
    setEnv({ LINKDINK_BASE_URL: LD, NGA_SYNC_SECRET: "s3cret" });
    const headers: Record<string, string>[] = [];
    stub
      .on("api.notion.com", { results: [notionRow()], has_more: false })
      .on(`${LD}/play/api/internal/nga-rotation-league`, (call: { body: string }) =>
        JSON.parse(call.body).action === "roster_upsert"
          ? { ok: true, written: 1, refused_erased: [] }
          : { ok: true, season: { slug: SEASON.slug } },
      )
      .install();
    const stubbed = globalThis.fetch;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      headers.push(Object.fromEntries(new Headers(init?.headers).entries()));
      return stubbed(input, init);
    }) as typeof fetch;
    try {
      const r = await syncSeason(SEASON.slug);
      expect(r).toEqual({ ok: true, sent: 1, skipped: 0, refused: 0 });
    } finally {
      globalThis.fetch = stubbed;
    }

    for (const call of stub.calls) {
      const host = new URL(call.url).host;
      expect(["api.notion.com", new URL(LD).host], `unexpected host ${host}`).toContain(host);
    }
    const ld = stub.calls.filter((c) => c.url.startsWith(LD));
    expect(ld.map((c) => JSON.parse(c.body).action)).toEqual(["season_upsert", "roster_upsert"]);
    const roster = JSON.parse(ld[1].body);
    expect(Object.keys(roster).sort()).toEqual(["action", "players", "season_slug"]);
    expect(roster.players).toEqual([
      {
        external_ref: "11111111-2222-4333-8444-555555555555",
        first_name: CHILD.first,
        last_name: CHILD.last,
        status: "active",
      },
    ]);
    for (const c of ld) {
      for (const leak of [PII.allergies, PII.emergency, PII.parentEmail, PII.parentPhone, String(PII.birthYear), "s3cret"]) {
        expect(c.body).not.toContain(leak);
        expect(c.url).not.toContain(leak);
      }
    }
    const ldHeaders = headers.filter((_, i) => stub.calls[i]?.url.startsWith(LD));
    expect(ldHeaders.every((h) => h["x-nga-sync-secret"] === "s3cret")).toBe(true);
  });

  test("a failed Notion read sends nothing to L&D", async () => {
    setEnv({ LINKDINK_BASE_URL: LD, NGA_SYNC_SECRET: "s3cret" });
    stub.on("api.notion.com", { message: "boom" }, 500).on(LD, { ok: true }).install();
    const r = await syncSeason(SEASON.slug);
    expect(r.ok).toBe(false);
    expect(stub.calls.filter((c) => c.url.startsWith(LD))).toHaveLength(0);
  });

  test("an unknown season sends nothing anywhere", async () => {
    setEnv({ LINKDINK_BASE_URL: LD, NGA_SYNC_SECRET: "s3cret" });
    stub.install();
    expect((await syncSeason("not-a-season")).ok).toBe(false);
    expect(stub.calls).toHaveLength(0);
  });

  test("an L&D error body never becomes the coach's message unless it is a known engine reason", async () => {
    setEnv({ LINKDINK_BASE_URL: LD, NGA_SYNC_SECRET: "s3cret" });
    stub.on(LD, { error: 'relation "ld.x" does not exist', reason: "DB internals" }, 500).install();
    const r = await callRotationLeague({ action: "standings", season_slug: SEASON.slug });
    expect(r).toEqual({ ok: false, code: "http_500" });
  });
});
