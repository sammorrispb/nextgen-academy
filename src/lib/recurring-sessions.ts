// Keeps the recurring weekly-evening sessions stocked (admin-reduction
// roadmap Phase 2a). Each active template in src/data/recurring-templates.ts
// gets one row per level per upcoming week — a court each. The seed cron
// (still at /api/cron/seed-tuesday-sessions, wrapped by withCronAlert) calls
// ensureWeeklyTemplates() weekly; it's idempotent (never duplicates a row)
// and never resurrects a deliberately-cancelled one: any existing row for a
// date|level counts as present, whatever its Status, matched against the
// template's titleBase OR any legacyTitlePrefix.

import { readPlainText } from "@/lib/notion-utils";
import {
  RECURRING_TEMPLATES,
  type RecurringTemplate,
  type SessionLevel,
} from "@/data/recurring-templates";

const NOTION_API = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";

/** Every title prefix that marks a row as belonging to `template` — the
 * current titleBase plus every legacy prefix, deduped. */
export function templateTitlePrefixes(template: RecurringTemplate): string[] {
  return [...new Set([template.titleBase, ...template.legacyTitlePrefixes])];
}

/** Union of every recurring template's title prefixes (active or not — a
 * deactivated template's already-seeded rows still exist and still belong to
 * the recurring family). Used as the blast-radius guard by the group-cancel
 * and reschedule flows. */
export const RECURRING_TITLE_PREFIXES: readonly string[] = [
  ...new Set(RECURRING_TEMPLATES.flatMap(templateTitlePrefixes)),
];

/**
 * ISO dates (YYYY-MM-DD) of the next `count` occurrences of `weekday`
 * (0=Sun … 6=Sat) on or after `todayIso`. Pure + UTC-anchored (Date.UTC,
 * never `new Date(y,m,d)`) so it can't drift on a UTC build server. If today
 * IS the requested weekday, today is included.
 */
export function upcomingWeekday(
  weekday: number,
  todayIso: string,
  count: number,
): string[] {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(todayIso) || count <= 0) return [];
  if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) return [];
  const [y, m, d] = todayIso.split("-").map(Number);
  const base = Date.UTC(y, m - 1, d);
  const dow = new Date(base).getUTCDay(); // 0=Sun … 6=Sat
  const daysUntil = (weekday - dow + 7) % 7;
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    const ms = base + (daysUntil + i * 7) * 86_400_000;
    out.push(new Date(ms).toISOString().slice(0, 10));
  }
  return out;
}

/** Notion REST `properties` payload for one templated session row. Pure. */
export function buildTemplateRowProps(
  template: RecurringTemplate,
  date: string,
  level: SessionLevel,
) {
  return {
    Session: { title: [{ text: { content: `${template.titleBase} — ${level}` } }] },
    Level: { select: { name: level } },
    Date: { date: { start: date } },
    "Start time": { rich_text: [{ text: { content: template.startTime } }] },
    "End time": { rich_text: [{ text: { content: template.endTime } }] },
    "Court count": { number: template.courtCount },
    "Max courts": { number: template.maxCourts },
    Location: { rich_text: [{ text: { content: template.location } }] },
    "Public Area": { rich_text: [{ text: { content: template.publicArea } }] },
    Status: { select: { name: "Open" } },
    Notes: { rich_text: [{ text: { content: template.notes } }] },
  };
}

/**
 * Existing `date|level` keys for template-owned rows in [minDate, maxDate].
 * A row belongs to a template when its title starts with the titleBase OR any
 * legacyTitlePrefix — Status is deliberately ignored so a Cancelled row still
 * counts as present (never resurrect a deliberate cancellation).
 */
async function fetchExistingTemplateKeys(
  notionKey: string,
  dbId: string,
  minDate: string,
  maxDate: string,
  templates: readonly RecurringTemplate[],
): Promise<Set<string>> {
  const prefixes = [...new Set(templates.flatMap(templateTitlePrefixes))];
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
      if (!prefixes.some((p) => title.startsWith(p))) continue;
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
  template: RecurringTemplate,
  date: string,
  level: SessionLevel,
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
      properties: buildTemplateRowProps(template, date, level),
    }),
  });
  if (!res.ok) {
    console.error(
      `[recurring-sessions] create failed ${date} ${template.titleBase} ${level}:`,
      res.status,
      await res.text().catch(() => ""),
    );
    return false;
  }
  return true;
}

export interface EnsureResult {
  dryRun: boolean;
  /** All dates considered across templates, ascending. */
  dates: string[];
  /** Rows created this run — "YYYY-MM-DD TitleBase — Level". Empty in dryRun. */
  created: string[];
  /** dryRun only: rows a live run WOULD create. Empty otherwise. */
  wouldCreate: string[];
  /** date|level pairs that already existed (any Status). */
  skipped: number;
  failed: string[];
}

export interface EnsureOptions {
  /** Plan only — return `wouldCreate` and write NOTHING to Notion. */
  dryRun?: boolean;
  /** Override for tests; defaults to RECURRING_TEMPLATES. */
  templates?: readonly RecurringTemplate[];
}

/**
 * Ensure each active template has all of its level rows for the next `weeks`
 * occurrences of its weekday. Idempotent: existing rows (any Status, any
 * known title prefix) are left untouched. Fail-soft per row — one bad create
 * doesn't abort the rest.
 */
export async function ensureWeeklyTemplates(
  todayIso: string,
  weeks: number,
  options: EnsureOptions = {},
): Promise<EnsureResult> {
  const { dryRun = false, templates = RECURRING_TEMPLATES } = options;
  const notionKey = process.env.NOTION_API_KEY;
  const dbId = process.env.NOTION_SESSIONS_DB_ID;

  const active = templates.filter((t) => t.active);
  const datesByTemplate = new Map<RecurringTemplate, string[]>(
    active.map((t) => [t, upcomingWeekday(t.weekday, todayIso, weeks)]),
  );
  const allDates = [...new Set([...datesByTemplate.values()].flat())].sort();

  const result: EnsureResult = {
    dryRun,
    dates: allDates,
    created: [],
    wouldCreate: [],
    skipped: 0,
    failed: [],
  };
  if (!notionKey || !dbId || allDates.length === 0) return result;

  const existing = await fetchExistingTemplateKeys(
    notionKey,
    dbId,
    allDates[0],
    allDates[allDates.length - 1],
    templates,
  );

  for (const [template, dates] of datesByTemplate) {
    for (const date of dates) {
      for (const level of template.levels) {
        const label = `${date} ${template.titleBase} — ${level}`;
        if (existing.has(`${date}|${level}`)) {
          result.skipped += 1;
          continue;
        }
        if (dryRun) {
          result.wouldCreate.push(label);
          continue;
        }
        const ok = await createRow(notionKey, dbId, template, date, level);
        if (ok) result.created.push(label);
        else result.failed.push(label);
      }
    }
  }
  return result;
}
