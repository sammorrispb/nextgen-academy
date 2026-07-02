/**
 * Read/write helpers for the NGA Crew Commits Notion DB
 * (NOTION_CREW_COMMITS_DB_ID). One row per parent who's locked in 4-week
 * auto-reservation after their first drop-in session. The daily
 * /api/cron/crew-autoreserve loop reads Active rows, charges the saved
 * card off-session, and writes a Confirmed drop-in row into the next
 * matching Sessions row.
 */

import { readPlainText } from "@/lib/notion-utils";

const NOTION_API = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";

export type CommitStatus =
  | "Active"
  | "Paused"
  | "Completed"
  | "Cancelled"
  | "CardFailed";

export interface CrewCommit {
  id: string;
  parentName: string;
  parentEmail: string;
  parentPhone: string;
  childFirstName: string;
  crewId: string;
  status: CommitStatus;
  stripeCustomerId: string;
  stripePaymentMethodId: string;
  weeksCommitted: number;
  weeksReserved: number;
  lastChargeAt: string;
  lastError: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function readSelect(prop: any): string {
  return prop?.select?.name ?? "";
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function readNumber(prop: any): number {
  return typeof prop?.number === "number" ? prop.number : 0;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function pageToCommit(page: any): CrewCommit {
  const p = page.properties ?? {};
  return {
    id: page.id,
    parentName: readPlainText(p["Parent Name"]),
    parentEmail: p["Parent Email"]?.email ?? "",
    parentPhone: p["Parent Phone"]?.phone_number ?? "",
    childFirstName: readPlainText(p["Child First Name"]),
    crewId: readPlainText(p["Crew ID"]),
    status: (readSelect(p["Status"]) as CommitStatus) || "Active",
    stripeCustomerId: readPlainText(p["Stripe Customer ID"]),
    stripePaymentMethodId: readPlainText(p["Stripe Payment Method ID"]),
    weeksCommitted: readNumber(p["Weeks Committed"]) || 4,
    weeksReserved: readNumber(p["Weeks Reserved"]),
    lastChargeAt: p["Last Charge At"]?.date?.start ?? "",
    lastError: readPlainText(p["Last Error"]),
  };
}

export async function fetchActiveCommits(): Promise<CrewCommit[]> {
  const notionKey = process.env.NOTION_API_KEY;
  const db = process.env.NOTION_CREW_COMMITS_DB_ID;
  if (!notionKey || !db) return [];

  const all: CrewCommit[] = [];
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
      cache: "no-store",
    });
    if (!res.ok) {
      console.error(
        "[notion-crew-commits] fetchActiveCommits failed",
        res.status,
        await res.text().catch(() => ""),
      );
      return all;
    }
    const data = await res.json();
    for (const page of data.results ?? []) all.push(pageToCommit(page));
    cursor = data.has_more ? data.next_cursor : undefined;
  } while (cursor);
  return all;
}

export async function findCommitByEmailChildCrew(
  parentEmail: string,
  childFirstName: string,
  crewId: string,
): Promise<CrewCommit | null> {
  const notionKey = process.env.NOTION_API_KEY;
  const db = process.env.NOTION_CREW_COMMITS_DB_ID;
  if (!notionKey || !db) return null;

  const res = await fetch(`${NOTION_API}/databases/${db}/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${notionKey}`,
      "Content-Type": "application/json",
      "Notion-Version": NOTION_VERSION,
    },
    body: JSON.stringify({
      filter: {
        and: [
          { property: "Parent Email", email: { equals: parentEmail } },
          {
            property: "Child First Name",
            rich_text: { equals: childFirstName },
          },
          { property: "Crew ID", rich_text: { equals: crewId } },
        ],
      },
      page_size: 1,
    }),
    cache: "no-store",
  });
  if (!res.ok) return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = (await res.json()) as { results: any[] };
  if (data.results.length === 0) return null;
  return pageToCommit(data.results[0]);
}

export interface CreateCommitInput {
  parentName: string;
  parentEmail: string;
  parentPhone: string;
  childFirstName: string;
  crewId: string;
  stripeCustomerId: string;
  stripePaymentMethodId: string;
  weeksCommitted?: number;
}

export async function createCommit(
  input: CreateCommitInput,
): Promise<{ ok: boolean; pageId?: string; error?: string }> {
  const notionKey = process.env.NOTION_API_KEY;
  const db = process.env.NOTION_CREW_COMMITS_DB_ID;
  if (!notionKey || !db) {
    return { ok: false, error: "NOTION_CREW_COMMITS_DB_ID not configured" };
  }

  const title = `${input.parentName} — ${input.childFirstName}`;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const properties: Record<string, any> = {
    "Parent Name": { title: [{ text: { content: title } }] },
    "Parent Email": { email: input.parentEmail },
    "Child First Name": {
      rich_text: [{ text: { content: input.childFirstName } }],
    },
    "Crew ID": { rich_text: [{ text: { content: input.crewId } }] },
    Status: { select: { name: "Active" } },
    "Stripe Customer ID": {
      rich_text: [{ text: { content: input.stripeCustomerId } }],
    },
    "Stripe Payment Method ID": {
      rich_text: [{ text: { content: input.stripePaymentMethodId } }],
    },
    "Weeks Committed": { number: input.weeksCommitted ?? 4 },
    "Weeks Reserved": { number: 0 },
  };
  if (input.parentPhone) {
    properties["Parent Phone"] = { phone_number: input.parentPhone };
  }

  const res = await fetch(`${NOTION_API}/pages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${notionKey}`,
      "Content-Type": "application/json",
      "Notion-Version": NOTION_VERSION,
    },
    body: JSON.stringify({ parent: { database_id: db }, properties }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return { ok: false, error: `Notion create failed (${res.status}): ${text}` };
  }
  const data = await res.json();
  return { ok: true, pageId: data.id };
}

export async function updateCommit(
  pageId: string,
  patch: Partial<{
    status: CommitStatus;
    weeksReserved: number;
    lastChargeAtIso: string;
    lastError: string;
  }>,
): Promise<boolean> {
  const notionKey = process.env.NOTION_API_KEY;
  if (!notionKey) return false;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const properties: Record<string, any> = {};
  if (patch.status) properties["Status"] = { select: { name: patch.status } };
  if (typeof patch.weeksReserved === "number") {
    properties["Weeks Reserved"] = { number: patch.weeksReserved };
  }
  if (patch.lastChargeAtIso) {
    properties["Last Charge At"] = { date: { start: patch.lastChargeAtIso } };
  }
  if (typeof patch.lastError === "string") {
    properties["Last Error"] = patch.lastError
      ? { rich_text: [{ text: { content: patch.lastError.slice(0, 1900) } }] }
      : { rich_text: [] };
  }
  if (Object.keys(properties).length === 0) return true;

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
    console.error(
      "[notion-crew-commits] updateCommit failed",
      res.status,
      await res.text().catch(() => ""),
    );
    return false;
  }
  return true;
}
