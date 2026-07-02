import { Resend } from "resend";
import {
  fetchUpcomingDropIns,
  updateDropInSchedule,
  markDropInFlag,
  type DropInRegistration,
} from "@/lib/notion-dropins";
import { partitionRegistrants } from "@/lib/registrant-match";
import { updateSession } from "@/lib/notion-sessions-admin";
import { RECURRING_TITLE_PREFIXES } from "@/lib/recurring-sessions";
import {
  sessionRescheduledHtml,
  sessionRescheduledText,
} from "@/lib/email/session-rescheduled";

/**
 * Carry-over reschedule: move a session to a new date/time and keep every paid
 * spot. Unlike session-cancel, NO money moves — there is intentionally no
 * Stripe import here, and a test pins that api.stripe.com is never contacted.
 * Auth-agnostic (the admin route owns auth).
 *
 * Design (see gauntlet report 2026-06-16):
 *  - Roster attaches to the session by Session Row ID, but every drop-in query
 *    + the reminder/post-session crons key on Session Date, so each roster row
 *    is re-dated (updateDropInSchedule) — which also resets the date-scoped
 *    flags.
 *  - Two-phase + idempotent: migrate ALL rows first; if any migration fails,
 *    abort BEFORE emailing and leave the session row un-flipped (recoverable).
 *    The roster is captured across [min..max of old/new date] and matched by
 *    Session Row ID so a re-run finds rows whether or not they already moved;
 *    `Reschedule Notified` gates the email so a re-run never double-sends.
 *  - Seeded recurring evenings (Mon–Thu templates) are blocked — moving one
 *    makes the seed cron re-create a ghost at the original date. Cancel it
 *    instead.
 */

const ADMIN_EMAIL = "nextgenacademypb@gmail.com";
const FROM_EMAIL = "Next Gen PB Academy <noreply@nextgenpbacademy.com>";
const REPLY_TO = "nextgenacademypb@gmail.com";
const SITE_ORIGIN =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://nextgenpbacademy.com";
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface RescheduleInput {
  sessionRowId: string;
  sessionTitle: string;
  /** Current (pre-move) session date, ISO YYYY-MM-DD — used to locate roster. */
  oldDate: string;
  oldStartTime: string;
  newDate: string; // ISO YYYY-MM-DD
  newStartTime: string;
  newEndTime: string;
}

export interface RescheduleResult {
  ok: boolean;
  message: string;
  rosterSize?: number;
  migrated?: number;
  emailed?: number;
  errors?: number;
}

export interface RowPlan {
  pageId: string;
  newSessionDate: string;
  newSessionStartTime: string;
  /** Row is not yet at the target date/time. */
  needsMigration: boolean;
  /** Row has not been emailed about this move yet. */
  needsNotify: boolean;
}

/** Today (America/New_York) as YYYY-MM-DD. ISO strings sort lexicographically. */
export function todayET(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
}

export function isSeededRecurring(title: string): boolean {
  const t = (title || "").trim();
  return RECURRING_TITLE_PREFIXES.some((p) => t.startsWith(p));
}

