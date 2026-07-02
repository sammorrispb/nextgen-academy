import { readPlainText } from "@/lib/notion-utils";
import {
  executeSessionCancel,
  type SessionCancelResult,
} from "@/lib/session-cancel";
import type { CancelReason } from "@/lib/email/session-cancelled";
import { RECURRING_TITLE_PREFIXES } from "@/lib/recurring-sessions";

/**
 * One-call cancel for a multi-row session day.
 *
 * The recurring all-levels Tuesday (and the cluster pilots) are NOT a single
 * session — each level is its own Sessions-DB row (its own court, status, and
 * roster). `executeSessionCancel` cancels exactly one row, so cancelling "the
 * Tuesday" by hand means flipping four rows and is easy to get half-done — the
 * 2026-06-16 incident, where only the Orange court was cancelled and a family
 * still booked the Red court that was left Open.
 *
 * This layer is deliberately a thin orchestrator over the existing, tested
 * engine: it enumerates the level rows for a date and fires the SAME
 * refund→notify→flip fan-out once per row. It moves no money itself.
 */

const NOTION_API = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";

// Statuses that mean the row is already handled — never re-fire the engine on
// these (a re-refund attempt is harmless thanks to Stripe idempotency, but a
// second cancellation email to a parent is not).
const TERMINAL_STATUSES = new Set(["Cancelled", "Completed", "Passed"]);

interface GroupRow {
  id: string;
  title: string;
  startTime: string;
  level: string;
  status: string;
}

/**
 * Every Sessions-DB row on `date` whose title starts with one of
 * `titlePrefixes`. The prefix match is the blast-radius guard: an unrelated
 * same-date session (e.g. a Saturday HS clinic) is never returned, so it can
 * never be swept into a group cancel. Defaults to the union of all
 * recurring-template prefixes (Mon–Thu, Phase 2a); the coach button passes
 * the specific base title instead.
 */
export async function fetchGroupRowsForDate(
  date: string,
  titlePrefixes: readonly string[] = RECURRING_TITLE_PREFIXES,
): Promise<GroupRow[]> {
  const notionKey = process.env.NOTION_API_KEY;
  const dbId = process.env.NOTION_SESSIONS_DB_ID;
  if (!notionKey || !dbId || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return [];

  const res = await fetch(`${NOTION_API}/databases/${dbId}/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${notionKey}`,
      "Content-Type": "application/json",
      "Notion-Version": NOTION_VERSION,
    },
    body: JSON.stringify({
      filter: { property: "Date", date: { equals: date } },
      page_size: 100,
    }),
    cache: "no-store",
  });
  if (!res.ok) {
    console.error(
      "[session-cancel-group] fetchGroupRowsForDate failed",
      res.status,
      await res.text().catch(() => ""),
    );
    return [];
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = (await res.json()) as { results: any[] };
  const rows: GroupRow[] = [];
  for (const page of data.results ?? []) {
    const props = page.properties ?? {};
    const title = readPlainText(props["Session"]);
    if (!title || !titlePrefixes.some((p) => title.startsWith(p))) continue;
    rows.push({
      id: page.id as string,
      title,
      startTime: readPlainText(props["Start time"]),
      level: props["Level"]?.select?.name ?? "",
      status: props["Status"]?.select?.name ?? "",
    });
  }
  return rows;
}

export interface GroupCancelInput {
  date: string; // ISO YYYY-MM-DD
  reason: CancelReason;
  note?: string;
  /** Title prefixes that define the group. Defaults to the Tuesday prefixes. */
  titlePrefixes?: readonly string[];
}

export type GroupLevelOutcome =
  | { level: string; title: string; sessionRowId: string; result: SessionCancelResult }
  | { level: string; title: string; sessionRowId: string; skipped: true; status: string };

export interface GroupCancelResult {
  ok: boolean;
  date: string;
  message: string;
  matched: number; // group rows found for the date
  cancelled: number; // rows the engine fired on successfully
  skipped: number; // already-terminal rows
  failed: number;
  outcomes: GroupLevelOutcome[];
}

/**
 * Cancel every level row for `date`, firing `executeSessionCancel` once per
 * non-terminal row. Already-Cancelled/Completed/Passed rows are skipped.
 * `ok` is true only when at least one row matched and none failed.
 */
export async function cancelAllLevelsForDate(
  input: GroupCancelInput,
): Promise<GroupCancelResult> {
  const { date, reason, note, titlePrefixes } = input;

  const base: GroupCancelResult = {
    ok: false,
    date,
    message: "",
    matched: 0,
    cancelled: 0,
    skipped: 0,
    failed: 0,
    outcomes: [],
  };

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return { ...base, message: "A valid date (YYYY-MM-DD) is required" };
  }

  const rows = await fetchGroupRowsForDate(date, titlePrefixes ?? RECURRING_TITLE_PREFIXES);
  base.matched = rows.length;
  if (rows.length === 0) {
    return { ...base, message: `No multi-level sessions found on ${date}` };
  }

  for (const row of rows) {
    if (TERMINAL_STATUSES.has(row.status)) {
      base.skipped += 1;
      base.outcomes.push({
        level: row.level,
        title: row.title,
        sessionRowId: row.id,
        skipped: true,
        status: row.status,
      });
      continue;
    }

    // Fail-soft per level: a throw on one row (or its post-work cache
    // revalidation) must not strand the remaining courts un-cancelled.
    let result: SessionCancelResult;
    try {
      result = await executeSessionCancel({
        sessionRowId: row.id,
        sessionTitle: row.title,
        sessionDate: date,
        sessionStartTime: row.startTime,
        reason,
        note,
      });
    } catch (err) {
      result = {
        ok: false,
        message: err instanceof Error ? err.message : String(err),
      };
    }
    if (result.ok) base.cancelled += 1;
    else base.failed += 1;
    base.outcomes.push({
      level: row.level,
      title: row.title,
      sessionRowId: row.id,
      result,
    });
  }

  base.ok = base.failed === 0;
  const refundedTotal = base.outcomes.reduce(
    (n, o) => n + ("result" in o ? o.result.refunded ?? 0 : 0),
    0,
  );
  const emailedTotal = base.outcomes.reduce(
    (n, o) => n + ("result" in o ? o.result.emailSent ?? 0 : 0),
    0,
  );
  base.message = base.ok
    ? `${base.cancelled} level${base.cancelled === 1 ? "" : "s"} cancelled · ${base.skipped} already done · ${refundedTotal} refunded · ${emailedTotal} emailed`
    : `Partial: ${base.failed} level${base.failed === 1 ? "" : "s"} failed, ${base.cancelled} cancelled — safe to re-run`;

  console.log(
    "[session-cancel-group]",
    JSON.stringify({
      date,
      reason,
      matched: base.matched,
      cancelled: base.cancelled,
      skipped: base.skipped,
      failed: base.failed,
    }),
  );

  return base;
}
