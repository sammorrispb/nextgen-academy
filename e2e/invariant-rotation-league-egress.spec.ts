import { test, expect } from "@playwright/test";
import { FetchStub } from "./fixtures/fetch-stub";

process.env.NOTION_API_KEY = "ntn_test_rotation_league";
process.env.NOTION_FALL_REGS_DB_ID = "fall-regs-rotation-league";

import { buildRosterPlayers, readSeasonRegistrations } from "../src/lib/rotation-league/roster";
import { callRotationLeague, rotationLeagueTarget } from "../src/lib/rotation-league/client";
import { addGuest, editRound, guestCandidates, replanAfter, syncSeason } from "../src/lib/rotation-league/view";
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

test.describe("round edits and re-plans (2026-10-25)", () => {
  const WEEK = SEASON.playWeeks[0];
  const G1 = "aaaaaaaa-bbbb-4ccc-8ddd-000000000001";
  const G2 = "aaaaaaaa-bbbb-4ccc-8ddd-000000000002";
  const games = [
    { gameId: G1, sideA: ["r1", "r2"], sideB: ["r3", "r4"] },
    { gameId: G2, sideA: ["r5"], sideB: ["r6"] },
  ];

  test("an edit sends only ids, refs and numbers, in the exact command shape", async () => {
    setEnv({ LINKDINK_BASE_URL: LD, NGA_SYNC_SECRET: "s3cret" });
    stub.on(LD, { ok: true, games: 2 }).install();
    const r = await editRound({ slug: SEASON.slug, week: WEEK, round: 2, games });
    expect(r).toEqual({ ok: true });
    expect(stub.calls).toHaveLength(1);
    expect(stub.calls[0].url.startsWith(LD)).toBe(true);
    expect(JSON.parse(stub.calls[0].body)).toEqual({
      action: "edit_round",
      season_slug: SEASON.slug,
      week: WEEK,
      round: 2,
      games: [
        { game_id: G1, side_a: ["r1", "r2"], side_b: ["r3", "r4"] },
        { game_id: G2, side_a: ["r5"], side_b: ["r6"] },
      ],
    });
    expect(stub.calls[0].body).not.toContain("s3cret");
  });

  test("a bad edit is refused before anything is sent", async () => {
    setEnv({ LINKDINK_BASE_URL: LD, NGA_SYNC_SECRET: "s3cret" });
    stub.on(LD, { ok: true }).install();
    const bad: unknown[] = [
      { slug: SEASON.slug, week: WEEK, round: 2, games: [{ ...games[0], sideB: ["r1", "r4"] }] },
      { slug: SEASON.slug, week: WEEK, round: 2, games: [{ ...games[0], gameId: "not-a-uuid" }] },
      { slug: SEASON.slug, week: WEEK, round: 2, games: [{ ...games[0], sideB: ["r3"] }] },
      { slug: SEASON.slug, week: WEEK, round: 2, games: [{ ...games[0], sideA: ["parent@example.com", "r2"] }] },
      { slug: SEASON.slug, week: WEEK, round: 0, games },
      { slug: SEASON.slug, week: 999, round: 2, games },
      { slug: "not-a-season", week: WEEK, round: 2, games },
      { slug: SEASON.slug, week: WEEK, round: 2, games: [] },
    ];
    for (const input of bad) {
      const r = await editRound(input as Parameters<typeof editRound>[0]);
      expect(r.ok, JSON.stringify(input)).toBe(false);
    }
    expect(stub.calls).toHaveLength(0);
  });

  test("a re-plan sends the round, attempt and dry-run flag, and nothing else", async () => {
    setEnv({ LINKDINK_BASE_URL: LD, NGA_SYNC_SECRET: "s3cret" });
    stub.on(LD, { ok: true, saved: false, present: 6, rounds: [] }).install();
    const r = await replanAfter({ slug: SEASON.slug, week: WEEK, afterRound: 2, attempt: 3, save: false });
    expect(r).toEqual({ ok: true, saved: false, present: 6, rounds: [] });
    expect(JSON.parse(stub.calls[0].body)).toEqual({
      action: "replan_after",
      season_slug: SEASON.slug,
      week: WEEK,
      after_round: 2,
      attempt: 3,
      dry_run: true,
    });
  });

  test("the new refusals reach the coach as plain sentences", async () => {
    setEnv({ LINKDINK_BASE_URL: LD, NGA_SYNC_SECRET: "s3cret" });
    for (const code of ["round_changed", "later_round_scored", "nothing_to_replan"]) {
      stub.reset();
      stub.on(LD, { error: code }, 409).install();
      const r = await replanAfter({ slug: SEASON.slug, week: WEEK, afterRound: 1, attempt: 1, save: true });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.message, code).not.toContain("answered");
      stub.uninstall();
    }
  });
});

