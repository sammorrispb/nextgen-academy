// Admin read/write for the "NGA Sessions Schedule" Notion DB (NOTION_SESSIONS_DB_ID).
// Powers the /admin/sessions editor. List upcoming sessions (all statuses) and
// patch the editable fields. `Registered count` is owned by the Stripe webhook
// and is intentionally NOT writable here (read-only display only).

const NOTION_API = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";

export const SESSION_STATUSES = ["Open", "Full", "Cancelled", "Completed", "Passed"] as const;
export type SessionStatus = (typeof SESSION_STATUSES)[number];

export interface AdminSession {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  startTime: string;
  endTime: string;
  level: string | null; // Red/Orange/Green/Yellow (read-only here)
  location: string;
  publicArea: string;
  courtCount: number | null;
  maxCourts: number | null;
  status: string;
  registered: number; // webhook-owned, read-only
  notes: string;
}

/** Editable subset the API accepts. All optional — only provided keys are written. */
export interface SessionPatch {
  title?: string;
  date?: string;
  startTime?: string;
  endTime?: string;
  location?: string;
  publicArea?: string;
  courtCount?: number | null;
  maxCourts?: number | null;
  status?: SessionStatus;
  notes?: string;
}

function env(): { key: string; db: string } {
  const key = process.env.NOTION_API_KEY;
  const db = process.env.NOTION_SESSIONS_DB_ID;
  if (!key) throw new Error("NOTION_API_KEY is not set");
  if (!db) throw new Error("NOTION_SESSIONS_DB_ID is not set");
  return { key, db };
}

function headers(key: string) {
  return {
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
    "Notion-Version": NOTION_VERSION,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function readPlainText(prop: any): string {
  const arr = prop?.rich_text ?? prop?.title ?? [];
  return Array.isArray(arr)
    ? arr.map((r: { plain_text?: string }) => r.plain_text ?? "").join("")
    : "";
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapRow(page: any): AdminSession {
  const p = page.properties ?? {};
  return {
    id: page.id,
    title: readPlainText(p["Session"]) || "Untitled session",
    date: p["Date"]?.date?.start ?? "",
    startTime: readPlainText(p["Start time"]),
    endTime: readPlainText(p["End time"]),
    level: p["Level"]?.select?.name ?? null,
    location: readPlainText(p["Location"]),
    publicArea: readPlainText(p["Public Area"]),
    courtCount: p["Court count"]?.number ?? null,
    maxCourts: p["Max courts"]?.number ?? null,
    status: p["Status"]?.select?.name ?? "",
    registered: p["Registered count"]?.number ?? 0,
    notes: readPlainText(p["Notes"]),
  };
}

const todayIsoET = (): string =>
  new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });

const addDaysIso = (iso: string, n: number): string => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
};

/** Upcoming sessions (today .. +days, ET), all statuses, ascending by date. */
export async function listUpcomingSessions(days = 120): Promise<AdminSession[]> {
  const { key, db } = env();
  const today = todayIsoET();
  const end = addDaysIso(today, days);
  const out: AdminSession[] = [];
  let cursor: string | undefined;
  do {
    const res = await fetch(`${NOTION_API}/databases/${db}/query`, {
      method: "POST",
      headers: headers(key),
      body: JSON.stringify({
        filter: {
          and: [
            { property: "Date", date: { on_or_after: today } },
            { property: "Date", date: { on_or_before: end } },
          ],
        },
        sorts: [{ property: "Date", direction: "ascending" }],
        page_size: 100,
        ...(cursor ? { start_cursor: cursor } : {}),
      }),
      cache: "no-store",
    });
    if (!res.ok) {
      throw new Error(`Notion query failed (${res.status}): ${await res.text().catch(() => "")}`);
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = (await res.json()) as { results: any[]; has_more: boolean; next_cursor: string };
    for (const page of data.results ?? []) out.push(mapRow(page));
    cursor = data.has_more ? data.next_cursor : undefined;
  } while (cursor);
  return out;
}

const clampText = (s: string) => s.slice(0, 2000);
const richText = (s: string) => ({ rich_text: s ? [{ text: { content: clampText(s) } }] : [] });

/** Validate + build the Notion `properties` payload from a patch. Throws on bad input. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildProps(patch: SessionPatch): Record<string, any> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const props: Record<string, any> = {};
  if (patch.title !== undefined) {
    const t = patch.title.trim();
    if (!t) throw new Error("Title cannot be empty");
    props["Session"] = { title: [{ text: { content: clampText(t) } }] };
  }
  if (patch.date !== undefined) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(patch.date)) throw new Error("Date must be YYYY-MM-DD");
    props["Date"] = { date: { start: patch.date } };
  }
  if (patch.startTime !== undefined) props["Start time"] = richText(patch.startTime.trim());
  if (patch.endTime !== undefined) props["End time"] = richText(patch.endTime.trim());
  if (patch.location !== undefined) props["Location"] = richText(patch.location.trim());
  if (patch.publicArea !== undefined) props["Public Area"] = richText(patch.publicArea.trim());
  if (patch.notes !== undefined) props["Notes"] = richText(patch.notes.trim());
  if (patch.courtCount !== undefined) {
    if (patch.courtCount !== null && (!Number.isFinite(patch.courtCount) || patch.courtCount < 0))
      throw new Error("Court count must be a non-negative number");
    props["Court count"] = { number: patch.courtCount };
  }
  if (patch.maxCourts !== undefined) {
    if (patch.maxCourts !== null && (!Number.isFinite(patch.maxCourts) || patch.maxCourts < 0))
      throw new Error("Max courts must be a non-negative number");
    props["Max courts"] = { number: patch.maxCourts };
  }
  if (patch.status !== undefined) {
    if (!SESSION_STATUSES.includes(patch.status)) throw new Error("Invalid status");
    props["Status"] = { select: { name: patch.status } };
  }
  if (Object.keys(props).length === 0) throw new Error("No editable fields supplied");
  return props;
}

const SESSION_ID = /^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i;

/** PATCH one session row. Returns the updated AdminSession. */
export async function updateSession(id: string, patch: SessionPatch): Promise<AdminSession> {
  const { key } = env();
  if (!SESSION_ID.test(id)) throw new Error("Invalid session id");
  const properties = buildProps(patch);
  const res = await fetch(`${NOTION_API}/pages/${id}`, {
    method: "PATCH",
    headers: headers(key),
    body: JSON.stringify({ properties }),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Notion update failed (${res.status}): ${await res.text().catch(() => "")}`);
  }
  return mapRow(await res.json());
}
