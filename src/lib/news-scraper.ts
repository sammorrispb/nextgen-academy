/**
 * Pull youth-pickleball news items from a handful of public sources
 * (Google News RSS, USA Pickleball, PPA, Reddit) and return a normalized,
 * deduped list. No persistence here — the cron route owns the Notion write.
 *
 * Filtering rule: an item lands in the feed only if its title or summary
 * mentions pickleball AND a youth-context term (junior, youth, kid, school,
 * academy, camp, etc.). Cuts the pro-tour signal that dominates the raw
 * Google News query.
 */

export interface RawNewsItem {
  title: string;
  url: string;
  source: string;
  summary: string;
  /** ISO date string. Empty when the source doesn't expose one. */
  published: string;
  /** Which keywords matched — surfaced in the Notion row so Sam can sanity-check. */
  keywordHits: string[];
}

const PICKLEBALL_TERMS = ["pickleball", "pickle ball"];

const YOUTH_TERMS = [
  "youth",
  "junior",
  "juniors",
  "kid",
  "kids",
  "child",
  "children",
  "teen",
  "teens",
  "teenager",
  "school",
  "schools",
  "high school",
  "middle school",
  "elementary",
  "academy",
  "academies",
  "camp",
  "camps",
  "coach",
  "coaches",
  "coaching",
  "clinic",
  "clinics",
  "tournament",
  "league",
  "lessons",
];

const GOOGLE_NEWS_QUERIES = [
  "youth pickleball",
  "junior pickleball",
  "pickleball academy",
  "pickleball camp kids",
  "high school pickleball",
  "pickleball coach kids",
];

const SCRAPE_USER_AGENT =
  "Mozilla/5.0 (compatible; NGAScraper/1.0; +https://nextgenpbacademy.com)";

const FETCH_TIMEOUT_MS = 10_000;

async function fetchWithTimeout(
  url: string,
  init: RequestInit = {},
): Promise<Response | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, {
      ...init,
      signal: ctrl.signal,
      headers: { "User-Agent": SCRAPE_USER_AGENT, ...(init.headers ?? {}) },
      cache: "no-store",
    });
  } catch (err) {
    console.warn(`[news-scraper] fetch failed for ${url}:`, err);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Strip query params Google appends for tracking, normalize protocol+host
 * casing, drop a trailing slash. Used as the dedup key so the same article
 * surfaced via Google News + USA Pickleball doesn't land twice.
 */
export function canonicalizeUrl(raw: string): string {
  if (!raw) return "";
  let trimmed = raw.trim();
  try {
    const u = new URL(trimmed);
    u.hash = "";
    // Google News redirector wraps the real URL in ?url=... — unwrap when present.
    if (u.hostname.endsWith("news.google.com")) {
      const wrapped = u.searchParams.get("url");
      if (wrapped) trimmed = wrapped;
      else return u.toString();
    }
    const v = new URL(trimmed);
    v.hash = "";
    // Strip common tracking params; keep the rest so deep links still work.
    for (const key of [
      "utm_source",
      "utm_medium",
      "utm_campaign",
      "utm_term",
      "utm_content",
      "gclid",
      "fbclid",
      "ref",
      "ref_src",
    ]) {
      v.searchParams.delete(key);
    }
    let out = `${v.protocol}//${v.hostname.toLowerCase()}${v.pathname}${
      v.search
    }`;
    if (out.endsWith("/") && v.pathname !== "/") out = out.slice(0, -1);
    return out;
  } catch {
    return trimmed;
  }
}

function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

function stripTags(s: string): string {
  return decodeHtmlEntities(s.replace(/<[^>]*>/g, "")).replace(/\s+/g, " ").trim();
}

/** Pull the text between <tag>…</tag> (first match, CDATA-aware). */
function extractTag(xml: string, tag: string): string {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i");
  const m = xml.match(re);
  if (!m) return "";
  const inner = m[1].trim();
  const cdata = inner.match(/^<!\[CDATA\[([\s\S]*?)\]\]>$/);
  return (cdata ? cdata[1] : inner).trim();
}

/** Split an RSS/Atom feed into `<item>` or `<entry>` chunks. */
function splitItems(xml: string): string[] {
  const items: string[] = [];
  const re = /<(item|entry)[\s>][\s\S]*?<\/\1>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    items.push(m[0]);
  }
  return items;
}

/**
 * Apply the youth-pickleball relevance filter. Returns matched keywords; an
 * empty array means the item should be dropped.
 */
export function matchYouthPickleball(
  title: string,
  summary: string,
): string[] {
  const haystack = `${title} ${summary}`.toLowerCase();
  const pickle = PICKLEBALL_TERMS.find((t) => haystack.includes(t));
  if (!pickle) return [];
  const youth = YOUTH_TERMS.filter((t) => haystack.includes(t));
  if (youth.length === 0) return [];
  return [pickle, ...youth];
}

function parseRssDate(raw: string): string {
  if (!raw) return "";
  const d = new Date(raw);
  if (!Number.isNaN(d.getTime())) return d.toISOString();
  return "";
}