test.describe("guests (2026-10-25)", () => {
  const WEEK = SEASON.playWeeks[0];
  const OTHER = ROTATION_LEAGUE_SEASONS.find((x) => x.rosterGroup !== SEASON.rosterGroup);
  const KOBE_REF = "22222222-3333-4444-8555-666666666666";

  /** Notion answers by the Group the query asks for: Kobe in the other group, a refunded kid too. */
  function notionByGroup() {
    return (call: { body: string }) => {
      const group = JSON.parse(call.body)?.filter?.select?.equals;
      if (group !== OTHER?.rosterGroup) return { results: [notionRow()], has_more: false };
      return {
        results: [
          notionRow({
            "Child First Name": { rich_text: [{ plain_text: "Kobe" }] },
            "Child Last Name": { rich_text: [{ plain_text: "Lane" }] },
            Group: { select: { name: OTHER?.rosterGroup } },
          }),
          {
            ...notionRow({
              "Child First Name": { rich_text: [{ plain_text: "Refundedkid" }] },
              Status: { select: { name: "Refunded" } },
            }),
            id: "99999999-3333-4444-8555-666666666666",
          },
        ].map((r, i) => (i === 0 ? { ...r, id: KOBE_REF } : r)),
        has_more: false,
      };
    };
  }

  test("the picker lists only Confirmed children from the other group, by name", async () => {
    expect(OTHER).toBeTruthy();
    stub.on("api.notion.com", notionByGroup()).install();
    const r = await guestCandidates(SEASON.slug);
    expect(r).toEqual({
      ok: true,
      candidates: [{ external_ref: KOBE_REF, name: "Kobe Lane", group: OTHER?.rosterGroup }],
    });
    const queried = stub.calls.map((c) => JSON.parse(c.body)?.filter?.select?.equals);
    expect(queried).toEqual([OTHER?.rosterGroup]);
  });

  test("a picked child goes over with Notion's names and the projection, nothing else", async () => {
    setEnv({ LINKDINK_BASE_URL: LD, NGA_SYNC_SECRET: "s3cret" });
    stub.on("api.notion.com", notionByGroup()).on(LD, { ok: true }).install();
    const r = await addGuest({
      slug: SEASON.slug,
      week: WEEK,
      externalRef: KOBE_REF,
      firstName: "Spoofed",
      lastName: "Name",
    });
    expect(r).toEqual({ ok: true });
    const ld = stub.calls.filter((c) => c.url.startsWith(LD));
    expect(ld).toHaveLength(1);
    expect(JSON.parse(ld[0].body)).toEqual({
      action: "add_guest",
      season_slug: SEASON.slug,
      week: WEEK,
      external_ref: KOBE_REF,
      first_name: "Kobe",
      last_name: "Lane",
    });
    for (const leak of [PII.allergies, PII.emergency, PII.parentEmail, PII.parentPhone, String(PII.birthYear), "Spoofed"]) {
      expect(ld[0].body).not.toContain(leak);
    }
  });

  test("a ref that isn't a Confirmed child in the other group sends nothing to L&D", async () => {
    setEnv({ LINKDINK_BASE_URL: LD, NGA_SYNC_SECRET: "s3cret" });
    stub.on("api.notion.com", notionByGroup()).on(LD, { ok: true }).install();
    for (const ref of ["99999999-3333-4444-8555-666666666666", "11111111-2222-4333-8444-555555555555", "bad ref"]) {
      expect((await addGuest({ slug: SEASON.slug, week: WEEK, externalRef: ref })).ok, ref).toBe(false);
    }
    expect(stub.calls.filter((c) => c.url.startsWith(LD))).toHaveLength(0);
  });

  test("a typed guest is a first (and optional last) name under a fresh opaque ref", async () => {
    setEnv({ LINKDINK_BASE_URL: LD, NGA_SYNC_SECRET: "s3cret" });
    stub.on(LD, { ok: true }).install();
    expect(await addGuest({ slug: SEASON.slug, week: WEEK, firstName: "  Sam ", lastName: "" })).toEqual({ ok: true });
    const body = JSON.parse(stub.calls[0].body);
    expect(Object.keys(body).sort()).toEqual(["action", "external_ref", "first_name", "last_name", "season_slug", "week"]);
    expect(body).toMatchObject({ action: "add_guest", first_name: "Sam", last_name: null, week: WEEK });
    expect(body.external_ref).toMatch(/^guest-[0-9a-f-]{36}$/);
  });

  test("a typed name that isn't a name is refused before anything is sent", async () => {
    setEnv({ LINKDINK_BASE_URL: LD, NGA_SYNC_SECRET: "s3cret" });
    stub.on(LD, { ok: true }).install();
    const bad = [
      { firstName: "" },
      { firstName: "sam@example.com" },
      { firstName: "3015550199" },
      { firstName: "Sam", lastName: "parent@example.com" },
    ];
    for (const b of bad) {
      expect((await addGuest({ slug: SEASON.slug, week: WEEK, ...b })).ok, JSON.stringify(b)).toBe(false);
    }
    expect((await addGuest({ slug: SEASON.slug, week: 999, firstName: "Sam" })).ok).toBe(false);
    expect((await addGuest({ slug: "nope", week: WEEK, firstName: "Sam" })).ok).toBe(false);
    expect(stub.calls).toHaveLength(0);
  });
});
