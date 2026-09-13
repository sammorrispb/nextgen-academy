import { test, expect } from "@playwright/test";
import { FetchStub, type RecordedFetch } from "./fixtures/fetch-stub";

// Env BEFORE import (read at call time; the convention across the pure specs).
process.env.NOTION_API_KEY = "ntn_test_season_league";
process.env.NOTION_SEASON_LEAGUE_DB_ID = "season-league-db";
process.env.NOTION_FALL_REGS_DB_ID = "fall-regs-db";

import {
  SEASON_LEAGUE_PROPS,
  SEASON_LEAGUE_SCHEMA,
  buildDayRowProps,
  buildGameRowProps,
  buildPlayoffRowProps,
  buildScoreProps,
  buildTeamRowProps,
  dayKey,
  fetchSeasonLeagueRows,
  findSeasonLeagueRowByKey,
  gameKey,
  parseSeasonLeagueRow,
  playoffKey,
  probeSeasonLeagueSchema,
  recordSeasonLeagueScore,
  teamKey,
  upsertSeasonLeagueRow,
  voidSeasonLeagueRow,
} from "../src/lib/notion-season-league";
import { fetchFallRosterForLeague } from "../src/lib/notion-fall-registrations";

// Pure-function spec (no dev server) for the season-league Notion store: the
// row builders/parser round-trip, and the store's behaviour against a stubbed
// Notion — pagination, find-or-create, the Played guard, the 429 retry, and
// the ships-dark / fail-soft postures.
//   npx playwright test e2e/season-league-notion.spec.ts --project=desktop
//
// Mutation checks: drop the `existing?.status === "Played"` guard in
// upsertSeasonLeagueRow → "never overwrites a Played row" fails; drop the
// has_more loop → the pagination pin fails; make notionWrite not retry a 429 →
// the retry pin fails.

const stub = new FetchStub();
test.beforeEach(() => stub.reset());
test.afterEach(() => stub.uninstall());

