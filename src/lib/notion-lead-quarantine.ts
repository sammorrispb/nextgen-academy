import { playerCrmDbId } from "./notion-utils";

/**
 * Write side of the lead-CRM opt-out: tick `Quarantine` on EVERY row a parent
 * owns.
 *
 * Quarantine is the documented CRM opt-out (docs/unsubscribe-runbook.md) and
 * classifyLead honours it before any provenance check, so one tick suppresses
 * that family from every lead-marketing sender.
 *
 * All rows, not the first match: the CRM holds 405 rows for 257 families
 * (botched syncs, per-child rows, re-imports). Quarantining one row and
 * leaving the duplicates clean is precisely the per-row hole that
 * resolveFamilyBucket closes on the read side — this closes it on the write
 * side too, so the opt-out survives even if the family folding is ever
 * bypassed. Defence in depth on the one action a person explicitly asked for.
 */

const NOTION_API = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";

export interface QuarantineResult {
  ok: boolean;
  rowsUpdated: number;
  /** True when the address matched no CRM row (already gone, or never a lead). */
  notFound: boolean;
}

export async function quarantineLeadByEmail(
  email: string,
): Promise<QuarantineResult> {
  const notionKey = process.env.NOTION_API_KEY;
  if (!notionKey) {
    console.error("[lead-quarantine] NOTION_API_KEY missing");
    return { ok: false, rowsUpdated: 0, notFound: false };
  }
  const db = playerCrmDbId();
  const normalized = email.trim().toLowerCase();

  const pageIds: string[] = [];
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
        filter: { property: "Parent Email", email: { equals: normalized } },
        page_size: 100,
        ...(cursor ? { start_cursor: cursor } : {}),
      }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error(`[lead-quarantine] query failed (${res.status}): ${text}`);
      return { ok: false, rowsUpdated: 0, notFound: false };
    }
    const data = await res.json();
    for (const page of data.results ?? []) if (page.id) pageIds.push(page.id);
    cursor = data.has_more ? data.next_cursor : undefined;
  } while (cursor);

  if (pageIds.length === 0) {
    return { ok: true, rowsUpdated: 0, notFound: true };
  }

  let updated = 0;
  let failed = 0;
  for (const pageId of pageIds) {
    const res = await fetch(`${NOTION_API}/pages/${pageId}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${notionKey}`,
        "Content-Type": "application/json",
        "Notion-Version": NOTION_VERSION,
      },
      body: JSON.stringify({ properties: { Quarantine: { checkbox: true } } }),
    });
    if (res.ok) updated++;
    else {
      failed++;
      const text = await res.text().catch(() => "");
      console.error(
        `[lead-quarantine] patch ${pageId} failed (${res.status}): ${text}`,
      );
    }
  }

  // Partial success is NOT ok: an un-quarantined duplicate row can still be
  // mailed, so the caller must surface a real failure rather than a false
  // "you're unsubscribed".
  return { ok: failed === 0, rowsUpdated: updated, notFound: false };
}
