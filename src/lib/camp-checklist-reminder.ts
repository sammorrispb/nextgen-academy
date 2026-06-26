import { Resend } from "resend";
import { CAMPS, CAMP_OPTIONS, campDays, type Camp } from "@/data/camps";
import {
  formatCampDayLong,
  formatCampWeekday,
  resolveCampWhere,
} from "@/lib/camp-reminder-schedule";
import { getCoachEmails } from "@/lib/coach-allowlist";
import {
  campChecklistSubject,
  campChecklistHtml,
  campChecklistText,
  type CampChecklistReminderInput,
} from "@/lib/email/camp-checklist-reminder";

/**
 * Core of the 7am-on-camp-days coach checklist nudge, split out from the cron
 * route so it runs offline in tests (Resend rides globalThis.fetch). The route
 * does auth + param parsing and calls this.
 *
 * Recipients are COACHES ONLY (COACH_ALLOWED_EMAILS, falling back to the admin
 * inbox). No parent or child data travels in this email, so it sits outside the
 * minor-PII egress surface — it only links to the public checklist page.
 */

const FROM_EMAIL = "Next Gen PB Academy <noreply@nextgenpbacademy.com>";
const ADMIN_EMAIL = "nextgenacademypb@gmail.com";
const REPLY_TO = "nextgenacademypb@gmail.com";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://nextgenpbacademy.com";
const CHECKLIST_PATH = "/coach/camp-checklist";
const CAMP_HOURS = CAMP_OPTIONS[0].hours; // "9:30 AM – 12:30 PM" (same for both SKUs)

/**
 * Pure: the camps whose scheduled Mon–Thu mornings include `todayIso` (ET
 * date). Usually zero or one. The makeup/rain Friday is intentionally excluded
 * — it only runs if a day was rained out, which this cron can't know, so a blind
 * Friday send would be a false alarm.
 */
export function campsRunningOn(todayIso: string, camps: Camp[]): Camp[] {
  return camps.filter((camp) => campDays(camp).includes(todayIso));
}

export interface RunCampChecklistOpts {
  /** ET "today" (YYYY-MM-DD). Defaults to the ET calendar date. */
  today?: string;
  dryRun?: boolean;
}

export type RunCampChecklistResult =
  | { ok: true; skipped: true; reason: string; today: string }
  | {
      ok: true;
      dryRun: true;
      today: string;
      campTitles: string[];
      recipients: string[];
      preview: { subject: string; text: string };
    }
  | { ok: true; today: string; campTitles: string[]; recipientCount: number; sent: boolean }
  | { ok: false; reason: "resend_unconfigured"; message: string };

function todayET(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
  }).format(new Date());
}

function buildInput(today: string, running: Camp[]): CampChecklistReminderInput {
  return {
    dayLong: formatCampDayLong(today),
    camps: running.map((camp) => ({
      title: camp.title,
      week: camp.weekLabel,
      hours: CAMP_HOURS,
      location: resolveCampWhere(camp),
    })),
    checklistUrl: `${SITE_URL}${CHECKLIST_PATH}`,
  };
}

export async function runCampChecklistReminder(
  opts: RunCampChecklistOpts = {},
): Promise<RunCampChecklistResult> {
  const today = opts.today ?? todayET();
  const running = campsRunningOn(today, CAMPS);

  if (running.length === 0) {
    return { ok: true, skipped: true, reason: "no camp scheduled today", today };
  }

  const weekday = formatCampWeekday(today);
  const input = buildInput(today, running);
  const subject = campChecklistSubject(weekday);
  const text = campChecklistText(input);
  const campTitles = running.map((c) => c.title);

  // Coaches working camp are the audience. Fall back to the admin inbox so the
  // reminder still lands if the allowlist isn't configured in this env.
  const coachEmails = getCoachEmails();
  const recipients = coachEmails.length ? coachEmails : [ADMIN_EMAIL];

  if (opts.dryRun) {
    return {
      ok: true,
      dryRun: true,
      today,
      campTitles,
      recipients,
      preview: { subject, text },
    };
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return {
      ok: false,
      reason: "resend_unconfigured",
      message: "RESEND_API_KEY is not configured — refusing to run a live send",
    };
  }

  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({
    from: FROM_EMAIL,
    to: recipients,
    replyTo: REPLY_TO,
    subject,
    html: campChecklistHtml(input),
    text,
  });

  if (error) {
    console.error("[camp-checklist-reminder] Resend rejected", error);
    return { ok: true, today, campTitles, recipientCount: recipients.length, sent: false };
  }

  return { ok: true, today, campTitles, recipientCount: recipients.length, sent: true };
}
