/**
 * Read/write helpers for the NGA Youth Pickleball News Notion DB
 * (NOTION_NEWS_DB_ID). Owned by the daily scraper cron (write new rows,
 * deduped by URL) and the weekly newsletter cron (list Approved rows,
 * flip them to Used after the broadcast).
 */

import type { RawNewsItem } from "@/lib/news-scraper";
import { isSafeHref } from "@/lib/notion-newsletter-drafts";

const NOTION_API = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";

export type NewsStatus = "New" | "Approved" | "Used" | "Rejected";

/**
 * Scraper-sourced URLs are untrusted input rendered as anchors in the inbox
 * triage queue — same scheme-allowlist posture as the draft renderer
 * (isSafeHref: http/https/mailto only). Null = render plain text, no anchor.
 * Pinned by e2e/coach-inbox.spec.ts.
 */
export function newsLinkHref(url: string): string | null {
  return url && isSafeHref(url) ? url : null;
}

export interface NewsRow {
  pageId: string;
  title: string;
  url: string;
  source: string;
  summary: string;
  /** Original article publication date (ISO). May be empty. */
  published: string;
  status: NewsStatus;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function readTitle(prop: any): string {
  const arr = prop?.title ?? [];
  if (!Array.isArray(arr)) return "";
  return arr.map((r: { plain_text?: string }) => r.plain_text ?? "").join("");
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function readRichText(prop: any): string {
  const arr = prop?.rich_text ?? [];
  if (!Array.isArray(arr)) return "";
  return arr.map((r: { plain_text?: string }) => r.plain_text ?? "").join("");
}

/**
 * Check whether a row with `url` already exists. Used by the scraper to skip
 * re-writing items it discovered on a previous tick.
 */
export async function findNewsByUrl(url: string): Promise<string | null> {
  const notionKey = process.env.NOTION_API_KEY;
  const dbId = process.env.NOTION_NEWS_DB_ID;
  if (!notionKey || !dbId) return null;

  const res = await fetch(`${NOTION_API}/databases/${dbId}/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${notionKey}`,
      "Content-Type": "application/json",
      "Notion-Version": NOTION_VERSION,
    },
    body: JSON.stringify({
      filter: { property: "URL", url: { equals: url } },
      page_size: 1,
    }),
    cache: "no-store",
  });
  if (!res.ok) {
    console.error(
      "[notion-news] findNewsByUrl failed",
      res.status,
      await res.text().catch(() => ""),
    );
    return null;
  }
  const data = (await res.json()) as { results: { id: string }[] };
  return data.results[0]?.id ?? null;
}

export async function createNewsRow(item: RawNewsItem): Promise<boolean> {
  const notionKey = process.env.NOTION_API_KEY;
  const dbId = process.env.NOTION_NEWS_DB_ID;
  if (!notionKey || !dbId) return false;

  const discoveredAt = new Date().toISOString();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const properties: Record<string, any> = {
    Title: { title: [{ text: { content: item.title.slice(0, 200) } }] },
    URL: { url: item.url },
    Source: { rich_text: [{ text: { content: item.source } }] },
    Summary: {
      rich_text: item.summary
        ? [{ text: { content: item.summary.slice(0, 1900) } }]
        : [],
    },
    Status: { select: { name: "New" satisfies NewsStatus } },
    "Discovered At": { date: { start: discoveredAt } },
    "Keyword Hits": {
      rich_text: [{ text: { content: item.keywordHits.join(", ") } }],
    },
  };
  if (item.published) {
    properties["Published"] = { date: { start: item.published } };
  }

  const res = await fetch(`${NOTION_API}/pages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${notionKey}`,
      "Content-Type": "application/json",
      "Notion-Version": NOTION_VERSION,
    },
    body: JSON.stringify({
      parent: { database_id: dbId },
      properties,
    }),
  });
  if (!res.ok) {
    console.error(
      "[notion-news] createNewsRow failed",
      res.status,
      await res.text().catch(() => ""),
    );
    return false;
  }
  return true;
}

/** Map one Notion page into a NewsRow — shared by every news fetcher. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function pageToNewsRow(page: any): NewsRow {
  const props = page.properties ?? {};
  return {
    pageId: page.id as string,
    title: readTitle(props["Title"]),
    url: props["URL"]?.url ?? "",
    source: readRichText(props["Source"]),
    summary: readRichText(props["Summary"]),
    published: props["Published"]?.date?.start ?? "",
    status: (props["Status"]?.select?.name as NewsStatus) ?? "New",
  };
}

/**
 * Run one news-DB query and map the results (fetchCommitsWithStatus
 * precedent) — the single fetch+map path shared by fetchApprovedNews and
 * fetchNewNews. Returns null on any error so callers can fail soft.
 */
