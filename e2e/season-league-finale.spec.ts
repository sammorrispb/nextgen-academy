import { test, expect } from "@playwright/test";
import * as reactJsx from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import { createRequire } from "node:module";
import { FetchStub, type RecordedFetch } from "./fixtures/fetch-stub";

// Env BEFORE import, as in the egress invariant.
process.env.NOTION_API_KEY = "ntn_test_finale";
process.env.NOTION_SEASON_LEAGUE_DB_ID = "finale-games-db";
process.env.NOTION_FALL_REGS_DB_ID = "finale-regs-db";
process.env.STANDINGS_LINK_SECRET = "finale-standings-secret";

import { editRoundLineup, loadLeagueSnapshot, previewDay, resolveStandingsView, saveDay } from "../src/lib/season-league-view";
import { buildGameRowProps, buildScoreProps, buildTeamRowProps } from "../src/lib/notion-season-league";
import { signStandingsLink } from "../src/lib/standings-link-token";
import { FALL_PLAYOFF_DATE } from "../src/data/fall-2026";
import { FALL_SEASON_PLAN, FALL_SEASON_PLAN_YELLOW } from "../src/data/fall-season-plan-2026";
import FallWeatherStatus from "../src/components/FallWeatherStatus";
import FallStandingsPage from "../src/app/fall/standings/[group]/[token]/page";

// Nov 8, 2026 is the Finale (Sam, 2026-11-02): a rotating-partner round robin
// that COUNTS toward the standings, then one game for 1st and 2nd. Week 6 is
// therefore a play week like weeks 1–5, and no Nov 8 surface may still promise
// a seeded playoff, a bracket or double elimination.
//   npx playwright test --config=playwright.pure.config.ts e2e/season-league-finale.spec.ts
//
// Mutation checks: put SEASON_LEAGUE_PLAY_WEEKS back to [1..5] → every test in
// "week 6 is the round robin" fails; restore " (playoff)" / "Playoff" in any
// listed surface → the copy sweep fails.

const KIDS = ["Rosalind", "Jasper", "Wren", "Theo", "Mira", "Ash", "Juno", "Pax"];
const REG_IDS = KIDS.map((_, i) => `reg-${i + 1}`);
const OLD_FORMAT = /playoff|seeded|bracket|double.?elim/i;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Page = { id: string; properties: Record<string, any> };

function regRow(i: number) {
  return {
    id: REG_IDS[i],
    properties: {
      "Child First Name": { rich_text: [{ plain_text: KIDS[i] }] },
      Group: { select: { name: "Green" } },
      Status: { select: { name: "Confirmed" } },
    },
  };
}

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

/** A week-6 doubles game already scored on the day. */
function playedWeek6Game(): Page {
  const props = {
    ...buildGameRowProps({
      group: "Green",
      week: 6,
      sessionDate: FALL_PLAYOFF_DATE,
      round: 1,
      court: 1,
      format: "doubles",
      sideA: [REG_IDS[0], REG_IDS[1]],
      sideB: [REG_IDS[2], REG_IDS[3]],
    }),
    ...buildScoreProps(11, 5, false),
  };
  return { id: "w6-game", properties: toPageProps(props) };
}

