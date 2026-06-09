// Keeps the recurring all-levels Tuesday session stocked. Each future Tuesday
// should have one row per level (Red/Orange/Green/Yellow) — a court each — at
// the Olney Tuesday Evening 6–7 PM slot. The seed cron calls
// ensureAllLevelsTuesdays() weekly; it's idempotent (never duplicates a row)
// and never resurrects a deliberately-cancelled one (any existing row for a
// date+level counts as present, whatever its Status).

const NOTION_API = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";

export const TUESDAY_TITLE_BASE = "Olney Tuesday Evening";
export const TUESDAY_LEVELS = ["Red", "Orange", "Green", "Yellow"] as const;
export type TuesdayLevel = (typeof TUESDAY_LEVELS)[number];

// One template for every generated row. Change the venue/time here and the
// cron follows. `publicArea` stays as a broad fallback in case Location is
// ever cleared on a row.
const TEMPLATE = {
  startTime: "6:00 PM",
  endTime: "7:00 PM",
  courtCount: 1,
  location:
    "Redland Middle School Tennis Courts, 6505 Muncaster Mill Rd, Rockville, MD 20855",
  publicArea: "Derwood, MD",
  notes:
    "All-levels Tuesday: one court per level (Red/Orange/Green/Yellow). Venue: Redland MS tennis courts. Auto-seeded by the seed-tuesday-sessions cron.",
} as const;

/**
 * ISO dates (YYYY-MM-DD) of the next `weeks` Tuesdays on or after `todayIso`.
 * Pure + UTC-anchored (Date.UTC, never `new Date(y,m,d)`) so it can't drift on
 * a UTC build server. If today is a Tuesday, today is included.
 */
export function upcomingTuesdays(todayIso: string, weeks: number): string[] {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(todayIso) || weeks <= 0) return [];
  const [y, m, d] = todayIso.split("-").map(Number);
  const base = Date.UTC(y, m - 1, d);
  const dow = new Date(base).getUTCDay(); // 0=Sun … 2=Tue … 6=Sat
  const daysUntilTue = (2 - dow + 7) % 7;
  const out: string[] = [];
  for (let i = 0; i < weeks; i++) {
    const ms = base + (daysUntilTue + i * 7) * 86_400_000;
    out.push(new Date(ms).toISOString().slice(0, 10));
  }
  return out;
}

/** Notion REST `properties` payload for one Tuesday session row. Pure. */
export function buildTuesdayRowProps(date: string, level: TuesdayLevel) {
  return {
    Session: { title: [{ text: { content: `${TUESDAY_TITLE_BASE} — ${level}` } }] },
    Level: { select: { name: level } },
    Date: { date: { start: date } },
    "Start time": { rich_text: [{ text: { content: TEMPLATE.startTime } }] },
    "End time": { rich_text: [{ text: { content: TEMPLATE.endTime } }] },
    "Court count": { number: TEMPLATE.courtCount },
    Location: { rich_text: [{ text: { content: TEMPLATE.location } }] },
    "Public Area": { rich_text: [{ text: { content: TEMPLATE.publicArea } }] },
    Status: { select: { name: "Open" } },
    Notes: { rich_text: [{ text: { content: TEMPLATE.notes } }] },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function readPlainText(prop: any): string {
  const arr = prop?.rich_text ?? prop?.title ?? [];
  return Array.isArray(arr)
    ? arr.map((r: { plain_text?: string }) => r.plain_text ?? "").join("")
    : "";
}

/** Existing `date|level` keys for Olney-Tuesday rows in [minDate, maxDate]. */
async function fetchExistingTuesdayKeys(
  notionKey: string,
  dbId: string,
  minDate: string,
  maxDate: string,
): Promise<Set<string>> {
  const keys = new Set<string>();
  let cursor: string | undefined;
  do {
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
            { property: "Date", date: { on_or_after: minDate } },
            { property: "Date", date: { on_or_before: maxDate } },
          ],
        },
        page_size: 100,
        ...(cursor ? { start_cursor: cursor } : {}),
      }),
      cache: "no-store",
    });
    if (!res.ok) {
      throw new Error(
        `Notion query failed (${res.status}): ${await res.text().catch(() => "")}`,
      );
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = (await res.json()) as { results: any[]; has_more: boolean; next_cursor: string };
    for (const page of data.results ?? []) {
      const props = page.properties ?? {};
      const title = readPlainText(props["Session"]);
      if (!title.startsWith(TUESDAY_TITLE_BASE)) continue;
      const date = props["Date"]?.date?.start ?? "";
      const level = props["Level"]?.select?.name ?? "";
      if (date && level) keys.add(`${date}|${level}`);
    }
    cursor = data.has_more ? data.next_cursor : undefined;
  } while (cursor);
  return keys;
}

async function createRow(
  notionKey: string,
  dbId: string,
  date: string,
  level: TuesdayLevel,
): Promise<boolean> {
  const res = await fetch(`${NOTION_API}/pages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${notionKey}`,
      "Content-Type": "application/json",
      "Notion-Version": NOTION_VERSION,
    },
    body: JSON.stringify({
      parent: { database_id: dbId },
      properties: buildTuesdayRowProps(date, level),
    }),
  });
  if (!res.ok) {
    console.error(
      `[recurring-sessions] create failed ${date} ${level}:`,
      res.status,
      await res.text().catch(() => ""),
    );
    return false;
  }
  return true;
}

export interface EnsureResult {
  tuesdays: string[];
  created: string[]; // "YYYY-MM-DD Level"
  skipped: number; // already existed
  failed: string[];
}

/**
 * Ensure each of the next `weeks` Tuesdays has all four level rows. Idempotent:
 * existing rows (any Status) are left untouched. Fail-soft per row — one bad
 * create doesn't abort the rest.
 */
export async function ensureAllLevelsTuesdays(
  todayIso: string,
  weeks: number,
): Promise<EnsureResult> {
  const notionKey = process.env.NOTION_API_KEY;
  const dbId = process.env.NOTION_SESSIONS_DB_ID;
  const tuesdays = upcomingTuesdays(todayIso, weeks);
  const result: EnsureResult = { tuesdays, created: [], skipped: 0, failed: [] };
  if (!notionKey || !dbId || tuesdays.length === 0) return result;

  const existing = await fetchExistingTuesdayKeys(
    notionKey,
    dbId,
    tuesdays[0],
    tuesdays[tuesdays.length - 1],
  );

  for (const date of tuesdays) {
    for (const level of TUESDAY_LEVELS) {
      if (existing.has(`${date}|${level}`)) {
        result.skipped += 1;
        continue;
      }
      const ok = await createRow(notionKey, dbId, date, level);
      if (ok) result.created.push(`${date} ${level}`);
      else result.failed.push(`${date} ${level}`);
    }
  }
  return result;
}