async function scrapeGoogleNews(query: string): Promise<RawNewsItem[]> {
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(
    query,
  )}&hl=en-US&gl=US&ceid=US:en`;
  const res = await fetchWithTimeout(url);
  if (!res || !res.ok) return [];
  const xml = await res.text();
  const out: RawNewsItem[] = [];
  for (const chunk of splitItems(xml)) {
    const title = stripTags(extractTag(chunk, "title"));
    const link = stripTags(extractTag(chunk, "link"));
    const desc = stripTags(extractTag(chunk, "description"));
    const pubDate = extractTag(chunk, "pubDate");
    const sourceMatch = chunk.match(/<source[^>]*>([\s\S]*?)<\/source>/i);
    const source = sourceMatch
      ? stripTags(sourceMatch[1])
      : "Google News";
    if (!title || !link) continue;
    const hits = matchYouthPickleball(title, desc);
    if (hits.length === 0) continue;
    out.push({
      title,
      url: canonicalizeUrl(link),
      source,
      summary: desc.slice(0, 400),
      published: parseRssDate(pubDate),
      keywordHits: hits,
    });
  }
  return out;
}

async function scrapeUsaPickleball(): Promise<RawNewsItem[]> {
  // USA Pickleball publishes a news RSS feed; if it ever goes away, this
  // fails soft and the other sources keep working.
  const res = await fetchWithTimeout("https://usapickleball.org/feed/");
  if (!res || !res.ok) return [];
  const xml = await res.text();
  const out: RawNewsItem[] = [];
  for (const chunk of splitItems(xml)) {
    const title = stripTags(extractTag(chunk, "title"));
    const link = stripTags(extractTag(chunk, "link"));
    const desc = stripTags(
      extractTag(chunk, "description") || extractTag(chunk, "content:encoded"),
    );
    const pubDate = extractTag(chunk, "pubDate");
    if (!title || !link) continue;
    const hits = matchYouthPickleball(title, desc);
    if (hits.length === 0) continue;
    out.push({
      title,
      url: canonicalizeUrl(link),
      source: "USA Pickleball",
      summary: desc.slice(0, 400),
      published: parseRssDate(pubDate),
      keywordHits: hits,
    });
  }
  return out;
}

async function scrapePpa(): Promise<RawNewsItem[]> {
  const res = await fetchWithTimeout("https://www.ppatour.com/feed/");
  if (!res || !res.ok) return [];
  const xml = await res.text();
  const out: RawNewsItem[] = [];
  for (const chunk of splitItems(xml)) {
    const title = stripTags(extractTag(chunk, "title"));
    const link = stripTags(extractTag(chunk, "link"));
    const desc = stripTags(
      extractTag(chunk, "description") || extractTag(chunk, "content:encoded"),
    );
    const pubDate = extractTag(chunk, "pubDate");
    if (!title || !link) continue;
    const hits = matchYouthPickleball(title, desc);
    if (hits.length === 0) continue;
    out.push({
      title,
      url: canonicalizeUrl(link),
      source: "PPA Tour",
      summary: desc.slice(0, 400),
      published: parseRssDate(pubDate),
      keywordHits: hits,
    });
  }
  return out;
}

interface RedditChild {
  data?: {
    title?: string;
    permalink?: string;
    url?: string;
    selftext?: string;
    created_utc?: number;
    subreddit?: string;
  };
}

async function scrapeReddit(): Promise<RawNewsItem[]> {
  // Reddit JSON listing — no auth needed, but they 429 aggressively without a
  // User-Agent. The custom UA above keeps us in the polite tier.
  const subs = ["Pickleball", "youthsports"];
  const out: RawNewsItem[] = [];
  for (const sub of subs) {
    const url = `https://www.reddit.com/r/${sub}/top.json?t=week&limit=25`;
    const res = await fetchWithTimeout(url);
    if (!res || !res.ok) continue;
    let data: { data?: { children?: RedditChild[] } };
    try {
      data = (await res.json()) as { data?: { children?: RedditChild[] } };
    } catch {
      continue;
    }
    const children = data.data?.children ?? [];
    for (const child of children) {
      const d = child.data ?? {};
      const title = d.title?.trim() ?? "";
      const permalink = d.permalink ? `https://www.reddit.com${d.permalink}` : "";
      const link = permalink || d.url || "";
      const summary = (d.selftext ?? "").slice(0, 400);
      if (!title || !link) continue;
      const hits = matchYouthPickleball(title, summary);
      if (hits.length === 0) continue;
      out.push({
        title,
        url: canonicalizeUrl(link),
        source: `r/${d.subreddit ?? sub}`,
        summary,
        published: d.created_utc
          ? new Date(d.created_utc * 1000).toISOString()
          : "",
        keywordHits: hits,
      });
    }
  }
  return out;
}

/**
 * Run every source in parallel, then dedupe by canonical URL (first source
 * wins — Google News usually has earlier coverage so it keeps the slot).
 * Returns at most `limit` items, newest first.
 */
export async function scrapeAll(limit: number = 50): Promise<RawNewsItem[]> {
  const settled = await Promise.allSettled([
    ...GOOGLE_NEWS_QUERIES.map(scrapeGoogleNews),
    scrapeUsaPickleball(),
    scrapePpa(),
    scrapeReddit(),
  ]);

  const all: RawNewsItem[] = [];
  for (const result of settled) {
    if (result.status === "fulfilled") all.push(...result.value);
    else console.warn("[news-scraper] source failed:", result.reason);
  }

  return dedupeAndSort(all).slice(0, limit);
}

export function dedupeAndSort(items: RawNewsItem[]): RawNewsItem[] {
  const seen = new Map<string, RawNewsItem>();
  for (const item of items) {
    if (!item.url) continue;
    if (!seen.has(item.url)) seen.set(item.url, item);
  }
  return [...seen.values()].sort((a, b) => {
    if (a.published && b.published) return b.published.localeCompare(a.published);
    if (a.published) return -1;
    if (b.published) return 1;
    return 0;
  });
}
