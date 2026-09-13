import { test, expect } from "@playwright/test";
import { FetchStub, type RecordedFetch } from "./fixtures/fetch-stub";

// Env BEFORE import. Open Brain + Resend are deliberately SET rather than
// deleted — deleting them would make their helpers self-skip, which proves
// only that a call didn't happen, not that this feature declines to make it.
process.env.NOTION_API_KEY = "ntn_test_egress";
process.env.NOTION_SEASON_LEAGUE_DB_ID = "egress-games-db";
process.env.NOTION_FALL_REGS_DB_ID = "egress-regs-db";
process.env.STANDINGS_LINK_SECRET = "egress-standings-secret";
process.env.OPEN_BRAIN_INGEST_URL = "https://open-brain.example/ingest";
process.env.LEAD_INGEST_TOKEN = "ob-token";
process.env.RESEND_API_KEY = "re_test_egress";

import {
  lockTeams,
  previewDay,
  recordGameScore,
  recordPlayoffScore,
  resolveStandingsView,
  saveDay,
} from "../src/lib/season-league-view";
import { signStandingsLink } from "../src/lib/standings-link-token";

// THE season-play egress invariants. The feature touches minors' data at
// every step (a roster of first names, who played whom), so what matters is:
// the ONLY host it ever talks to is Notion; the new games database receives
// ids and scores and never a name or a parent field; the parent page hands
// out first names, records and scores and nothing else; and a bad token
// costs zero reads. Every fixture row carries the sentinel parent/child data
// ON PURPOSE — the negative assertions only mean something if the data the
// feature must not forward is actually in its input.
//   npx playwright test e2e/invariant-season-league-egress.spec.ts --project=desktop
//
// Mutation checks: put `childFirstName` into buildGameRowProps' title → the
// "write bodies carry ids + scores only" pin fails; swap the order of the
// token check and the snapshot load in resolveStandingsView → the zero-fetch
// pin fails; add `present` to StandingsView → the parent-view pin fails.

const ALLOWED_HOSTS = ["api.notion.com"];

const KIDS = ["Rosalind", "Jasper", "Wren", "Theo", "Mira", "Ash"];
const PARENT_NAME = "Dana Fields";
const PARENT_EMAIL = "dana@egress.example";
const PARENT_PHONE = "240-555-0134";
const BIRTH_YEAR = 2014;
const ALLERGY = "peanut allergy — carries an EpiPen";
const EMERGENCY = "Aunt Meg";
const SENTINELS = [PARENT_NAME, "Dana", PARENT_EMAIL, PARENT_PHONE, String(BIRTH_YEAR), ALLERGY, EMERGENCY];

function regRow(i: number, status = "Confirmed") {
  return {
    id: `reg-${i + 1}`,
    properties: {
      "Parent Name": { title: [{ plain_text: PARENT_NAME }] },
      "Parent Email": { email: PARENT_EMAIL },
      "Parent Phone": { phone_number: PARENT_PHONE },
      "Child First Name": { rich_text: [{ plain_text: KIDS[i] }] },
      "Child Birth Year": { number: BIRTH_YEAR },
      Allergies: { rich_text: [{ plain_text: ALLERGY }] },
      "Emergency Name": { rich_text: [{ plain_text: EMERGENCY }] },
      "Emergency Phone": { phone_number: PARENT_PHONE },
      Group: { select: { name: "Green" } },
      Status: { select: { name: status } },
    },
  };
}
const REG_IDS = KIDS.map((_, i) => `reg-${i + 1}`);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Page = { id: string; properties: Record<string, any> };

/** The API's read shape for the props the store writes. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toPageProps(props: Record<string, any>): Record<string, any> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const out: Record<string, any> = {};
  for (const [name, value] of Object.entries(props)) {
    if (value && typeof value === "object" && "title" in value) {
      out[name] = { title: value.title.map((t: { text: { content: string } }) => ({ plain_text: t.text.content })) };
    } else if (value && typeof value === "object" && "rich_text" in value) {
      out[name] = { rich_text: value.rich_text.map((t: { text: { content: string } }) => ({ plain_text: t.text.content })) };
    } else {
      out[name] = value;
    }
  }
  return out;
}

/** A tiny in-memory Notion: the regs DB is static, the games DB is live. */
function installWorld(stub: FetchStub, games: Page[], regs: Page[] = KIDS.map((_, i) => regRow(i))) {
  let seq = games.length;
  stub
    .on("databases/egress-regs-db/query", { results: regs, has_more: false, next_cursor: null })
    .onDynamic("databases/egress-games-db/query", (call: RecordedFetch) => {
      const f = JSON.parse(call.body).filter;
      let rows = games;
      if (f?.property === "League") rows = rows.filter((p) => p.properties.League?.select?.name === f.select.equals);
      if (f?.property === "Game") rows = rows.filter((p) => p.properties.Game?.title?.[0]?.plain_text === f.title.equals);
      return { status: 200, json: { results: rows, has_more: false, next_cursor: null } };
    })
    .onDynamic("api.notion.com/v1/pages/", (call: RecordedFetch) => {
      const id = call.url.split("/pages/")[1];
      const page = games.find((p) => p.id === id);
      if (page) Object.assign(page.properties, toPageProps(JSON.parse(call.body).properties));
      return { status: 200, json: { id } };
    })
    .onDynamic("api.notion.com/v1/pages", (call: RecordedFetch) => {
      const id = `game-${++seq}`;
      games.push({ id, properties: toPageProps(JSON.parse(call.body).properties) });
      return { status: 200, json: { id } };
    })
    .on("open-brain.example", { ok: true })
    .on("api.resend.com", { id: "email_test" })
    .install();
}

