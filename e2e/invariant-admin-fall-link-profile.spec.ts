import { test, expect } from "@playwright/test";
import { NextRequest } from "next/server";
import { FetchStub, type RecordedFetch } from "./fixtures/fetch-stub";

// Linking a trial profile to the paid registration that follows it (2026-09-20).
//
// WHY THIS EXISTS: `PlayerId` IS the Notion page id of a Fall Registrations row,
// so a kid who plays a Sunday before paying accumulates results against the row
// that existed that day. When the family then registers through /api/checkout-fall
// they get a SECOND row with a NEW page id — full waiver, emergency contact and
// birth year, but none of the games. The duplicate guard cannot catch it
// (it matches an exact child first name, and a same-name kid carries a last
// initial). This link action is the join between the two.
//
// The shape these tests pin:
//   1. Only the PLAYER RELATIONS move. A Played game keeps its scores, its
//      Played status and its key — the link is not a rescore and not a replan.
//   2. The target must hold ZERO games. That single guard makes self-play, a
//      doubled id on one side, and merging two kids who BOTH really played
//      impossible by construction, so none of them need their own branch.
//   3. Both pages must live in the Fall Regs DB and the same Group. The Notion
//      integration can see every NGA database, so a page id alone proves nothing.
//   4. The trial row is CANCELLED, never deleted — a deleted page would strand
//      every relation and `buildNameMap` would render "Player" on games already
//      played.
//   5. Admin COOKIE only, strict body allowlist, and it is idempotent: a second
//      run rewrites nothing.
//
//   npx playwright test e2e/invariant-admin-fall-link-profile.spec.ts --project=desktop

process.env.COACH_SIGNING_SECRET = "test-signing-secret";
process.env.ADMIN_ALLOWLIST = "admin@example.com";
process.env.SESSION_OPS_SECRET = "test-ops-secret";
process.env.NOTION_API_KEY = "test-notion-key";

const REGS_DB = "11b32fd13f524c9ab4cc3f2cb3f61424";
const REGS_DB_DASHED = "11b32fd1-3f52-4c9a-b4cc-3f2cb3f61424";
const GAMES_DB = "aaaabbbbccccddddeeeeffff00001111";
const OTHER_DB = "557f01d8-e4c6-47d9-a67b-f0817dd8724f";

process.env.NOTION_FALL_REGS_DB_ID = REGS_DB;
process.env.NOTION_SEASON_LEAGUE_DB_ID = GAMES_DB;

import { createAdminSessionValue } from "../src/lib/admin-auth";
import {
  rewritePlayerInRows,
  playerAppearsIn,
  type MergeableRow,
} from "../src/lib/season-league/merge";
import { linkFallProfile } from "../src/lib/admin-fall-actions";
import { POST as linkRoute } from "../src/app/api/admin/fall/link-profile/route";

const TRIAL = "page-trial-aiden";
const PAID = "page-paid-aiden";
const OTHER_KID = "page-ian";
const THIRD_KID = "page-kabir";

// ---------------------------------------------------------------------------
// Pure: rewritePlayerInRows / playerAppearsIn
// ---------------------------------------------------------------------------

function row(over: Partial<MergeableRow> & { pageId: string }): MergeableRow {
  return {
    key: `G-W1-R1-C1`,
    status: "Played",
    sideA: [],
    sideB: [],
    present: [],
    ...over,
  };
}

