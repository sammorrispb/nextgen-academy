/**
 * Read helper for the NGA Newsletter Drafts Notion DB
 * (NOTION_NEWSLETTER_DRAFTS_DB_ID). The drafter cloud routine writes a new
 * Pending row each Wednesday morning containing Coach-voice newsletter
 * sections sourced from the Tuesday NGA News Radar.
 *
 * Sam flips a row's Status to 'Approved' (in Notion) before Thursday 6pm ET.
 * The weekly-newsletter cron then fetches the most recent approved row whose
 * Drafted At falls within the last 7 days, converts its page body blocks to
 * HTML, and renders it as a "From Coach Sam" lead block between the Coach
 * Tip and the existing news-cards block.
 *
 * Status=Pending or Skip = cron sends the existing static-tip-bank email
 * unchanged. Nothing ships without Sam's explicit approval.
 *
 * "Expires At" guardrail (optional date property on the Drafts DB): the last
 * date a row may ship, inclusive. A time-sensitive Approved row (e.g. an event
 * promo) is NOT retired after a send, so without this guard it would re-inject
 * on the next Thursday as long as its Drafted At is still inside the 7-day
 * window — shipping a promo for an event that already happened. The query now
 * excludes any row whose Expires At is before today (ET). Empty Expires At = no
 * expiry: behaviour is unchanged and the existing 7-day Drafted At window stays
 * the only freshness guard for that row.
 */
import { c } from "@/lib/email/brand";

const NOTION_API = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";

/** A newsletter section ready to render in the email. */
export interface NewsletterDraft {
  pageId: string;
  weekTitle: string;
  sourceRadar: string;
  /** Pre-rendered HTML for the section body (already styled with brand tokens). */
  html: string;
  /** Plain-text equivalent for the text/plain MIME part. */
  text: string;
  sectionCount: number;
}

