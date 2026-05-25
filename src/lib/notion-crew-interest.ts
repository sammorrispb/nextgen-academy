import type { CrewLevel, CrewDay } from "./validate-crew-interest";

/**
 * Write-side helper for the NGA Crew Interest Notion DB
 * (NOTION_CREW_INTEREST_DB_ID). One row per parent submission. Sam reviews
 * the table in Notion and decides whether to spin up a new Crew Poll for the
 * day/level mix coming through. There's no read path from the site — the
 * source of truth for "what to do next with this submission" is the Notion
 * Status column Sam manages.
 */

const NOTION_API = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";

export interface CrewInterestRow {
  parentName: string;
  email: string;
  phone: string;
  childFirstName: string;
  childBirthYear: number;
  childLevel: CrewLevel;
  preferredDays: CrewDay[];
  preferredTime: string;
  preferredLocation: string;
  friendsWanted: string;
  notes: string;
  source: "Newsletter" | "Web" | "Other";
  marketingOptIn: boolean;
}

export async function createCrewInterest(
  row: CrewInterestRow,
): Promise<{ ok: boolean; pageId?: string; error?: string }> {
  const notionKey = process.env.NOTION_API_KEY;
  const dbId = process.env.NOTION_CREW_INTEREST_DB_ID;
  if (!notionKey || !dbId) {
    return { ok: false, error: "NOTION_CREW_INTEREST_DB_ID not configured" };
  }

  const dayList = row.preferredDays.join("/");
  const title =
    `${row.childFirstName} (${row.childLevel}) — ${dayList} ${row.preferredTime}`.slice(
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
    "Child Level": { select: { name: row.childLevel } },
    "Preferred Days": {
      multi_select: row.preferredDays.map((d) => ({ name: d })),
    },
    "Preferred Time": {
      rich_text: [{ text: { content: row.preferredTime } }],
    },
    Status: { select: { name: "New" } },
    Source: { select: { name: row.source } },
    "Marketing Opt-In": { checkbox: row.marketingOptIn },
  };
  if (row.phone) {
    properties["Parent Phone"] = { phone_number: row.phone };
  }
  if (row.preferredLocation) {
    properties["Preferred Location"] = {
      rich_text: [{ text: { content: row.preferredLocation } }],
    };
  }
  if (row.friendsWanted) {
    properties["Friends Wanted"] = {
      rich_text: [{ text: { content: row.friendsWanted } }],
    };
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
      error: `Notion crew-interest create failed (${res.status}): ${text}`,
    };
  }
  const data = await res.json();
  return { ok: true, pageId: data.id };
}
