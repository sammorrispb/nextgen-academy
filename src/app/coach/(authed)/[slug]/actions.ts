"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { Resend } from "resend";
import type Stripe from "stripe";
import { cancelDropIn } from "@/lib/cancel-dropin";
import {
  COACH_SESSION_COOKIE,
  verifySessionCookieValue,
} from "@/lib/coach-auth";
import { isAllowedCoachEmail } from "@/lib/coach-allowlist";
import {
  fetchUpcomingDropIns,
  markDropInFlag,
  type DropInRegistration,
} from "@/lib/notion-dropins";
import { setSessionStatus } from "@/lib/notion-sessions";
import { getStripe } from "@/lib/stripe";
import {
  sessionCancelledHtml,
  sessionCancelledText,
  type CancelReason,
} from "@/lib/email/session-cancelled";
import { sendSms, sessionCancelledSms } from "@/lib/sms";

async function requireCoach(): Promise<string | null> {
  const c = await cookies();
  const value = c.get(COACH_SESSION_COOKIE)?.value;
  const email = value ? verifySessionCookieValue(value) : null;
  return email && isAllowedCoachEmail(email) ? email : null;
}

export interface CancelActionResult {
  ok: boolean;
  message: string;
}

export async function cancelRegistrationAction(
  checkoutSessionId: string,
): Promise<CancelActionResult> {
  const email = await requireCoach();
  if (!email) return { ok: false, message: "Unauthorized" };

  if (!checkoutSessionId?.trim()) {
    return { ok: false, message: "Missing checkoutSessionId" };
  }

  const result = await cancelDropIn(checkoutSessionId, "Cancelled");
  if (!result.ok) {
    return {
      ok: false,
      message:
        result.reason === "not_found"
          ? "Registration not found"
          : "Failed to update Notion",
    };
  }
  if (result.idempotent) {
    return { ok: true, message: "Already cancelled" };
  }
  return {
    ok: true,
    message: result.decremented ? "Cancelled · seat freed" : "Cancelled",
  };
}

// ---------------------------------------------------------------------------
// Session-wide cancellation broadcast (build #2)
// ---------------------------------------------------------------------------

const ADMIN_EMAIL = "nextgenacademypb@gmail.com";
const FROM_EMAIL = "Next Gen PB Academy <noreply@nextgenpbacademy.com>";
const REPLY_TO = "nextgenacademypb@gmail.com";
const SITE_ORIGIN =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.nextgenpbacademy.com";

function formatLongDate(isoDate: string): string {
  if (!isoDate) return "";
  const d = new Date(`${isoDate}T12:00:00Z`);
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatShortDate(isoDate: string): string {
  if (!isoDate) return "";
  const d = new Date(`${isoDate}T12:00:00Z`);
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

interface RowOutcome {
  pageId: string;
  childFirst: string;
  parentEmail: string;
  refunded: "ok" | "already" | "no_pi" | "error";
  emailSent: boolean;
  smsResult: "sent" | "no_consent" | "no_phone" | "not_configured" | "error";
  flagged: boolean;
  error?: string;
}

interface SessionCancelInput {
  sessionRowId: string;
  sessionTitle: string;
  sessionDate: string; // ISO YYYY-MM-DD
  sessionStartTime: string;
  reason: CancelReason;
  note?: string;
}

export interface SessionCancelActionResult {
  ok: boolean;
  message: string;
  rosterSize?: number;
  refunded?: number;
  emailSent?: number;
  smsSent?: number;
  errors?: number;
  outcomes?: RowOutcome[];
}

async function refundOne(
  stripe: Stripe,
  row: DropInRegistration,
): Promise<RowOutcome["refunded"]> {
  if (!row.stripePaymentIntentId) return "no_pi";
  try {
    await stripe.refunds.create({ payment_intent: row.stripePaymentIntentId });
    return "ok";
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // Stripe says "Charge has already been refunded" with code charge_already_refunded.
    if (/already.*refund/i.test(message)) return "already";
    console.error("[session-cancel] refund failed", row.id, message);
    return "error";
  }
}

async function broadcastOne(
  resend: Resend | null,
  stripe: Stripe,
  row: DropInRegistration,
  input: SessionCancelInput,
): Promise<RowOutcome> {
  const childFirst = row.childFirstName || "your player";
  const parentFirst = (row.parentName || "").split(/\s+/)[0] || "there";
  const sessionDateLong = formatLongDate(input.sessionDate);
  const sessionDateShort = formatShortDate(input.sessionDate);
  const scheduleUrl = `${SITE_ORIGIN}/schedule`;

  const outcome: RowOutcome = {
    pageId: row.id,
    childFirst,
    parentEmail: row.parentEmail,
    refunded: "no_pi",
    emailSent: false,
    smsResult: "not_configured",
    flagged: false,
  };

  // 1. Refund first. If the refund fails outright (not "already refunded"),
  //    do NOT send the parent a "you've been refunded" email — that would
  //    be a lie. Surface the error and keep the row's flag at false so a
  //    re-run can retry.
  outcome.refunded = await refundOne(stripe, row);
  if (outcome.refunded === "error") {
    outcome.error = "stripe refund failed";
    return outcome;
  }

  // 2. Email broadcast. cancellationNotified gates re-sends (build #4
  //    will check the same flag from cancelDropIn() to suppress a
  //    duplicate per-row cancellation-confirmation send).
  if (row.cancellationNotified) {
    outcome.flagged = true; // already true; no work
    return outcome;
  }

  if (
    resend &&
    row.parentEmail &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.parentEmail)
  ) {
    const subject = `Session cancelled — ${input.sessionTitle || sessionDateLong}`;
    const html = sessionCancelledHtml({
      parentFirst,
      childFirst,
      sessionTitle: input.sessionTitle,
      sessionDateLong,
      sessionStart: input.sessionStartTime,
      reason: input.reason,
      note: input.note,
      amountRefunded: row.amountPaidUsd.toFixed(2),
      scheduleUrl,
    });
    const text = sessionCancelledText({
      parentFirst,
      childFirst,
      sessionTitle: input.sessionTitle,
      sessionDateLong,
      sessionStart: input.sessionStartTime,
      reason: input.reason,
      note: input.note,
      amountRefunded: row.amountPaidUsd.toFixed(2),
      scheduleUrl,
    });

    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: row.parentEmail,
      bcc: ADMIN_EMAIL,
      replyTo: REPLY_TO,
      subject,
      html,
      text,
    });
    if (error) {
      outcome.error = `resend: ${error.message ?? String(error)}`;
      console.error("[session-cancel] Resend rejected", outcome.error);
      return outcome;
    }
    outcome.emailSent = true;
  }

  // 3. SMS — consent-gated.
  if (!row.parentPhone) {
    outcome.smsResult = "no_phone";
  } else {
    const smsBody = sessionCancelledSms({
      childFirst,
      sessionTitle: input.sessionTitle,
      sessionDateShort,
      scheduleUrl,
    });
    const result = await sendSms({
      to: row.parentPhone,
      body: smsBody,
      consent: row.smsConsent,
      tag: `session-cancel:${row.id}`,
    });
    if (result.ok) {
      outcome.smsResult = "sent";
    } else if ("skipped" in result) {
      outcome.smsResult =
        result.skipped === "no_consent"
          ? "no_consent"
          : result.skipped === "invalid_to"
            ? "no_phone"
            : "not_configured";
    } else {
      outcome.smsResult = "error";
      outcome.error = (outcome.error ?? "") + ` sms: ${result.error}`;
    }
  }

  // 4. Flip the idempotency flag only after the email landed. Build #4's
  //    cancelDropIn() integration will check this before sending the
  //    per-row cancellation-confirmation, preventing double-comms.
  if (outcome.emailSent) {
    outcome.flagged = await markDropInFlag(row.id, "Cancellation Notified");
  }

  return outcome;
}

