import {
  FALL_CALL_GROUPS,
  fallCallDateKind,
  normalizeCallStatus,
  normalizeCupfStatus,
  type FallCallGroup,
  type FallCallRecord,
  type FallCallStatus,
  type FallCupfStatus,
} from "./fall-calls";

/**
 * NGA Fall Season Calls — the Notion tracker behind the weather calls.
 *
 * One row per date, titled with the ISO date ("2026-09-27"). Rows are created
 * on first write (find-or-create by title), so the database can start EMPTY —
 * a missing row reads as "every group Scheduled, rain date not booked".
 *
 * Posture, in priority order (a Sunday morning must never be blocked by it):
 *   - Env unset   → config_missing with ZERO network calls. /fall renders the
 *                   plain schedule; the admin page says how to switch it on.
 *   - Read failed → query_failed. /fall says "check WhatsApp" rather than
 *                   implying a session is on; the call engine refuses to write
 *                   or send on a tracker it cannot read.
 * The DB holds dates, statuses, a public note and timestamps — no child or
 * parent data — so it is not a minor-PII destination.
 *
 * Env: NOTION_FALL_CALLS_DB_ID. Share the DB with the "Player DB" integration
 * by hand; nothing in code can detect a missed share.
 */

const NOTION_API = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";

/** Seconds a public read may be served from cache. The admin route also
 * revalidates /fall on every write, so this is only the fallback bound. */
export const FALL_CALLS_REVALIDATE_SECONDS = 60;

export const FALL_CALL_PROPS = {
  title: "Date",
  status: { Green: "Green", Yellow: "Yellow" } as Record<FallCallGroup, string>,
  cupf: "CUPF",
  note: "Note",
  notified: { Green: "Green Notified", Yellow: "Yellow Notified" } as Record<FallCallGroup, string>,
} as const;

/** Property → the Notion type the code reads and writes. */
export const FALL_CALL_SCHEMA: Record<string, string> = {
  [FALL_CALL_PROPS.title]: "title",
  [FALL_CALL_PROPS.cupf]: "select",
  [FALL_CALL_PROPS.note]: "rich_text",
  ...Object.fromEntries(FALL_CALL_GROUPS.map((g) => [FALL_CALL_PROPS.status[g], "select"])),
  ...Object.fromEntries(FALL_CALL_GROUPS.map((g) => [FALL_CALL_PROPS.notified[g], "date"])),
};

export interface FallCallRow extends FallCallRecord {
  pageId: string;
}

export type FallCallsReadResult =
  | { status: "ok"; rows: FallCallRow[]; duplicates: string[] }
  | { status: "config_missing" }
  | { status: "query_failed"; message: string };

function notionEnv(): { notionKey: string; dbId: string } | null {
  const notionKey = process.env.NOTION_API_KEY;
  const dbId = process.env.NOTION_FALL_CALLS_DB_ID;
  if (!notionKey || !dbId) return null;
  return { notionKey, dbId };
}

export function fallCallsConfigured(): boolean {
  return notionEnv() !== null;
}

