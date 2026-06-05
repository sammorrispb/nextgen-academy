// Shared send path for the free-evaluation confirmation. Both the secret-gated
// POST /api/eval-confirmation (operator/agent curl) and the coach-dashboard
// "Confirm eval" server action call sendEvalConfirmation(), so the template,
// .ics, Resend wiring, and CRM stamp live in exactly one place. Mirrors the
// executeSessionCancel pattern (one lib, two callers).

import { Resend } from "resend";
import {
  evalConfirmationHtml,
  evalConfirmationText,
  evalConfirmationSubject,
  type EvalConfirmationInput,
} from "./email/eval-confirmation";
import { buildDropInIcs } from "./email/ics";
import { setEvalDate, type SetEvalDateResult } from "./notion-eval";

const FROM_EMAIL = "Next Gen PB Academy <noreply@nextgenpbacademy.com>";
const REPLY_TO = "nextgenacademypb@gmail.com";
const ADMIN_BCC = "nextgenacademypb@gmail.com";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{1,2}:\d{2}\s*(AM|PM)$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface EvalConfirmationRequest {
  parentEmail: string;
  parentFirst?: string;
  childFirst: string;
  date: string; // "YYYY-MM-DD"
  startTime: string; // "10:00 AM"
  endTime: string; // "10:45 AM"
  location: string;
  coachName?: string;
}

export type SendEvalResult =
  | { ok: false; status: number; error: string; errors?: string[] }
  | { ok: true; dryRun: true; to: string; subject: string; dateLong: string; preview: string }
  | { ok: true; dryRun: false; to: string; subject: string; crm: SetEvalDateResult };

/** Pure field validation — returns a list of human-readable problems (empty = ok). */
export function validateEvalConfirmation(req: Partial<EvalConfirmationRequest>): string[] {
  const errors: string[] = [];
  if (!EMAIL_RE.test((req.parentEmail ?? "").trim())) {
    errors.push("parentEmail must be a valid email");
  }
  if (!(req.childFirst ?? "").trim()) errors.push("childFirst is required");
  if (!DATE_RE.test((req.date ?? "").trim())) errors.push("date must be YYYY-MM-DD");
  if (!TIME_RE.test((req.startTime ?? "").trim())) errors.push('startTime must be like "10:00 AM"');
  if (!TIME_RE.test((req.endTime ?? "").trim())) errors.push('endTime must be like "10:45 AM"');
  if (!(req.location ?? "").trim()) errors.push("location is required");
  return errors;
}

/** "14:05" (24h) → "2:05 PM". Returns null on malformed input. */
export function to12Hour(hhmm: string): string | null {
  const m = (hhmm ?? "").trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  let h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  const period = h < 12 ? "AM" : "PM";
  if (h === 0) h = 12;
  else if (h > 12) h -= 12;
  return `${h}:${String(min).padStart(2, "0")} ${period}`;
}

// Date-only → long/short. Anchored at noon UTC so the weekday/day never shifts
// on a UTC build server (the date-only off-by-one trap).
export function formatLongDate(date: string): string {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function formatShortDate(date: string): string {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export async function sendEvalConfirmation(
  req: EvalConfirmationRequest,
  opts: { dryRun?: boolean } = {},
): Promise<SendEvalResult> {
  const errors = validateEvalConfirmation(req);
  if (errors.length) {
    return { ok: false, status: 400, error: "Validation failed", errors };
  }

  const parentEmail = req.parentEmail.trim();
  const parentFirst = (req.parentFirst ?? "").trim() || "there";
  const childFirst = req.childFirst.trim();
  const date = req.date.trim();
  const startTime = req.startTime.trim();
  const endTime = req.endTime.trim();
  const location = req.location.trim();
  const coachName = (req.coachName ?? "").trim() || "Coach Sam";

  const dateLong = formatLongDate(date);
  const shortDate = formatShortDate(date);
  const subject = evalConfirmationSubject(childFirst, shortDate, startTime);
  const tmpl: EvalConfirmationInput = {
    parentFirst,
    childFirst,
    dateLong,
    startTime,
    endTime,
    location,
    coachName,
  };

  const ics = buildDropInIcs({
    uid: `eval-${date}-${encodeURIComponent(childFirst.toLowerCase())}@nextgenpbacademy.com`,
    date,
    startTime,
    endTime,
    title: `${childFirst}'s Free Evaluation with ${coachName} (NGA)`,
    location,
    description: `Free evaluation with ${coachName}, Next Gen Pickleball Academy. Wear athletic clothes and court shoes, bring water. Paddle loaners available.`,
  });
  if (!ics) {
    return {
      ok: false,
      status: 400,
      error: "Could not build calendar invite — check startTime/endTime format",
    };
  }

  if (opts.dryRun) {
    return {
      ok: true,
      dryRun: true,
      to: parentEmail,
      subject,
      dateLong,
      preview: evalConfirmationText(tmpl),
    };
  }

  if (!process.env.RESEND_API_KEY) {
    return { ok: false, status: 500, error: "RESEND_API_KEY missing" };
  }
  const resend = new Resend(process.env.RESEND_API_KEY);
  const { error } = await resend.emails.send({
    from: FROM_EMAIL,
    to: parentEmail,
    bcc: ADMIN_BCC,
    replyTo: REPLY_TO,
    subject,
    html: evalConfirmationHtml(tmpl),
    text: evalConfirmationText(tmpl),
    attachments: [
      {
        filename: `${childFirst.toLowerCase()}-eval-${date}.ics`,
        content: Buffer.from(ics, "utf-8").toString("base64"),
        contentType: "text/calendar; charset=utf-8; method=PUBLISH",
      },
    ],
  });
  if (error) {
    return {
      ok: false,
      status: 502,
      error: `Resend failed: ${error.message ?? String(error)}`,
    };
  }

  // Stamp the CRM after a successful send. Fail-soft — a Notion miss never turns
  // a delivered email into an error.
  const crm = await setEvalDate(parentEmail, date);
  console.log(
    "[eval-confirmation]",
    JSON.stringify({ to: parentEmail, date, crm_updated: crm.updated }),
  );
  return { ok: true, dryRun: false, to: parentEmail, subject, crm };
}
