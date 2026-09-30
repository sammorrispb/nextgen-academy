import { test, expect } from "@playwright/test";
import { mock } from "node:test";
import {
  buildDraftsQueryFilter, buildStrandedDraftsQueryFilter, draftPassesShipFilter,
  fetchApprovedNewsletterDrafts, fetchDraftShipFields, pendingDraftFromRow,
  shipWindowBounds, willRideThursdaySend,
} from "../src/lib/notion-newsletter-drafts";
import { FetchStub, type RecordedFetch } from "./fixtures/fetch-stub";

type DraftFields = { draftedAt: string; expiresAt: string; sendOn?: string };
type Filter = {
  and?: Filter[]; or?: Filter[]; property?: string;
  select?: { equals: string };
  date?: { equals?: string; before?: string; on_or_before?: string; on_or_after?: string; is_empty?: boolean; is_not_empty?: boolean };
};

// Emulate Notion's documented comparisons rather than returning every fixture
// regardless of the query: otherwise a missing scheduling leg goes unnoticed.
function matches(filter: Filter, draft: DraftFields, status = "Approved"): boolean {
  if (filter.and) return filter.and.every(part => matches(part, draft, status));
  if (filter.or) return filter.or.some(part => matches(part, draft, status));
  if (filter.select) return status === filter.select.equals;
  const value = ({ "Drafted At": draft.draftedAt, "Expires At": draft.expiresAt, "Send On": draft.sendOn ?? "" } as Record<string, string>)[filter.property ?? ""];
  if (!filter.date) throw new Error("Unsupported test filter");
  const day = value.slice(0, 10);
  const { date } = filter;
  if (date.is_empty !== undefined) return !value === date.is_empty;
  if (date.is_not_empty !== undefined) return !!value === date.is_not_empty;
  if (!value) return false;
  if (date.equals !== undefined) return day === date.equals;
  if (date.before !== undefined) return day < date.before;
  if (date.on_or_before !== undefined) return day <= date.on_or_before;
  if (date.on_or_after !== undefined) return day >= date.on_or_after;
  throw new Error("Unsupported test comparison");
}

const row = (pageId: string, fields: DraftFields, status = "Approved") => ({
  id: pageId,
  properties: {
    Week: { title: [{ plain_text: "Reviewed tournament copy" }] },
    Status: { select: { name: status } },
    "Drafted At": { date: fields.draftedAt ? { start: fields.draftedAt } : null },
    "Expires At": { date: fields.expiresAt ? { start: fields.expiresAt } : null },
    "Send On": { date: fields.sendOn ? { start: fields.sendOn } : null },
  },
});
const scheduled = { draftedAt: "2026-09-30", expiresAt: "2026-10-08", sendOn: "2026-10-08" };

test("the scheduling query stays within Notion's two compound levels", () => {
  const depth = (filter: Filter): number => {
    const children = filter.and ?? filter.or;
    return children ? 1 + Math.max(...children.map(depth)) : 0;
  };
  expect(depth(buildDraftsQueryFilter("2026-10-01", "2026-10-08"))).toBeLessThanOrEqual(2);
});

test("dated copy ships only on its ET issue date, even when older than seven days", () => {
  for (const [moment, expected] of [
    ["2026-10-01T22:00:00Z", false], ["2026-10-08T22:00:00Z", true],
    ["2026-10-09T00:30:00Z", true], ["2026-10-09T04:00:00Z", false],
    ["2026-10-15T22:00:00Z", false],
  ] as const) {
    const bounds = shipWindowBounds(new Date(moment));
    expect(draftPassesShipFilter(scheduled, bounds), moment).toBe(expected);
    expect(matches(buildDraftsQueryFilter(bounds.cutoff, bounds.todayEt), scheduled), moment).toBe(expected);
  }
});

test("future creation dates, expired copy, and incomplete dates never qualify", () => {
  const bounds = shipWindowBounds(new Date("2026-10-08T22:00:00Z"));
  for (const fields of [
    { ...scheduled, draftedAt: "2026-10-09" }, { ...scheduled, expiresAt: "2026-10-07" },
    { ...scheduled, draftedAt: "" }, { ...scheduled, sendOn: "invalid" },
    { ...scheduled, sendOn: "2026-02-30" }, { ...scheduled, sendOn: "2026-10-08T12:00:00Z" },
    { ...scheduled, expiresAt: "invalid" }, { ...scheduled, draftedAt: "2026-09-31" },
  ]) expect(draftPassesShipFilter(fields, bounds), JSON.stringify(fields)).toBe(false);
  for (const fields of [
    { ...scheduled, draftedAt: "2026-10-09" }, { ...scheduled, expiresAt: "2026-10-07" },
    { ...scheduled, draftedAt: "" },
  ]) expect(matches(buildDraftsQueryFilter(bounds.cutoff, bounds.todayEt), fields)).toBe(false);
  expect(matches(buildDraftsQueryFilter(bounds.cutoff, bounds.todayEt), scheduled, "Pending")).toBe(false);
  expect(matches(buildDraftsQueryFilter(bounds.cutoff, bounds.todayEt), scheduled, "Skip")).toBe(false);
});

test("undated legacy copy keeps its freshness and expiry guards and excludes future drafts", () => {
  const bounds = { cutoff: "2026-10-01", todayEt: "2026-10-08" };
  for (const [draftedAt, expiresAt, expected] of [
    ["2026-10-01", "", true], ["2026-10-08", "2026-10-08", true],
    ["2026-09-30", "2026-10-08", false], ["2026-10-09", "", false],
    ["2026-10-07", "2026-10-07", false], ["", "", false],
  ] as const) {
    const fields = { draftedAt, expiresAt };
    expect(draftPassesShipFilter(fields, bounds)).toBe(expected);
    expect(matches(buildDraftsQueryFilter(bounds.cutoff, bounds.todayEt), fields)).toBe(expected);
  }
});