interface NotionRichText {
  plain_text?: string;
  href?: string | null;
  annotations?: {
    bold?: boolean;
    italic?: boolean;
    code?: boolean;
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function readTitle(prop: any): string {
  const arr = prop?.title ?? [];
  if (!Array.isArray(arr)) return "";
  return arr.map((r: NotionRichText) => r.plain_text ?? "").join("");
}

function escape(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Render a Notion rich-text array to inline HTML. Handles bold/italic/code
 * annotations and href links. Unknown annotations are ignored — the drafter
 * only emits the subset we render here, per the routine prompt.
 */
function renderRichText(rich: NotionRichText[]): string {
  return rich
    .map((r) => {
      let text = escape(r.plain_text ?? "");
      if (r.annotations?.code) text = `<code>${text}</code>`;
      if (r.annotations?.italic) text = `<em>${text}</em>`;
      if (r.annotations?.bold) text = `<strong>${text}</strong>`;
      if (r.href) {
        text = `<a href="${escape(r.href)}" style="color:${c.link};text-decoration:underline;">${text}</a>`;
      }
      return text;
    })
    .join("");
}

/**
 * Convert the Notion blocks returned by the API into email-safe HTML, styled
 * to match the existing weekly-newsletter template aesthetic.
 *
 * Block types intentionally supported: heading_2, heading_3, paragraph,
 * divider, bulleted_list_item, numbered_list_item. Anything else is skipped
 * (the drafter prompt restricts the routine to this subset; an unknown block
 * means the drafter went off-pattern, and silently skipping is preferable to
 * shipping unstyled content).
 */
// Exported (2026-07 Phase 1b) so the coach inbox renders a pending draft's
// body with the EXACT renderer the Thursday cron ships with — never a rewrite.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function blocksToHtml(blocks: any[]): string {
  const out: string[] = [];
  let listBuffer: { type: "ul" | "ol"; items: string[] } | null = null;

  const flushList = () => {
    if (!listBuffer) return;
    const tag = listBuffer.type;
    out.push(
      `<${tag} style="margin:0 0 12px 0;padding-left:22px;color:${c.text};font-size:14px;line-height:1.6;">${listBuffer.items.join("")}</${tag}>`,
    );
    listBuffer = null;
  };

  for (const block of blocks) {
    const type = block.type;
    if (type === "bulleted_list_item" || type === "numbered_list_item") {
      const tag = type === "bulleted_list_item" ? "ul" : "ol";
      if (!listBuffer || listBuffer.type !== tag) {
        flushList();
        listBuffer = { type: tag, items: [] };
      }
      const rich = (block[type]?.rich_text ?? []) as NotionRichText[];
      listBuffer.items.push(`<li>${renderRichText(rich)}</li>`);
      continue;
    }
    flushList();

    if (type === "heading_2" || type === "heading_3") {
      const rich = (block[type]?.rich_text ?? []) as NotionRichText[];
      const text = renderRichText(rich);
      if (!text) continue;
      out.push(
        `<h3 style="margin:18px 0 8px 0;font-family:Montserrat,Arial,sans-serif;font-size:16px;font-weight:900;color:${c.text};">${text}</h3>`,
      );
    } else if (type === "paragraph") {
      const rich = (block.paragraph?.rich_text ?? []) as NotionRichText[];
      const text = renderRichText(rich);
      if (!text) continue;
      out.push(
        `<p style="margin:0 0 12px 0;color:${c.text};font-size:14px;line-height:1.6;">${text}</p>`,
      );
    } else if (type === "divider") {
      out.push(
        `<hr style="border:0;border-top:1px solid ${c.border};margin:18px 0;" />`,
      );
    }
  }

  flushList();
  return out.join("\n");
}

/** Inline rich-text → plain text. Links render as `text (url)`. */
function richToText(rich: NotionRichText[]): string {
  return rich
    .map((r) => {
      const plain = r.plain_text ?? "";
      if (r.href && r.href !== plain) return `${plain} (${r.href})`;
      return plain;
    })
    .join("");
}

/**
 * Mirror of blocksToHtml that emits plain text for the text/plain MIME part.
 * Same supported subset (headings, paragraphs, dividers, bullet/numbered
 * lists). Blank line between blocks for readability.
 */
// Exported (2026-07 Phase 1b) — same reasoning as blocksToHtml.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function blocksToText(blocks: any[]): string {
  const lines: string[] = [];
  let numberedIndex = 0;
  let prevType: string | null = null;

  for (const block of blocks) {
    const type = block.type;
    if (type !== "numbered_list_item") numberedIndex = 0;

    if (type === "bulleted_list_item") {
      const rich = (block.bulleted_list_item?.rich_text ?? []) as NotionRichText[];
      lines.push(`- ${richToText(rich)}`);
    } else if (type === "numbered_list_item") {
      numberedIndex++;
      const rich = (block.numbered_list_item?.rich_text ?? []) as NotionRichText[];
      lines.push(`${numberedIndex}. ${richToText(rich)}`);
    } else if (type === "heading_2" || type === "heading_3") {
      const rich = (block[type]?.rich_text ?? []) as NotionRichText[];
      const text = richToText(rich);
      if (!text) continue;
      if (prevType) lines.push("");
      lines.push(text);
    } else if (type === "paragraph") {
      const rich = (block.paragraph?.rich_text ?? []) as NotionRichText[];
      const text = richToText(rich);
      if (!text) continue;
      if (prevType) lines.push("");
      lines.push(text);
    } else if (type === "divider") {
      if (prevType) lines.push("");
      lines.push("---");
    }
    prevType = type;
  }

  return lines.join("\n");
}

/**
 * Build the Notion query filter for Approved drafts that are still eligible to
 * ship. Pure (no I/O) so it's unit-testable. Three conditions, all ANDed:
 *   1. Status = Approved.
 *   2. Drafted At on_or_after `cutoff` (the 7-day freshness window).
 *   3. Expires At is empty OR on_or_after `todayEt` — i.e. the row hasn't
 *      passed its inclusive last-ship date. Empty Expires At = no expiry, so
 *      such rows rely solely on the 7-day Drafted At window (unchanged
 *      behaviour). This is what stops a time-sensitive Approved row (an event
 *      promo) from re-injecting after its event has passed.
 */
export function buildDraftsQueryFilter(cutoff: string, todayEt: string) {
  return {
    and: [
      { property: "Status", select: { equals: "Approved" } },
      { property: "Drafted At", date: { on_or_after: cutoff } },
      {
        or: [
          { property: "Expires At", date: { is_empty: true } },
          { property: "Expires At", date: { on_or_after: todayEt } },
        ],
      },
    ],
  };
}

/**
 * Query the drafts DB for Approved rows whose Drafted At falls within the last
 * 7 days AND whose Expires At (if set) has not passed. Returns the raw Notion
 * rows (or null on a query error so callers can fail soft). The 7-day window
 * prevents stale Approved rows from earlier weeks shipping if Sam never flipped
 * them to Skip; with weekly sends and a date-only window, each Approved row is
 * caught by exactly one Thursday broadcast. The Expires At guard additionally
 * excludes any row past its inclusive last-ship date (empty = no expiry), so a
 * time-sensitive promo can't re-inject for an event that already happened.
 */
async function queryApprovedRows(
  notionKey: string,
  dbId: string,
  opts: { pageSize: number; direction: "ascending" | "descending" },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any[] | null> {
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  // ET-anchored YYYY-MM-DD (en-CA yields ISO date order). Avoids the
  // new Date(y,m,d) UTC-build off-by-one hazard.
  const todayEt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
  }).format(new Date());

