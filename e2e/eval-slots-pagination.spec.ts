import { test, expect } from "@playwright/test";
import { FetchStub, type RecordedFetch } from "./fixtures/fetch-stub";

// Env BEFORE importing the lib — fetchOpenEvalSlots reads these at call time.
process.env.NOTION_API_KEY = "ntn_test";
process.env.NOTION_EVAL_SLOTS_DB_ID = "eval-slots-db";

import {
  fetchOpenEvalSlots,
  OPEN_SLOTS_MAX_PAGES,
  OPEN_SLOTS_MAX_ROWS,
} from "../src/lib/notion-eval-slots";

// Display-cap bug (public /free-evaluation/book picker): fetchOpenEvalSlots
// queried Notion with page_size:100 and NO pagination loop, so only the
// soonest 100 Open future slots ever surfaced. Sam loaded 180 — the last 80
// were invisible until earlier ones cleared. These specs pin the fix: follow
// has_more/next_cursor until exhausted (or a logged safety ceiling), preserve
// the ascending-by-date sort, and keep the ≤100 case byte-identical to before.

const SLOTS_QUERY = "/databases/eval-slots-db/query";

// A far-future Open slot row, ascending as `i` grows: day advances every 10
// rows, hour advances within a day (all components stay valid — day 1..18,
// hour 08..17). id encodes the index so union + order are checkable.
function slotRow(i: number) {
  const day = String(Math.floor(i / 10) + 1).padStart(2, "0");
  const hour = String(8 + (i % 10)).padStart(2, "0");
  return {
    id: `slot-${i}`,
    object: "page",
    archived: false,
    in_trash: false,
    parent: { type: "database_id", database_id: "eval-slots-db" },
    properties: {
      Status: { select: { name: "Open" } },
      Date: {
        date: { start: `2036-08-${day}T${hour}:00:00.000-04:00` },
      },
      Location: { select: { name: "Cabin John MS" } },
    },
  };
}

function rows(from: number, count: number) {
  return Array.from({ length: count }, (_, k) => slotRow(from + k));
}

const stub = new FetchStub();

test.beforeEach(() => {
  stub.reset();
  stub.install();
});
test.afterEach(() => stub.uninstall());

