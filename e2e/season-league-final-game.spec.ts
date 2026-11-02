import { test, expect } from "@playwright/test";
import { FetchStub, type RecordedFetch } from "./fixtures/fetch-stub";

// Env BEFORE import, as in the egress invariant.
process.env.NOTION_API_KEY = "ntn_test_final";
process.env.NOTION_SEASON_LEAGUE_DB_ID = "final-games-db";
process.env.NOTION_FALL_REGS_DB_ID = "final-regs-db";
process.env.STANDINGS_LINK_SECRET = "final-standings-secret";

import {
  lockFinal,
  previewFinal,
  recordPlayoffScore,
  resolveStandingsView,
  unlockFinal,
} from "../src/lib/season-league-view";
import { buildDayRowProps, buildGameRowProps, buildScoreProps } from "../src/lib/notion-season-league";
import { signStandingsLink } from "../src/lib/standings-link-token";
import { FALL_PLAYOFF_DATE } from "../src/data/fall-2026";

// The Finale's one game (Sam, 2026-11-02): after the week-6 round robin, the
// top four kids CHECKED IN that day play #1 & #4 vs #2 & #3 for 1st and 2nd.
// These tests drive the real lock and score paths against an in-memory Notion:
// candidates come from the week-6 check-in (the round robin's Day row, which
// the lock never rewrites), a dead-even tie at #4/#5 blocks the lock until the
// coach picks who plays, and one score decides it — no bracket, no reset.
//   npx playwright test --config=playwright.pure.config.ts e2e/season-league-final-game.spec.ts
//
// Mutation checks: pair the top four with halvesTeams → the 1+4 v 2+3 pins
// fail; drop the tie guard → the tie test fails; let lockFinal write the Day
// row → the "leaves the check-in alone" pin fails.

const KIDS = ["Rosalind", "Jasper", "Wren", "Theo", "Mira", "Ash", "Juno", "Pax"];
const R = KIDS.map((_, i) => `reg-${i + 1}`); // R[0] = r1 … R[7] = r8

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Page = { id: string; properties: Record<string, any> };

function regRow(i: number) {
  return {
    id: R[i],
    properties: {
      "Child First Name": { rich_text: [{ plain_text: KIDS[i] }] },
      Group: { select: { name: "Green" } },
      Status: { select: { name: "Confirmed" } },
    },
  };
}

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

let seq = 0;
/** A singles game already played in an earlier week: winner `a` beats `b`. */
function played(week: number, round: number, court: number, a: number, b: number, scoreA: number, scoreB: number): Page {
  const props = {
    ...buildGameRowProps({
      group: "Green",
      week,
      sessionDate: "2026-10-04",
      round,
      court,
      format: "singles",
      sideA: [R[a - 1]],
      sideB: [R[b - 1]],
    }),
    ...buildScoreProps(scoreA, scoreB, false),
  };
  return { id: `seed-${++seq}`, properties: toPageProps(props) };
}

/** Week-6 check-in: the round robin's Day row. */
function checkIn(kids: number[]): Page {
  const props = buildDayRowProps({
    group: "Green",
    week: 6,
    sessionDate: FALL_PLAYOFF_DATE,
    present: kids.map((k) => R[k - 1]),
    attempt: 1,
    rounds: 3,
  });
  return { id: "w6-day", properties: toPageProps(props) };
}

/** An unscored week-6 round-robin game. */
function scheduledWeek6(): Page {
  const props = buildGameRowProps({
    group: "Green",
    week: 6,
    sessionDate: FALL_PLAYOFF_DATE,
    round: 2,
    court: 1,
    format: "doubles",
    sideA: [R[0], R[1]],
    sideB: [R[2], R[3]],
  });
  return { id: "w6-sched", properties: toPageProps(props) };
}

/** Standings r1 > r2 > r3 > r4 > r8 > r7 > r6 > r5, no ties anywhere. */
function seasonGames(): Page[] {
  return [
    played(1, 1, 1, 1, 5, 11, 0),
    played(1, 1, 2, 1, 6, 11, 0),
    played(1, 2, 1, 2, 7, 11, 1),
    played(1, 2, 2, 2, 8, 11, 2),
    played(2, 1, 1, 3, 5, 11, 2),
    played(2, 1, 2, 4, 6, 11, 3),
  ];
}

