import { REGISTRATION_WINDOW_DAYS } from "@/data/schedule";
import { fetchUpcomingDropIns } from "@/lib/notion-dropins";
import { isSessionEnded } from "@/lib/session-time";

export type SessionLevel = "Red" | "Orange" | "Green" | "Yellow";

export interface NgaSession {
  id: string;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  level: SessionLevel | null;
  /** Exact venue. For location-hidden sessions, NEVER render this publicly or
   * in pre-reveal email — use `publicArea` via the session-location helpers. */
  location: string;
  /** Broad area for location-hidden sessions (e.g. "Olney, MD"). Empty string
   * for normal sessions. Presence = location-hidden mode. */
  publicArea: string;
  /** Pickleball courts currently *open* (capacity = courtCount × 4). Auto-opens
   * the next court when the current ones fill, up to `maxCourts`. */
  courtCount: number;
  /** Ceiling on open courts (= 2 × tennis courts booked; 1 tennis court splits
   * into 2 pickleball courts). Defaults to courtCount when unset (no expand). */
  maxCourts: number;
  capacity: number;
  registeredCount: number;
  spotsLeft: number;
  status: "Open" | "Full" | "Cancelled" | "Completed" | "Passed";
  /** Child first names of confirmed registrants who opted in to public display. */
  roster: string[];
  /** Non-PII social-proof aggregate over all confirmed registrants. */
  ageStats: { count: number; minAge: number; maxAge: number } | null;
  /** True once the coach 24h pre-event briefing email has fired (cron dedup). */
  coachReminderSent: boolean;
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
          { property: "Status", select: { does_not_equal: "Completed" } },
          { property: "Status", select: { does_not_equal: "Passed" } },
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
    const maxCourts = Math.max(readNumber(props["Max courts"]), courtCount);
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
      publicArea: readPlainText(props["Public Area"]),
      courtCount,
      maxCourts,
      capacity,
      registeredCount,
      spotsLeft: Math.max(0, capacity - registeredCount),
      status,
      roster: [] as string[],
      ageStats: null as NgaSession["ageStats"],
      coachReminderSent: props["Coach Reminder Sent"]?.checkbox === true,
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

  // Drop sessions whose end time has already passed in ET — the Status flip to
  // Completed/Passed is async (hourly cron), so filter at read time too so a
  // finished slot disappears the moment it ends, not on the next cron tick.
  return sessions.filter((s) => !isSessionEnded(s.date, s.endTime, now));
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
  const maxCourts = Math.max(readNumber(props["Max courts"]), courtCount);
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
    publicArea: readPlainText(props["Public Area"]),
    courtCount,
    maxCourts,
    capacity,
    registeredCount,
    spotsLeft: Math.max(0, capacity - registeredCount),
    status,
    roster,
    ageStats,
    coachReminderSent: props["Coach Reminder Sent"]?.checkbox === true,
  };
}

/**
 * Flip a session row's Status to "Cancelled". Used by the session-cancellation
 * broadcast from /coach when Sam pulls a whole session (weather, venue,
 * low-enrollment). Does NOT touch the drop-in row Statuses — those are
 * flipped via the per-row charge.refunded webhook after the broadcast
 * issues Stripe refunds.
 */
export async function setSessionStatus(
  id: string,
  status: NgaSession["status"],
): Promise<boolean> {
  const notionKey = process.env.NOTION_API_KEY;
  if (!notionKey) return false;

  const res = await fetch(`${NOTION_API}/pages/${id}`, {
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
  if (!res.ok) {
    console.error(
      "[notion-sessions] setSessionStatus failed",
      res.status,
      await res.text().catch(() => ""),
    );
    return false;
  }
  return true;
}

/**
 * Stamp a session row with a lifecycle Status ("Completed" / "Passed") AND a
 * Notes audit line in one PATCH. Used by the mark-passed-sessions cron when a
 * session's end time passes. Records are kept — we never delete the row.
 */
export async function setSessionLifecycle(
  id: string,
  status: "Completed" | "Passed",
  note: string,
): Promise<boolean> {
  const notionKey = process.env.NOTION_API_KEY;
  if (!notionKey) return false;

  const res = await fetch(`${NOTION_API}/pages/${id}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${notionKey}`,
      "Content-Type": "application/json",
      "Notion-Version": NOTION_VERSION,
    },
    body: JSON.stringify({
      properties: {
        Status: { select: { name: status } },
        Notes: { rich_text: [{ text: { content: note } }] },
      },
    }),
  });
  if (!res.ok) {
    console.error(
      "[notion-sessions] setSessionLifecycle failed",
      res.status,
      await res.text().catch(() => ""),
    );
    return false;
  }
  return true;
}