function writes(stub: FetchStub): RecordedFetch[] {
  return stub.calls.filter(
    (c) => c.url.includes("api.notion.com") && (c.method === "PATCH" || (c.method === "POST" && !c.url.includes("/query"))),
  );
}

function assertNoSentinels(body: string, where: string) {
  for (const s of SENTINELS) expect(body, `${where} must not carry ${s}`).not.toContain(s);
  for (const kid of KIDS) expect(body, `${where} must not carry the first name ${kid}`).not.toContain(kid);
}

const stub = new FetchStub();
test.beforeEach(() => stub.reset());
test.afterEach(() => stub.uninstall());

test.describe("season play — hosts", () => {
  test("a Sunday save + a score reach Notion and nothing else (Open Brain and Resend are configured and untouched)", async () => {
    const games: Page[] = [];
    installWorld(stub, games);
    const saved = await saveDay({ group: "Green", week: 1, presentIds: REG_IDS });
    expect(saved.ok).toBe(true);
    expect(saved.created).toBeGreaterThan(0);

    const first = games.find((p) => p.properties.Phase?.select?.name === "League")!;
    const key = first.properties.Game.title[0].plain_text as string;
    const score = await recordGameScore({ group: "Green", week: 1, key, scoreA: 11, scoreB: 6, timed: false });
    expect(score.ok).toBe(true);

    expect(stub.calls.length).toBeGreaterThan(0);
    for (const call of stub.calls) {
      const host = new URL(call.url).host;
      expect(ALLOWED_HOSTS, `unexpected egress to ${call.url}`).toContain(host);
    }
    expect(stub.callsTo("open-brain.example")).toHaveLength(0);
    expect(stub.callsTo("api.resend.com")).toHaveLength(0);
  });

  test("a preview writes nothing", async () => {
    const games: Page[] = [];
    installWorld(stub, games);
    const preview = await previewDay({ group: "Green", week: 1, presentIds: REG_IDS });
    expect(preview.ok).toBe(true);
    expect(writes(stub)).toHaveLength(0);
    expect(games).toHaveLength(0);
  });
});

test.describe("season play — the games database holds no names", () => {
  test("every write body carries relation ids and scores only", async () => {
    const games: Page[] = [];
    installWorld(stub, games);
    await saveDay({ group: "Green", week: 1, presentIds: REG_IDS });
    const first = games.find((p) => p.properties.Phase?.select?.name === "League")!;
    await recordGameScore({ group: "Green", week: 1, key: first.properties.Game.title[0].plain_text, scoreA: 11, scoreB: 6, timed: true });

    const bodies = writes(stub);
    expect(bodies.length).toBeGreaterThan(1);
    for (const w of bodies) assertNoSentinels(w.body, `${w.method} ${w.url}`);
    // Positive proof the sanctioned data DID land: relation ids + a score.
    const create = bodies.find((w) => w.method === "POST")!;
    expect(create.body).toContain('"relation":[{"id":"reg-');
    const patch = bodies.find((w) => w.method === "PATCH" && w.body.includes('"Score A"'))!;
    expect(patch.body).toContain('"Score A":{"number":11}');
    expect(patch.body).toContain('"Played"');
  });

  test("a playoff lock and a bracket score write ids and scores only", async () => {
    const games: Page[] = [];
    installWorld(stub, games);
    const lock = await lockTeams({ group: "Green", presentIds: REG_IDS });
    expect(lock.ok).toBe(true);
    const score = await recordPlayoffScore({ group: "Green", slot: "w1m2", scoreA: 11, scoreB: 9, timed: false });
    expect(score.ok).toBe(true);
    for (const w of writes(stub)) assertNoSentinels(w.body, `${w.method} ${w.url}`);
    const playoffRow = games.find((p) => p.properties.Phase?.select?.name === "Playoff")!;
    expect(playoffRow.properties["Side A"].relation.length).toBeGreaterThanOrEqual(2);
  });
});

