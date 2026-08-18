import { test, expect } from "@playwright/test";
import { existsSync } from "node:fs";
import { FetchStub } from "./fixtures/fetch-stub";
import { fetchCrewInterestDemand } from "../src/lib/notion-crew-interest";
import { fetchFallInterestDemand } from "../src/lib/notion-fall-interest";
import { fetchSessionsInRange } from "../src/lib/notion-sessions";

/**
 * THE /coach/calendar egress invariant.
 *
 * The calendar counts families; it never names them. That promise is kept by a
 * PROJECTION — the three read helpers below pull a narrow slice of each Notion
 * row and drop everything else — and a projection is one line away from being
 * widened ("add Parent Email so the coach can mail them"). These tests make
 * that widening fail loudly.
 *
 * Method: stub Notion with rows whose name/contact properties carry sentinel
 * values, then assert the sentinels appear NOWHERE in the returned data.
 * FetchStub.install() throws on any unstubbed fetch, so a new egress added to
 * these paths fails here too rather than silently reaching the network.
 */

const NOTION = "api.notion.com";

const CHILD_NAME = "Calendarkid ZZ9";
const PARENT_NAME = "Calendarparent QX7";
const PARENT_EMAIL = "calendar-sentinel@example.invalid";
const PARENT_PHONE = "3015550199";
const NOTES = "Sentinel free text VV4";
const ROSTER_NAME = "Rosterkid WW2";

const SENTINELS = [
  CHILD_NAME,
  PARENT_NAME,
  PARENT_EMAIL,
  PARENT_PHONE,
  NOTES,
  ROSTER_NAME,
];

function richText(s: string) {
  return { rich_text: [{ plain_text: s }] };
}

function crewPage(over: Record<string, unknown> = {}) {
  return {
    id: "crew-1",
    created_time: "2026-08-01T00:00:00.000Z",
    properties: {
      "Parent Name": { title: [{ plain_text: PARENT_NAME }] },
      "Parent Email": { email: PARENT_EMAIL },
      "Parent Phone": { phone_number: PARENT_PHONE },
      "Child First Name": richText(CHILD_NAME),
      "Child Birth Year": { number: 2015 },
      "Child Level": { select: { name: "Green" } },
      "Skill Sub-Level": { select: { name: "Mid" } },
      "Preferred Days": { multi_select: [{ name: "Tue" }, { name: "Thu" }] },
      "Preferred Time": richText("after 5"),
      "Preferred Location": richText("Olney"),
      Notes: richText(NOTES),
      Status: { select: { name: "New" } },
      ...over,
    },
  };
}

function fallPage(over: Record<string, unknown> = {}) {
  return {
    id: "fall-1",
    properties: {
      Name: { title: [{ plain_text: PARENT_NAME }] },
      Email: { email: PARENT_EMAIL },
      Phone: { phone_number: PARENT_PHONE },
      Track: { multi_select: [{ name: "youth" }] },
      "Child First Name": richText(CHILD_NAME),
      "Child Birth Year": { number: 2014 },
      "Child Level": { select: { name: "Yellow" } },
      Days: { multi_select: [{ name: "Sunday" }] },
      "Sub List": { checkbox: true },
      Notes: richText(NOTES),
      ...over,
    },
  };
}

function sessionPage() {
  return {
    id: "sess-1",
    properties: {
      Session: { title: [{ plain_text: "Earle B. Wood MS — Early" }] },
      Date: { date: { start: "2026-09-05" } },
      "Start time": richText("6:00 PM"),
      "End time": richText("7:00 PM"),
      Level: { select: { name: "Green" } },
      Location: richText("Earle B. Wood MS"),
      "Public Area": richText("Rockville, MD"),
      "Court count": { number: 1 },
      "Registered count": { number: 3 },
      Status: { select: { name: "Open" } },
      Roster: richText(ROSTER_NAME),
    },
  };
}

function page(results: unknown[], hasMore = false, cursor: string | null = null) {
  return { results, has_more: hasMore, next_cursor: cursor };
}

const stub = new FetchStub();
const savedEnv: Record<string, string | undefined> = {};