export async function cancelSessionAction(
  input: SessionCancelInput,
): Promise<SessionCancelActionResult> {
  const email = await requireCoach();
  if (!email) return { ok: false, message: "Unauthorized" };

  if (!input.sessionRowId?.trim()) {
    return { ok: false, message: "Missing sessionRowId" };
  }
  if (!input.sessionDate?.trim() || !input.sessionTitle?.trim()) {
    return { ok: false, message: "Missing session metadata" };
  }
  const validReasons: CancelReason[] = [
    "weather",
    "venue",
    "low-enrollment",
    "other",
  ];
  if (!validReasons.includes(input.reason)) {
    return { ok: false, message: "Invalid reason" };
  }

  // Pull this date's confirmed roster from Notion. Same matching logic the
  // /coach page uses — date + title pair uniquely identifies a session
  // because session-day pairings are unique in the public schedule.
  const drops = await fetchUpcomingDropIns(input.sessionDate, input.sessionDate);
  const roster = drops.filter(
    (d) =>
      d.sessionDate === input.sessionDate && d.sessionTitle === input.sessionTitle,
  );

  if (roster.length === 0) {
    // No parents to notify, but still flip the session row so the schedule
    // page hides this entry.
    await setSessionStatus(input.sessionRowId, "Cancelled");
    revalidatePath("/schedule");
    revalidatePath("/coach");
    return { ok: true, message: "Session cancelled (no roster)", rosterSize: 0 };
  }

  const resendApiKey = process.env.RESEND_API_KEY;
  const resend = resendApiKey ? new Resend(resendApiKey) : null;
  const stripe = getStripe();

  const outcomes: RowOutcome[] = [];
  for (const row of roster) {
    outcomes.push(await broadcastOne(resend, stripe, row, input));
  }

  const refunded = outcomes.filter(
    (o) => o.refunded === "ok" || o.refunded === "already",
  ).length;
  const emailSent = outcomes.filter((o) => o.emailSent).length;
  const smsSent = outcomes.filter((o) => o.smsResult === "sent").length;
  const errors = outcomes.filter((o) => o.error).length;

  // Only flip the session row Status if every refund landed (ok or
  // already). Partial state stays as-is so Sam can re-fire and recover.
  const allRefunded = outcomes.every(
    (o) => o.refunded === "ok" || o.refunded === "already" || o.refunded === "no_pi",
  );
  if (allRefunded) {
    await setSessionStatus(input.sessionRowId, "Cancelled");
  }

  // The charge.refunded webhook will flip each drop-in row Status to
  // "Refunded" on its own — no need to do it from here. Stripe usually
  // fires within seconds.

  revalidatePath("/schedule");
  revalidatePath("/coach");
  revalidatePath(`/coach/${input.sessionRowId}`);

  const summary = {
    ok: errors === 0 && allRefunded,
    message:
      errors === 0 && allRefunded
        ? `Cancelled · ${refunded} refunded · ${emailSent} emailed · ${smsSent} texted`
        : `Partial: ${errors} error(s), ${refunded} refunded, ${emailSent} emailed`,
    rosterSize: roster.length,
    refunded,
    emailSent,
    smsSent,
    errors,
    outcomes,
  };
  console.log("[session-cancel]", JSON.stringify({
    sessionRowId: input.sessionRowId,
    sessionTitle: input.sessionTitle,
    sessionDate: input.sessionDate,
    reason: input.reason,
    ...summary,
  }));

  return summary;
}
