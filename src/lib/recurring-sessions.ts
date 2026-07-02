// Keeps the recurring weekly-evening sessions stocked (admin-reduction
// roadmap Phase 2a). Each active template in src/data/recurring-templates.ts
// gets one row per level per upcoming week — a court each. The seed cron
// (still at /api/cron/seed-tuesday-sessions, wrapped by withCronAlert) calls
// ensureWeeklyTemplates() weekly; it's idempotent (never duplicates a row)
// and never resurrects a deliberately-cancelled one: within a template
// FAMILY, any existing row for a date|level counts as present, whatever its
// Status. A row joins a family via its title (the template's titleBase OR any
// legacyTitlePrefix) — family-scoped keys so a row hand-moved onto another
// evening's date can't suppress that evening's seed.

import { readPlainText } from "@/lib/notion-utils";
import { rollupFailure, type CronFailure } from "@/lib/cron-alert";
import {
  RECURRING_TEMPLATES,
  type RecurringTemplate,
  type SessionLevel,
} from "@/data/recurring-templates";

const NOTION_API = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";

// Seeded dates must be strictly AFTER the run date: a Monday run never yields
// today's Monday (same-day rows would appear inside the bookable window with
// zero notice, and a mid-day run could double-book a day already handled by
// hand that morning).
const MIN_LEAD_DAYS = 1;

// Notion allows ~3 req/s — space live creates out (mirrors the repo's 300ms
// Resend throttle convention in camp-reminder-run.ts). Tests pass 0.
const CREATE_THROTTLE_MS = 350;

const sleep = (ms: number) =>
  ms > 0 ? new Promise((r) => setTimeout(r, ms)) : Promise.resolve();

// "6:30 PM" — what every template (and every seeded row) uses.
const TIME_RE = /^\d{1,2}:\d{2} (AM|PM)$/;

/** Every title prefix that marks a row as belonging to `template` — the
 * current titleBase plus every legacy prefix, deduped. Empty/whitespace
 * prefixes are dropped: "" startsWith-matches EVERY title. */
export function templateTitlePrefixes(template: RecurringTemplate): string[] {
  return [
    ...new Set(
      [template.titleBase, ...template.legacyTitlePrefixes].filter((p) => p?.trim()),
    ),
  ];
}

/** UTC-anchored weekday (0=Sun … 6=Sat) of an ISO date, or null when the
 * string isn't a date. Date.UTC, never `new Date(y,m,d)`. */
export function weekdayOfIso(dateIso: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateIso)) return null;
  const [y, m, d] = dateIso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/**
 * Title prefixes of the template families that run on `date`'s weekday
 * (active or not — a deactivated template's already-seeded rows still exist
 * and still belong to the recurring family). This is the DEFAULT blast-radius
 * guard for the group-cancel flow: deriving the prefixes from the DATE means
 * a wrong-date call can only ever match that weekday's own family — a
 * Wednesday date can never sweep Tuesday rows (F1).
 */
export function recurringPrefixesForDate(
  dateIso: string,
  templates: readonly RecurringTemplate[] = RECURRING_TEMPLATES,
): string[] {
  const weekday = weekdayOfIso(dateIso);
  if (weekday === null) return [];
  return [
    ...new Set(
      templates.filter((t) => t.weekday === weekday).flatMap(templateTitlePrefixes),
    ),
  ];
}

/**
 * True only for rows the seeder ACTUALLY manages — the reschedule block's
 * guard (F5): the title must match an ACTIVE template's prefix AND the row's
 * level must be one the template seeds AND the row's date must fall on the
 * template's weekday. Everything else (hand-moved rows, levels a template
 * doesn't seed, deactivated templates) reschedules normally — the seeder will
 * never re-create a ghost in those slots. `level` defaults to the title's
 * "… — Level" suffix (how every seeded row is titled); pass the row's Level
 * select when you have it.
 */
export function isSeederManagedRow(
  row: { title: string; date: string; level?: string },
  templates: readonly RecurringTemplate[] = RECURRING_TEMPLATES,
): boolean {
  const weekday = weekdayOfIso(row.date);
  if (weekday === null) return false;
  const title = (row.title || "").trim();
  if (!title) return false;
  const parts = title.split(" — ");
  const level = row.level ?? (parts.length > 1 ? parts[parts.length - 1].trim() : "");
  if (!level) return false;
  return templates.some(
    (t) =>
      t.active &&
      t.weekday === weekday &&
      (t.levels as readonly string[]).includes(level) &&
      templateTitlePrefixes(t).some((p) => title.startsWith(p)),
  );
}