test("future scheduled rows do not raise a stranded freshness warning", () => {
  expect(matches(buildStrandedDraftsQueryFilter("2026-10-01", "2026-10-08"), scheduled)).toBe(false);
  expect(matches(buildStrandedDraftsQueryFilter("2026-10-01", "2026-10-08"), { ...scheduled, sendOn: "2026-10-15", expiresAt: "2026-10-15" })).toBe(false);
  expect(matches(buildStrandedDraftsQueryFilter("2026-10-01", "2026-10-08"), { ...scheduled, sendOn: "" })).toBe(true);
});

test("inbox prediction uses the next actual issue and pending rows retain Send On", () => {
  expect(willRideThursdaySend(scheduled, new Date("2026-09-30T17:00:00Z"))).toBe(false);
  expect(willRideThursdaySend(scheduled, new Date("2026-10-01T22:00:00Z"))).toBe(true);
  expect(willRideThursdaySend(scheduled, new Date("2026-10-08T22:00:00Z"))).toBe(false);
  const pending = pendingDraftFromRow(row("oct-8", scheduled, "Pending"), [
    { type: "paragraph", paragraph: { rich_text: [{ plain_text: "Your player can rotate partners." }] } },
  ]);
  expect(pending).toMatchObject({ sendOn: "2026-10-08", bodyUnavailable: false });
  expect(pendingDraftFromRow(row("oct-8", scheduled), null)).toMatchObject({ sendOn: "2026-10-08", bodyUnavailable: true });
});

test("Notion reads hydrate only due approved rows and approval re-reads Send On", async () => {
  const stub = new FetchStub();
  const oldKey = process.env.NOTION_API_KEY;
  const oldDb = process.env.NOTION_NEWSLETTER_DRAFTS_DB_ID;
  process.env.NOTION_API_KEY = "test-notion-key";
  process.env.NOTION_NEWSLETTER_DRAFTS_DB_ID = "test-drafts-db";
  mock.timers.enable({ apis: ["Date"], now: new Date("2026-10-08T22:00:00Z") });
  try {
    const fixtures = [
      { id: "due", fields: scheduled, status: "Approved" },
      { id: "future", fields: { ...scheduled, sendOn: "2026-10-15", expiresAt: "2026-10-15" }, status: "Approved" },
      { id: "pending", fields: scheduled, status: "Pending" },
      { id: "expired", fields: { ...scheduled, expiresAt: "2026-10-07" }, status: "Approved" },
    ];
    stub.on("databases/test-drafts-db/query", (call: RecordedFetch) => ({ results: fixtures
      .filter(item => matches(JSON.parse(call.body).filter, item.fields, item.status))
      .map(item => row(item.id, item.fields, item.status)) }));
    stub.on("/blocks/due/children", { results: [{ type: "paragraph", paragraph: { rich_text: [{ plain_text: "At least four games." }] } }] });
    stub.on("/pages/due", row("due", scheduled));
    stub.install();
    expect(await fetchApprovedNewsletterDrafts()).toMatchObject({
      status: "ok", drafts: [{ pageId: "due", text: "At least four games." }], strandedPageIds: [], unreadablePageIds: [],
    });
    expect(stub.callsTo("/blocks/")).toHaveLength(1);
    expect(await fetchDraftShipFields("due")).toEqual(scheduled);
  } finally {
    stub.uninstall(); mock.timers.reset();
    if (oldKey === undefined) delete process.env.NOTION_API_KEY; else process.env.NOTION_API_KEY = oldKey;
    if (oldDb === undefined) delete process.env.NOTION_NEWSLETTER_DRAFTS_DB_ID; else process.env.NOTION_NEWSLETTER_DRAFTS_DB_ID = oldDb;
  }
});

test("native date validation rejects malformed scheduled candidates even if Notion returns them", async () => {
  const stub = new FetchStub();
  const oldKey = process.env.NOTION_API_KEY;
  const oldDb = process.env.NOTION_NEWSLETTER_DRAFTS_DB_ID;
  process.env.NOTION_API_KEY = "test-notion-key";
  process.env.NOTION_NEWSLETTER_DRAFTS_DB_ID = "test-drafts-db";
  mock.timers.enable({ apis: ["Date"], now: new Date("2026-10-08T22:00:00Z") });
  try {
    stub.on("databases/test-drafts-db/query", (call: RecordedFetch) => ({ results: call.body.includes("is_not_empty") ? [] : [
      row("time-valued", { ...scheduled, sendOn: "2026-10-08T12:00:00Z" }),
      row("invalid-expiry", { ...scheduled, expiresAt: "2026-02-30" }),
      row("invalid-creation", { ...scheduled, draftedAt: "2026-09-31" }),
      row("invalid-send", { ...scheduled, sendOn: "invalid" }),
    ] }));
    stub.install();
    expect(await fetchApprovedNewsletterDrafts()).toMatchObject({ status: "ok", drafts: [], unreadablePageIds: [] });
    expect(stub.callsTo("/blocks/")).toHaveLength(0);
  } finally {
    stub.uninstall(); mock.timers.reset();
    if (oldKey === undefined) delete process.env.NOTION_API_KEY; else process.env.NOTION_API_KEY = oldKey;
    if (oldDb === undefined) delete process.env.NOTION_NEWSLETTER_DRAFTS_DB_ID; else process.env.NOTION_NEWSLETTER_DRAFTS_DB_ID = oldDb;
  }
});
