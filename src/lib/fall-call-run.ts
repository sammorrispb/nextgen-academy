import { Resend } from "resend";
import { todayET } from "./fall-refund-policy";
import {
  FALL_CALL_GROUPS,
  FALL_CUPF_STATUSES,
  FALL_WHATSAPP_NOTE_MAX,
  applyCall,
  buildFallCalendar,
  fallCallDateKind,
  isFallCallGroup,
  parseExtraEmails,
  sessionOn,
  whatsAppCallText,
  whatsAppShareUrl,
  type FallCallGroup,
  type FallCallRecord,
  type FallCupfStatus,
  type FallRainDateUse,
  type FallSeasonCalendar,
} from "./fall-calls";
import { fetchFallCalls, upsertFallCall, type FallCallRow } from "./notion-fall-calls";
import { fetchFallRoster } from "./notion-fall-registrations";
import { primaryParentEmail } from "./notion-fall-poll";
import {
  fallWeatherCancelHtml,
  fallWeatherCancelSubject,
  fallWeatherCancelText,
  type FallWeatherCancelGroup,
} from "./email/fall-weather-cancel";

/**
 * The weather-call engine for the Fall 2026 Sunday season. ONE engine behind
 * two equal entry points — the /admin/weather buttons (admin cookie) and an
 * agent (Bearer SESSION_OPS_SECRET) — so an agent making the call on Sam's
 * behalf fires the identical fan-out.
 *
 * `cancel` for a date + group(s):
 *   1. reads the tracker FRESH (refuses to act on one it can't read),
 *   2. checks each group actually plays that date,
 *   3. projects the calendar to find each group's make-up rain date,
 *   4. reads the roster (Confirmed rows only, parent fields only) — BEFORE any
 *      write, so a roster outage can't leave a session marked cancelled with
 *      nobody told,
 *   5. writes the status to Notion, 6. emails each family once, 7. stamps
 *      `<Group> Notified` only when every send landed.
 * It returns the WhatsApp text for each group and the rain dates that now need
 * a CUPF booking — the two steps a server can't do for Sam.
 *
 * A dry run does 1–4 and returns the plan: zero writes, zero sends.
 *
 * NO CHILD DATA LEAVES. The roster read is the wide admin one (it fails loud —
 * an unreadable roster must never look like "nobody to email"), but only
 * parent email, parent first name, group and status are used, and the email
 * says "your player". Pinned by e2e/invariant-fall-weather-call.spec.ts, whose
 * fixtures carry child data on purpose.
 */

const FROM_EMAIL = "Next Gen PB Academy <noreply@nextgenpbacademy.com>";
const REPLY_TO = "nextgenacademypb@gmail.com";
/** BCC, never CC — a parent must never see another family's address. */
const ADMIN_EMAIL = "nextgenacademypb@gmail.com";
const CONFIRMED = "Confirmed";
/** ~3.3/sec, under Resend's 5/sec cap. */
const THROTTLE_MS = 300;

export type FallCallAction = "cancel" | "on" | "revert" | "cupf";

export interface FallCallRequest {
  action: FallCallAction;
  date: string;
  groups?: readonly string[];
  note?: string;
  extraEmails?: string | readonly string[];
  /** cancel: false marks it cancelled without emailing (e.g. logging a past call). */
  notify?: boolean;
  /** cancel: email again even though this group was already notified. */
  resend?: boolean;
  /** cancel: restrict sends to these addresses — for retrying failures. */
  only?: readonly string[];
  cupf?: string;
  dryRun?: boolean;
  /** Tests only. */
  todayIso?: string;
}

export interface FallCallRecipient {
  email: string;
  firstName: string;
  groups: FallCallGroup[];
}

export interface FallCallEmailReport {
  subject: string | null;
  preview: string | null;
  recipients: string[];
  sent: string[];
  failed: string[];
  /** Why no email went out for a group, when one didn't. */
  skipped: { group: FallCallGroup; reason: "already_notified" | "past_date" | "notify_off" }[];
}

export type FallCallResult =
  | {
      ok: true;
      dryRun: boolean;
      action: FallCallAction;
      date: string;
      groups: FallCallGroup[];
      written: boolean;
      calendar: FallSeasonCalendar;
      makeups: { group: FallCallGroup; makeupDate: string | null }[];
      /** Rain dates claimed and not yet Booked with CUPF — Sam's next step. */
      cupf: FallRainDateUse[];
      whatsapp: { group: FallCallGroup; text: string; shareUrl: string }[];
      email: FallCallEmailReport | null;
      warnings: string[];
    }
  | {
      ok: false;
      reason:
        | "invalid"
        | "not_configured"
        | "calls_unreadable"
        | "roster_unreadable"
        | "write_failed"
        | "resend_unconfigured";
      message: string;
    };