test.describe("season play — a save never rewrites a played game", () => {
  test("Played rows are untouched; a stale Scheduled row is voided; a refunded kid is never scheduled", async () => {
    const games: Page[] = [];
    installWorld(stub, games, [...KIDS.map((_, i) => regRow(i)), regRow(0, "Refunded")].map((r, i) =>
      i === KIDS.length ? { ...r, id: "reg-refunded", properties: { ...r.properties, "Child First Name": { rich_text: [{ plain_text: "Refundo" }] } } } : r,
    ));
    // Round 1 already played; a stray scheduled round 9 left over.
    await saveDay({ group: "Green", week: 1, presentIds: REG_IDS });
    const round1 = games.filter((p) => p.properties.Phase?.select?.name === "League" && p.properties.Round?.number === 1);
    for (const p of round1) {
      await recordGameScore({ group: "Green", week: 1, key: p.properties.Game.title[0].plain_text, scoreA: 11, scoreB: 4, timed: false });
    }
    games.push({
      id: "stale",
      properties: toPageProps({
        Game: { title: [{ text: { content: "G-W1-R9-C1" } }] },
        League: { select: { name: "Green" } },
        Week: { number: 1 },
        Phase: { select: { name: "League" } },
        Format: { select: { name: "Doubles" } },
        Round: { number: 9 },
        Court: { number: 1 },
        "Side A": { relation: [{ id: "reg-1" }, { id: "reg-2" }] },
        "Side B": { relation: [{ id: "reg-3" }, { id: "reg-4" }] },
        Status: { select: { name: "Scheduled" } },
      }),
    });
    stub.calls.length = 0;

    // A late arrival: regenerate the remaining rounds with a different 5.
    const present = REG_IDS.slice(1);
    const again = await saveDay({ group: "Green", week: 1, presentIds: [...present, "reg-refunded"] });
    expect(again.ok).toBe(true);

    const patchedIds = writes(stub)
      .filter((w) => w.method === "PATCH")
      .map((w) => w.url.split("/pages/")[1]);
    for (const p of round1) expect(patchedIds, "a Played row must never be PATCHed by a save").not.toContain(p.id);
    expect(games.find((p) => p.id === "stale")!.properties.Status.select.name).toBe("Void");
    for (const p of games) {
      const ids = [...(p.properties["Side A"]?.relation ?? []), ...(p.properties["Side B"]?.relation ?? []), ...(p.properties.Present?.relation ?? [])].map((r: { id: string }) => r.id);
      expect(ids, "a non-Confirmed registration is never scheduled or listed present").not.toContain("reg-refunded");
    }
  });
});

test.describe("season play — the parent link", () => {
  test("a bad, missing or cross-group token → null with ZERO fetches", async () => {
    installWorld(stub, []);
    expect(await resolveStandingsView("green", "not-a-token")).toBeNull();
    expect(await resolveStandingsView("green", undefined)).toBeNull();
    expect(await resolveStandingsView("green", signStandingsLink("Yellow")!)).toBeNull();
    expect(await resolveStandingsView("purple", signStandingsLink("Green")!)).toBeNull();
    expect(stub.calls).toHaveLength(0);
  });

  test("an unset secret → null with ZERO fetches (the pages ship dark)", async () => {
    installWorld(stub, []);
    const token = signStandingsLink("Green")!;
    const saved = process.env.STANDINGS_LINK_SECRET;
    try {
      delete process.env.STANDINGS_LINK_SECRET;
      expect(await resolveStandingsView("green", token)).toBeNull();
    } finally {
      process.env.STANDINGS_LINK_SECRET = saved;
    }
    expect(stub.calls).toHaveLength(0);
  });

  test("a good token renders first names, records and scores — and no parent field, age, or attendance", async () => {
    const games: Page[] = [];
    installWorld(stub, games);
    await saveDay({ group: "Green", week: 1, presentIds: REG_IDS });
    const first = games.find((p) => p.properties.Phase?.select?.name === "League")!;
    await recordGameScore({ group: "Green", week: 1, key: first.properties.Game.title[0].plain_text, scoreA: 11, scoreB: 6, timed: false });

    const view = await resolveStandingsView("green", signStandingsLink("Green")!);
    expect(view).not.toBeNull();
    const json = JSON.stringify(view);
    for (const kid of KIDS) expect(json).toContain(kid);
    for (const s of SENTINELS) expect(json, `parent view must not carry ${s}`).not.toContain(s);
    expect(json).not.toContain("reg-1"); // no registration ids either
    for (const key of ['"present"', '"sitting"', '"absent"', '"age"', '"birthYear"']) {
      expect(json, `parent view must not carry ${key}`).not.toContain(key);
    }
    expect(view!.standings.every((r) => r.name && typeof r.wins === "number")).toBe(true);
    expect(view!.weeks[0].games.some((g) => g.status === "Played" && g.scoreA === 11)).toBe(true);
    // Everything it read came from Notion only.
    for (const call of stub.calls) expect(ALLOWED_HOSTS).toContain(new URL(call.url).host);
  });
});
