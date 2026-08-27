import { readPlainText } from "@/lib/notion-utils";
import type { CurriculumOverride } from "@/lib/curriculum-merge";

/**
 * Curriculum override layer — the READ half.
 *
 * Reads one row per overridden string from the NGA Curriculum Overrides DB and
 * hands them to mergeCurriculum(). Code stays the source of truth for defaults;
 * this only ever supplies replacements.
 *
 * Posture, in priority order (a run sheet must never render blank or half-
 * merged on a Sunday):
 *   - Env unset          => config_missing, ZERO network calls. The deliberate
 *                           ships-dark state, not an error.
 *   - Query failed       => query_failed + code defaults. Never a throw.
 *   - Row unreadable     => that row is skipped; the rest still apply.
 * Nothing here writes. Stage 1 is read-only by design; Sam edits in Notion.
 *
 * The loud half lives in /api/cron/curriculum-health, which turns `status` and
 * the merge's unresolved ids into alerts. The render path stays silent on
 * purpose — same split as fetchOpenEvalSlots + /free-evaluation/book.
 */

const NOTION_API = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";

/** Bounded so a runaway DB can't stall a Sunday render. */
export const CURRICULUM_OVERRIDES_PAGE_SIZE = 100;
/** The whole addressable field surface is ~130 ids; 3 pages can never truncate. */
const MAX_PAGES = 3;

export type CurriculumOverridesStatus = "ok" | "config_missing" | "query_failed";

export interface CurriculumOverridesResult {
  overrides: CurriculumOverride[];
  status: CurriculumOverridesStatus;
}

function notionEnv(): { notionKey: string; dbId: string } | null {
  const notionKey = process.env.NOTION_API_KEY;
  const dbId = process.env.NOTION_CURRICULUM_DB_ID;
  if (!notionKey || !dbId) return null;
  return { notionKey, dbId };
}

function headers(notionKey: string): Record<string, string> {
  return {
    Authorization: `Bearer ${notionKey}`,
    "Content-Type": "application/json",
    "Notion-Version": NOTION_VERSION,
  };
}

/**
 * An unticked Active box is Sam's revert. A MISSING Active property is not:
 * it means the column doesn't exist on the DB yet, and treating that as "every
 * row is off" would silently disable the whole feature. So absent => active.
 *
 * This is also why there is no server-side Active filter — Notion 400s a filter
 * naming a property the DB doesn't have, which would turn a missing column into
 * query_failed for the whole read. Same lesson as createNotionPageSourceFailSoft:
 * a schema gap must degrade, not take the surface down.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isActive(props: any): boolean {
  const prop = props?.["Active"];
  if (!prop || typeof prop.checkbox !== "boolean") return true;
  return prop.checkbox;
}

/** null = the HTTP call failed; [] = the DB genuinely has no rows. */
async function queryOverrideRows(
  notionKey: string,
  dbId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any[] | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const all: any[] = [];
  let cursor: string | undefined;

  for (let page = 0; page < MAX_PAGES; page += 1) {
    const body: Record<string, unknown> = { page_size: CURRICULUM_OVERRIDES_PAGE_SIZE };
    if (cursor) body.start_cursor = cursor;

    let res: Response;
    try {
      res = await fetch(`${NOTION_API}/databases/${dbId}/query`, {
        method: "POST",
        headers: headers(notionKey),
        body: JSON.stringify(body),
        next: { revalidate: 300 },
      });
    } catch (err) {
      console.error("[notion-curriculum] query threw", err);
      return null;
    }

    if (!res.ok) {
      console.error(
        "[notion-curriculum] query failed",
        res.status,
        await res.text().catch(() => ""),
      );
      return null;
    }

    let data: { results?: unknown; has_more?: boolean; next_cursor?: string | null };
    try {
      data = await res.json();
    } catch (err) {
      console.error("[notion-curriculum] query returned unparseable JSON", err);
      return null;
    }

    if (Array.isArray(data?.results)) all.push(...data.results);
    if (!data?.has_more || !data?.next_cursor) return all;
    cursor = data.next_cursor;
  }

  return all;
}

/**
 * Every active override row, ready for mergeCurriculum(). Never throws.
 * A row missing its Field ID (or carrying only whitespace) is skipped rather
 * than failing the read — one malformed row must not cost the other edits.
 */
export async function fetchCurriculumOverrides(): Promise<CurriculumOverridesResult> {
  const env = notionEnv();
  if (!env) return { overrides: [], status: "config_missing" };

  const rows = await queryOverrideRows(env.notionKey, env.dbId);
  if (!rows) return { overrides: [], status: "query_failed" };

  const overrides: CurriculumOverride[] = [];
  for (const row of rows) {
    const props = row?.properties;
    if (!props || !isActive(props)) continue;

    const fieldId = readPlainText(props["Field ID"]).trim();
    if (!fieldId) continue;

    overrides.push({
      fieldId,
      value: readPlainText(props["Value"]),
      pageId: typeof row.id === "string" ? row.id : undefined,
    });
  }

  return { overrides, status: "ok" };
}