test.describe("fetchOpenEvalSlots — pagination (display-cap fix)", () => {
  test("follows next_cursor across TWO pages → returns the UNION (100 + 80 = 180) in ascending order, cursor passed through", async () => {
    // Page 1: 100 rows, has_more. Page 2: the remaining 80, done.
    stub.onDynamic(SLOTS_QUERY, (call: RecordedFetch) => {
      const body = JSON.parse(call.body) as { start_cursor?: string };
      if (body.start_cursor === "cursor-2") {
        return {
          status: 200,
          json: { results: rows(100, 80), has_more: false, next_cursor: null },
        };
      }
      return {
        status: 200,
        json: { results: rows(0, 100), has_more: true, next_cursor: "cursor-2" },
      };
    });

    const { slots, error } = await fetchOpenEvalSlots();

    expect(error).toBe(false);
    // The whole backlog surfaces, not just the soonest 100.
    expect(slots.length).toBe(180);
    // Union preserved in order: slot-0 … slot-179.
    expect(slots.map((s) => s.id)).toEqual(
      Array.from({ length: 180 }, (_, k) => `slot-${k}`),
    );
    // Ascending by date (the sort the picker relies on) held across the join.
    for (let k = 1; k < slots.length; k++) {
      expect(slots[k - 1].date <= slots[k].date, `date order at ${k}`).toBe(true);
    }

    // Exactly two queries; the SECOND carries the first page's cursor, the
    // first carries none (the pass-through the fix depends on).
    const calls = stub.callsTo(SLOTS_QUERY);
    expect(calls.length).toBe(2);
    expect(calls[0].body).not.toContain("start_cursor");
    expect(calls[1].body).toContain('"start_cursor":"cursor-2"');
  });

  test("≤100 open slots (single page, has_more:false) → same result + single query as before", async () => {
    stub.on(SLOTS_QUERY, {
      results: rows(0, 42),
      has_more: false,
      next_cursor: null,
    });

    const { slots, error } = await fetchOpenEvalSlots();

    expect(error).toBe(false);
    expect(slots.length).toBe(42);
    const calls = stub.callsTo(SLOTS_QUERY);
    expect(calls.length).toBe(1);
    expect(calls[0].body).not.toContain("start_cursor");
  });

  test("safety ceiling: a runaway has_more stops at OPEN_SLOTS_MAX_PAGES and logs (no silent cap, no infinite loop)", async () => {
    // Every page claims more — without a ceiling this loops forever.
    stub.onDynamic(SLOTS_QUERY, () => ({
      status: 200,
      json: { results: rows(0, 100), has_more: true, next_cursor: "more" },
    }));

    const warnings: string[] = [];
    const origWarn = console.warn;
    console.warn = (...args: unknown[]) => {
      warnings.push(args.map(String).join(" "));
    };
    try {
      const { slots, error } = await fetchOpenEvalSlots();
      expect(error).toBe(false);
      // Bounded by BOTH ceilings; pages never exceed the page cap.
      expect(stub.callsTo(SLOTS_QUERY).length).toBe(OPEN_SLOTS_MAX_PAGES);
      expect(slots.length).toBeLessThanOrEqual(OPEN_SLOTS_MAX_ROWS);
    } finally {
      console.warn = origWarn;
    }
    expect(
      warnings.some((w) => w.includes("[eval-slots]") && w.includes("ceiling")),
      "the ceiling hit is logged, never silent",
    ).toBe(true);
  });

  test("F1: a LATER page failing → keep page 1's slots, error:FALSE, and warn (partial success beats a false empty state)", async () => {
    // Page 1 succeeds with the soonest 100; page 2 500s. The soonest slots are
    // the ones parents actually book — showing them beats blanking the picker.
    let page = 0;
    stub.onDynamic(SLOTS_QUERY, () => {
      page++;
      if (page === 1) {
        return {
          status: 200,
          json: { results: rows(0, 100), has_more: true, next_cursor: "cursor-2" },
        };
      }
      return { status: 500, json: { object: "error" } };
    });

    const warnings: string[] = [];
    const origWarn = console.warn;
    console.warn = (...args: unknown[]) => warnings.push(args.map(String).join(" "));
    let result: Awaited<ReturnType<typeof fetchOpenEvalSlots>>;
    try {
      result = await fetchOpenEvalSlots();
    } finally {
      console.warn = origWarn;
    }

    expect(result.error, "a later-page failure is NOT a total outage").toBe(false);
    expect(result.slots.length, "page 1's soonest slots survive").toBe(100);
    expect(result.slots.map((s) => s.id)).toEqual(
      Array.from({ length: 100 }, (_, k) => `slot-${k}`),
    );
    expect(
      warnings.some((w) => w.includes("[eval-slots]") && w.includes("later page")),
      "the kept-partial is logged, never silent",
    ).toBe(true);
  });

  test("F1: the FIRST page failing → { slots: [], error: true } (total-outage GET-503/retry contract preserved)", async () => {
    stub.on(SLOTS_QUERY, { object: "error" }, 500);
    const { slots, error } = await fetchOpenEvalSlots();
    expect(error).toBe(true);
    expect(slots).toEqual([]);
  });

  test("F2: has_more:true but null/empty next_cursor → stop, KEEP the partial, error:false, and warn (no silent truncation)", async () => {
    // Abnormal Notion response: claims more rows but hands back no cursor. The
    // old code would exit normally with a silently-truncated list and no log.
    stub.on(SLOTS_QUERY, {
      results: rows(0, 100),
      has_more: true,
      next_cursor: null,
    });

    const warnings: string[] = [];
    const origWarn = console.warn;
    console.warn = (...args: unknown[]) => warnings.push(args.map(String).join(" "));
    let result: Awaited<ReturnType<typeof fetchOpenEvalSlots>>;
    try {
      result = await fetchOpenEvalSlots();
    } finally {
      console.warn = origWarn;
    }

    expect(result.error).toBe(false);
    expect(result.slots.length, "the fetched page is kept").toBe(100);
    // Exactly ONE query — it must NOT loop with an empty cursor.
    expect(stub.callsTo(SLOTS_QUERY).length).toBe(1);
    expect(
      warnings.some(
        (w) => w.includes("[eval-slots]") && w.includes("no next_cursor"),
      ),
      "the abnormal truncation is logged, never silent",
    ).toBe(true);
  });
});
