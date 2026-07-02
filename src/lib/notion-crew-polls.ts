import type { Level, Vote } from "@/lib/validate-poll-vote";
import { readPlainText } from "@/lib/notion-utils";

/**
 * Read/write helpers for the NGA Crew Polls Notion DB
 * (NOTION_CREW_POLLS_DB_ID) and the NGA Poll Responses DB
 * (NOTION_POLL_RESPONSES_DB_ID).
 *
 * Polls are coach-owned candidate slots Sam drops to WhatsApp; Responses are
 * one-row-per-parent-vote, related back to the parent Poll. Sam never
 * publishes a poll through the site — he creates the row in Notion and
 * shares /poll/<slug> on WhatsApp.
 */

const NOTION_API = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";

export type PollStatus = "Draft" | "Open" | "Closed" | "Confirmed" | "Cancelled";

export interface CrewPoll {
  id: string;
  slug: string;
  title: string;
  status: PollStatus;
  day: string;
  startTime: string;
  endTime: string;
  location: string;
  level: Level | "";
  minPartySize: number;
  coachNotes: string;
}

export interface PollResponse {
  id: string;
  pollId: string;
  parentName: string;
  email: string;
  phone: string;
  childFirstName: string;
  childBirthYear: number;
  childLevel: Level | "";
  vote: Vote | "";
  note: string;
  createdTime: string;
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
function pageToPoll(page: any): CrewPoll {
  const p = page.properties ?? {};
  return {
    id: page.id,
    slug: readPlainText(p["Slug"]),
    title: readPlainText(p["Title"]),
    status: (readSelect(p["Status"]) as PollStatus) || "Draft",
    day: readPlainText(p["Day"]),
    startTime: readPlainText(p["Start Time"]),
    endTime: readPlainText(p["End Time"]),
    location: readPlainText(p["Location"]),
    level: (readSelect(p["Level"]) as Level) || "",
    minPartySize: readNumber(p["Min Party Size"]) || 4,
    coachNotes: readPlainText(p["Coach Notes"]),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function pageToResponse(page: any): PollResponse {
  const p = page.properties ?? {};
  const relation = p["Poll"]?.relation ?? [];
  return {
    id: page.id,
    pollId: relation[0]?.id ?? "",
    parentName: readPlainText(p["Parent Name"]),
    email: p["Parent Email"]?.email ?? "",
    phone: p["Parent Phone"]?.phone_number ?? "",
    childFirstName: readPlainText(p["Child First Name"]),
    childBirthYear: readNumber(p["Child Birth Year"]),
    childLevel: (readSelect(p["Child Level"]) as Level) || "",
    vote: (readSelect(p["Vote"]) as Vote) || "",
    note: readPlainText(p["Note"]),
    createdTime: page.created_time ?? "",
  };
}

export async function fetchPollBySlug(slug: string): Promise<CrewPoll | null> {
  const notionKey = process.env.NOTION_API_KEY;
  const db = process.env.NOTION_CREW_POLLS_DB_ID;
  if (!notionKey || !db || !slug) return null;

  const res = await fetch(`${NOTION_API}/databases/${db}/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${notionKey}`,
      "Content-Type": "application/json",
      "Notion-Version": NOTION_VERSION,
    },
    body: JSON.stringify({
      filter: { property: "Slug", rich_text: { equals: slug } },
      page_size: 1,
    }),
    cache: "no-store",
  });
  if (!res.ok) {
    console.error(
      "[notion-crew-polls] fetchPollBySlug failed",
      res.status,
      await res.text().catch(() => ""),
    );
    return null;
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = (await res.json()) as { results: any[] };
  if (data.results.length === 0) return null;
  return pageToPoll(data.results[0]);
}

export async function fetchOpenPolls(): Promise<CrewPoll[]> {
  const notionKey = process.env.NOTION_API_KEY;
  const db = process.env.NOTION_CREW_POLLS_DB_ID;
  if (!notionKey || !db) return [];

  const res = await fetch(`${NOTION_API}/databases/${db}/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${notionKey}`,
      "Content-Type": "application/json",
      "Notion-Version": NOTION_VERSION,
    },
    body: JSON.stringify({
      filter: { property: "Status", select: { equals: "Open" } },
      sorts: [{ timestamp: "created_time", direction: "descending" }],
      page_size: 50,
    }),
    cache: "no-store",
  });
  if (!res.ok) return [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = (await res.json()) as { results: any[] };
  return data.results.map(pageToPoll);
}

export async function fetchPollResponses(
  pollId: string,
): Promise<PollResponse[]> {
  const notionKey = process.env.NOTION_API_KEY;
  const db = process.env.NOTION_POLL_RESPONSES_DB_ID;
  if (!notionKey || !db || !pollId) return [];

  const res = await fetch(`${NOTION_API}/databases/${db}/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${notionKey}`,
      "Content-Type": "application/json",
      "Notion-Version": NOTION_VERSION,
    },
    body: JSON.stringify({
      filter: { property: "Poll", relation: { contains: pollId } },
      sorts: [{ timestamp: "created_time", direction: "ascending" }],
      page_size: 100,
    }),
    cache: "no-store",
  });
  if (!res.ok) {
    console.error(
      "[notion-crew-polls] fetchPollResponses failed",
      res.status,
      await res.text().catch(() => ""),
    );
    return [];
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = (await res.json()) as { results: any[] };
  return data.results.map(pageToResponse);
}

