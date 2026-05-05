import { REGISTRATION_WINDOW_DAYS } from "@/data/schedule";

export type SessionLevel = "Red" | "Orange" | "Green" | "Yellow";

export interface NgaSession {
  id: string;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  level: SessionLevel | null;
  location: string;
  courtCount: number;
  capacity: number;
  registeredCount: number;
  spotsLeft: number;
  status: "Open" | "Full" | "Cancelled";
}

const NOTION_API = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function readPlainText(prop: any): string {
  if (!prop) return "";
  const arr = prop.rich_text ?? prop.title ?? [];
  if (!Array.isArray(arr)) return "";
  return arr.map((r: { plain_text?: string }) => r.plain_text ?? "").join("");
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function readSelect(prop: any): string | null {
  return prop?.select?.name ?? null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function readNumber(prop: any): number {
  return typeof prop?.number === "number" ? prop.number : 0;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function readFormulaNumber(prop: any): number {
  if (!prop?.formula) return 0;
  const f = prop.formula;
  if (typeof f.number === "number") return f.number;
  return 0;
}

export async function fetchUpcomingSessions(
  now: Date = new Date(),
): Promise<NgaSession[]> {
  const notionKey = process.env.NOTION_API_KEY;
  const dbId = process.env.NOTION_SESSIONS_DB_ID;
  if (!notionKey || !dbId) return [];

  const today = isoDate(now);
  const end = new Date(now);
  end.setDate(end.getDate() + REGISTRATION_WINDOW_DAYS);
  const endIso = isoDate(end);

  const res = await fetch(`${NOTION_API}/databases/${dbId}/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${notionKey}`,
      "Content-Type": "application/json",
      "Notion-Version": NOTION_VERSION,
    },
    body: JSON.stringify({
      filter: {
        and: [
          { property: "Date", date: { on_or_after: today } },
          { property: "Date", date: { on_or_before: endIso } },
          { property: "Status", select: { does_not_equal: "Cancelled" } },
        ],
      },
      sorts: [{ property: "Date", direction: "ascending" }],
      page_size: 100,
    }),
    next: { revalidate: 300 },
  });

  if (!res.ok) {
    console.error(
      "[notion-sessions] query failed",
      res.status,
      await res.text().catch(() => ""),
    );
    return [];
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = (await res.json()) as { results: any[] };

  return data.results.map((page) => {
    const props = page.properties;
    const courtCount = readNumber(props["Court count"]) || 1;
    const capacity = readFormulaNumber(props["Capacity"]) || courtCount * 4;
    const registeredCount = readNumber(props["Registered count"]);
    const status =
      (readSelect(props["Status"]) as NgaSession["status"]) ?? "Open";

    return {
      id: page.id as string,
      title: readPlainText(props["Session"]),
      date: props["Date"]?.date?.start ?? "",
      startTime: readPlainText(props["Start time"]),
      endTime: readPlainText(props["End time"]),
      level: readSelect(props["Level"]) as SessionLevel | null,
      location: readPlainText(props["Location"]),
      courtCount,
      capacity,
      registeredCount,
      spotsLeft: Math.max(0, capacity - registeredCount),
      status,
    };
  });
}

export async function fetchSessionById(id: string): Promise<NgaSession | null> {
  const notionKey = process.env.NOTION_API_KEY;
  if (!notionKey) return null;

  const res = await fetch(`${NOTION_API}/pages/${id}`, {
    headers: {
      Authorization: `Bearer ${notionKey}`,
      "Notion-Version": NOTION_VERSION,
    },
    cache: "no-store",
  });
  if (!res.ok) return null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const page = (await res.json()) as { id: string; properties: any };
  const props = page.properties;
  const courtCount = readNumber(props["Court count"]) || 1;
  const capacity = readFormulaNumber(props["Capacity"]) || courtCount * 4;
  const registeredCount = readNumber(props["Registered count"]);
  const status =
    (readSelect(props["Status"]) as NgaSession["status"]) ?? "Open";

  return {
    id: page.id,
    title: readPlainText(props["Session"]),
    date: props["Date"]?.date?.start ?? "",
    startTime: readPlainText(props["Start time"]),
    endTime: readPlainText(props["End time"]),
    level: readSelect(props["Level"]) as SessionLevel | null,
    location: readPlainText(props["Location"]),
    courtCount,
    capacity,
    registeredCount,
    spotsLeft: Math.max(0, capacity - registeredCount),
    status,
  };
}

export async function incrementSessionRegistered(
  id: string,
  by: number = 1,
): Promise<NgaSession | null> {
  const session = await fetchSessionById(id);
  if (!session) return null;

  const newCount = session.registeredCount + by;
  const newStatus: NgaSession["status"] =
    newCount >= session.capacity ? "Full" : session.status;

  const notionKey = process.env.NOTION_API_KEY;
  if (!notionKey) return null;

  const res = await fetch(`${NOTION_API}/pages/${id}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${notionKey}`,
      "Content-Type": "application/json",
      "Notion-Version": NOTION_VERSION,
    },
    body: JSON.stringify({
      properties: {
        "Registered count": { number: newCount },
        Status: { select: { name: newStatus } },
      },
    }),
  });
  if (!res.ok) {
    console.error(
      "[notion-sessions] increment failed",
      res.status,
      await res.text().catch(() => ""),
    );
    return null;
  }
  return { ...session, registeredCount: newCount, status: newStatus };
}