function fail(
  reason: Extract<FallCallResult, { ok: false }>["reason"],
  message: string,
): FallCallResult {
  return { ok: false, reason, message };
}

function firstNameOf(parentName: string): string {
  const trimmed = (parentName ?? "").trim();
  return trimmed ? trimmed.split(/\s+/)[0]! : "there";
}

interface RosterLike {
  parentEmail: string;
  parentName: string;
  group: string;
  status: string;
}

/**
 * Confirmed families in the cancelled groups, one entry per parent email with
 * the set of their groups. Extra addresses (families paid off-site, with no
 * roster row) get every cancelled group. Reads parent fields ONLY.
 */
export function foldCallAudience(
  rows: readonly RosterLike[],
  groups: readonly FallCallGroup[],
  extraEmails: readonly string[] = [],
): FallCallRecipient[] {
  const byEmail = new Map<string, FallCallRecipient>();
  for (const row of rows) {
    if (row.status !== CONFIRMED) continue;
    if (!isFallCallGroup(row.group) || !groups.includes(row.group)) continue;
    const email = primaryParentEmail(row.parentEmail ?? "");
    if (!email) continue;
    const existing = byEmail.get(email);
    if (existing) {
      if (!existing.groups.includes(row.group)) existing.groups.push(row.group);
    } else {
      byEmail.set(email, { email, firstName: firstNameOf(row.parentName), groups: [row.group] });
    }
  }
  for (const email of extraEmails) {
    if (!byEmail.has(email)) byEmail.set(email, { email, firstName: "there", groups: [...groups] });
  }
  for (const r of byEmail.values()) {
    r.groups.sort((a, b) => FALL_CALL_GROUPS.indexOf(a) - FALL_CALL_GROUPS.indexOf(b));
  }
  return [...byEmail.values()];
}

function emailGroupsFor(
  recipient: FallCallRecipient,
  calendar: FallSeasonCalendar,
  date: string,
  todayIso: string,
): FallWeatherCancelGroup[] {
  return recipient.groups.map((group) => {
    const schedule = calendar.groups.find((g) => g.group === group)!;
    return {
      group,
      makeupDate: sessionOn(calendar, group, date)?.makeupDate ?? null,
      remaining: schedule.sessions
        .filter((s) => s.date >= todayIso && s.date !== date && s.state !== "cancelled")
        .map((s) => s.date),
    };
  });
}

async function sendOne(
  recipient: FallCallRecipient,
  calendar: FallSeasonCalendar,
  date: string,
  todayIso: string,
  note: string,
): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return false;
  const input = {
    firstName: recipient.firstName,
    date,
    todayIso,
    groups: emailGroupsFor(recipient, calendar, date, todayIso),
    note,
  };
  try {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      replyTo: REPLY_TO,
      to: recipient.email,
      bcc: ADMIN_EMAIL,
      subject: fallWeatherCancelSubject(input),
      html: fallWeatherCancelHtml(input),
      text: fallWeatherCancelText(input),
    });
    if (error) {
      console.error(`[fall-call] send to ${recipient.email} failed:`, error);
      return false;
    }
    return true;
  } catch (err) {
    console.error(`[fall-call] send to ${recipient.email} threw:`, err);
    return false;
  }
}

function recordsOf(rows: readonly FallCallRow[]): FallCallRecord[] {
  return rows.map((r) => ({ date: r.date, status: r.status, cupf: r.cupf, note: r.note, notifiedAt: r.notifiedAt }));
}

function whatsappFor(
  groups: readonly FallCallGroup[],
  calendar: FallSeasonCalendar,
  date: string,
  todayIso: string,
  outcome: "cancelled" | "on",
  note: string,
) {
  return groups.map((group) => {
    const text = whatsAppCallText({
      group,
      date,
      todayIso,
      outcome,
      makeupDate: sessionOn(calendar, group, date)?.makeupDate ?? null,
      note,
    });
    return { group, text, shareUrl: whatsAppShareUrl(text) };
  });
}

function parseGroups(raw: readonly string[] | undefined): FallCallGroup[] | null {
  if (!raw || raw.length === 0) return null;
  const out: FallCallGroup[] = [];
  for (const g of raw) {
    if (!isFallCallGroup(g)) return null;
    if (!out.includes(g)) out.push(g);
  }
  return out.sort((a, b) => FALL_CALL_GROUPS.indexOf(a) - FALL_CALL_GROUPS.indexOf(b));
}