export async function findResponseByEmail(
  pollId: string,
  email: string,
): Promise<PollResponse | null> {
  const notionKey = process.env.NOTION_API_KEY;
  const db = process.env.NOTION_POLL_RESPONSES_DB_ID;
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
          { property: "Poll", relation: { contains: pollId } },
          { property: "Parent Email", email: { equals: email } },
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
  return pageToResponse(data.results[0]);
}

export interface UpsertPollResponseInput {
  pollId: string;
  parentName: string;
  email: string;
  phone: string;
  childFirstName: string;
  childBirthYear: number;
  childLevel: Level;
  vote: Vote;
  note: string;
}

export async function upsertPollResponse(
  input: UpsertPollResponseInput,
): Promise<{ ok: boolean; pageId?: string; error?: string }> {
  const notionKey = process.env.NOTION_API_KEY;
  const db = process.env.NOTION_POLL_RESPONSES_DB_ID;
  if (!notionKey || !db) {
    return { ok: false, error: "NOTION_POLL_RESPONSES_DB_ID not configured" };
  }

  const existing = await findResponseByEmail(input.pollId, input.email);
  const title = `${input.parentName} — ${input.vote}`;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const properties: Record<string, any> = {
    "Parent Name": { title: [{ text: { content: title } }] },
    "Parent Email": { email: input.email },
    Poll: { relation: [{ id: input.pollId }] },
    "Child First Name": {
      rich_text: [{ text: { content: input.childFirstName } }],
    },
    "Child Birth Year": { number: input.childBirthYear },
    "Child Level": { select: { name: input.childLevel } },
    Vote: { select: { name: input.vote } },
    Note: { rich_text: input.note ? [{ text: { content: input.note } }] : [] },
  };
  if (input.phone) {
    properties["Parent Phone"] = { phone_number: input.phone };
  }

  if (existing) {
    const res = await fetch(`${NOTION_API}/pages/${existing.id}`, {
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
      return { ok: false, error: `Notion update failed (${res.status}): ${text}` };
    }
    return { ok: true, pageId: existing.id };
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

export async function updatePollStatus(
  pollId: string,
  status: PollStatus,
): Promise<boolean> {
  const notionKey = process.env.NOTION_API_KEY;
  if (!notionKey) return false;

  const res = await fetch(`${NOTION_API}/pages/${pollId}`, {
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
  return res.ok;
}