function headers(notionKey: string): Record<string, string> {
  return {
    Authorization: `Bearer ${notionKey}`,
    "Content-Type": "application/json",
    "Notion-Version": NOTION_VERSION,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function plain(runs: any): string {
  return Array.isArray(runs) ? runs.map((r) => r?.plain_text ?? "").join("") : "";
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toRow(page: any): FallCallRow | null {
  const p = page?.properties ?? {};
  const date = plain(p[FALL_CALL_PROPS.title]?.title).trim();
  // Only the season's own dates count — a stray row can't invent a session.
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !fallCallDateKind(date)) return null;

  const status: Partial<Record<FallCallGroup, FallCallStatus>> = {};
  const notifiedAt: Partial<Record<FallCallGroup, string | null>> = {};
  for (const g of FALL_CALL_GROUPS) {
    status[g] = normalizeCallStatus(p[FALL_CALL_PROPS.status[g]]?.select?.name);
    notifiedAt[g] = p[FALL_CALL_PROPS.notified[g]]?.date?.start ?? null;
  }
  const cupfName = p[FALL_CALL_PROPS.cupf]?.select?.name;
  return {
    pageId: String(page?.id ?? ""),
    date,
    status,
    cupf: cupfName ? normalizeCupfStatus(cupfName) : null,
    note: plain(p[FALL_CALL_PROPS.note]?.rich_text).trim(),
    notifiedAt,
  };
}

/**
 * Every tracked date. `fresh` (the admin page and the call engine) bypasses the
 * cache; the public page reads through ISR with a short revalidate.
 * Oldest row wins when a date appears twice; the rest are reported so the
 * admin page can say which duplicate to delete.
 */
export async function fetchFallCalls(opts: { fresh?: boolean } = {}): Promise<FallCallsReadResult> {
  const env = notionEnv();
  if (!env) return { status: "config_missing" };

  const rows: FallCallRow[] = [];
  const duplicates: string[] = [];
  let cursor: string | undefined;
  try {
    for (let page = 0; page < 3; page += 1) {
      const res = await fetch(`${NOTION_API}/databases/${env.dbId}/query`, {
        method: "POST",
        headers: headers(env.notionKey),
        body: JSON.stringify({
          page_size: 100,
          sorts: [{ timestamp: "created_time", direction: "ascending" }],
          ...(cursor ? { start_cursor: cursor } : {}),
        }),
        ...(opts.fresh
          ? { cache: "no-store" as const }
          : { next: { revalidate: FALL_CALLS_REVALIDATE_SECONDS, tags: ["fall-calls"] } }),
      });
      if (!res.ok) {
        console.error(`[notion-fall-calls] query failed ${res.status}`);
        return { status: "query_failed", message: `Notion returned ${res.status}` };
      }
      const data = (await res.json()) as {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        results?: any[];
        has_more?: boolean;
        next_cursor?: string | null;
      };
      for (const pageRow of data.results ?? []) {
        const row = toRow(pageRow);
        if (!row) continue;
        if (rows.some((r) => r.date === row.date)) duplicates.push(row.date);
        else rows.push(row);
      }
      if (!data.has_more || !data.next_cursor) break;
      cursor = data.next_cursor;
    }
  } catch (err) {
    console.error("[notion-fall-calls] query threw", err);
    return { status: "query_failed", message: err instanceof Error ? err.message : String(err) };
  }
  return { status: "ok", rows, duplicates };
}

export interface FallCallPatch {
  status?: Partial<Record<FallCallGroup, FallCallStatus>>;
  cupf?: FallCupfStatus;
  /** Public reason. An empty string clears it. */
  note?: string;
  /** ISO timestamp, or null to clear. */
  notifiedAt?: Partial<Record<FallCallGroup, string | null>>;
}

/**
 * Builds ONLY the properties the patch names, from an explicit map — never a
 * spread of a row — so a call can't touch a column it didn't mean to.
 */
export function buildFallCallProperties(patch: FallCallPatch): Record<string, unknown> {
  const props: Record<string, unknown> = {};
  for (const g of FALL_CALL_GROUPS) {
    const s = patch.status?.[g];
    if (s) props[FALL_CALL_PROPS.status[g]] = { select: { name: s } };
    if (patch.notifiedAt && g in patch.notifiedAt) {
      const at = patch.notifiedAt[g];
      props[FALL_CALL_PROPS.notified[g]] = { date: at ? { start: at } : null };
    }
  }
  if (patch.cupf) props[FALL_CALL_PROPS.cupf] = { select: { name: patch.cupf } };
  if (patch.note !== undefined) {
    const note = patch.note.trim();
    props[FALL_CALL_PROPS.note] = { rich_text: note ? [{ text: { content: note } }] : [] };
  }
  return props;
}

export type FallCallWriteResult =
  | { ok: true; pageId: string }
  | { ok: false; reason: "config_missing" | "write_failed"; message: string };

/**
 * Find-or-create the row for `date`, then write the patch. Pass the `pageId`
 * from a fresh read to skip the lookup.
 */
export async function upsertFallCall(
  date: string,
  patch: FallCallPatch,
  pageId?: string,
): Promise<FallCallWriteResult> {
  const env = notionEnv();
  if (!env) return { ok: false, reason: "config_missing", message: "NOTION_FALL_CALLS_DB_ID is not set" };
  if (!fallCallDateKind(date)) {
    return { ok: false, reason: "write_failed", message: `${date} is not a fall season date` };
  }
  const properties = buildFallCallProperties(patch);

  try {
    let id = pageId;
    if (!id) {
      const found = await fetch(`${NOTION_API}/databases/${env.dbId}/query`, {
        method: "POST",
        headers: headers(env.notionKey),
        body: JSON.stringify({
          filter: { property: FALL_CALL_PROPS.title, title: { equals: date } },
          sorts: [{ timestamp: "created_time", direction: "ascending" }],
          page_size: 1,
        }),
        cache: "no-store",
      });
      if (!found.ok) {
        return { ok: false, reason: "write_failed", message: `lookup returned ${found.status}` };
      }
      const data = (await found.json()) as { results?: { id?: string }[] };
      id = data.results?.[0]?.id;
    }

    const res = id
      ? await fetch(`${NOTION_API}/pages/${id}`, {
          method: "PATCH",
          headers: headers(env.notionKey),
          body: JSON.stringify({ properties }),
          cache: "no-store",
        })
      : await fetch(`${NOTION_API}/pages`, {
          method: "POST",
          headers: headers(env.notionKey),
          body: JSON.stringify({
            parent: { database_id: env.dbId },
            properties: {
              [FALL_CALL_PROPS.title]: { title: [{ text: { content: date } }] },
              ...properties,
            },
          }),
          cache: "no-store",
        });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error(`[notion-fall-calls] write failed ${res.status}: ${text}`);
      return { ok: false, reason: "write_failed", message: `Notion returned ${res.status}` };
    }
    const written = (await res.json().catch(() => ({}))) as { id?: string };
    return { ok: true, pageId: String(written.id ?? id ?? "") };
  } catch (err) {
    console.error("[notion-fall-calls] write threw", err);
    return { ok: false, reason: "write_failed", message: err instanceof Error ? err.message : String(err) };
  }
}

export type FallCallsSchemaProbe =
  | { status: "ok" }
  | { status: "config_missing" }
  | { status: "query_failed" }
  | { status: "mismatch"; missing: string[]; mistyped: string[] };

/**
 * Checks the DB has every property the code writes. Notion 400s a write that
 * names a missing property, so this is what turns "Sunday's cancel button
 * failed" into "fix the CUPF column before Sunday".
 */
export async function probeFallCallsSchema(): Promise<FallCallsSchemaProbe> {
  const env = notionEnv();
  if (!env) return { status: "config_missing" };
  try {
    const res = await fetch(`${NOTION_API}/databases/${env.dbId}`, {
      headers: headers(env.notionKey),
      cache: "no-store",
    });
    if (!res.ok) return { status: "query_failed" };
    const data = (await res.json()) as { properties?: Record<string, { type?: string }> };
    const props = data.properties ?? {};
    const missing: string[] = [];
    const mistyped: string[] = [];
    for (const [name, type] of Object.entries(FALL_CALL_SCHEMA)) {
      if (!props[name]) missing.push(name);
      else if (props[name].type !== type) mistyped.push(`${name} (want ${type})`);
    }
    return missing.length || mistyped.length ? { status: "mismatch", missing, mistyped } : { status: "ok" };
  } catch {
    return { status: "query_failed" };
  }
}