export async function runFallCall(req: FallCallRequest): Promise<FallCallResult> {
  const todayIso = req.todayIso ?? todayET();
  const dryRun = req.dryRun === true;
  const kind = fallCallDateKind(req.date);
  if (!kind) return fail("invalid", `${req.date} is not a fall season date or rain date.`);

  const note = (req.note ?? "").trim();
  if (note.length > FALL_WHATSAPP_NOTE_MAX) {
    return fail("invalid", `Keep the note under ${FALL_WHATSAPP_NOTE_MAX} characters.`);
  }

  let groups: FallCallGroup[] = [];
  let cupf: FallCupfStatus | null = null;
  if (req.action === "cupf") {
    if (kind !== "rain") return fail("invalid", "CUPF status is tracked for rain dates only.");
    if (!req.cupf || !(FALL_CUPF_STATUSES as readonly string[]).includes(req.cupf)) {
      return fail("invalid", `cupf must be one of: ${FALL_CUPF_STATUSES.join(", ")}.`);
    }
    cupf = req.cupf as FallCupfStatus;
  } else if (req.action === "cancel" || req.action === "on" || req.action === "revert") {
    const parsed = parseGroups(req.groups);
    if (!parsed) return fail("invalid", `groups must be a non-empty list of: ${FALL_CALL_GROUPS.join(", ")}.`);
    groups = parsed;
  } else {
    return fail("invalid", "action must be cancel, on, revert or cupf.");
  }

  const extra = parseExtraEmails(req.extraEmails);
  if (extra.invalid.length > 0) {
    return fail("invalid", `Not an email address: ${extra.invalid.join(", ")}`);
  }

  // 1. The tracker, fresh. Never act on a tracker we can't read.
  const calls = await fetchFallCalls({ fresh: true });
  if (calls.status === "config_missing") {
    return fail("not_configured", "NOTION_FALL_CALLS_DB_ID is not set — the weather-call tracker is off.");
  }
  if (calls.status === "query_failed") {
    return fail("calls_unreadable", `Couldn't read the weather-call tracker (${calls.message}). Nothing was changed.`);
  }
  const records = recordsOf(calls.rows);
  const before = buildFallCalendar(records, todayIso);
  const row = calls.rows.find((r) => r.date === req.date);
  const warnings: string[] = [];
  if (calls.duplicates.length > 0) {
    warnings.push(`Duplicate tracker rows for ${calls.duplicates.join(", ")} — the oldest one is used.`);
  }

  // 2. Every group named must actually play this date.
  for (const g of groups) {
    if (!sessionOn(before, g, req.date)) {
      return fail(
        "invalid",
        `${g} Ball has no session on ${req.date} — a rain date only becomes a session once a cancellation claims it.`,
      );
    }
  }

  if (req.action === "cupf") {
    const after = buildFallCalendar(
      [...records.filter((r) => r.date !== req.date), { ...(row ?? { date: req.date }), cupf }],
      todayIso,
    );
    if (!dryRun) {
      const w = await upsertFallCall(req.date, { cupf: cupf! }, row?.pageId);
      if (!w.ok) return fail("write_failed", w.message);
    }
    return {
      ok: true,
      dryRun,
      action: "cupf",
      date: req.date,
      groups: [],
      written: !dryRun,
      calendar: after,
      makeups: [],
      cupf: after.rainDates.filter((r) => r.needsBooking),
      whatsapp: [],
      email: null,
      warnings,
    };
  }

  if (req.action === "on" || req.action === "revert") {
    const status = req.action === "on" ? "Held" : "Scheduled";
    for (const g of groups) {
      if (row?.status?.[g] === "Cancelled" && row?.notifiedAt?.[g]) {
        warnings.push(
          `${g} Ball families were already emailed that ${req.date} is cancelled — post the update in WhatsApp so nobody stays home.`,
        );
      }
    }
    const after = buildFallCalendar(applyCall(records, req.date, groups, status), todayIso);
    if (!dryRun) {
      const w = await upsertFallCall(
        req.date,
        {
          status: Object.fromEntries(groups.map((g) => [g, status])),
          // Clear the stamp so a later cancel of this date emails again.
          notifiedAt: Object.fromEntries(groups.map((g) => [g, null])),
        },
        row?.pageId,
      );
      if (!w.ok) return fail("write_failed", w.message);
    }
    return {
      ok: true,
      dryRun,
      action: req.action,
      date: req.date,
      groups,
      written: !dryRun,
      calendar: after,
      makeups: [],
      cupf: after.rainDates.filter((r) => r.needsBooking),
      whatsapp: whatsappFor(groups, after, req.date, todayIso, "on", note),
      email: null,
      warnings,
    };
  }

  // ----- cancel -----------------------------------------------------------
  // 3. Project the calendar: where does each group's session go?
  const after = buildFallCalendar(applyCall(records, req.date, groups, "Cancelled"), todayIso);
  const makeups = groups.map((group) => ({
    group,
    makeupDate: sessionOn(after, group, req.date)?.makeupDate ?? null,
  }));
  for (const m of makeups) {
    if (!m.makeupDate) {
      warnings.push(
        `${m.group} Ball has no rain date left for ${req.date}. Per the season terms a session we can't make up is refunded — decide whether to add a date or refund.`,
      );
    }
  }

  // Who gets emailed, and who doesn't (and why).
  const skipped: FallCallEmailReport["skipped"] = [];
  const emailGroups: FallCallGroup[] = [];
  for (const g of groups) {
    if (req.notify === false) skipped.push({ group: g, reason: "notify_off" });
    else if (req.date < todayIso) skipped.push({ group: g, reason: "past_date" });
    else if (row?.notifiedAt?.[g] && row?.status?.[g] === "Cancelled" && req.resend !== true) {
      skipped.push({ group: g, reason: "already_notified" });
    } else emailGroups.push(g);
  }

  // 4. The roster — before any write.
  let recipients: FallCallRecipient[] = [];
  if (emailGroups.length > 0) {
    if (!dryRun && !process.env.RESEND_API_KEY) {
      return fail("resend_unconfigured", "RESEND_API_KEY is not set — nothing was changed.");
    }
    const roster = await fetchFallRoster();
    if (roster.status === "config_missing") {
      return fail("roster_unreadable", "NOTION_FALL_REGS_DB_ID is not set, so there is nobody to email. Nothing was changed.");
    }
    if (roster.status === "query_failed") {
      return fail(
        "roster_unreadable",
        `Couldn't read the fall roster (${roster.message}). Nothing was changed — retry, or cancel with notify off and email families by hand.`,
      );
    }
    recipients = foldCallAudience(roster.rows, emailGroups, extra.valid);
    if (req.only && req.only.length > 0) {
      const onlySet = new Set(req.only.map((e) => primaryParentEmail(e)));
      recipients = recipients.filter((r) => onlySet.has(r.email));
    }
    if (recipients.length === 0) {
      warnings.push("No Confirmed families found for this group — check the roster before relying on email.");
    }
  }

  const sample = recipients[0] ?? {
    email: "",
    firstName: "there",
    groups: emailGroups.length ? emailGroups : groups,
  };
  const sampleInput = {
    firstName: sample.firstName,
    date: req.date,
    todayIso,
    groups: emailGroupsFor(sample, after, req.date, todayIso),
    note,
  };
  const report: FallCallEmailReport = {
    subject: emailGroups.length ? fallWeatherCancelSubject(sampleInput) : null,
    preview: emailGroups.length ? fallWeatherCancelText(sampleInput) : null,
    recipients: recipients.map((r) => r.email),
    sent: [],
    failed: [],
    skipped,
  };
  const whatsapp = whatsappFor(groups, after, req.date, todayIso, "cancelled", note);

  if (dryRun) {
    return {
      ok: true,
      dryRun,
      action: "cancel",
      date: req.date,
      groups,
      written: false,
      calendar: after,
      makeups,
      cupf: after.rainDates.filter((r) => r.needsBooking),
      whatsapp,
      email: report,
      warnings,
    };
  }

  // 5. Mark it. The website reads this row.
  const write = await upsertFallCall(
    req.date,
    {
      status: Object.fromEntries(groups.map((g) => [g, "Cancelled"])),
      ...(req.note !== undefined ? { note } : {}),
    },
    row?.pageId,
  );
  if (!write.ok) return fail("write_failed", `${write.message} — nothing was sent.`);

  // 6. Email, one per family.
  for (const [i, r] of recipients.entries()) {
    const ok = await sendOne(r, after, req.date, todayIso, note);
    (ok ? report.sent : report.failed).push(r.email);
    if (i < recipients.length - 1) await new Promise((res) => setTimeout(res, THROTTLE_MS));
  }

  // 7. Stamp only a complete send, so a partial one can be retried.
  if (emailGroups.length > 0 && report.sent.length > 0 && report.failed.length === 0) {
    const at = new Date().toISOString();
    const stamp = await upsertFallCall(
      req.date,
      { notifiedAt: Object.fromEntries(emailGroups.map((g) => [g, at])) },
      write.pageId,
    );
    if (!stamp.ok) {
      warnings.push("Emails went out but the Notified stamp didn't save — don't resend; it's safe to leave.");
    }
  }
  if (report.failed.length > 0) {
    warnings.push(`${report.failed.length} email(s) failed — retry with only those addresses.`);
  }

  return {
    ok: true,
    dryRun: false,
    action: "cancel",
    date: req.date,
    groups,
    written: true,
    calendar: after,
    makeups,
    cupf: after.rainDates.filter((r) => r.needsBooking),
    whatsapp,
    email: report,
    warnings,
  };
}
