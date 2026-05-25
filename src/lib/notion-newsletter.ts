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
  /** HMAC ref token stamped at signup; null if the row predates the referral feature. */
  referralToken: string | null;
}

function readTitle(prop: unknown): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const p = prop as any;
  return p?.title?.map((t: { plain_text?: string }) => t.plain_text ?? "").join("") ?? "";
}

function readRichText(prop: unknown): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const p = prop as any;
  return (
    p?.rich_text
      ?.map((t: { plain_text?: string }) => t.plain_text ?? "")
      .join("") ?? ""
  );
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
        referralToken: readRichText(props["Referral Token"]) || null,
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

export interface SubscriberLookup {
  pageId: string;
  parentName: string;
  email: string;
  referredBy: string | null;
  referralRewarded: boolean;
  couponsIssued: number;
}

/**
 * Look up a subscriber by email — used by the Stripe webhook's referral path
 * to read both `Referred By` and `Referral Rewarded` so we know whether this
 * paid drop-in is the friend's first one and a reward is owed.
 *
 * Returns null on miss, on missing env vars, or on API failure. The webhook
 * treats null as "no referral to process" and continues.
 */
export async function findSubscriberByEmail(
  email: string,
): Promise<SubscriberLookup | null> {
  const notionKey = process.env.NOTION_API_KEY;
  const db = process.env.NOTION_NEWSLETTER_DB_ID;
  if (!notionKey || !db) return null;

  const normalized = email.trim().toLowerCase();
  if (!normalized) return null;

  const res = await fetch(`${NOTION_API}/databases/${db}/query`, {
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
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error(
      `[notion-newsletter] findSubscriberByEmail failed (${res.status}): ${text}`,
    );
    return null;
  }
  const data = await res.json();
  const page = data.results?.[0];
  if (!page) return null;
  const props = page.properties ?? {};
  return {
    pageId: page.id,
    parentName: readTitle(props["Parent Name"]),
    email: props["Email"]?.email ?? normalized,
    referredBy: props["Referred By"]?.email ?? null,
    referralRewarded: props["Referral Rewarded"]?.checkbox === true,
    couponsIssued:
      typeof props["Coupons Issued"]?.number === "number"
        ? props["Coupons Issued"].number
        : 0,
  };
}

/**
 * Mark a subscriber as having had their referral processed — flips
 * `Referral Rewarded` to true and increments `Coupons Issued`. Used in two
 * places by the Stripe webhook's referral path:
 *   1. On the friend's row, gates against double-rewarding the same friend
 *      if Stripe retries the webhook.
 *   2. On the referrer's row, tracks lifetime referral wins for reporting.
 *      (We never set `Referral Rewarded` on the referrer — they can refer
 *      multiple friends; only `Coupons Issued` accumulates.)
 *
 * Passes `flipRewarded: true` only on the friend's side. Failures are
 * logged and swallowed so the user-visible flow doesn't break on a Notion
 * blip.
 */
export async function markReferralIssued(
  pageId: string,
  opts: { flipRewarded: boolean; currentCount: number },
): Promise<boolean> {
  const notionKey = process.env.NOTION_API_KEY;
  if (!notionKey) return false;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const properties: Record<string, any> = {
    "Coupons Issued": { number: opts.currentCount + 1 },
  };
  if (opts.flipRewarded) {
    properties["Referral Rewarded"] = { checkbox: true };
  }

  const res = await fetch(`${NOTION_API}/pages/${pageId}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${notionKey}`,
      "Content-Type": "application/json",
      "Notion-Version": NOTION_VERSION,
    },
    body: JSON.stringify({ properties }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error(
      `[notion-newsletter] markReferralIssued failed (${res.status}): ${text}`,
    );
    return false;
  }
  return true;
}

