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
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function blocksToHtml(blocks: any[]): string {
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
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function blocksToText(blocks: any[]): string {
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
 * Return the most recent Approved newsletter draft within the last 7 days,
 * or null if none. The cron uses this to decide whether to inject a "From
 * Coach Sam" lead block. Fails soft — any Notion error returns null so the
 * static-tip-bank email still ships.
 */
export async function fetchApprovedNewsletterDraft(): Promise<NewsletterDraft | null> {
  const notionKey = process.env.NOTION_API_KEY;
  const dbId = process.env.NOTION_NEWSLETTER_DRAFTS_DB_ID;
  if (!notionKey || !dbId) return null;

  // 7-day window prevents stale Approved rows from earlier weeks shipping if
  // Sam never flipped them to Skip. The drafter writes a fresh row every Wed
  // so a current-week Approved row will always supersede when present.
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  const queryRes = await fetch(`${NOTION_API}/databases/${dbId}/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${notionKey}`,
      "Content-Type": "application/json",
      "Notion-Version": NOTION_VERSION,
    },
    body: JSON.stringify({
      filter: {
        and: [
          { property: "Status", select: { equals: "Approved" } },
          { property: "Drafted At", date: { on_or_after: cutoff } },
        ],
      },
      sorts: [{ property: "Drafted At", direction: "descending" }],
      page_size: 1,
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
  const row = queryData.results[0];
  if (!row) return null;

  const props = row.properties ?? {};
  const weekTitle = readTitle(props["Week"]);
  const sourceRadar = (props["Source Radar"]?.url ?? "") as string;
  const sectionCount = (props["Section Count"]?.number ?? 0) as number;

  // Pull the page's child blocks (the actual newsletter section markdown,
  // stored as native Notion blocks). 100-block cap is fine — drafter rows
  // are short (1-3 sections × ~10 blocks each).
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