/**
 * ISO dates (YYYY-MM-DD) of the next `count` occurrences of `weekday`
 * (0=Sun … 6=Sat) strictly AFTER `todayIso` (MIN_LEAD_DAYS — a run on the
 * requested weekday yields next week, never today). Pure + UTC-anchored
 * (Date.UTC, never `new Date(y,m,d)`) so it can't drift on a UTC build server.
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
  let daysUntil = (weekday - dow + 7) % 7;
  if (daysUntil < MIN_LEAD_DAYS) daysUntil += 7;
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    const ms = base + (daysUntil + i * 7) * 86_400_000;
    out.push(new Date(ms).toISOString().slice(0, 10));
  }
  return out;
}

/**
 * Fail-safe `?dryRun=` parsing for the seed route (F6): `1`/`true`/`yes`
 * (case-insensitive) plan; absent/empty runs live; ANYTHING else is rejected
 * so a typo'd dry-run request (`?dryRun=ture`) can never silently write to
 * the live Sessions DB.
 */
export function parseDryRunParam(
  raw: string | null,
): { ok: true; dryRun: boolean } | { ok: false; error: string } {
  if (raw === null || raw === "") return { ok: true, dryRun: false };
  if (["1", "true", "yes"].includes(raw.toLowerCase())) return { ok: true, dryRun: true };
  return { ok: false, error: "dryRun must be 1|true|yes" };
}

/** Structural problems with a template ([] = valid). Guards the data file:
 * a typo'd weekday or unparseable time seeds wrong silently otherwise (F8).
 * The weekday TYPE (0|1|…|6 union) already fails a typo at compile time; this
 * is the runtime backstop for values that arrive via options.templates. */
export function validateTemplate(template: RecurringTemplate): string[] {
  const problems: string[] = [];
  if (!Number.isInteger(template.weekday) || template.weekday < 0 || template.weekday > 6) {
    problems.push(`weekday must be an integer 0-6 (got ${JSON.stringify(template.weekday)})`);
  }
  if (!template.titleBase?.trim()) problems.push("titleBase is empty");
  if (!template.levels || template.levels.length === 0) problems.push("levels is empty");
  if (!TIME_RE.test(template.startTime ?? "")) {
    problems.push(`startTime ${JSON.stringify(template.startTime)} is not "H:MM AM/PM"`);
  }
  if (!TIME_RE.test(template.endTime ?? "")) {
    problems.push(`endTime ${JSON.stringify(template.endTime)} is not "H:MM AM/PM"`);
  }
  return problems;
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
 * Existing template-owned rows in [minDate, maxDate], keyed
 * `titleBase|date|level` — the FAMILY-scoped identity (F2). A row joins a
 * family when its title starts with that template's titleBase OR any
 * legacyTitlePrefix (first matching family wins). Status is deliberately
 * ignored so a Cancelled row still counts as present within its family
 * (never resurrect a deliberate cancellation). The value carries the row's
 * start time for the drift signal (F7).
 */
async function fetchExistingTemplateRows(
  notionKey: string,
  dbId: string,
  minDate: string,
  maxDate: string,
  templates: readonly RecurringTemplate[],
): Promise<Map<string, { startTime: string }>> {
  const families = templates.map((t) => ({
    titleBase: t.titleBase,
    prefixes: templateTitlePrefixes(t),
  }));
  const rows = new Map<string, { startTime: string }>();
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
      const family = families.find((f) => f.prefixes.some((p) => title.startsWith(p)));
      if (!family) continue;
      const date = props["Date"]?.date?.start ?? "";
      const level = props["Level"]?.select?.name ?? "";
      if (date && level) {
        rows.set(`${family.titleBase}|${date}|${level}`, {
          startTime: readPlainText(props["Start time"]),
        });
      }
    }
    cursor = data.has_more ? data.next_cursor : undefined;
  } while (cursor);
  return rows;
}

/** One create with ONE 429 retry (Retry-After honored, else backoffMs) —
 * Notion rate-limits at ~3 req/s and the first live run is a burst (F9).
 * Any other failure stays fail-soft per row. */
async function createRow(
  notionKey: string,
  dbId: string,
  template: RecurringTemplate,
  date: string,
  level: SessionLevel,
  backoffMs: number,
): Promise<boolean> {
  for (let attempt = 0; attempt < 2; attempt++) {
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
    if (res.ok) return true;
    if (res.status === 429 && attempt === 0) {
      const retryAfter = Number(res.headers.get("retry-after"));
      const wait = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : backoffMs;
      console.warn(
        `[recurring-sessions] 429 on create ${date} ${template.titleBase} ${level} — retrying once in ${wait}ms`,
      );
      await sleep(wait);
      continue;
    }
    console.error(
      `[recurring-sessions] create failed ${date} ${template.titleBase} ${level}:`,
      res.status,
      await res.text().catch(() => ""),
    );
    return false;
  }
  return false;
}