test.describe("rewritePlayerInRows — pure", () => {
  test("replaces the trial id in Side A, Side B and Present", () => {
    const rows = [
      row({ pageId: "g1", sideA: [TRIAL, OTHER_KID], sideB: [THIRD_KID, "d"] }),
      row({ pageId: "g2", sideA: ["x", "y"], sideB: ["z", TRIAL] }),
      row({ pageId: "day", key: "G-W1-DAY", present: [OTHER_KID, TRIAL] }),
    ];
    const patches = rewritePlayerInRows(rows, TRIAL, PAID);
    expect(patches).toHaveLength(3);
    expect(patches.find((p) => p.pageId === "g1")!.sideA).toEqual([PAID, OTHER_KID]);
    expect(patches.find((p) => p.pageId === "g2")!.sideB).toEqual(["z", PAID]);
    expect(patches.find((p) => p.pageId === "day")!.present).toEqual([OTHER_KID, PAID]);
  });

  test("emits ONLY the relation fields that changed", () => {
    const patches = rewritePlayerInRows(
      [row({ pageId: "g1", sideA: [TRIAL, OTHER_KID], sideB: [THIRD_KID, "d"] })],
      TRIAL,
      PAID,
    );
    expect(patches).toHaveLength(1);
    expect(patches[0].sideA).toEqual([PAID, OTHER_KID]);
    expect(patches[0].sideB, "an untouched side must not be rewritten").toBeUndefined();
    expect(patches[0].present).toBeUndefined();
  });

  test("a row without the trial id produces no patch", () => {
    expect(rewritePlayerInRows([row({ pageId: "g1", sideA: [OTHER_KID] })], TRIAL, PAID)).toHaveLength(0);
  });

  test("Void rows are left alone", () => {
    const patches = rewritePlayerInRows(
      [row({ pageId: "stale", status: "Void", sideA: [TRIAL, OTHER_KID] })],
      TRIAL,
      PAID,
    );
    expect(patches, "a voided row is dead history — rewriting it is noise").toHaveLength(0);
  });

  test("de-duplicates when the target is already on the same side", () => {
    const patches = rewritePlayerInRows(
      [row({ pageId: "g1", sideA: [TRIAL, PAID, OTHER_KID] })],
      TRIAL,
      PAID,
    );
    expect(patches[0].sideA, "one child must never appear twice on one side").toEqual([
      PAID,
      OTHER_KID,
    ]);
  });

  test("is idempotent — a second pass rewrites nothing", () => {
    const rows = [row({ pageId: "g1", sideA: [TRIAL, OTHER_KID] })];
    const first = rewritePlayerInRows(rows, TRIAL, PAID);
    expect(first).toHaveLength(1);
    const after = [row({ pageId: "g1", sideA: first[0].sideA! })];
    expect(rewritePlayerInRows(after, TRIAL, PAID)).toHaveLength(0);
  });

  test("playerAppearsIn sees every relation but ignores Void rows", () => {
    const rows = [
      row({ pageId: "g1", sideA: [OTHER_KID], sideB: [THIRD_KID] }),
      row({ pageId: "g2", status: "Void", sideA: [PAID] }),
    ];
    expect(playerAppearsIn(rows, OTHER_KID)).toBe(true);
    expect(playerAppearsIn(rows, THIRD_KID)).toBe(true);
    expect(playerAppearsIn(rows, PAID), "a Void row is not a game the kid played").toBe(false);
    expect(playerAppearsIn(rows, TRIAL)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Engine: linkFallProfile
// ---------------------------------------------------------------------------

const stub = new FetchStub();
test.beforeEach(() => {
  stub.reset();
  stub.install();
});
test.afterEach(() => stub.uninstall());

interface RegOpts {
  group?: string;
  status?: string;
  child?: string;
  db?: string;
}

function regPage(id: string, o: RegOpts = {}) {
  return {
    id,
    parent: { database_id: o.db ?? REGS_DB_DASHED },
    created_time: "2026-09-20T12:00:00.000Z",
    properties: {
      "Parent Name": { title: [{ plain_text: "A Parent" }] },
      "Parent Email": { email: "parent@example.com" },
      "Child First Name": { rich_text: [{ plain_text: o.child ?? "Aiden L." }] },
      Group: { select: { name: o.group ?? "Green" } },
      Status: { select: { name: o.status ?? "Confirmed" } },
      "Amount Paid": { number: 225 },
      "Stripe Payment Intent ID": { rich_text: [] },
    },
  };
}

function gamePage(id: string, over: Record<string, unknown> = {}) {
  return {
    id,
    properties: {
      Game: { title: [{ plain_text: "G-W1-R1-C1" }] },
      League: { select: { name: "Green" } },
      Week: { number: 1 },
      Phase: { select: { name: "League" } },
      Format: { select: { name: "Doubles" } },
      Round: { number: 1 },
      Court: { number: 1 },
      "Side A": { relation: [{ id: TRIAL }, { id: OTHER_KID }] },
      "Side B": { relation: [{ id: THIRD_KID }, { id: "page-kobe" }] },
      "Score A": { number: 11 },
      "Score B": { number: 6 },
      Status: { select: { name: "Played" } },
      ...over,
    },
  };
}

/** Wire both databases + the two registration pages. */
function installWorld(opts: { games?: unknown[]; trial?: RegOpts; paid?: RegOpts } = {}) {
  const games = opts.games ?? [
    gamePage("g1"),
    {
      id: "day1",
      properties: {
        Game: { title: [{ plain_text: "G-W1-DAY" }] },
        League: { select: { name: "Green" } },
        Week: { number: 1 },
        Phase: { select: { name: "Day" } },
        Present: { relation: [{ id: TRIAL }, { id: OTHER_KID }] },
        Status: { select: { name: "Scheduled" } },
      },
    },
  ];
  stub.on(`pages/${TRIAL}`, regPage(TRIAL, opts.trial ?? {}));
  stub.on(`pages/${PAID}`, regPage(PAID, opts.paid ?? { child: "Aiden" }));
  stub.on(`databases/${GAMES_DB}/query`, { results: games, has_more: false });
  stub.on(/api\.notion\.com\/v1\/pages\/[^/]+$/, (c: RecordedFetch) => ({ id: c.url.split("/pages/")[1] }));
  return games;
}

/** A Notion database query is a POST too — only a page create or PATCH mutates. */
const writes = (s: FetchStub) =>
  s.calls.filter(
    (c) => c.method === "PATCH" || (c.method === "POST" && !c.url.includes("/query")),
  );
const patches = (s: FetchStub) => s.calls.filter((c) => c.method === "PATCH");

test.describe("linkFallProfile", () => {
  test("moves every relation to the paid row and cancels the trial row", async () => {
    installWorld();
    const result = await linkFallProfile({ fromPageId: TRIAL, toPageId: PAID });

    expect(result.ok, result.ok ? "" : result.message).toBe(true);
    if (!result.ok) return;
    expect(result.rowsRewritten).toBe(2);

    const bodies = patches(stub).map((c) => ({ url: c.url, body: JSON.parse(c.body) }));
    const g1 = bodies.find((b) => b.url.includes("g1"))!;
    expect(g1.body.properties["Side A"].relation.map((r: { id: string }) => r.id)).toEqual([
      PAID,
      OTHER_KID,
    ]);
    const day = bodies.find((b) => b.url.includes("day1"))!;
    expect(day.body.properties.Present.relation.map((r: { id: string }) => r.id)).toEqual([
      PAID,
      OTHER_KID,
    ]);
    const trial = bodies.find((b) => b.url.includes(TRIAL))!;
    expect(trial.body.properties.Status.select.name).toBe("Cancelled");
  });

  test("a Played game keeps its score, its Played status and its key", async () => {
    installWorld();
    await linkFallProfile({ fromPageId: TRIAL, toPageId: PAID });

    const g1 = patches(stub).find((c) => c.url.includes("g1"))!;
    const props = JSON.parse(g1.body).properties;
    expect(Object.keys(props).sort(), "a link writes relations and nothing else").toEqual([
      "Side A",
    ]);
    expect(props["Score A"]).toBeUndefined();
    expect(props.Status, "the link must never re-open a played game").toBeUndefined();
    expect(props.Game).toBeUndefined();
  });

  test("egress is Notion only", async () => {
    installWorld();
    await linkFallProfile({ fromPageId: TRIAL, toPageId: PAID });
    expect(stub.calls.length).toBeGreaterThan(0);
    for (const c of stub.calls) expect(new URL(c.url).host).toBe("api.notion.com");
  });

  test("refuses when the TARGET already has games — zero writes", async () => {
    installWorld({
      games: [gamePage("g1", { "Side A": { relation: [{ id: PAID }, { id: OTHER_KID }] } })],
    });
    const result = await linkFallProfile({ fromPageId: TRIAL, toPageId: PAID });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("target_has_games");
    expect(writes(stub), "a refusal must not half-apply").toHaveLength(0);
  });

  test("refuses a cross-group link — zero writes", async () => {
    installWorld({ paid: { group: "Yellow" } });
    const result = await linkFallProfile({ fromPageId: TRIAL, toPageId: PAID });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("group_mismatch");
    expect(writes(stub)).toHaveLength(0);
  });

  test("refuses when the target is not Confirmed — zero writes", async () => {
    installWorld({ paid: { status: "Refunded" } });
    const result = await linkFallProfile({ fromPageId: TRIAL, toPageId: PAID });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("target_not_confirmed");
    expect(writes(stub)).toHaveLength(0);
  });

  test("refuses a page from another NGA database — zero writes", async () => {
    installWorld({ trial: { db: OTHER_DB } });
    const result = await linkFallProfile({ fromPageId: TRIAL, toPageId: PAID });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("wrong_database");
    expect(writes(stub)).toHaveLength(0);
  });

  test("refuses linking a row to itself — zero writes", async () => {
    installWorld();
    const result = await linkFallProfile({ fromPageId: TRIAL, toPageId: TRIAL });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("same_page");
    expect(writes(stub)).toHaveLength(0);
  });

  test("warns when the paid row's name now collides with another kid in the group", async () => {
    installWorld({ trial: { child: "Aiden L." }, paid: { child: "Aiden" } });
    const result = await linkFallProfile({ fromPageId: TRIAL, toPageId: PAID });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.trialChildName).toBe("Aiden L.");
    expect(result.targetChildName).toBe("Aiden");
    expect(
      result.renameHint,
      "the display name the results were earned under should carry over",
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Route: admin cookie only, strict body
// ---------------------------------------------------------------------------

function post(body: unknown, opts: { cookie?: string; bearer?: string } = {}): NextRequest {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (opts.cookie !== undefined) headers.cookie = `nga_admin=${opts.cookie}`;
  if (opts.bearer) headers.authorization = `Bearer ${opts.bearer}`;
  return new NextRequest("https://nextgenpbacademy.com/api/admin/fall/link-profile", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

const admin = () => createAdminSessionValue("admin@example.com");

test.describe("POST /api/admin/fall/link-profile", () => {
  test("no cookie → 401 with ZERO fetches", async () => {
    const res = await linkRoute(post({ fromPageId: TRIAL, toPageId: PAID }));
    expect(res.status).toBe(401);
    expect(stub.calls, "an unauthorized call must never reach Notion").toHaveLength(0);
  });

  test("the Bearer ops secret does NOT open this route", async () => {
    const res = await linkRoute(
      post({ fromPageId: TRIAL, toPageId: PAID }, { bearer: "test-ops-secret" }),
    );
    expect(res.status).toBe(401);
    expect(stub.calls).toHaveLength(0);
  });

  test("a missing field is a 400 with zero calls — never a default", async () => {
    const res = await linkRoute(post({ fromPageId: TRIAL }, { cookie: admin() }));
    expect(res.status).toBe(400);
    expect(stub.calls).toHaveLength(0);
  });

  test("an admin cookie links and reports what moved", async () => {
    installWorld();
    const res = await linkRoute(post({ fromPageId: TRIAL, toPageId: PAID }, { cookie: admin() }));
    expect(res.status).toBe(200);
    const json = (await res.json()) as { ok: boolean; rowsRewritten: number };
    expect(json.ok).toBe(true);
    expect(json.rowsRewritten).toBe(2);
  });

  test("a refusal surfaces its reason, not a green check", async () => {
    installWorld({ paid: { group: "Yellow" } });
    const res = await linkRoute(post({ fromPageId: TRIAL, toPageId: PAID }, { cookie: admin() }));
    expect(res.status).toBe(409);
    const json = (await res.json()) as { reason: string };
    expect(json.reason).toBe("group_mismatch");
  });
});

// ---------------------------------------------------------------------------
// Ships dark
// ---------------------------------------------------------------------------

test.describe("configuration", () => {
  test("no games DB configured → refused with zero writes", async () => {
    const saved = process.env.NOTION_SEASON_LEAGUE_DB_ID;
    delete process.env.NOTION_SEASON_LEAGUE_DB_ID;
    try {
      installWorld();
      const result = await linkFallProfile({ fromPageId: TRIAL, toPageId: PAID });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.reason).toBe("config_missing");
      expect(writes(stub)).toHaveLength(0);
    } finally {
      process.env.NOTION_SEASON_LEAGUE_DB_ID = saved;
    }
  });
});