export interface ActiveSessionRow {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  registeredCount: number;
  status: string;
  title: string;
}

/**
 * Query the Sessions DB for still-active (Open/Full) rows dated within
 * [dateIso - lookbackDays, dateIso]. The lookback catches any rows the cron
 * missed on a prior tick (e.g. a deploy gap). Date math is done on the ISO
 * string via Date.UTC — never `new Date(y,m,d)` (UTC-build hazard).
 */
export async function fetchActiveSessionsOnOrBefore(
  dateIso: string,
  lookbackDays: number = 3,
): Promise<ActiveSessionRow[]> {
  const notionKey = process.env.NOTION_API_KEY;
  const dbId = process.env.NOTION_SESSIONS_DB_ID;
  if (!notionKey || !dbId || !/^\d{4}-\d{2}-\d{2}$/.test(dateIso)) return [];

  const [y, mo, d] = dateIso.split("-").map(Number);
  const sinceMs = Date.UTC(y, mo - 1, d) - lookbackDays * 86_400_000;
  const since = new Date(sinceMs).toISOString().slice(0, 10);

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
          { property: "Date", date: { on_or_after: since } },
          { property: "Date", date: { on_or_before: dateIso } },
          {
            or: [
              { property: "Status", select: { equals: "Open" } },
              { property: "Status", select: { equals: "Full" } },
            ],
          },
        ],
      },
      page_size: 100,
    }),
    cache: "no-store",
  });

  if (!res.ok) {
    console.error(
      "[notion-sessions] fetchActiveSessionsOnOrBefore failed",
      res.status,
      await res.text().catch(() => ""),
    );
    return [];
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = (await res.json()) as { results: any[] };
  return data.results.map((page) => {
    const props = page.properties;
    return {
      id: page.id as string,
      date: props["Date"]?.date?.start ?? "",
      startTime: readPlainText(props["Start time"]),
      endTime: readPlainText(props["End time"]),
      registeredCount: readNumber(props["Registered count"]),
      status: readSelect(props["Status"]) ?? "Open",
      title: readPlainText(props["Session"]),
    };
  });
}

/** Flip the session row's "Coach Reminder Sent" checkbox (pre-event cron dedup). */
export async function markSessionCoachReminderSent(id: string): Promise<boolean> {
  const notionKey = process.env.NOTION_API_KEY;
  if (!notionKey) return false;

  const res = await fetch(`${NOTION_API}/pages/${id}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${notionKey}`,
      "Content-Type": "application/json",
      "Notion-Version": NOTION_VERSION,
    },
    body: JSON.stringify({
      properties: { "Coach Reminder Sent": { checkbox: true } },
    }),
  });
  if (!res.ok) {
    console.error(
      "[notion-sessions] markSessionCoachReminderSent failed",
      res.status,
      await res.text().catch(() => ""),
    );
    return false;
  }
  return true;
}

export async function incrementSessionRegistered(
  id: string,
  by: number = 1,
): Promise<NgaSession | null> {
  const session = await fetchSessionById(id);
  if (!session) return null;

  const newCount = session.registeredCount + by;

  // Auto-expand: when registrations fill the open courts, open the next court
  // (each adds 4 spots) up to maxCourts — so a session "soft-launches" at 4 and
  // grows to its ceiling instead of dead-ending at "Full". One tennis court =
  // 2 pickleball courts, so a 1-court booking expands 4 → 8.
  let newCourtCount = session.courtCount;
  while (newCount >= newCourtCount * 4 && newCourtCount < session.maxCourts) {
    newCourtCount += 1;
  }
  const newCapacity = newCourtCount * 4;
  const newStatus: NgaSession["status"] =
    newCount >= newCapacity ? "Full" : session.status;

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
        // Bump Court count when we open a court — the Notion Capacity formula
        // (Court count × 4) recomputes off this.
        "Court count": { number: newCourtCount },
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
    courtCount: newCourtCount,
    capacity: newCapacity,
    registeredCount: newCount,
    spotsLeft: Math.max(0, newCapacity - newCount),
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