export interface EnsureResult {
  dryRun: boolean;
  /** All dates considered across templates, ascending. */
  dates: string[];
  /** Rows created this run — "YYYY-MM-DD TitleBase — Level". Empty in dryRun. */
  created: string[];
  /** dryRun only: rows a live run WOULD create. Empty otherwise. */
  wouldCreate: string[];
  /** family|date|level slots that already existed (any Status). */
  skipped: number;
  /** Per-row create failures (fail-soft) — the route maps these to
   * `seed_row_failed` alert entries. */
  failed: string[];
  /** Run-level failure entries (config_missing, config_invalid, time_drift)
   * ready for withCronAlert — a misconfigured or drifting seeder must alert,
   * never no-op green (F4/F7/F8). */
  failures: CronFailure[];
}

export interface EnsureOptions {
  /** Plan only — return `wouldCreate` and write NOTHING to Notion. */
  dryRun?: boolean;
  /** Override for tests; defaults to RECURRING_TEMPLATES. */
  templates?: readonly RecurringTemplate[];
  /** ms between live creates (default 350 — Notion ~3 req/s). Tests pass 0. */
  throttleMs?: number;
}

/**
 * Ensure each active template has all of its level rows for the next `weeks`
 * occurrences of its weekday (strictly future — see MIN_LEAD_DAYS).
 * Idempotent: existing rows (any Status, matched within their template
 * family) are left untouched — but a skipped row whose start time differs
 * from its template rolls up into ONE `time_drift` failure entry so silent
 * drift alerts instead of passing (no auto-correction of live rows).
 * Fail-soft per row — one bad create doesn't abort the rest.
 */
export async function ensureWeeklyTemplates(
  todayIso: string,
  weeks: number,
  options: EnsureOptions = {},
): Promise<EnsureResult> {
  const {
    dryRun = false,
    templates = RECURRING_TEMPLATES,
    throttleMs = CREATE_THROTTLE_MS,
  } = options;
  const notionKey = process.env.NOTION_API_KEY;
  const dbId = process.env.NOTION_SESSIONS_DB_ID;

  const result: EnsureResult = {
    dryRun,
    dates: [],
    created: [],
    wouldCreate: [],
    skipped: 0,
    failed: [],
    failures: [],
  };

  // Validate every template up front (F8) — an invalid one is excluded from
  // seeding AND from family matching (an empty titleBase would prefix-match
  // every row) and surfaces as config_invalid.
  const valid: RecurringTemplate[] = [];
  for (const template of templates) {
    const problems = validateTemplate(template);
    if (problems.length === 0) {
      valid.push(template);
      continue;
    }
    result.failures.push({
      signature: "config_invalid",
      ref: template.titleBase?.trim() || "(untitled template)",
      detail: problems.join("; "),
    });
  }

  // Missing config is a FAILURE, not a quiet green no-op (F4) — the whole
  // point of the seeder is that Sam stopped watching the Sessions DB.
  if (!notionKey || !dbId) {
    const missing = [
      ...(!notionKey ? ["NOTION_API_KEY"] : []),
      ...(!dbId ? ["NOTION_SESSIONS_DB_ID"] : []),
    ];
    result.failures.push({
      signature: "config_missing",
      detail: `${missing.join(" + ")} not set — seeder cannot run`,
    });
    return result;
  }

  const active = valid.filter((t) => t.active);
  const datesByTemplate = new Map<RecurringTemplate, string[]>(
    active.map((t) => [t, upcomingWeekday(t.weekday, todayIso, weeks)]),
  );
  const allDates = [...new Set([...datesByTemplate.values()].flat())].sort();
  result.dates = allDates;
  if (allDates.length === 0) return result; // no active templates / weeks<=0

  const existing = await fetchExistingTemplateRows(
    notionKey,
    dbId,
    allDates[0],
    allDates[allDates.length - 1],
    valid,
  );

  const driftRefs: string[] = [];
  const backoffMs = throttleMs * 3;
  let liveCreates = 0;
  for (const [template, dates] of datesByTemplate) {
    for (const date of dates) {
      for (const level of template.levels) {
        const label = `${date} ${template.titleBase} — ${level}`;
        const row = existing.get(`${template.titleBase}|${date}|${level}`);
        if (row) {
          result.skipped += 1;
          if (row.startTime !== template.startTime) {
            driftRefs.push(
              `${label} (expected ${template.startTime}, found ${row.startTime || "no start time"})`,
            );
          }
          continue;
        }
        if (dryRun) {
          result.wouldCreate.push(label);
          continue;
        }
        if (liveCreates > 0) await sleep(throttleMs);
        liveCreates += 1;
        const ok = await createRow(notionKey, dbId, template, date, level, backoffMs);
        if (ok) result.created.push(label);
        else result.failed.push(label);
      }
    }
  }

  // ONE rolled-up drift entry per run (F7) — refs carry expected vs actual.
  // Signal only: live rows are never auto-corrected (Sam's call).
  const drift = rollupFailure(
    "time_drift",
    driftRefs,
    "seeded row(s) whose start time differs from the template — fix the Notion row or the template",
  );
  if (drift) result.failures.push(drift);

  return result;
}