function setEnv(vars: Record<string, string | undefined>) {
  for (const [k, v] of Object.entries(vars)) {
    if (!(k in savedEnv)) savedEnv[k] = process.env[k];
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
}

test.beforeEach(() => {
  stub.reset();
  stub.install();
  setEnv({
    NOTION_API_KEY: "secret_test",
    NOTION_CREW_INTEREST_DB_ID: "crew-db",
    NOTION_FALL_INTEREST_DB_ID: "fall-db",
    NOTION_SESSIONS_DB_ID: "sessions-db",
  });
});

test.afterEach(() => {
  stub.uninstall();
  for (const [k, v] of Object.entries(savedEnv)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
});

test.describe("no name or contact field survives the projection", () => {
  test("crew interest demand carries counts only", async () => {
    stub.on(NOTION, page([crewPage()]));
    const result = await fetchCrewInterestDemand();

    expect(result.ok).toBe(true);
    expect(result.rows).toHaveLength(1);
    const serialized = JSON.stringify(result);
    for (const sentinel of SENTINELS) {
      expect(serialized).not.toContain(sentinel);
    }
    // Shape lock: adding a field to the projection fails here even if its
    // value happens not to match a sentinel.
    expect(Object.keys(result.rows[0]).sort()).toEqual([
      "childBirthYear",
      "childLevel",
      "preferredArea",
      "preferredDays",
    ]);
  });

  test("fall interest demand carries counts only", async () => {
    stub.on(NOTION, page([fallPage()]));
    const result = await fetchFallInterestDemand();

    expect(result.ok).toBe(true);
    expect(result.rows).toHaveLength(1);
    const serialized = JSON.stringify(result);
    for (const sentinel of SENTINELS) {
      expect(serialized).not.toContain(sentinel);
    }
    expect(Object.keys(result.rows[0]).sort()).toEqual([
      "childBirthYear",
      "childLevel",
      "days",
      "subListInterest",
    ]);
  });

  test("the session range read never loads a roster or age stats", async () => {
    stub.on(NOTION, page([sessionPage()]));
    const result = await fetchSessionsInRange("2026-09-01", "2026-09-30");

    expect(result.ok).toBe(true);
    expect(JSON.stringify(result)).not.toContain(ROSTER_NAME);
    expect(Object.keys(result.rows[0])).not.toContain("roster");
    expect(Object.keys(result.rows[0])).not.toContain("ageStats");
    // fetchUpcomingSessions runs a second drop-in query to build the roster.
    // This read must NOT — one query, and it goes to the sessions DB.
    expect(stub.callsTo(NOTION)).toHaveLength(1);
    expect(stub.calls[0].url).toContain("sessions-db");
  });
});

test.describe("egress boundary", () => {
  test("nothing but Notion is contacted", async () => {
    stub.on(NOTION, page([crewPage()]));
    await fetchCrewInterestDemand();
    await fetchFallInterestDemand();
    expect(stub.calls).toHaveLength(2);
    for (const call of stub.calls) {
      expect(new URL(call.url).hostname).toBe(NOTION);
    }
  });

  test("an unconfigured DB makes zero network calls and reports not-ok", async () => {
    setEnv({
      NOTION_CREW_INTEREST_DB_ID: undefined,
      NOTION_FALL_INTEREST_DB_ID: undefined,
      NOTION_SESSIONS_DB_ID: undefined,
    });

    const crew = await fetchCrewInterestDemand();
    const fall = await fetchFallInterestDemand();
    const sessions = await fetchSessionsInRange("2026-09-01", "2026-09-30");

    expect(stub.calls).toHaveLength(0);
    // ok:false, NOT an empty success — "unavailable" must not render as "zero
    // demand" or "no sessions".
    for (const r of [crew, fall, sessions]) {
      expect(r.ok).toBe(false);
      expect(r.rows).toHaveLength(0);
    }
  });

  test("a failed query reports not-ok rather than an empty success", async () => {
    stub.on(NOTION, { object: "error", message: "boom" }, 500);
    const crew = await fetchCrewInterestDemand();
    const fall = await fetchFallInterestDemand();
    const sessions = await fetchSessionsInRange("2026-09-01", "2026-09-30");
    for (const r of [crew, fall, sessions]) {
      expect(r.ok).toBe(false);
    }
  });
});

test.describe("pagination is real, and a cap is never silent", () => {
  test("follows the cursor to the end of the table", async () => {
    let call = 0;
    stub.onDynamic(NOTION, () => {
      call++;
      return {
        status: 200,
        json:
          call === 1
            ? page([crewPage()], true, "cursor-2")
            : page([crewPage()], false, null),
      };
    });

    const result = await fetchCrewInterestDemand();
    expect(result.rows).toHaveLength(2);
    expect(result.truncated).toBe(false);
    expect(stub.calls[1].body).toContain("cursor-2");
  });

  test("hitting the page cap sets truncated instead of quietly stopping", async () => {
    stub.on(NOTION, page([crewPage()], true, "cursor-next"));
    const result = await fetchCrewInterestDemand();
    expect(result.ok).toBe(true);
    expect(result.truncated).toBe(true);
    expect(result.rows.length).toBeGreaterThan(1);
  });
});

test("the page sits under the coach auth gate", () => {
  // Auth is positional: (authed)/layout.tsx calls requireCoach() for every
  // page in the group, so the calendar must live inside it. A move to
  // src/app/coach/calendar/ would silently make it public.
  expect(existsSync("src/app/coach/(authed)/calendar/page.tsx")).toBe(true);
  expect(existsSync("src/app/coach/calendar/page.tsx")).toBe(false);
});
