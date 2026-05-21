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
  findDropInPageByCheckoutId,
  markDropInFlag,
  setDropInAttendance,
  type AttendanceValue,
  type DropInRegistration,
} from "@/lib/notion-dropins";
import { setSessionStatus } from "@/lib/notion-sessions";
import { sessionToSlug } from "@/lib/session-slug";
import { ingestToOpenBrain } from "@/lib/open-brain-ingest";
import { resolveRefundCents, type RefundOption } from "@/lib/refund-amount";
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

export interface CancelRegistrationOptions {
  /** "none" (default) cancels without a refund; "full"/"partial" refund via Stripe. */
  refund?: RefundOption;
  /** Required when refund === "partial". Amount to return, in cents. */
  amountCents?: number;
}

export async function cancelRegistrationAction(
  checkoutSessionId: string,
  options: CancelRegistrationOptions = {},
): Promise<CancelActionResult> {
  const email = await requireCoach();
  if (!email) return { ok: false, message: "Unauthorized" };

  if (!checkoutSessionId?.trim()) {
    return { ok: false, message: "Missing checkoutSessionId" };
  }

  const refund = options.refund ?? "none";

  // ── No-refund path: cancel only, free the seat (unchanged behavior). ──
  if (refund === "none") {
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
    if (result.idempotent) return { ok: true, message: "Already cancelled" };
    return {
      ok: true,
      message: result.decremented ? "Cancelled · seat freed" : "Cancelled",
    };
  }

  // ── Refund path: validate amount, refund in Stripe, then flip to Refunded. ──
  const dropIn = await findDropInPageByCheckoutId(checkoutSessionId);
  if (!dropIn) return { ok: false, message: "Registration not found" };
  if (!dropIn.stripePaymentIntentId) {
    return { ok: false, message: "No payment on file to refund" };
  }

  const resolved = resolveRefundCents(
    refund,
    dropIn.amountPaidUsd,
    options.amountCents,
  );
  if (!resolved.ok) return { ok: false, message: resolved.message };

  const stripe = getStripe();
  try {
    await stripe.refunds.create({
      payment_intent: dropIn.stripePaymentIntentId,
      ...(resolved.amountCents ? { amount: resolved.amountCents } : {}),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // A prior refund means the money's already back — fall through to flip
    // the row's status rather than erroring the coach out.
    if (!/already.*refund/i.test(message)) {
      console.error("[cancel-registration] refund failed", dropIn.id, message);
      return { ok: false, message: "Stripe refund failed — nothing changed" };
    }
  }

  const refundedUsd = (resolved.amountCents ?? Math.round(dropIn.amountPaidUsd * 100)) / 100;

  // Flip to Refunded + send the refund-cue email with the actual amount. This
  // also sets Cancellation Notified, so the charge.refunded webhook that
  // Stripe fires for this same refund finds the row already Refunded and
  // no-ops — no duplicate email.
  const result = await cancelDropIn(checkoutSessionId, "Refunded", refundedUsd);
  if (!result.ok) {
    return {
      ok: false,
      message: "Refunded in Stripe, but updating Notion failed — check the row",
    };
  }
  return { ok: true, message: `Refunded $${refundedUsd.toFixed(2)} · seat freed` };
}

// ---------------------------------------------------------------------------
// Day-of attendance check-in — writes the roster row + an Open Brain activity
// on the parent's contact (the player profile system of record).
// ---------------------------------------------------------------------------

export interface AttendanceActionResult {
  ok: boolean;
  message: string;
  attendance?: AttendanceValue | "";
}

export async function markAttendanceAction(input: {
  checkoutSessionId: string;
  attended: AttendanceValue | "clear";
}): Promise<AttendanceActionResult> {
  const email = await requireCoach();
  if (!email) return { ok: false, message: "Unauthorized" };

  if (!input.checkoutSessionId?.trim()) {
    return { ok: false, message: "Missing checkoutSessionId" };
  }
  const value: AttendanceValue | null =
    input.attended === "clear" ? null : input.attended;
  if (value !== null && value !== "Present" && value !== "No-show") {
    return { ok: false, message: "Invalid attendance value" };
  }

  const dropIn = await findDropInPageByCheckoutId(input.checkoutSessionId);
  if (!dropIn) return { ok: false, message: "Registration not found" };

  const ok = await setDropInAttendance(dropIn.id, value);
  if (!ok) return { ok: false, message: "Failed to update Notion" };

  // Tie the check-in to the player's Open Brain profile. Keyed on parent
  // email/phone (OB dedups to the existing contact); fire-and-forget so a
  // slow OB never blocks the coach. Only fires for a real Present/No-show.
  if (value && (dropIn.parentEmail || dropIn.parentPhone)) {
    void ingestToOpenBrain({
      business: "nga",
      source: "nga_attendance",
      email: dropIn.parentEmail || undefined,
      phone: dropIn.parentPhone || undefined,
      name: dropIn.parentName || undefined,
      interest: dropIn.childFirstName || undefined,
      metadata: {
        child_first_name: dropIn.childFirstName,
        child_birth_year: dropIn.childBirthYear || undefined,
        session_title: dropIn.sessionTitle,
        session_date: dropIn.sessionDate,
        session_start_time: dropIn.sessionStartTime,
        location: dropIn.location,
        attendance: value,
      },
    });
  }

  const slug = sessionToSlug({
    title: dropIn.sessionTitle,
    date: dropIn.sessionDate,
  });
  if (slug) revalidatePath(`/coach/${slug}`);
  revalidatePath("/coach");

  return { ok: true, message: value ?? "Cleared", attendance: value ?? "" };
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