async function queryNewsRows(
  queryBody: Record<string, unknown>,
  label: string,
): Promise<{ rows: NewsRow[]; hasMore: boolean; nextCursor: string | null } | null> {
  const notionKey = process.env.NOTION_API_KEY;
  const dbId = process.env.NOTION_NEWS_DB_ID;
  if (!notionKey || !dbId) return null;

  const res = await fetch(`${NOTION_API}/databases/${dbId}/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${notionKey}`,
      "Content-Type": "application/json",
      "Notion-Version": NOTION_VERSION,
    },
    body: JSON.stringify(queryBody),
    cache: "no-store",
  });
  if (!res.ok) {
    console.error(
      `[notion-news] ${label} failed`,
      res.status,
      await res.text().catch(() => ""),
    );
    return null;
  }
  const data = (await res.json()) as {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    results: any[];
    has_more?: boolean;
    next_cursor?: string | null;
  };
  return {
    rows: (data.results ?? []).map(pageToNewsRow),
    hasMore: data.has_more === true,
    nextCursor: data.next_cursor ?? null,
  };
}

/**
 * Return Approved rows for inclusion in the weekly newsletter. Capped at
 * `limit` so a long approval backlog doesn't blow up the email. Sorted
 * newest-published first (falling back to discovery order).
 */
export async function fetchApprovedNews(limit: number = 4): Promise<NewsRow[]> {
  const page = await queryNewsRows(
    {
      filter: { property: "Status", select: { equals: "Approved" } },
      sorts: [
        { property: "Published", direction: "descending" },
        { property: "Discovered At", direction: "descending" },
      ],
      page_size: Math.max(1, limit),
    },
    "fetchApprovedNews",
  );
  return page ? page.rows : [];
}

/**
 * Query body for the coach-inbox triage queue: Status=New rows, newest
 * discovered first, with an optional pagination cursor. Pure so the
 * filter/sort/limit are pinned by e2e/coach-inbox.spec.ts
 * (buildDraftsQueryFilter precedent).
 */
export function buildNewNewsQuery(limit: number, cursor?: string) {
  return {
    filter: {
      property: "Status",
      select: { equals: "New" satisfies NewsStatus },
    },
    sorts: [{ property: "Discovered At", direction: "descending" }],
    page_size: Math.max(1, limit),
    ...(cursor ? { start_cursor: cursor } : {}),
  };
}

/** How many Status=New rows the inbox will pull before saying "more in Notion". */
export const NEW_NEWS_FETCH_CEILING = 100;

export interface NewNewsResult {
  rows: NewsRow[];
  /** True when rows remain in Notion beyond the ceiling — surface it, never hide it. */
  hasMore: boolean;
}

/**
 * Return Status=New rows for the coach-inbox triage queue (the rows Sam
 * currently flips by hand in Notion). Follows has_more/next_cursor up to
 * `max` rows (default NEW_NEWS_FETCH_CEILING) and reports whether more
 * remain, so a backlog deeper than one page is surfaced honestly instead of
 * silently truncated at 20 (F5). Fails soft to { rows: [], hasMore: false }
 * so the inbox renders its other queues on a Notion blip.
 */
export async function fetchNewNews(
  max: number = NEW_NEWS_FETCH_CEILING,
): Promise<NewNewsResult> {
  const all: NewsRow[] = [];
  let cursor: string | undefined;
  let hasMore = false;
  do {
    const page = await queryNewsRows(
      buildNewNewsQuery(Math.min(100, max - all.length), cursor),
      "fetchNewNews",
    );
    if (!page) return { rows: all, hasMore: false };
    all.push(...page.rows);
    hasMore = page.hasMore;
    cursor = page.hasMore && page.nextCursor ? page.nextCursor : undefined;
  } while (cursor && all.length < max);
  return { rows: all.slice(0, max), hasMore: hasMore || all.length > max };
}

/** Flip a single row's Status select. Idempotent. */
export async function setNewsStatus(
  pageId: string,
  status: NewsStatus,
): Promise<boolean> {
  const notionKey = process.env.NOTION_API_KEY;
  if (!notionKey) return false;

  const res = await fetch(`${NOTION_API}/pages/${pageId}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${notionKey}`,
      "Content-Type": "application/json",
      "Notion-Version": NOTION_VERSION,
    },
    body: JSON.stringify({
      properties: { Status: { select: { name: status } } },
    }),
  });
  if (!res.ok) {
    console.error(
      "[notion-news] setNewsStatus failed",
      res.status,
      await res.text().catch(() => ""),
    );
    return false;
  }
  return true;
}
