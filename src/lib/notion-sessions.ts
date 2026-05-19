import { REGISTRATION_WINDOW_DAYS } from "@/data/schedule";
import { fetchUpcomingDropIns } from "@/lib/notion-dropins";

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
  /** Child first names of confirmed registrants who opted in to public display. */
  roster: string[];
  /** Non-PII social-proof aggregate over all confirmed registrants. */
  ageStats: { count: number; minAge: number; maxAge: number } | null;
}

function ageFromBirthYear(year: number, today: Date = new Date()): number | null {
  if (!Number.isFinite(year) || year <= 0) return null;
  return today.getFullYear() - year;
}

function rosterKey(date: string, startTime: string): string {
  return `${date}|${(startTime ?? "").trim().toLowerCase()}`;
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

  const sessions = data.results.map((page) => {
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
      roster: [] as string[],
      ageStats: null as NgaSession["ageStats"],
    };
  });

  // Roster batch: one query for all drop-ins in the same date window, then
  // group by (date, start time) and attach to sessions. Failures here just
  // leave roster empty — never block the schedule render.
  try {
    const drops = await fetchUpcomingDropIns(today, endIso, { revalidate: 300 });
    const namesByKey = new Map<string, string[]>();
    const agesByKey = new Map<string, number[]>();
    for (const d of drops) {
      const k = rosterKey(d.sessionDate, d.sessionStartTime);
      if (d.childFirstName && d.displayConsent) {
        const arr = namesByKey.get(k) ?? [];
        arr.push(d.childFirstName);
        namesByKey.set(k, arr);
      }
      const age = ageFromBirthYear(d.childBirthYear, now);
      if (age !== null) {
        const arr = agesByKey.get(k) ?? [];
        arr.push(age);
        agesByKey.set(k, arr);
      }
    }
    for (const s of sessions) {
      const k = rosterKey(s.date, s.startTime);
      s.roster = namesByKey.get(k) ?? [];
      const ages = agesByKey.get(k) ?? [];
      s.ageStats = ages.length
        ? { count: ages.length, minAge: Math.min(...ages), maxAge: Math.max(...ages) }
        : null;
    }
  } catch (err) {
    console.error("[notion-sessions] roster batch failed", err);
  }

  return sessions;
}

export async function findSessionIdByDateAndTime(
  date: string,
  startTime: string,
): Promise<string | null> {
  const notionKey = process.env.NOTION_API_KEY;
  const dbId = process.env.NOTION_SESSIONS_DB_ID;
  if (!notionKey || !dbId || !date) return null;

  const res = await fetch(`${NOTION_API}/databases/${dbId}/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${notionKey}`,
      "Content-Type": "application/json",
      "Notion-Version": NOTION_VERSION,
    },
    body: JSON.stringify({
      filter: { property: "Date", date: { equals: date } },
      page_size: 10,
    }),
    cache: "no-store",
  });
  if (!res.ok) return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = (await res.json()) as { results: any[] };
  const match = data.results.find(
    (p) =>
      rosterKey(date, readPlainText(p.properties?.["Start time"])) ===
      rosterKey(date, startTime),
  );
  return match?.id ?? null;
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
  const date = props["Date"]?.date?.start ?? "";
  const startTime = readPlainText(props["Start time"]);

  let roster: string[] = [];
  let ageStats: NgaSession["ageStats"] = null;
  if (date) {
    try {
      const drops = await fetchUpcomingDropIns(date, date, { revalidate: 300 });
      const matching = drops.filter(
        (d) =>
          rosterKey(d.sessionDate, d.sessionStartTime) ===
          rosterKey(date, startTime),
      );
      roster = matching
        .filter((d) => d.displayConsent)
        .map((d) => d.childFirstName)
        .filter(Boolean);
      const ages = matching
        .map((d) => ageFromBirthYear(d.childBirthYear))
        .filter((a): a is number => a !== null);
      if (ages.length) {
        ageStats = {
          count: ages.length,
          minAge: Math.min(...ages),
          maxAge: Math.max(...ages),
        };
      }
    } catch (err) {
      console.error("[notion-sessions] single-session roster failed", err);
    }
  }

  return {
    id: page.id,
    title: readPlainText(props["Session"]),
    date,
    startTime,
    endTime: readPlainText(props["End time"]),
    level: readSelect(props["Level"]) as SessionLevel | null,
    location: readPlainText(props["Location"]),
    courtCount,
    capacity,
    registeredCount,
    spotsLeft: Math.max(0, capacity - registeredCount),
    status,
    roster,
    ageStats,
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
  return {
    ...session,
    registeredCount: newCount,
    spotsLeft: Math.max(0, session.capacity - newCount),
    status: newStatus,
  };
}

export async function decrementSessionRegistered(
  id: string,
  by: number = 1,
): Promise<NgaSession | null> {
  const session = await fetchSessionById(id);
  if (!session) return null;

  const newCount = Math.max(0, session.registeredCount - by);
  // If we drop below capacity, flip Full → Open. Never touch Cancelled.
  const newStatus: NgaSession["status"] =
    session.status === "Full" && newCount < session.capacity
      ? "Open"
      : session.status;

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
      "[notion-sessions] decrement failed",
      res.status,
      await res.text().catch(() => ""),
    );
    return null;
  }
  return {
    ...session,
    registeredCount: newCount,
    spotsLeft: Math.max(0, session.capacity - newCount),
    status: newStatus,
  };
}