/** Build a Notion page the way the API returns it, from the props we would write. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function pageFromProps(id: string, props: Record<string, any>) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const properties: Record<string, any> = {};
  for (const [name, value] of Object.entries(props)) {
    if ("title" in value) properties[name] = { title: value.title.map((t: { text: { content: string } }) => ({ plain_text: t.text.content })) };
    else if ("rich_text" in value) properties[name] = { rich_text: value.rich_text.map((t: { text: { content: string } }) => ({ plain_text: t.text.content })) };
    else properties[name] = value;
  }
  return { id, properties };
}

function queryPage(results: unknown[], next_cursor: string | null = null) {
  return { results, has_more: next_cursor !== null, next_cursor };
}

test.describe("row keys", () => {
  test("are per league, week and slot", () => {
    expect(gameKey("Green", 2, 1, 1)).toBe("G-W2-R1-C1");
    expect(dayKey("Yellow", 6)).toBe("Y-W6-DAY");
    expect(teamKey("Yellow", 6, 3)).toBe("Y-W6-T3");
    expect(playoffKey("Green", 6, "l2m1")).toBe("G-W6-l2m1");
  });
});

test.describe("builders ↔ parser", () => {
  test("a league game round-trips (relations carry ids only)", () => {
    const props = buildGameRowProps({
      group: "Green",
      week: 2,
      sessionDate: "2026-09-27",
      round: 1,
      court: 1,
      format: "doubles",
      sideA: ["reg-a", "reg-b"],
      sideB: ["reg-c", "reg-d"],
    });
    const row = parseSeasonLeagueRow(pageFromProps("page-1", props));
    expect(row).toMatchObject({
      pageId: "page-1",
      key: "G-W2-R1-C1",
      league: "Green",
      week: 2,
      sessionDate: "2026-09-27",
      phase: "League",
      format: "doubles",
      round: 1,
      court: 1,
      sideA: ["reg-a", "reg-b"],
      sideB: ["reg-c", "reg-d"],
      scoreA: null,
      scoreB: null,
      status: "Scheduled",
      timed: false,
    });
    expect(JSON.stringify(props)).not.toMatch(/[A-Z][a-z]+ & /);
  });

  test("a singles game, a day row, a team row and a playoff row round-trip", () => {
    const singles = parseSeasonLeagueRow(
      pageFromProps("s", buildGameRowProps({ group: "Yellow", week: 3, sessionDate: "2026-10-04", round: 2, court: 2, format: "singles", sideA: ["x"], sideB: ["y"] })),
    );
    expect(singles).toMatchObject({ key: "Y-W3-R2-C2", format: "singles", sideA: ["x"], sideB: ["y"] });

    const day = parseSeasonLeagueRow(
      pageFromProps("d", buildDayRowProps({ group: "Green", week: 1, sessionDate: "2026-09-20", present: ["a", "b", "c"], attempt: 2, rounds: 3 })),
    );
    expect(day).toMatchObject({ key: "G-W1-DAY", phase: "Day", present: ["a", "b", "c"], attempt: 2, rounds: 3 });

    const team = parseSeasonLeagueRow(
      pageFromProps("t", buildTeamRowProps({ group: "Green", week: 6, sessionDate: "2026-10-25", seed: 3, members: ["a", "b", "c"] })),
    );
    expect(team).toMatchObject({ key: "G-W6-T3", phase: "Team", seed: 3, sideA: ["a", "b", "c"] });

    const playoff = parseSeasonLeagueRow(
      pageFromProps("p", buildPlayoffRowProps({ group: "Green", week: 6, sessionDate: "2026-10-25", slot: "gf", sideA: ["a", "b"], sideB: ["c", "d"], scoreA: 11, scoreB: 8, timed: true })),
    );
    expect(playoff).toMatchObject({ key: "G-W6-gf", phase: "Playoff", slot: "gf", scoreA: 11, scoreB: 8, status: "Played", timed: true });
  });

  test("score props flip Status to Played and carry the timed flag", () => {
    expect(buildScoreProps(11, 9, false)).toEqual({
      [SEASON_LEAGUE_PROPS.scoreA]: { number: 11 },
      [SEASON_LEAGUE_PROPS.scoreB]: { number: 9 },
      [SEASON_LEAGUE_PROPS.status]: { select: { name: "Played" } },
      [SEASON_LEAGUE_PROPS.timed]: { checkbox: false },
    });
  });

  test("garbage in → a blank, typed row out (never a throw)", () => {
    expect(parseSeasonLeagueRow({})).toMatchObject({ pageId: "", key: "", phase: "", format: "", status: "", sideA: [], present: [] });
    expect(parseSeasonLeagueRow(null)).toMatchObject({ pageId: "" });
  });

  test("the schema map names every property the builders write", () => {
    const written = new Set<string>();
    for (const props of [
      buildGameRowProps({ group: "Green", week: 1, sessionDate: "", round: 1, court: 1, format: "doubles", sideA: [], sideB: [] }),
      buildDayRowProps({ group: "Green", week: 1, sessionDate: "", present: [], attempt: 1, rounds: 1 }),
      buildTeamRowProps({ group: "Green", week: 6, sessionDate: "", seed: 1, members: [] }),
      buildPlayoffRowProps({ group: "Green", week: 6, sessionDate: "", slot: "gf", sideA: [], sideB: [], scoreA: 0, scoreB: 1, timed: false }),
    ]) {
      for (const name of Object.keys(props)) written.add(name);
    }
    for (const name of written) expect(Object.keys(SEASON_LEAGUE_SCHEMA), name).toContain(name);
  });
});

test.describe("reads", () => {
  test("env unset → config_missing with ZERO network calls", async () => {
    const saved = process.env.NOTION_SEASON_LEAGUE_DB_ID;
    delete process.env.NOTION_SEASON_LEAGUE_DB_ID;
    stub.install();
    try {
      expect(await fetchSeasonLeagueRows("Green")).toEqual({ rows: [], status: "config_missing" });
      expect(await findSeasonLeagueRowByKey("G-W1-DAY")).toBeNull();
      expect(await probeSeasonLeagueSchema()).toMatchObject({ status: "config_missing" });
      expect(stub.calls).toHaveLength(0);
    } finally {
      process.env.NOTION_SEASON_LEAGUE_DB_ID = saved;
    }
  });

  test("fetchSeasonLeagueRows filters by League and follows next_cursor", async () => {
    const row = (id: string, round: number) =>
      pageFromProps(id, buildGameRowProps({ group: "Green", week: 1, sessionDate: "2026-09-20", round, court: 1, format: "doubles", sideA: ["a", "b"], sideB: ["c", "d"] }));
    stub
      .onDynamic("databases/season-league-db/query", (call: RecordedFetch) => {
        const body = JSON.parse(call.body);
        return body.start_cursor === "c2"
          ? { status: 200, json: queryPage([row("p2", 2)]) }
          : { status: 200, json: queryPage([row("p1", 1)], "c2") };
      })
      .install();
    const res = await fetchSeasonLeagueRows("Green");
    expect(res.status).toBe("ok");
    expect(res.rows.map((r) => r.pageId)).toEqual(["p1", "p2"]);
    const queries = stub.callsTo("/query");
    expect(queries).toHaveLength(2);
    for (const q of queries) {
      const body = JSON.parse(q.body);
      expect(body.filter).toEqual({ property: "League", select: { equals: "Green" } });
      expect(body.page_size).toBe(100);
    }
    expect(JSON.parse(queries[1].body).start_cursor).toBe("c2");
  });

  test("a failed query → query_failed, never a throw", async () => {
    stub.on("databases/season-league-db/query", { message: "boom" }, 500).install();
    expect(await fetchSeasonLeagueRows("Yellow")).toEqual({ rows: [], status: "query_failed" });
  });

  test("the schema probe reports missing and mistyped properties", async () => {
    stub
      .on("databases/season-league-db", {
        properties: {
          Game: { type: "title" },
          League: { type: "select" },
          Week: { type: "rich_text" },
        },
      })
      .install();
    const probe = await probeSeasonLeagueSchema();
    expect(probe.status).toBe("mismatch");
    expect(probe.missing).toContain("Side A");
    expect(probe.missing).not.toContain("Game");
    expect(probe.mistyped).toEqual(["Week (rich_text, expected number)"]);
    const call = stub.calls[0];
    expect(call.method).toBe("GET");
    expect(call.url).toBe("https://api.notion.com/v1/databases/season-league-db");
  });

  test("the schema probe is clean when every property matches", async () => {
    const properties: Record<string, { type: string }> = {};
    for (const [name, type] of Object.entries(SEASON_LEAGUE_SCHEMA)) properties[name] = { type };
    stub.on("databases/season-league-db", { properties }).install();
    expect(await probeSeasonLeagueSchema()).toEqual({ status: "ok", missing: [], mistyped: [] });
  });
});

test.describe("writes", () => {
  const props = buildGameRowProps({ group: "Green", week: 1, sessionDate: "2026-09-20", round: 1, court: 1, format: "doubles", sideA: ["a", "b"], sideB: ["c", "d"] });

  test("no row with the key → one POST create", async () => {
    stub.on("databases/season-league-db/query", queryPage([])).on("/pages", { id: "new-page" }).install();
    const r = await upsertSeasonLeagueRow("G-W1-R1-C1", props);
    expect(r).toEqual({ action: "created", pageId: "new-page" });
    const lookup = JSON.parse(stub.callsTo("/query")[0].body);
    expect(lookup.filter).toEqual({ property: "Game", title: { equals: "G-W1-R1-C1" } });
    const creates = stub.calls.filter((c) => c.method === "POST" && c.url.endsWith("/pages"));
    expect(creates).toHaveLength(1);
    expect(JSON.parse(creates[0].body).parent).toEqual({ database_id: "season-league-db" });
  });

  test("a Scheduled row with the key → PATCHed in place, never a second create", async () => {
    stub
      .on("databases/season-league-db/query", queryPage([pageFromProps("existing", props)]))
      .on("/pages/existing", { id: "existing" })
      .install();
    const r = await upsertSeasonLeagueRow("G-W1-R1-C1", props);
    expect(r).toEqual({ action: "updated", pageId: "existing" });
    expect(stub.calls.filter((c) => c.method === "POST" && c.url.endsWith("/pages"))).toHaveLength(0);
    expect(stub.calls.filter((c) => c.method === "PATCH")).toHaveLength(1);
  });

  test("never overwrites a Played row", async () => {
    const played = { ...props, ...buildScoreProps(11, 4, false) };
    stub.on("databases/season-league-db/query", queryPage([pageFromProps("played", played)])).install();
    const r = await upsertSeasonLeagueRow("G-W1-R1-C1", props);
    expect(r).toEqual({ action: "skipped", pageId: "played" });
    expect(stub.calls.filter((c) => c.method === "PATCH" || c.url.endsWith("/pages"))).toHaveLength(0);
  });

  test("a 429 on create is retried exactly once", async () => {
    let creates = 0;
    stub
      .on("databases/season-league-db/query", queryPage([]))
      .onDynamic("/pages", () => {
        creates += 1;
        return creates === 1 ? { status: 429, json: { message: "slow down" } } : { status: 200, json: { id: "after-retry" } };
      })
      .install();
    const r = await upsertSeasonLeagueRow("G-W1-R1-C1", props);
    expect(r).toEqual({ action: "created", pageId: "after-retry" });
    expect(creates).toBe(2);
  });

  test("a permanent failure reports failed with the body, and does not retry", async () => {
    let creates = 0;
    stub
      .on("databases/season-league-db/query", queryPage([]))
      .onDynamic("/pages", () => {
        creates += 1;
        return { status: 400, json: { message: "Side A is not a property that exists" } };
      })
      .install();
    const r = await upsertSeasonLeagueRow("G-W1-R1-C1", props);
    expect(r.action).toBe("failed");
    expect(r.error).toContain("Side A");
    expect(creates).toBe(1);
  });

  test("recordScore PATCHes scores + Played; void PATCHes Void only", async () => {
    stub.on("/pages/row-1", { id: "row-1" }).install();
    expect(await recordSeasonLeagueScore("row-1", 11, 9, true)).toBe(true);
    expect(await voidSeasonLeagueRow("row-1")).toBe(true);
    const [score, voided] = stub.calls.filter((c) => c.method === "PATCH");
    expect(JSON.parse(score.body).properties).toEqual(buildScoreProps(11, 9, true));
    expect(JSON.parse(voided.body).properties).toEqual({ Status: { select: { name: "Void" } } });
  });

  test("env unset → writes refuse with zero calls", async () => {
    const saved = process.env.NOTION_SEASON_LEAGUE_DB_ID;
    delete process.env.NOTION_SEASON_LEAGUE_DB_ID;
    stub.install();
    try {
      expect(await upsertSeasonLeagueRow("G-W1-R1-C1", props)).toEqual({ action: "failed", error: "config_missing" });
      expect(await recordSeasonLeagueScore("row-1", 11, 9, false)).toBe(false);
      expect(await voidSeasonLeagueRow("row-1")).toBe(false);
      expect(stub.calls).toHaveLength(0);
    } finally {
      process.env.NOTION_SEASON_LEAGUE_DB_ID = saved;
    }
  });
});

test.describe("roster reader", () => {
  const regRow = (id: string, name: string, status: string, group = "Green") => ({
    id,
    properties: {
      "Parent Name": { title: [{ plain_text: "Dana Fields" }] },
      "Parent Email": { email: "dana@example.org" },
      "Parent Phone": { phone_number: "240-555-0134" },
      "Child First Name": { rich_text: [{ plain_text: name }] },
      "Child Birth Year": { number: 2014 },
      Allergies: { rich_text: [{ plain_text: "peanuts" }] },
      "Emergency Name": { rich_text: [{ plain_text: "Aunt Meg" }] },
      Group: { select: { name: group } },
      Status: { select: { name: status } },
    },
  });

  test("returns id, first name, group and status for EVERY status, and nothing else", async () => {
    stub
      .onDynamic("databases/fall-regs-db/query", (call) => {
        const body = JSON.parse(call.body);
        expect(body.filter).toEqual({ property: "Group", select: { equals: "Green" } });
        return body.start_cursor === "next"
          ? { status: 200, json: queryPage([regRow("r3", "Kabir", "Refunded")]) }
          : { status: 200, json: queryPage([regRow("r1", "Aiden", "Confirmed"), regRow("r2", "Ian", "Confirmed")], "next") };
      })
      .install();
    const res = await fetchFallRosterForLeague("Green");
    expect(res.status).toBe("ok");
    expect(res.players).toEqual([
      { pageId: "r1", childFirstName: "Aiden", group: "Green", status: "Confirmed" },
      { pageId: "r2", childFirstName: "Ian", group: "Green", status: "Confirmed" },
      { pageId: "r3", childFirstName: "Kabir", group: "Green", status: "Refunded" },
    ]);
    const serialized = JSON.stringify(res);
    for (const secret of ["Dana", "dana@example.org", "240-555-0134", "2014", "peanuts", "Aunt Meg"]) {
      expect(serialized, `roster result must not carry ${secret}`).not.toContain(secret);
    }
  });

  test("env unset → config_missing with zero calls; a failed query → query_failed", async () => {
    const saved = process.env.NOTION_FALL_REGS_DB_ID;
    delete process.env.NOTION_FALL_REGS_DB_ID;
    stub.install();
    try {
      expect(await fetchFallRosterForLeague("Green")).toEqual({ players: [], status: "config_missing" });
      expect(stub.calls).toHaveLength(0);
    } finally {
      process.env.NOTION_FALL_REGS_DB_ID = saved;
    }
    stub.reset();
    stub.on("databases/fall-regs-db/query", { message: "boom" }, 500).install();
    expect(await fetchFallRosterForLeague("Green")).toEqual({ players: [], status: "query_failed" });
  });
});
