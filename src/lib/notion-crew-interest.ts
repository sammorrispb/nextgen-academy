import type {
  CrewLevel,
  CrewDay,
  CrewSubLevel,
} from "./validate-crew-interest";

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
  childSubLevel?: CrewSubLevel | "";
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
  if (row.childSubLevel) {
    properties["Skill Sub-Level"] = { select: { name: row.childSubLevel } };
  }
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

/**
 * A Crew Interest submission still awaiting a crew, read back for the follow-up
 * cron. "Actionable" = Status New or Reviewed — Sam-terminal states (Polled,
 * Matched, Closed, Declined, etc.) are excluded so a family that's already been
 * routed never gets a stale nudge or re-engagement.
 */
export interface ActionableCrewInterest {
  id: string;
  parentName: string;
  parentEmail: string;
  parentPhone: string;
  childFirstName: string;
  childBirthYear: number;
  childLevel: CrewLevel;
  childSubLevel: CrewSubLevel | null;
  preferredDays: CrewDay[];
  preferredTime: string;
  preferredArea: string;
  status: string;
  createdTime: string;
  nudgeSent: boolean;
  reengagementSent: boolean;
}

const ACTIONABLE_STATUSES = ["New", "Reviewed"];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function plain(prop: any): string {
  const arr = prop?.rich_text ?? prop?.title ?? [];
  if (!Array.isArray(arr)) return "";
  return arr.map((r: { plain_text?: string }) => r.plain_text ?? "").join("");
}

export async function fetchActionableCrewInterest(): Promise<
  ActionableCrewInterest[]
> {
  const notionKey = process.env.NOTION_API_KEY;
  const dbId = process.env.NOTION_CREW_INTEREST_DB_ID;
  if (!notionKey || !dbId) return [];

  const res = await fetch(`${NOTION_API}/databases/${dbId}/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${notionKey}`,
      "Content-Type": "application/json",
      "Notion-Version": NOTION_VERSION,
    },
    body: JSON.stringify({
      filter: {
        or: ACTIONABLE_STATUSES.map((s) => ({
          property: "Status",
          select: { equals: s },
        })),
      },
      sorts: [{ timestamp: "created_time", direction: "ascending" }],
      page_size: 100,
    }),
    cache: "no-store",
  });

  if (!res.ok) {
    console.error(
      "[notion-crew-interest] fetchActionable failed",
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
      id: page.id as string,
      parentName: plain(props["Parent Name"]),
      parentEmail: props["Parent Email"]?.email ?? "",
      parentPhone: props["Parent Phone"]?.phone_number ?? "",
      childFirstName: plain(props["Child First Name"]),
      childBirthYear:
        typeof props["Child Birth Year"]?.number === "number"
          ? props["Child Birth Year"].number
          : 0,
      childLevel: (props["Child Level"]?.select?.name ?? "Green") as CrewLevel,
      childSubLevel: (props["Skill Sub-Level"]?.select?.name ??
        null) as CrewSubLevel | null,
      preferredDays: (props["Preferred Days"]?.multi_select ?? []).map(
        (o: { name: string }) => o.name,
      ) as CrewDay[],
      preferredTime: plain(props["Preferred Time"]),
      preferredArea: plain(props["Preferred Location"]),
      status: props["Status"]?.select?.name ?? "",
      createdTime: page.created_time ?? "",
      nudgeSent: props["Nudge Sent"]?.checkbox === true,
      reengagementSent: props["Reengagement Sent"]?.checkbox === true,
    };
  });
}

export type CrewInterestFlag = "Nudge Sent" | "Reengagement Sent";

/** Flip a follow-up idempotency checkbox on a Crew Interest row. */
export async function markCrewInterestFlag(
  pageId: string,
  flag: CrewInterestFlag,
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
    body: JSON.stringify({ properties: { [flag]: { checkbox: true } } }),
  });
  if (!res.ok) {
    console.error(
      "[notion-crew-interest] markFlag failed",
      flag,
      res.status,
      await res.text().catch(() => ""),
    );
    return false;
  }
  return true;
}
