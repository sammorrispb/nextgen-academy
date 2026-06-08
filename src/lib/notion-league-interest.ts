import type { LeagueLevel } from "./validate-league-interest";
import type { LeagueBand } from "@/data/leagues";

/**
 * Write-side helper for the NGA League Interest Notion DB
 * (NOTION_LEAGUE_INTEREST_DB_ID). One row per parent submission — the
 * demand-validation signal for whether a band can fill before the P0 launch
 * spend. Sam reviews the table in Notion; there's no read path from the site.
 * Fails soft (returns ok:false) so a missing DB never blocks the welcome email
 * or the Open Brain ingest.
 */

const NOTION_API = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";

export interface LeagueInterestRow {
  parentName: string;
  email: string;
  phone: string;
  childFirstName: string;
  childBirthYear: number;
  preferredBand: LeagueBand;
  childLevel: LeagueLevel | "";
  notes: string;
  source: "Newsletter" | "Web" | "Other";
  marketingOptIn: boolean;
}

export async function createLeagueInterest(
  row: LeagueInterestRow,
): Promise<{ ok: boolean; pageId?: string; error?: string }> {
  const notionKey = process.env.NOTION_API_KEY;
  const dbId = process.env.NOTION_LEAGUE_INTEREST_DB_ID;
  if (!notionKey || !dbId) {
    return { ok: false, error: "NOTION_LEAGUE_INTEREST_DB_ID not configured" };
  }

  const title =
    `${row.childFirstName} — ${row.preferredBand}${row.childLevel ? ` (${row.childLevel})` : ""}`.slice(
      0,
      200,
    );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const properties: Record<string, any> = {
    Submission: { title: [{ text: { content: title } }] },
    "Parent Name": { rich_text: [{ text: { content: row.parentName } }] },
    "Parent Email": { email: row.email },
    "Child First Name": {
      rich_text: [{ text: { content: row.childFirstName } }],
    },
    "Child Birth Year": { number: row.childBirthYear },
    "Preferred Band": { select: { name: row.preferredBand } },
    Status: { select: { name: "New" } },
    Source: { select: { name: row.source } },
    "Marketing Opt-In": { checkbox: row.marketingOptIn },
  };
  if (row.childLevel) {
    properties["Child Level"] = { select: { name: row.childLevel } };
  }
  if (row.phone) {
    properties["Parent Phone"] = { phone_number: row.phone };
  }
  if (row.notes) {
    properties.Notes = { rich_text: [{ text: { content: row.notes } }] };
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
    const text = await res.text().catch(() => "");
    return {
      ok: false,
      error: `Notion league-interest create failed (${res.status}): ${text}`,
    };
  }
  const data = await res.json();
  return { ok: true, pageId: data.id };
}
