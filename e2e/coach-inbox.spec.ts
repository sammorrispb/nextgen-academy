import { test, expect } from "@playwright/test";
import { FetchStub } from "./fixtures/fetch-stub";

// Pure + offline-behavioral specs for the Coach Inbox (Phase 1b) — the four
// queue fetchers' query builders, the decision→Notion-status maps (vocabulary
// pins: the inbox may only write status values that already exist in each
// DB's documented union), the pending-count badge math, the draft-body
// approvability gate, the href scheme allowlist, and the ship-window math
// pinned to the Thursday 22:00 UTC cron fire.
//
// Written RED-FIRST: every import below fails until the helpers exist.

// Env BEFORE any fetcher call (read at call time; pattern matches
// invariant-coach-inbox-authz.spec.ts).
process.env.NOTION_API_KEY = "test-notion-key-inbox";
process.env.NOTION_NEWS_DB_ID = "test-news-db";
process.env.NOTION_NEWSLETTER_DRAFTS_DB_ID = "test-drafts-db";
process.env.NOTION_CREW_INTEREST_DB_ID = "test-crew-db";
process.env.NOTION_CREW_COMMITS_DB_ID = "test-commits-db";

import {
  inboxPendingCount,
  inboxCountsTotal,
  pendingBadgeLabel,
  fetchInboxCounts,
  filterCrewInboxRows,
  NEWS_DECISION_TO_STATUS,
  DRAFT_DECISION_TO_STATUS,
  CREW_DECISION_TO_STATUS,
  type InboxQueues,
} from "../src/lib/coach-inbox";
import {
  buildNewNewsQuery,
  fetchNewNews,
  newsLinkHref,
} from "../src/lib/notion-news";
import {
  blocksToHtml,
  blocksToText,
  buildPendingDraftsQueryFilter,
  buildDraftsQueryFilter,
  isDraftBodyApprovable,
  isSafeHref,
  nextNewsletterFire,
  formatNewsletterDeadline,
  shipWindowBounds,
  draftPassesShipFilter,
  willRideThursdaySend,
  pendingDraftFromRow,
  fetchPendingDrafts,
  fetchPendingDraftCount,
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

  test("news query carries the pagination cursor only when one is given (F5)", () => {
    expect(buildNewNewsQuery(20)).not.toHaveProperty("start_cursor");
    expect(buildNewNewsQuery(20, "cursor-abc").start_cursor).toBe("cursor-abc");
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
test.describe("inboxPendingCount / badge labeling", () => {
  const empty: InboxQueues = {
    news: [],
    newsHasMore: false,
    drafts: [],
    crew: [],
    cardFailed: [],
  };

  test("zero on all-empty queues", () => {
    expect(inboxPendingCount(empty)).toBe(0);
  });

  test("sums all four queues", () => {
    const queues = {
      news: [{}, {}] ,
      newsHasMore: false,
      drafts: [{}],
      crew: [{}, {}, {}],
      cardFailed: [{}],
    } as unknown as InboxQueues;
    expect(inboxPendingCount(queues)).toBe(7);
  });

  test("inboxCountsTotal sums the count-only shape", () => {
    expect(
      inboxCountsTotal({
        news: 2,
        newsHasMore: false,
        drafts: 1,
        crew: 3,
        cardFailed: 1,
      }),
    ).toBe(7);
  });

  test("pendingBadgeLabel is honest about a capped news fetch (F5)", () => {
    expect(pendingBadgeLabel(7, false)).toBe("7");
    expect(pendingBadgeLabel(104, true)).toBe("104+");
    expect(pendingBadgeLabel(0, false)).toBe("0");
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
// F2 — ship-window eligibility computed against the NEXT Thursday 22:00 UTC
// cron fire (vercel.json "0 22 * * 4"), mirroring queryApprovedRows' own
// filter (7-day Drafted At window + Expires At guard). All dates fixed;
// helpers are UTC/Intl-explicit so results are TZ-independent.
// 2026-07-02 is a Thursday.
// ---------------------------------------------------------------------------
test.describe("F2 — nextNewsletterFire pins the cron schedule", () => {
  test("mid-week → the coming Thursday 22:00 UTC", () => {
    expect(
      nextNewsletterFire(new Date("2026-06-30T12:00:00.000Z")).toISOString(),
    ).toBe("2026-07-02T22:00:00.000Z");
  });

  test("Thursday just before the fire → today's fire", () => {
    expect(
      nextNewsletterFire(new Date("2026-07-02T21:59:59.000Z")).toISOString(),
    ).toBe("2026-07-02T22:00:00.000Z");
  });

  test("at or after the fire → next week's Thursday", () => {
    expect(
      nextNewsletterFire(new Date("2026-07-02T22:00:00.000Z")).toISOString(),
    ).toBe("2026-07-09T22:00:00.000Z");
    expect(
      nextNewsletterFire(new Date("2026-07-03T02:00:00.000Z")).toISOString(),
    ).toBe("2026-07-09T22:00:00.000Z");
  });
});

test.describe("F2 — shipWindowBounds is THE cutoff math the cron queries with", () => {
  const fire = new Date("2026-07-02T22:00:00.000Z");

  test("cutoff = fire minus 7 days (date-only), todayEt = fire's ET date", () => {
    const b = shipWindowBounds(fire);
    expect(b.cutoff).toBe("2026-06-25");
    // 22:00 UTC on Jul 2 = 18:00 EDT — still Jul 2 in ET.
    expect(b.todayEt).toBe("2026-07-02");
  });

  test("the bounds slot into buildDraftsQueryFilter exactly as the cron sends them", () => {
    const b = shipWindowBounds(fire);
    expect(buildDraftsQueryFilter(b.cutoff, b.todayEt)).toEqual({
      and: [
        { property: "Status", select: { equals: "Approved" } },
        { property: "Drafted At", date: { on_or_after: "2026-06-25" } },
        {
          or: [
            { property: "Expires At", date: { is_empty: true } },
            { property: "Expires At", date: { on_or_after: "2026-07-02" } },
          ],
        },
      ],
    });
  });
});

test.describe("F2 — draftPassesShipFilter mirrors the cron's Notion filter", () => {
  const bounds = { cutoff: "2026-06-25", todayEt: "2026-07-02" };
  const d = (draftedAt: string, expiresAt = "") => ({ draftedAt, expiresAt });

  test("Drafted At on_or_after the cutoff passes; older fails", () => {
    expect(draftPassesShipFilter(d("2026-06-25"), bounds)).toBe(true); // boundary
    expect(draftPassesShipFilter(d("2026-06-30"), bounds)).toBe(true);
    expect(draftPassesShipFilter(d("2026-06-24"), bounds)).toBe(false);
  });

  test("Expires At before the fire's ET date excludes an otherwise-fresh draft", () => {
    expect(draftPassesShipFilter(d("2026-06-30", "2026-07-01"), bounds)).toBe(false);
    expect(draftPassesShipFilter(d("2026-06-30", "2026-07-02"), bounds)).toBe(true); // inclusive
    expect(draftPassesShipFilter(d("2026-06-30", ""), bounds)).toBe(true); // empty = no expiry
  });

  test("empty / garbage Drafted At reads as ineligible, never throws", () => {
    expect(draftPassesShipFilter(d(""), bounds)).toBe(false);
    expect(draftPassesShipFilter(d("not-a-date"), bounds)).toBe(false);
  });
});

test.describe("F2 — willRideThursdaySend uses the FIRE as the basis, not `now`", () => {
  test("Friday: a draft 4 days old NOW but >7 days old at next fire will NOT ride", () => {
    // now = Fri 2026-06-26; next fire = Thu 2026-07-02 22:00 UTC, cutoff 06-25.
    const now = new Date("2026-06-26T12:00:00.000Z");
    // A naive now-based 7-day window says true (drafted 06-22, 4 days ago);
    // the cron's filter at fire time says false. Fire basis must win.
    expect(willRideThursdaySend({ draftedAt: "2026-06-22", expiresAt: "" }, now)).toBe(false);
    expect(willRideThursdaySend({ draftedAt: "2026-06-25", expiresAt: "" }, now)).toBe(true);
  });

  test("expiring before the fire's ET date means it will NOT ride, even if fresh", () => {
    const now = new Date("2026-06-30T12:00:00.000Z"); // Tue; fire Thu 07-02
    expect(
      willRideThursdaySend({ draftedAt: "2026-06-29", expiresAt: "2026-07-01" }, now),
    ).toBe(false);
    expect(
      willRideThursdaySend({ draftedAt: "2026-06-29", expiresAt: "2026-07-02" }, now),
    ).toBe(true);
  });

  test("parity: willRideThursdaySend === draftPassesShipFilter over the fire's bounds", () => {
    const nows = [
      new Date("2026-06-26T12:00:00.000Z"),
      new Date("2026-07-02T21:00:00.000Z"),
      new Date("2026-07-02T23:00:00.000Z"),
    ];
    const drafts = [
      { draftedAt: "2026-06-22", expiresAt: "" },
      { draftedAt: "2026-06-28", expiresAt: "" },
      { draftedAt: "2026-07-01", expiresAt: "2026-07-01" },
      { draftedAt: "", expiresAt: "" },
    ];
    for (const now of nows) {
      const bounds = shipWindowBounds(nextNewsletterFire(now));
      for (const draft of drafts) {
        expect(willRideThursdaySend(draft, now)).toBe(
          draftPassesShipFilter(draft, bounds),
        );
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Residue 1 — deadline copy must be DST-correct. The cron is UTC-fixed
// ("0 22 * * 4"), so the ET wall time is 6:00 PM EDT in summer but
// 5:00 PM EST Nov–Mar: a hardcoded "6:00 PM ET" string lies half the year
// (a 5:30 PM EST approval would miss the fire while the copy says OK).
// Helpers are Intl-explicit → TZ-independent; dates fixed under TZ=UTC.
// ---------------------------------------------------------------------------
test.describe("residue 1 — formatNewsletterDeadline renders the fire in ET, DST-aware", () => {
  test("summer fire (2026-07-02 22:00 UTC) reads Thursday 6:00 PM EDT", () => {
    const s = formatNewsletterDeadline(
      nextNewsletterFire(new Date("2026-06-30T12:00:00.000Z")),
    );
    expect(s).toContain("Thursday");
    expect(s).toContain("6:00 PM");
    expect(s).toContain("EDT");
    expect(s).not.toContain("EST");
  });

  test("November fire (2026-11-12 22:00 UTC, after DST ends) reads Thursday 5:00 PM EST", () => {
    // 2026-11-10 is a Tuesday; next fire is Thu 2026-11-12 22:00 UTC.
    // US DST ended Sun 2026-11-01, so 22:00 UTC = 17:00 EST.
    const s = formatNewsletterDeadline(
      nextNewsletterFire(new Date("2026-11-10T12:00:00.000Z")),
    );
    expect(s).toContain("Thursday");
    expect(s).toContain("5:00 PM");
    expect(s).toContain("EST");
    expect(s).not.toContain("EDT");
  });
});

// ---------------------------------------------------------------------------
// Residue 2 — scraper-sourced news URLs are untrusted input rendered as
// anchors in the triage queue: same scheme-allowlist posture as the draft
// renderer. null = the page renders plain text, no anchor.
// ---------------------------------------------------------------------------
test.describe("residue 2 — newsLinkHref scheme-checks scraper URLs", () => {
  test("unsafe or empty URL → null (no anchor)", () => {
    expect(newsLinkHref("javascript:alert(1)")).toBeNull();
    expect(newsLinkHref("  JAVASCRIPT:alert(1)")).toBeNull();
    expect(newsLinkHref("data:text/html,x")).toBeNull();
    expect(newsLinkHref("")).toBeNull();
  });

  test("http(s) URLs pass through unchanged", () => {
    expect(newsLinkHref("https://example.com/story")).toBe(
      "https://example.com/story",
    );
    expect(newsLinkHref("http://example.com/story")).toBe(
      "http://example.com/story",
    );
  });
});

// ---------------------------------------------------------------------------
// F1 — href scheme allowlist in the SHARED draft renderer (inbox preview and
// the Thursday email both render blocksToHtml, so the fix guards both).
// ---------------------------------------------------------------------------
test.describe("F1 — link scheme allowlist in blocksToHtml", () => {
  const linkBlocks = (href: string) => [
    {
      type: "paragraph",
      paragraph: { rich_text: [{ plain_text: "click me", href }] },
    },
  ];

  test("javascript: href renders as plain text — no anchor, no scheme in output", () => {
    const html = blocksToHtml(linkBlocks("javascript:alert(1)"));
    expect(html).toContain("click me");
    expect(html).not.toContain("<a");
    expect(html.toLowerCase()).not.toContain("javascript:");
  });

  test("data: and vbscript: hrefs are dropped too", () => {
    for (const href of ["data:text/html,<script>1</script>", "vbscript:msgbox(1)"]) {
      const html = blocksToHtml(linkBlocks(href));
      expect(html).toContain("click me");
      expect(html).not.toContain("<a");
    }
  });

  test("http, https and mailto anchors survive", () => {
    expect(blocksToHtml(linkBlocks("https://nextgenpbacademy.com/camp"))).toContain(
      '<a href="https://nextgenpbacademy.com/camp"',
    );
    expect(blocksToHtml(linkBlocks("http://example.com"))).toContain(
      '<a href="http://example.com"',
    );
    expect(blocksToHtml(linkBlocks("mailto:nextgenacademypb@gmail.com"))).toContain(
      '<a href="mailto:nextgenacademypb@gmail.com"',
    );
  });

  test("isSafeHref is case/whitespace hardened and allowlist-only", () => {
    expect(isSafeHref("  JAVASCRIPT:alert(1)")).toBe(false);
    expect(isSafeHref("java\nscript:alert(1)")).toBe(false);
    expect(isSafeHref("jAvAsCrIpT:alert(1)")).toBe(false);
    expect(isSafeHref("/relative/path")).toBe(false); // not on the allowlist
    expect(isSafeHref("")).toBe(false);
    expect(isSafeHref("HTTPS://example.com")).toBe(true);
    expect(isSafeHref("mailto:x@y.com")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// F3 — a blocks-fetch failure must SURFACE the pending row (bodyUnavailable),
// never hide it; a genuinely-empty body still drops (nothing to review).
// ---------------------------------------------------------------------------
const draftRow = (id: string, draftedAt = "2026-06-30", expiresAt = "") => ({
  id,
  properties: {
    Week: { title: [{ plain_text: `Week ${id}` }] },
    "Source Radar": { url: "" },
    "Section Count": { number: 2 },
    "Drafted At": { date: draftedAt ? { start: draftedAt } : null },
    "Expires At": { date: expiresAt ? { start: expiresAt } : null },
  },
});

const paragraphBlock = (text: string) => ({
  type: "paragraph",
  paragraph: { rich_text: [{ plain_text: text }] },
});

test.describe("F3 — pendingDraftFromRow distinguishes unavailable from empty", () => {
  test("blocks=null (fetch failed) → row kept, flagged bodyUnavailable", () => {
    const row = pendingDraftFromRow(draftRow("row-x"), null);
    expect(row).not.toBeNull();
    expect(row?.bodyUnavailable).toBe(true);
    expect(row?.html).toBe("");
    expect(row?.weekTitle).toBe("Week row-x");
    expect(row?.draftedAt).toBe("2026-06-30");
  });

  test("blocks=[] (genuinely empty body) → dropped, nothing to review", () => {
    expect(pendingDraftFromRow(draftRow("row-y"), [])).toBeNull();
  });

  test("real body → normal reviewable row with the shared render", () => {
    const row = pendingDraftFromRow(draftRow("row-z", "2026-07-01", "2026-07-09"), [
      paragraphBlock("Hi parents"),
    ]);
    expect(row?.bodyUnavailable).toBe(false);
    expect(row?.html).toContain("Hi parents");
    expect(row?.expiresAt).toBe("2026-07-09");
  });
});

test.describe("F3/F5/F6 — offline behavioral (FetchStub)", () => {
  const stub = new FetchStub();
  test.beforeEach(() => {
    stub.reset();
    stub.install();
  });
  test.afterEach(() => stub.uninstall());

  test("F3: fetchPendingDrafts keeps a row whose blocks fetch 500s, flagged bodyUnavailable", async () => {
    stub.on("/databases/test-drafts-db/query", {
      results: [draftRow("row-ok"), draftRow("row-broken")],
    });
    stub.on("/blocks/row-ok/", { results: [paragraphBlock("Hi parents")] });
    stub.on("/blocks/row-broken/", { error: "boom" }, 500);

    const rows = await fetchPendingDrafts();
    expect(rows.map((r) => [r.pageId, r.bodyUnavailable])).toEqual([
      ["row-ok", false],
      ["row-broken", true],
    ]);
    expect(rows[0].html).toContain("Hi parents");
    expect(rows[1].html).toBe("");
  });

  test("F5: fetchNewNews follows next_cursor up to the ceiling and reports hasMore", async () => {
    const page = (n: number) => ({
      results: Array.from({ length: n }, (_, i) => ({
        id: `news-${i}`,
        properties: {
          Title: { title: [{ plain_text: `Story ${i}` }] },
          URL: { url: "https://example.com" },
          Status: { select: { name: "New" } },
        },
      })),
      has_more: true,
      next_cursor: "cursor-2",
    });
    stub.on("/databases/test-news-db/query", page(4));

    const { rows, hasMore } = await fetchNewNews(10);
    expect(rows).toHaveLength(10); // capped at the ceiling, never more
    expect(hasMore).toBe(true);
    const calls = stub.callsTo("/databases/test-news-db/query");
    expect(calls.length).toBe(3); // 4 + 4 + 2(sliced)
    expect(calls[0].body).not.toContain("start_cursor");
    expect(calls[1].body).toContain('"start_cursor":"cursor-2"');
  });

  test("F5: a single short page reports hasMore=false", async () => {
    stub.on("/databases/test-news-db/query", {
      results: [
        {
          id: "news-solo",
          properties: {
            Title: { title: [{ plain_text: "Solo" }] },
            Status: { select: { name: "New" } },
          },
        },
      ],
      has_more: false,
      next_cursor: null,
    });
    const { rows, hasMore } = await fetchNewNews();
    expect(rows).toHaveLength(1);
    expect(rows[0].title).toBe("Solo");
    expect(hasMore).toBe(false);
    expect(stub.callsTo("/databases/test-news-db/query")).toHaveLength(1);
  });

  test("F6: fetchPendingDraftCount counts WITHOUT any blocks fetch", async () => {
    stub.on("/databases/test-drafts-db/query", {
      results: [draftRow("a"), draftRow("b"), draftRow("c")],
    });
    expect(await fetchPendingDraftCount()).toBe(3);
    expect(stub.callsTo("/blocks/")).toHaveLength(0);
    expect(stub.callsTo("/databases/test-drafts-db/query")).toHaveLength(1);
  });

  test("F6: fetchInboxCounts is O(4) queries and NEVER hydrates draft bodies", async () => {
    stub.on("/databases/test-news-db/query", {
      results: [
        {
          id: "n1",
          properties: {
            Title: { title: [{ plain_text: "Story" }] },
            Status: { select: { name: "New" } },
          },
        },
      ],
      has_more: false,
    });
    stub.on("/databases/test-drafts-db/query", {
      results: [draftRow("d1"), draftRow("d2")],
    });
    stub.on("/databases/test-crew-db/query", {
      results: [
        { id: "c1", properties: { Status: { select: { name: "New" } } } },
        { id: "c2", properties: { Status: { select: { name: "Reviewed" } } } },
      ],
    });
    stub.on("/databases/test-commits-db/query", {
      results: [{ id: "cf1", properties: { Status: { select: { name: "CardFailed" } } } }],
      has_more: false,
    });

    const counts = await fetchInboxCounts();
    // crew counts ONLY Status=New (same filter the inbox rows use).
    expect(counts).toEqual({
      news: 1,
      newsHasMore: false,
      drafts: 2,
      crew: 1,
      cardFailed: 1,
    });
    expect(inboxCountsTotal(counts)).toBe(5);
    expect(stub.callsTo("/blocks/")).toHaveLength(0); // the N+1 this fix removes
    expect(stub.calls).toHaveLength(4); // O(4) — one query per queue
  });
});