  const queryRes = await fetch(`${NOTION_API}/databases/${dbId}/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${notionKey}`,
      "Content-Type": "application/json",
      "Notion-Version": NOTION_VERSION,
    },
    body: JSON.stringify({
      filter: buildDraftsQueryFilter(cutoff, todayEt),
      sorts: [{ property: "Drafted At", direction: opts.direction }],
      page_size: opts.pageSize,
    }),
    cache: "no-store",
  });
  if (!queryRes.ok) {
    console.error(
      "[notion-newsletter-drafts] query failed",
      queryRes.status,
      await queryRes.text().catch(() => ""),
    );
    return null;
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const queryData = (await queryRes.json()) as { results: any[] };
  return queryData.results;
}

/**
 * Fetch a draft row's child blocks (the actual newsletter section markdown,
 * stored as native Notion blocks) and build a NewsletterDraft. Returns null on
 * a blocks-fetch error or empty body. 100-block cap is fine — drafter rows are
 * short (1-3 sections × ~10 blocks each).
 */
async function buildDraftFromRow(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  row: any,
  notionKey: string,
): Promise<NewsletterDraft | null> {
  const props = row.properties ?? {};
  const weekTitle = readTitle(props["Week"]);
  const sourceRadar = (props["Source Radar"]?.url ?? "") as string;
  const sectionCount = (props["Section Count"]?.number ?? 0) as number;

  const blocksRes = await fetch(
    `${NOTION_API}/blocks/${row.id}/children?page_size=100`,
    {
      headers: {
        Authorization: `Bearer ${notionKey}`,
        "Notion-Version": NOTION_VERSION,
      },
      cache: "no-store",
    },
  );
  if (!blocksRes.ok) {
    console.error(
      "[notion-newsletter-drafts] blocks fetch failed",
      blocksRes.status,
      await blocksRes.text().catch(() => ""),
    );
    return null;
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const blocksData = (await blocksRes.json()) as { results: any[] };
  const html = blocksToHtml(blocksData.results);
  const text = blocksToText(blocksData.results);
  if (!html.trim()) return null;

  return {
    pageId: row.id as string,
    weekTitle,
    sourceRadar,
    html,
    text,
    sectionCount,
  };
}

/**
 * Return ALL Approved newsletter drafts within the last 7 days, oldest first.
 * The cron concatenates these into the "From Coach Sam" lead block so that
 * *every* row Sam approved in a given week ships — not just the most recent.
 * (A second Approved row — e.g. an event promo alongside the weekly drafter
 * row — used to be silently dropped by the single-row fetch.) Fails soft: any
 * Notion error returns []. Empty when nothing is approved → block stays hidden.
 */
export async function fetchApprovedNewsletterDrafts(): Promise<
  NewsletterDraft[]
> {
  const notionKey = process.env.NOTION_API_KEY;
  const dbId = process.env.NOTION_NEWSLETTER_DRAFTS_DB_ID;
  if (!notionKey || !dbId) return [];

  const rows = await queryApprovedRows(notionKey, dbId, {
    pageSize: 100,
    direction: "ascending",
  });
  if (!rows) return [];

  const drafts: NewsletterDraft[] = [];
  for (const row of rows) {
    const draft = await buildDraftFromRow(row, notionKey);
    if (draft) drafts.push(draft);
  }
  return drafts;
}

/**
 * Stamp "Sent At" on each draft row that shipped in this broadcast. Fire-and-
 * forget: a Notion write failure is logged but never throws so the cron's
 * response is unaffected. Date is YYYY-MM-DD (ET-anchored by the caller).
 */
export async function stampDraftsSentAt(
  pageIds: string[],
  sentDate: string,
): Promise<void> {
  const notionKey = process.env.NOTION_API_KEY;
  if (!notionKey || !pageIds.length) return;
  await Promise.allSettled(
    pageIds.map((id) =>
      fetch(`${NOTION_API}/pages/${id}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${notionKey}`,
          "Content-Type": "application/json",
          "Notion-Version": NOTION_VERSION,
        },
        body: JSON.stringify({
          properties: { "Sent At": { date: { start: sentDate } } },
        }),
      }).then((r) => {
        if (!r.ok)
          console.warn(
            `[notion-newsletter-drafts] stampSentAt failed for ${id}`,
            r.status,
          );
      }),
    ),
  );
}

/**
 * The Drafts DB Status vocabulary (see the drafter-pipeline doc in CLAUDE.md):
 * the Wednesday cloud drafter writes Pending; Sam flips to Approved (ships
 * Thursday) or Skip (suppressed). The inbox may write ONLY Approved | Skip —
 * it never resets a row to Pending and there is no other value to invent.
 */
export type NewsletterDraftStatus = "Pending" | "Approved" | "Skip";

/** A Pending draft awaiting Sam's review in the coach inbox. */
export interface PendingNewsletterDraft extends NewsletterDraft {
  /** Drafted At (YYYY-MM-DD or ISO). Empty when the property is unset. */
  draftedAt: string;
}

