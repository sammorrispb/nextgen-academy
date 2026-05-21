import { revalidatePath } from "next/cache";
import { Resend } from "resend";
import type Stripe from "stripe";
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

/**
 * Core session-wide cancel: refund every confirmed drop-in, broadcast the
 * Coach-voice cancellation, then flip the session row to Cancelled. This is
 * intentionally NOT a "use server" export (those become unauthenticated RPC
 * endpoints) — callers own authentication:
 *   - cancelSessionAction (coach cookie) in /coach/[slug]/actions.ts
 *   - the signed-token confirm flow in /coach/cancel-session/[token]
 */

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

export interface SessionCancelInput {
  sessionRowId: string;
  sessionTitle: string;
  sessionDate: string; // ISO YYYY-MM-DD
  sessionStartTime: string;
  reason: CancelReason;
  note?: string;
}

export interface SessionCancelResult {
  ok: boolean;
  message: string;
  rosterSize?: number;
  refunded?: number;
  emailSent?: number;
  smsSent?: number;
  errors?: number;
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
  //    do NOT send the parent a "you've been refunded" email — surface the
  //    error and keep the flag false so a re-run can retry.
  outcome.refunded = await refundOne(stripe, row);
  if (outcome.refunded === "error") {
    outcome.error = "stripe refund failed";
    return outcome;
  }

  if (row.cancellationNotified) {
    outcome.flagged = true;
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

  if (outcome.emailSent) {
    outcome.flagged = await markDropInFlag(row.id, "Cancellation Notified");
  }

  return outcome;
}

const VALID_REASONS: CancelReason[] = ["weather", "venue", "low-enrollment", "other"];

export async function executeSessionCancel(
  input: SessionCancelInput,
): Promise<SessionCancelResult> {
  if (!input.sessionRowId?.trim()) {
    return { ok: false, message: "Missing sessionRowId" };
  }
  if (!input.sessionDate?.trim() || !input.sessionTitle?.trim()) {
    return { ok: false, message: "Missing session metadata" };
  }
  if (!VALID_REASONS.includes(input.reason)) {
    return { ok: false, message: "Invalid reason" };
  }

  // Pull this date's confirmed roster — date + title uniquely identify a
  // session because session-day pairings are unique in the public schedule.
  const drops = await fetchUpcomingDropIns(input.sessionDate, input.sessionDate);
  const roster = drops.filter(
    (d) =>
      d.sessionDate === input.sessionDate && d.sessionTitle === input.sessionTitle,
  );

  if (roster.length === 0) {
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

  // Only flip the session row Status if every refund landed (ok/already/no_pi).
  // Partial state stays as-is so it can be re-fired and recovered.
  const allRefunded = outcomes.every(
    (o) => o.refunded === "ok" || o.refunded === "already" || o.refunded === "no_pi",
  );
  if (allRefunded) {
    await setSessionStatus(input.sessionRowId, "Cancelled");
  }

  revalidatePath("/schedule");
  revalidatePath("/coach");
  revalidatePath(`/coach/${input.sessionRowId}`);

  const result: SessionCancelResult = {
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
  };
  console.log("[session-cancel]", JSON.stringify({
    sessionRowId: input.sessionRowId,
    sessionTitle: input.sessionTitle,
    sessionDate: input.sessionDate,
    reason: input.reason,
    ...result,
  }));

  return result;
}