function formatLongDate(isoDate: string): string {
  if (!isoDate) return "";
  // T12:00:00Z avoids the UTC-build off-by-one (CLAUDE.md Date Handling).
  return new Date(`${isoDate}T12:00:00Z`).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

/**
 * Pure: given the confirmed roster + target, compute each row's plan. Unit-
 * tested without a server. needsMigration is by current date+time; needsNotify
 * is by the Reschedule Notified flag — kept separate so a partial run recovers.
 */
export function planRescheduleRoster(
  rows: Pick<
    DropInRegistration,
    "id" | "sessionDate" | "sessionStartTime" | "rescheduleNotified"
  >[],
  target: { newDate: string; newStartTime: string },
): RowPlan[] {
  return rows.map((r) => ({
    pageId: r.id,
    newSessionDate: target.newDate,
    newSessionStartTime: target.newStartTime,
    needsMigration:
      r.sessionDate !== target.newDate ||
      r.sessionStartTime !== target.newStartTime,
    needsNotify: !r.rescheduleNotified,
  }));
}

export async function executeSessionReschedule(
  input: RescheduleInput,
): Promise<RescheduleResult> {
  if (!input.sessionRowId?.trim()) return { ok: false, message: "Missing sessionRowId" };
  if (!input.sessionTitle?.trim()) return { ok: false, message: "Missing session title" };
  if (!ISO_DATE.test(input.newDate)) {
    return { ok: false, message: "New date must be YYYY-MM-DD" };
  }
  if (!input.newStartTime?.trim()) return { ok: false, message: "Missing new start time" };
  if (input.newDate <= todayET()) {
    return { ok: false, message: "New date must be in the future" };
  }
  if (isSeededRecurring(input.sessionTitle)) {
    return {
      ok: false,
      message:
        "This is an auto-seeded recurring session — cancel it instead (the weekly seeder manages its dates).",
    };
  }

  // Capture the roster across [min..max of old/new] so a re-run finds rows
  // whether or not they already migrated; match by Session Row ID.
  const lo = input.oldDate < input.newDate ? input.oldDate : input.newDate;
  const hi = input.oldDate < input.newDate ? input.newDate : input.oldDate;
  const window = await fetchUpcomingDropIns(lo || input.newDate, hi || input.newDate);
  const roster = partitionRegistrants(window, input.sessionTitle, input.sessionRowId)
    .matched.filter((r) => r.status === "Confirmed");

  // Empty roster: nothing to migrate or notify — just move the session row.
  if (roster.length === 0) {
    await updateSession(input.sessionRowId, {
      date: input.newDate,
      startTime: input.newStartTime,
      endTime: input.newEndTime,
    });
    return { ok: true, rosterSize: 0, migrated: 0, emailed: 0, errors: 0, message: "Rescheduled (no roster)" };
  }

  const plans = planRescheduleRoster(roster, {
    newDate: input.newDate,
    newStartTime: input.newStartTime,
  });

  // ── Phase 1: migrate every row that needs it. Abort before emailing if any
  //    fails so the session row is never advanced past a half-moved roster. ──
  let migrated = 0;
  let migrateErrors = 0;
  for (const p of plans) {
    if (!p.needsMigration) continue;
    const ok = await updateDropInSchedule(p.pageId, {
      sessionDate: p.newSessionDate,
      sessionStartTime: p.newSessionStartTime,
    });
    if (ok) migrated++;
    else migrateErrors++;
  }
  if (migrateErrors > 0) {
    const result: RescheduleResult = {
      ok: false,
      rosterSize: roster.length,
      migrated,
      emailed: 0,
      errors: migrateErrors,
      message: `Partial: ${migrateErrors} roster row(s) failed to move — re-run to finish (nothing emailed, date not changed).`,
    };
    logResult(input, result);
    return result;
  }

  // ── Phase 2: notify parents whose row hasn't been told about this move. ──
  const resendApiKey = process.env.RESEND_API_KEY;
  const resend = resendApiKey ? new Resend(resendApiKey) : null;
  const oldDateLong = formatLongDate(input.oldDate);
  const newDateLong = formatLongDate(input.newDate);
  const scheduleUrl = `${SITE_ORIGIN}/schedule`;

  let emailed = 0;
  let emailErrors = 0;
  for (let i = 0; i < plans.length; i++) {
    const p = plans[i];
    if (!p.needsNotify) continue;
    const row = roster[i];
    if (!resend || !row.parentEmail || !EMAIL_RE.test(row.parentEmail)) continue;

    const args = {
      parentFirst: (row.parentName || "").split(/\s+/)[0] || "there",
      childFirst: row.childFirstName || "your player",
      sessionTitle: input.sessionTitle,
      oldDateLong,
      oldStart: input.oldStartTime,
      newDateLong,
      newStart: input.newStartTime,
      scheduleUrl,
    };
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: row.parentEmail,
      bcc: ADMIN_EMAIL,
      replyTo: REPLY_TO,
      subject: "Your session moved — new date inside",
      html: sessionRescheduledHtml(args),
      text: sessionRescheduledText(args),
    });
    if (error) {
      emailErrors++;
      console.error("[session-reschedule] Resend rejected", error.message ?? String(error));
      continue;
    }
    emailed++;
    await markDropInFlag(row.id, "Reschedule Notified");
  }

  // ── Phase 3: advance the session row. Roster is fully migrated by here. ──
  await updateSession(input.sessionRowId, {
    date: input.newDate,
    startTime: input.newStartTime,
    endTime: input.newEndTime,
  });

  const result: RescheduleResult = {
    ok: emailErrors === 0,
    rosterSize: roster.length,
    migrated,
    emailed,
    errors: emailErrors,
    message:
      emailErrors === 0
        ? `Rescheduled · ${migrated} moved · ${emailed} emailed`
        : `Rescheduled · ${migrated} moved · ${emailed} emailed · ${emailErrors} email error(s)`,
  };
  logResult(input, result);
  return result;
}

function logResult(input: RescheduleInput, result: RescheduleResult): void {
  console.log(
    "[session-reschedule]",
    JSON.stringify({
      sessionRowId: input.sessionRowId,
      sessionTitle: input.sessionTitle,
      oldDate: input.oldDate,
      newDate: input.newDate,
      ...result,
    }),
  );
}
