/**
 * Read/write helpers for the NGA Youth Pickleball News Notion DB
 * (NOTION_NEWS_DB_ID). Owned by the daily scraper cron (write new rows,
 * deduped by URL) and the weekly newsletter cron (list Approved rows,
 * flip them to Used after the broadcast).
 */

import type { RawNewsItem } from "@/lib/news-scraper";

const NOTION_API = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";

export type NewsStatus = "New" | "Approved" | "Used" | "Rejected";

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

/**
 * Return Approved rows for inclusion in the weekly newsletter. Capped at
 * `limit` so a long approval backlog doesn't blow up the email. Sorted
 * newest-published first (falling back to discovery order).
 */
export async function fetchApprovedNews(limit: number = 4): Promise<NewsRow[]> {
  const notionKey = process.env.NOTION_API_KEY;
  const dbId = process.env.NOTION_NEWS_DB_ID;
  if (!notionKey || !dbId) return [];

  const res = await fetch(`${NOTION_API}/databases/${dbId}/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${notionKey}`,
      "Content-Type": "application/json",
      "Notion-Version": NOTION_VERSION,
    },
    body: JSON.stringify({
      filter: { property: "Status", select: { equals: "Approved" } },
      sorts: [
        { property: "Published", direction: "descending" },
        { property: "Discovered At", direction: "descending" },
      ],
      page_size: Math.max(1, limit),
    }),
    cache: "no-store",
  });
  if (!res.ok) {
    console.error(
      "[notion-news] fetchApprovedNews failed",
      res.status,
      await res.text().catch(() => ""),
    );
    return [];
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = (await res.json()) as { results: any[] };
  return data.results.map((page) => {
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
  });
}

/**
 * Query body for the coach-inbox triage queue: Status=New rows, newest
 * discovered first. Pure so the filter/sort/limit are pinned by
 * e2e/coach-inbox.spec.ts (buildDraftsQueryFilter precedent).
 */
export function buildNewNewsQuery(limit: number) {
  return {
    filter: {
      property: "Status",
      select: { equals: "New" satisfies NewsStatus },
    },
    sorts: [{ property: "Discovered At", direction: "descending" }],
    page_size: Math.max(1, limit),
  };
}

/**
 * Return Status=New rows for the coach-inbox triage queue (the rows Sam
 * currently flips by hand in Notion). Modeled on fetchApprovedNews; fails
 * soft to [] so the inbox renders its other queues on a Notion blip.
 */
export async function fetchNewNews(limit: number = 20): Promise<NewsRow[]> {
  const notionKey = process.env.NOTION_API_KEY;
  const dbId = process.env.NOTION_NEWS_DB_ID;
  if (!notionKey || !dbId) return [];

  const res = await fetch(`${NOTION_API}/databases/${dbId}/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${notionKey}`,
      "Content-Type": "application/json",
      "Notion-Version": NOTION_VERSION,
    },
    body: JSON.stringify(buildNewNewsQuery(limit)),
    cache: "no-store",
  });
  if (!res.ok) {
    console.error(
      "[notion-news] fetchNewNews failed",
      res.status,
      await res.text().catch(() => ""),
    );
    return [];
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = (await res.json()) as { results: any[] };
  return data.results.map((page) => {
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
  });
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
