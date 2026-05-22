/**
 * Read/write helpers for the NGA Newsletter Subscribers Notion DB
 * (NOTION_NEWSLETTER_DB_ID). Used by the weekly-newsletter cron (list Active
 * recipients) and the one-click unsubscribe route (flip a row to
 * Unsubscribed). The signup write path lives self-contained in
 * /api/newsletter/route.ts; this module owns the broadcast-side reads/writes.
 */

const NOTION_API = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";

export interface NewsletterSubscriber {
  pageId: string;
  parentName: string;
  email: string;
}

function readTitle(prop: unknown): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const p = prop as any;
  return p?.title?.map((t: { plain_text?: string }) => t.plain_text ?? "").join("") ?? "";
}

/**
 * Fetch all Active subscribers (paginated). Returns [] if env vars are missing
 * or the query fails — the caller logs and continues, never throws.
 */
export async function fetchActiveSubscribers(): Promise<NewsletterSubscriber[]> {
  const notionKey = process.env.NOTION_API_KEY;
  const db = process.env.NOTION_NEWSLETTER_DB_ID;
  if (!notionKey || !db) {
    console.warn("[notion-newsletter] missing NOTION_API_KEY or NOTION_NEWSLETTER_DB_ID");
    return [];
  }

  const subscribers: NewsletterSubscriber[] = [];
  let cursor: string | undefined;

  do {
    const res = await fetch(`${NOTION_API}/databases/${db}/query`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${notionKey}`,
        "Content-Type": "application/json",
        "Notion-Version": NOTION_VERSION,
      },
      body: JSON.stringify({
        filter: { property: "Status", select: { equals: "Active" } },
        page_size: 100,
        ...(cursor ? { start_cursor: cursor } : {}),
      }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error(`[notion-newsletter] query failed (${res.status}): ${text}`);
      return subscribers;
    }
    const data = await res.json();
    for (const page of data.results ?? []) {
      const props = page.properties ?? {};
      const email = props["Email"]?.email ?? "";
      if (!email) continue;
      subscribers.push({
        pageId: page.id,
        parentName: readTitle(props["Parent Name"]),
        email,
      });
    }
    cursor = data.has_more ? data.next_cursor : undefined;
  } while (cursor);

  return subscribers;
}

/**
 * Flip the row matching `email` to Status = Unsubscribed. Returns true if a
 * row was found and updated. Idempotent — re-running on an already-
 * unsubscribed address is a harmless no-op write.
 */
export async function unsubscribeByEmail(email: string): Promise<boolean> {
  const notionKey = process.env.NOTION_API_KEY;
  const db = process.env.NOTION_NEWSLETTER_DB_ID;
  if (!notionKey || !db) return false;

  const normalized = email.trim().toLowerCase();
  const queryRes = await fetch(`${NOTION_API}/databases/${db}/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${notionKey}`,
      "Content-Type": "application/json",
      "Notion-Version": NOTION_VERSION,
    },
    body: JSON.stringify({
      filter: { property: "Email", email: { equals: normalized } },
      page_size: 1,
    }),
  });
  if (!queryRes.ok) {
    const text = await queryRes.text().catch(() => "");
    console.error(`[notion-newsletter] unsub query failed (${queryRes.status}): ${text}`);
    return false;
  }
  const data = await queryRes.json();
  const pageId = data.results?.[0]?.id;
  if (!pageId) return false;

  const patchRes = await fetch(`${NOTION_API}/pages/${pageId}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${notionKey}`,
      "Content-Type": "application/json",
      "Notion-Version": NOTION_VERSION,
    },
    body: JSON.stringify({
      properties: { Status: { select: { name: "Unsubscribed" } } },
    }),
  });
  if (!patchRes.ok) {
    const text = await patchRes.text().catch(() => "");
    console.error(`[notion-newsletter] unsub patch failed (${patchRes.status}): ${text}`);
    return false;
  }
  return true;
}