/** r1 > r2 > r3, then r4 (Theo) and r8 (Pax) dead even on every numeric key. */
function tiedAtTheCut(): Page[] {
  return [
    played(1, 1, 1, 1, 5, 11, 0),
    played(1, 1, 2, 1, 6, 11, 0),
    played(1, 2, 1, 2, 5, 11, 1),
    played(1, 2, 2, 2, 6, 11, 1),
    played(2, 1, 1, 3, 7, 11, 2),
    played(2, 1, 2, 4, 6, 11, 3),
    played(2, 2, 1, 8, 7, 11, 3),
  ];
}

function installWorld(stub: FetchStub, games: Page[], opts: { failGamesQuery?: boolean } = {}) {
  let next = 0;
  stub
    .on("databases/final-regs-db/query", { results: KIDS.map((_, i) => regRow(i)), has_more: false, next_cursor: null })
    .onDynamic("databases/final-games-db/query", (call: RecordedFetch) => {
      if (opts.failGamesQuery) return { status: 500, json: { message: "boom" } };
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
      const id = `new-${++next}`;
      games.push({ id, properties: toPageProps(JSON.parse(call.body).properties) });
      return { status: 200, json: { id } };
    })
    .install();
}

function writes(stub: FetchStub): RecordedFetch[] {
  return stub.calls.filter(
    (c) => c.url.includes("api.notion.com") && (c.method === "PATCH" || (c.method === "POST" && !c.url.includes("/query"))),
  );
}

function liveTeams(games: Page[]): Array<{ key: string; members: string[] }> {
  return games
    .filter((p) => p.properties.Phase?.select?.name === "Team" && p.properties.Status?.select?.name !== "Void")
    .map((p) => ({
      key: p.properties.Game.title[0].plain_text as string,
      members: (p.properties["Side A"].relation as Array<{ id: string }>).map((r) => r.id),
    }))
    .sort((a, b) => a.key.localeCompare(b.key));
}

const stub = new FetchStub();
test.beforeEach(() => stub.reset());
test.afterEach(() => stub.uninstall());

test.describe("the final — who plays", () => {
  test("locks #1 & #4 vs #2 & #3 from the round-robin check-in and leaves the check-in alone", async () => {
    const day = checkIn([1, 2, 3, 4, 5, 6, 7, 8]);
    const games = [...seasonGames(), day];
    const before = JSON.stringify(day.properties);
    installWorld(stub, games);

    const lock = await lockFinal({ group: "Green" });
    expect(lock.ok, lock.message).toBe(true);
    expect(liveTeams(games)).toEqual([
      { key: "G-W6-T1", members: [R[0], R[3]] },
      { key: "G-W6-T2", members: [R[1], R[2]] },
    ]);
    expect(JSON.stringify(day.properties)).toBe(before);
    expect(writes(stub).some((w) => w.url.includes("w6-day"))).toBe(false);
  });

  test("a top-four kid who isn't checked in is passed over — the next kid moves up", async () => {
    installWorld(stub, [...seasonGames(), checkIn([1, 2, 4, 5, 6, 7, 8])]);
    const preview = await previewFinal({ group: "Green" });
    expect(preview.ok, preview.ok ? "" : preview.message).toBe(true);
    if (!preview.ok) return;
    expect(preview.teams.map((t) => t.members)).toEqual([
      [R[0], R[7]],
      [R[1], R[3]],
    ]);
  });

  test("fewer than four checked in is refused, and so is a final before anyone is checked in", async () => {
    installWorld(stub, [...seasonGames(), checkIn([1, 2, 3])]);
    const few = await previewFinal({ group: "Green" });
    expect(few.ok).toBe(false);
    if (!few.ok) expect(few.message).toMatch(/four/i);

    stub.reset();
    installWorld(stub, seasonGames());
    const none = await previewFinal({ group: "Green" });
    expect(none.ok).toBe(false);
    if (!none.ok) expect(none.message).toMatch(/check in/i);
  });

  test("a dead-even tie at #4/#5 blocks the lock until the coach picks who plays", async () => {
    const games = [...tiedAtTheCut(), checkIn([1, 2, 3, 4, 5, 6, 7, 8])];
    installWorld(stub, games);

    const preview = await previewFinal({ group: "Green" });
    expect(preview.ok).toBe(false);
    if (preview.ok) return;
    expect(preview.tie?.spots).toBe(1);
    expect(preview.tie?.kids.map((k) => k.name).sort()).toEqual(["Pax", "Theo"]);

    const blocked = await lockFinal({ group: "Green" });
    expect(blocked.ok).toBe(false);
    expect(writes(stub)).toHaveLength(0);

    const wrongPick = await lockFinal({ group: "Green", chosen: [R[0]] });
    expect(wrongPick.ok).toBe(false);
    expect(writes(stub)).toHaveLength(0);

    const picked = await lockFinal({ group: "Green", chosen: [R[3]] });
    expect(picked.ok, picked.message).toBe(true);
    expect(liveTeams(games)).toEqual([
      { key: "G-W6-T1", members: [R[0], R[3]] },
      { key: "G-W6-T2", members: [R[1], R[2]] },
    ]);
  });

  test("the preview warns while round-robin games are still unscored", async () => {
    installWorld(stub, [...seasonGames(), checkIn([1, 2, 3, 4, 5, 6, 7, 8]), scheduledWeek6()]);
    const open = await previewFinal({ group: "Green" });
    expect(open.ok).toBe(true);
    if (open.ok) expect(open.warning).toMatch(/unscored/i);

    stub.reset();
    installWorld(stub, [...seasonGames(), checkIn([1, 2, 3, 4, 5, 6, 7, 8])]);
    const done = await previewFinal({ group: "Green" });
    expect(done.ok).toBe(true);
    if (done.ok) expect(done.warning).toBeNull();
  });

  test("a failed read writes nothing", async () => {
    installWorld(stub, [], { failGamesQuery: true });
    expect((await previewFinal({ group: "Green" })).ok).toBe(false);
    expect((await lockFinal({ group: "Green" })).ok).toBe(false);
    expect(writes(stub)).toHaveLength(0);
  });
});

