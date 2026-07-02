import { test, expect } from "@playwright/test";

// Pure specs for the Coach Inbox (Phase 1b) — the four queue fetchers' query
// builders, the decision→Notion-status maps (vocabulary pins: the inbox may
// only write status values that already exist in each DB's documented union),
// the pending-count badge math, and the draft-body approvability gate.
//
// Written RED-FIRST: every import below fails until the helpers exist.

import {
  inboxPendingCount,
  filterCrewInboxRows,
  isDraftWithinShipWindow,
  NEWS_DECISION_TO_STATUS,
  DRAFT_DECISION_TO_STATUS,
  CREW_DECISION_TO_STATUS,
  type InboxQueues,
} from "../src/lib/coach-inbox";
import { buildNewNewsQuery } from "../src/lib/notion-news";
import {
  blocksToHtml,
  blocksToText,
  buildPendingDraftsQueryFilter,
  isDraftBodyApprovable,
} from "../src/lib/notion-newsletter-drafts";
import { buildCommitsStatusFilter } from "../src/lib/notion-crew-commits";
import type { ActionableCrewInterest } from "../src/lib/notion-crew-interest";

function crewRow(
  overrides: Partial<ActionableCrewInterest>,
): ActionableCrewInterest {
  return {
    id: "row-1",
    parentName: "Pat Parent",
    parentEmail: "pat@example.com",
    parentPhone: "",
    childFirstName: "Sky",
    childBirthYear: 2015,
    childLevel: "Green",
    childSubLevel: null,
    preferredDays: ["Tue"],
    preferredTime: "evenings",
    preferredArea: "Rockville",
    status: "New",
    createdTime: "2026-06-30T12:00:00.000Z",
    nudgeSent: false,
    reengagementSent: false,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Decision → status maps. NEVER invent status values: each target must be a
// value already present in the lib's union / documented vocabulary.
//   news:   NewsStatus = "New" | "Approved" | "Used" | "Rejected"
//   drafts: Pending | Approved | Skip (lib doc + CLAUDE.md drafter pipeline)
//   crew:   Status select — actionable New/Reviewed, terminal Polled/Closed…
// ---------------------------------------------------------------------------
test.describe("inbox decision maps pin the existing Notion status vocabulary", () => {
  test("news: approve→Approved, reject→Rejected — and nothing else", () => {
    expect(NEWS_DECISION_TO_STATUS).toEqual({
      approve: "Approved",
      reject: "Rejected",
    });
  });

  test("drafts: approve→Approved, skip→Skip — no auto-approve alias, no Used", () => {
    expect(DRAFT_DECISION_TO_STATUS).toEqual({
      approve: "Approved",
      skip: "Skip",
    });
  });

  test("crew: reviewed→Reviewed, closed→Closed — Polled stays Sam-only (poll creation is never an inbox tap)", () => {
    expect(CREW_DECISION_TO_STATUS).toEqual({
      reviewed: "Reviewed",
      closed: "Closed",
    });
    expect(Object.values(CREW_DECISION_TO_STATUS)).not.toContain("Polled");
  });
});

// ---------------------------------------------------------------------------
// Queue fetcher query builders (pure, following the buildDraftsQueryFilter
// precedent) — pin the Status filter each fetcher sends to Notion.
// ---------------------------------------------------------------------------
test.describe("queue fetcher query builders", () => {
  test("news triage queue queries Status=New, newest discovered first", () => {
    const q = buildNewNewsQuery(20);
    expect(q.filter).toEqual({
      property: "Status",
      select: { equals: "New" },
    });
    expect(q.page_size).toBe(20);
    expect(q.sorts).toEqual([
      { property: "Discovered At", direction: "descending" },
    ]);
  });

  test("news query clamps a nonsense limit to at least 1", () => {
    expect(buildNewNewsQuery(0).page_size).toBe(1);
    expect(buildNewNewsQuery(-5).page_size).toBe(1);
  });

  test("newsletter queue queries Status=Pending only", () => {
    expect(buildPendingDraftsQueryFilter()).toEqual({
      property: "Status",
      select: { equals: "Pending" },
    });
  });

  test("CardFailed queue queries exactly the CardFailed status from the CommitStatus union", () => {
    expect(buildCommitsStatusFilter("CardFailed")).toEqual({
      property: "Status",
      select: { equals: "CardFailed" },
    });
    // The Active fetcher shares the same builder — refactor safety.
    expect(buildCommitsStatusFilter("Active")).toEqual({
      property: "Status",
      select: { equals: "Active" },
    });
  });

  test("crew inbox queue keeps only Status=New rows (Reviewed rows are already decided)", () => {
    const rows = [
      crewRow({ id: "a", status: "New" }),
      crewRow({ id: "b", status: "Reviewed" }),
      crewRow({ id: "c", status: "New" }),
    ];
    expect(filterCrewInboxRows(rows).map((r) => r.id)).toEqual(["a", "c"]);
    expect(filterCrewInboxRows([])).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Pending-count badge math
// ---------------------------------------------------------------------------
test.describe("inboxPendingCount", () => {
  const empty: InboxQueues = { news: [], drafts: [], crew: [], cardFailed: [] };

  test("zero on all-empty queues", () => {
    expect(inboxPendingCount(empty)).toBe(0);
  });

  test("sums all four queues", () => {
    const queues = {
      news: [{}, {}] ,
      drafts: [{}],
      crew: [{}, {}, {}],
      cardFailed: [{}],
    } as unknown as InboxQueues;
    expect(inboxPendingCount(queues)).toBe(7);
  });
});

// ---------------------------------------------------------------------------
// Draft body rendering + approvability. blocksToHtml / blocksToText are the
// EXISTING internal renderers, exported (not rewritten) so the inbox displays
// exactly what the Thursday cron would ship.
// ---------------------------------------------------------------------------
test.describe("draft body render + approve gate", () => {
  const paragraph = (text: string) => ({
    type: "paragraph",
    paragraph: { rich_text: [{ plain_text: text }] },
  });

  test("blocksToHtml renders a paragraph and a bulleted list", () => {
    const html = blocksToHtml([
      paragraph("Hi parents"),
      {
        type: "bulleted_list_item",
        bulleted_list_item: { rich_text: [{ plain_text: "First item" }] },
      },
    ]);
    expect(html).toContain("Hi parents");
    expect(html).toContain("<li>First item</li>");
    expect(html).toContain("<ul");
  });

  test("blocksToText renders a numbered list and headings", () => {
    const text = blocksToText([
      {
        type: "heading_2",
        heading_2: { rich_text: [{ plain_text: "This week" }] },
      },
      {
        type: "numbered_list_item",
        numbered_list_item: { rich_text: [{ plain_text: "One" }] },
      },
      {
        type: "numbered_list_item",
        numbered_list_item: { rich_text: [{ plain_text: "Two" }] },
      },
    ]);
    expect(text).toContain("This week");
    expect(text).toContain("1. One");
    expect(text).toContain("2. Two");
  });

  test("isDraftBodyApprovable refuses empty / whitespace-only rendered bodies", () => {
    expect(isDraftBodyApprovable("")).toBe(false);
    expect(isDraftBodyApprovable("   \n\t ")).toBe(false);
    expect(isDraftBodyApprovable("Hi parents — quick update.")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Thursday-send freshness context (7-day Drafted At window per the lib docs)
// ---------------------------------------------------------------------------
test.describe("isDraftWithinShipWindow", () => {
  const now = new Date("2026-07-02T15:00:00.000Z");

  test("a draft from 2 days ago is inside the window", () => {
    expect(isDraftWithinShipWindow("2026-06-30", now)).toBe(true);
  });

  test("a draft from 8 days ago is stale — cron will not pick it up", () => {
    expect(isDraftWithinShipWindow("2026-06-24", now)).toBe(false);
  });

  test("boundary: exactly 7 days ago still ships (cron uses on_or_after)", () => {
    expect(isDraftWithinShipWindow("2026-06-25", now)).toBe(true);
  });

  test("empty / garbage Drafted At reads as stale, never throws", () => {
    expect(isDraftWithinShipWindow("", now)).toBe(false);
    expect(isDraftWithinShipWindow("not-a-date", now)).toBe(false);
  });
});