/** Pure filter for the pending-review queue; pinned by e2e/coach-inbox.spec.ts. */
export function buildPendingDraftsQueryFilter() {
  return {
    property: "Status",
    select: { equals: "Pending" satisfies NewsletterDraftStatus },
  };
}

/**
 * A draft is approvable only when its RENDERED body has real content —
 * approval is approval of read content, and an empty render means there is
 * nothing to have read. Pure; setDraftStatus enforces it server-side.
 */
export function isDraftBodyApprovable(renderedText: string): boolean {
  return renderedText.trim().length > 0;
}

/**
 * Return Pending drafts for the coach inbox, newest first, each with its
 * body rendered by the same blocksToHtml/blocksToText the cron uses. Rows
 * whose body renders empty are dropped (nothing to review → nothing to
 * approve). Fails soft to [] on any Notion error.
 */
export async function fetchPendingDrafts(): Promise<PendingNewsletterDraft[]> {
  const notionKey = process.env.NOTION_API_KEY;
  const dbId = process.env.NOTION_NEWSLETTER_DRAFTS_DB_ID;
  if (!notionKey || !dbId) return [];

  const res = await fetch(`${NOTION_API}/databases/${dbId}/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${notionKey}`,
      "Content-Type": "application/json",
      "Notion-Version": NOTION_VERSION,
    },
    body: JSON.stringify({
      filter: buildPendingDraftsQueryFilter(),
      sorts: [{ property: "Drafted At", direction: "descending" }],
      page_size: 25,
    }),
    cache: "no-store",
  });
  if (!res.ok) {
    console.error(
      "[notion-newsletter-drafts] fetchPendingDrafts failed",
      res.status,
      await res.text().catch(() => ""),
    );
    return [];
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = (await res.json()) as { results: any[] };

  const pending: PendingNewsletterDraft[] = [];
  for (const row of data.results) {
    const draft = await buildDraftFromRow(row, notionKey);
    if (!draft) continue;
    pending.push({
      ...draft,
      draftedAt: row.properties?.["Drafted At"]?.date?.start ?? "",
    });
  }
  return pending;
}

/**
 * Flip a draft row's Status from the coach inbox. The inbox may only write
 * Approved | Skip (never Pending — that's the drafter's state).
 *
 * Approve gate: before PATCHing to Approved, the row's body is re-fetched
 * and re-rendered; an empty render REFUSES the approval. This keeps the
 * "nothing ships un-reviewed" guarantee server-side — hiding the button in
 * the UI is convenience, not the gate. Pinned by
 * e2e/invariant-coach-inbox-authz.spec.ts.
 */
export async function setDraftStatus(
  pageId: string,
  status: Extract<NewsletterDraftStatus, "Approved" | "Skip">,
): Promise<{ ok: boolean; error?: string }> {
  const notionKey = process.env.NOTION_API_KEY;
  if (!notionKey) return { ok: false, error: "NOTION_API_KEY not configured" };

  if (status === "Approved") {
    const blocksRes = await fetch(
      `${NOTION_API}/blocks/${pageId}/children?page_size=100`,
      {
        headers: {
          Authorization: `Bearer ${notionKey}`,
          "Notion-Version": NOTION_VERSION,
        },
        cache: "no-store",
      },
    );
    if (!blocksRes.ok) {
      return {
        ok: false,
        error: `Could not read the draft body (${blocksRes.status}) — not approving unread content.`,
      };
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const blocksData = (await blocksRes.json()) as { results: any[] };
    if (!isDraftBodyApprovable(blocksToText(blocksData.results))) {
      return {
        ok: false,
        error: "Draft body is empty — there is nothing to approve.",
      };
    }
  }

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
      "[notion-newsletter-drafts] setDraftStatus failed",
      res.status,
      await res.text().catch(() => ""),
    );
    return { ok: false, error: `Notion update failed (${res.status})` };
  }
  return { ok: true };
}

/**
 * Return the most recent Approved newsletter draft within the last 7 days, or
 * null if none. Retained for callers/tests that want a single row; the cron
 * uses fetchApprovedNewsletterDrafts (plural) so all approved rows ship. Fails
 * soft — any Notion error returns null.
 */
export async function fetchApprovedNewsletterDraft(): Promise<NewsletterDraft | null> {
  const notionKey = process.env.NOTION_API_KEY;
  const dbId = process.env.NOTION_NEWSLETTER_DRAFTS_DB_ID;
  if (!notionKey || !dbId) return null;

  const rows = await queryApprovedRows(notionKey, dbId, {
    pageSize: 1,
    direction: "descending",
  });
  if (!rows || !rows[0]) return null;
  return buildDraftFromRow(rows[0], notionKey);
}