test.describe("the final — one game decides 1st and 2nd", () => {
  test("one score decides it; the parent view names both pairs and marks a clock-ended game", async () => {
    const games = [...seasonGames(), checkIn([1, 2, 3, 4, 5, 6, 7, 8])];
    installWorld(stub, games);
    expect((await lockFinal({ group: "Green" })).ok).toBe(true);

    const score = await recordPlayoffScore({ group: "Green", slot: "final", scoreA: 7, scoreB: 5, timed: true });
    expect(score.ok, score.message).toBe(true);

    const view = await resolveStandingsView("green", signStandingsLink("Green")!);
    expect(view?.playoff).toBeTruthy();
    const final = view!.playoff!;
    expect(final.games).toHaveLength(1);
    expect(final.games[0]).toMatchObject({ scoreA: 7, scoreB: 5, timed: true, status: "played" });
    expect(final.champion).toContain("Rosalind");
    expect(final.champion).toContain("Theo");
    expect(final.runnerUp).toContain("Jasper");
    expect(final.runnerUp).toContain("Wren");
  });

  test("old bracket slots are refused, and a scored final freezes the teams", async () => {
    installWorld(stub, [...seasonGames(), checkIn([1, 2, 3, 4, 5, 6, 7, 8])]);
    expect((await lockFinal({ group: "Green" })).ok).toBe(true);
    expect((await recordPlayoffScore({ group: "Green", slot: "w1m1", scoreA: 11, scoreB: 7 })).ok).toBe(false);
    expect((await recordPlayoffScore({ group: "Green", slot: "gf", scoreA: 11, scoreB: 7 })).ok).toBe(false);

    expect((await recordPlayoffScore({ group: "Green", slot: "final", scoreA: 11, scoreB: 7 })).ok).toBe(true);
    expect((await lockFinal({ group: "Green" })).ok).toBe(false);
    expect((await unlockFinal({ group: "Green" })).ok).toBe(false);
  });

  test("the final's length is checked against the length the coach picked", async () => {
    installWorld(stub, [...seasonGames(), checkIn([1, 2, 3, 4, 5, 6, 7, 8])]);
    expect((await lockFinal({ group: "Green" })).ok).toBe(true);
    expect((await recordPlayoffScore({ group: "Green", slot: "final", scoreA: 6, scoreB: 6, timed: true })).ok).toBe(false);
    expect((await recordPlayoffScore({ group: "Green", slot: "final", scoreA: 15, scoreB: 9, target: 11 })).ok).toBe(false);
    expect((await recordPlayoffScore({ group: "Green", slot: "final", scoreA: 15, scoreB: 9, target: 15 })).ok).toBe(true);
  });

  test("unlocking before the final is scored clears the teams so the coach can lock again", async () => {
    const games = [...seasonGames(), checkIn([1, 2, 3, 4, 5, 6, 7, 8])];
    installWorld(stub, games);
    expect((await lockFinal({ group: "Green" })).ok).toBe(true);
    expect((await unlockFinal({ group: "Green" })).ok).toBe(true);
    expect(liveTeams(games)).toEqual([]);
    expect((await lockFinal({ group: "Green" })).ok).toBe(true);
    expect(liveTeams(games)).toHaveLength(2);
  });
});
