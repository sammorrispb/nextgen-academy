// Stamps the scheduled eval date onto a lead's row in the NGA Player CRM so the
// "Eval Date" column reflects what we just confirmed by email. Fail-soft: a
// missing key, no matching row, or a Notion error never blocks the send — the
// caller logs the result and moves on (the email is the core value).

import { playerCrmDbId } from "./notion-utils";

const NOTION_API = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";
// Player CRM id resolves through the shared env-backed constant
// (NOTION_PLAYER_CRM_DB_ID → legacy NOTION_DB_ID → literal fallback).

export interface SetEvalDateResult {
  updated: boolean;
  pageId?: string;
  reason?: string;
}

/**
 * Find the most-recent lead row by Parent Email and set its "Eval Date".
 * `date` is a date-only string ("YYYY-MM-DD") — we keep it date-only on purpose
 * to dodge UTC build-server off-by-one bugs (the precise time lives in the
 * email + .ics + Google Calendar event, not the CRM column).
 */
export async function setEvalDate(
  parentEmail: string,
  date: string,
): Promise<SetEvalDateResult> {
  const notionKey = process.env.NOTION_API_KEY;
  if (!notionKey) return { updated: false, reason: "NOTION_API_KEY missing" };

  const email = parentEmail.trim();
  if (!email) return { updated: false, reason: "no parent email" };

  try {
    const q = await fetch(`${NOTION_API}/databases/${playerCrmDbId()}/query`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${notionKey}`,
        "Content-Type": "application/json",
        "Notion-Version": NOTION_VERSION,
      },
      body: JSON.stringify({
        filter: { property: "Parent Email", email: { equals: email } },
        sorts: [{ timestamp: "created_time", direction: "descending" }],
        page_size: 1,
      }),
    });
    if (!q.ok) {
      return { updated: false, reason: `query failed (${q.status})` };
    }
    const data = (await q.json()) as { results?: { id: string }[] };
    const pageId = data.results?.[0]?.id;
    if (!pageId) return { updated: false, reason: "no matching lead row" };

    const patch = await fetch(`${NOTION_API}/pages/${pageId}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${notionKey}`,
        "Content-Type": "application/json",
        "Notion-Version": NOTION_VERSION,
      },
      body: JSON.stringify({
        properties: { "Eval Date": { date: { start: date } } },
      }),
    });
    if (!patch.ok) {
      return { updated: false, pageId, reason: `patch failed (${patch.status})` };
    }
    return { updated: true, pageId };
  } catch (err) {
    return {
      updated: false,
      reason: err instanceof Error ? err.message : "unknown error",
    };
  }
}
