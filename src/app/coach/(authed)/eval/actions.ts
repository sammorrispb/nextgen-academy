"use server";

import { cookies } from "next/headers";
import {
  COACH_SESSION_COOKIE,
  verifySessionCookieValue,
} from "@/lib/coach-auth";
import { isAllowedCoachEmail } from "@/lib/coach-allowlist";
import { sendEvalConfirmation, to12Hour } from "@/lib/eval-confirmation-send";

async function requireCoach(): Promise<string | null> {
  const c = await cookies();
  const value = c.get(COACH_SESSION_COOKIE)?.value;
  const email = value ? verifySessionCookieValue(value) : null;
  return email && isAllowedCoachEmail(email) ? email : null;
}

export interface ConfirmEvalInput {
  parentEmail: string;
  parentFirst?: string;
  childFirst: string;
  date: string; // "YYYY-MM-DD" (from <input type="date">)
  startTime: string; // "HH:MM" 24h (from <input type="time">)
  endTime: string; // "HH:MM" 24h
  location: string;
  coachName?: string;
}

export interface ConfirmEvalResult {
  ok: boolean;
  message: string;
  /** Plain-text preview, present on a successful dry run. */
  preview?: string;
  subject?: string;
}

/**
 * Coach-dashboard wrapper around sendEvalConfirmation. Converts the form's
 * native 24h time inputs to the "10:00 AM" format the template/.ics expect,
 * then sends (or previews when dryRun is true). Cookie-authed — no secret.
 */
export async function confirmEvalAction(
  input: ConfirmEvalInput,
  opts: { dryRun?: boolean } = {},
): Promise<ConfirmEvalResult> {
  const email = await requireCoach();
  if (!email) return { ok: false, message: "Unauthorized — sign in again." };

  const start12 = to12Hour(input.startTime);
  const end12 = to12Hour(input.endTime);
  if (!start12 || !end12) {
    return { ok: false, message: "Pick a valid start and end time." };
  }

  const result = await sendEvalConfirmation(
    {
      parentEmail: input.parentEmail,
      parentFirst: input.parentFirst,
      childFirst: input.childFirst,
      date: input.date,
      startTime: start12,
      endTime: end12,
      location: input.location,
      coachName: input.coachName,
    },
    { dryRun: opts.dryRun },
  );

  if (!result.ok) {
    const detail = result.errors?.length ? `: ${result.errors.join(", ")}` : "";
    return { ok: false, message: `${result.error}${detail}` };
  }

  if (result.dryRun) {
    return {
      ok: true,
      message: `Preview for ${result.to}`,
      preview: result.preview,
      subject: result.subject,
    };
  }

  const crmNote = result.crm.updated
    ? "CRM Eval Date stamped."
    : `Sent, but CRM not updated (${result.crm.reason ?? "no row"}).`;
  return {
    ok: true,
    message: `Confirmation sent to ${result.to}. ${crmNote}`,
    subject: result.subject,
  };
}