function installWorld(stub: FetchStub, games: Page[]) {
  let seq = games.length;
  stub
    .on("databases/finale-regs-db/query", { results: KIDS.map((_, i) => regRow(i)), has_more: false, next_cursor: null })
    .onDynamic("databases/finale-games-db/query", (call: RecordedFetch) => {
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
    .install();
}

async function render(make: () => React.ReactNode | Promise<React.ReactNode>): Promise<string> {
  const runtime = createRequire(`${process.cwd()}/package.json`)("playwright/jsx-runtime");
  const original = { ...runtime };
  try {
    Object.assign(runtime, { jsx: reactJsx.jsx, jsxs: reactJsx.jsxs, Fragment: reactJsx.Fragment });
    return renderToStaticMarkup(await make());
  } finally {
    Object.assign(runtime, original);
  }
}

function visible(html: string): string {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ");
}

const stub = new FetchStub();
test.beforeEach(() => stub.reset());
test.afterEach(() => stub.uninstall());

test.describe("week 6 is the round robin", () => {
  test("a coach can plan week 6 like any Sunday", async () => {
    installWorld(stub, []);
    const preview = await previewDay({ group: "Green", week: 6, presentIds: REG_IDS });
    expect(preview.ok, preview.ok ? "" : preview.message).toBe(true);
    if (preview.ok) expect(preview.rounds.length).toBeGreaterThan(0);
  });

  test("saving week 6 writes week-6 league games dated Nov 8", async () => {
    const games: Page[] = [];
    installWorld(stub, games);
    const saved = await saveDay({ group: "Green", week: 6, presentIds: REG_IDS });
    expect(saved.ok, saved.ok ? "" : saved.message).toBe(true);
    const league = games.filter((p) => p.properties.Phase?.select?.name === "League");
    expect(league.length).toBeGreaterThan(0);
    for (const row of league) {
      expect(row.properties.Game.title[0].plain_text).toMatch(/^G-W6-R\d+-C\d+$/);
      expect(row.properties["Session Date"].date.start).toBe(FALL_PLAYOFF_DATE);
    }
  });

  test("a played week-6 game counts in the standings and shows in the parent results", async () => {
    installWorld(stub, [playedWeek6Game()]);
    const view = await resolveStandingsView("green", signStandingsLink("Green")!);
    expect(view).not.toBeNull();
    const rosalind = view!.standings.find((r) => r.name === "Rosalind")!;
    expect(rosalind.games).toBe(1);
    expect(rosalind.wins).toBe(1);
    const week6 = view!.weeks.find((w) => w.week === 6);
    expect(week6, "week 6 listed in the parent results").toBeDefined();
    expect(week6!.games.some((g) => g.status === "Played" && g.scoreA === 11 && g.scoreB === 5)).toBe(true);
  });
});

test.describe("Nov 8 is the Finale on every surface", () => {
  test("the parent standings page announces the finale, not a seeded playoff", async () => {
    installWorld(stub, [playedWeek6Game()]);
    const token = signStandingsLink("Green")!;
    const text = visible(await render(() => FallStandingsPage({ params: Promise.resolve({ group: "green", token }) })));
    expect(text.toLowerCase()).toContain("finale");
    expect(text).not.toMatch(OLD_FORMAT);
  });

  test("the weather pill names Nov 8 the Finale", async () => {
    // The real season: Sep 27 and Oct 11 washed out onto both rain dates.
    const washedOut = (date: string) => ({
      pageId: `call-${date}`,
      date,
      status: { Green: "Cancelled" as const, Yellow: "Cancelled" as const },
    });
    const calls = { status: "ok" as const, rows: [washedOut("2026-09-27"), washedOut("2026-10-11")], duplicates: [] };
    const text = visible(await render(() => FallWeatherStatus({ calls, todayIso: "2026-11-02" })));
    expect(text).toContain("Finale");
    expect(text).not.toMatch(OLD_FORMAT);
  });

  test("the week-6 curriculum copy says finale in both arcs and keeps the growth-only line", () => {
    for (const [arc, plan] of [["green", FALL_SEASON_PLAN], ["yellow", FALL_SEASON_PLAN_YELLOW]] as const) {
      const last = plan[plan.length - 1];
      for (const field of ["parentLine", "coachLooksFor", "wordFraming", "title"] as const) {
        expect(String(last[field]), `${arc} week 6 ${field}`).not.toMatch(OLD_FORMAT);
      }
      expect(last.parentLine.toLowerCase(), `${arc} week 6 parentLine`).toContain("finale");
      expect(last.parentLine.toLowerCase()).toMatch(/never against each other/);
    }
  });
});


test.describe("manual unscored lineups", () => {
  async function setup() {
    const pages: Page[] = [];
    installWorld(stub, pages);
    await saveDay({ group: "Green", week: 6, presentIds: REG_IDS, rounds: 1 });
    const snapshot = await loadLeagueSnapshot("Green");
    const games = snapshot.weeks.find(w => w.week === 6)!.games.filter(g => g.phase === "League").map(g => ({ key: g.key, round: g.round, court: g.court, format: g.format === "singles" ? "singles" as const : "doubles" as const, sideA: g.sideA, sideB: g.sideB }));
    return { pages, games };
  }
  test("saves a cross-court swap, verifies it, and leaves scores untouched", async () => {
    const { pages, games } = await setup();
    const edited = games.map(g => ({ ...g, sideA: [...g.sideA], sideB: [...g.sideB] }));
    [edited[0].sideA[0], edited[1].sideA[0]] = [edited[1].sideA[0], edited[0].sideA[0]];
    const before = stub.calls.length;
    expect(await editRoundLineup({ group: "Green", week: 6, round: 1, expected: games, games: edited })).toEqual({ ok: true, message: "Lineup saved" });
    const writes = stub.calls.slice(before).filter(c => c.method === "PATCH");
    expect(writes).toHaveLength(2);
    for (const call of writes) expect(Object.keys(JSON.parse(call.body).properties).sort()).toEqual(["Side A", "Side B"]);
    expect(pages.length).toBe(3);
  });
  test("rejects stale, duplicate, absent and scored edits without writes", async () => {
    const { pages, games } = await setup();
    const input = { group: "Green", week: 6, round: 1, expected: games, games };
    const before = stub.calls.length;
    expect((await editRoundLineup({ ...input, expected: [] })).ok).toBe(false);
    const duplicate = games.map(g => ({ ...g, sideA: [...g.sideA] }));
    duplicate[0].sideA[0] = duplicate[1].sideA[0];
    expect((await editRoundLineup({ ...input, games: duplicate })).ok).toBe(false);
    duplicate[0].sideA[0] = "absent";
    expect((await editRoundLineup({ ...input, games: duplicate })).ok).toBe(false);
    const gamePage = pages.find(p => p.properties.Phase?.select?.name === "League")!;
    Object.assign(gamePage.properties, toPageProps(buildScoreProps(11, 5, false)));
    expect((await editRoundLineup(input)).ok).toBe(false);
    expect(stub.calls.slice(before).filter(c => c.method === "PATCH")).toHaveLength(0);
  });
  test("locked final rejects lineup edits", async () => {
    const { pages, games } = await setup();
    for (const seed of [1, 2]) pages.push({ id: `team-${seed}`, properties: toPageProps(buildTeamRowProps({ group: "Green", week: 6, sessionDate: FALL_PLAYOFF_DATE, seed, members: REG_IDS.slice((seed - 1) * 2, seed * 2) })) });
    const before = stub.calls.length;
    const result = await editRoundLineup({ group: "Green", week: 6, round: 1, expected: games, games });
    expect(result.ok).toBe(false);
    expect(result.message).toContain("locked");
    expect(stub.calls.slice(before).filter(c => c.method === "PATCH")).toHaveLength(0);
  });

});
