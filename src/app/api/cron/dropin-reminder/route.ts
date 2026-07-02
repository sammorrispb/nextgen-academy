import { rollupFailure, withCronAlert, type CronFailure } from "@/lib/cron-alert";
import { EMAIL_RE } from "@/lib/notion-utils";
import { Resend } from "resend";
import {
  fetchUpcomingDropIns,
  markDropInFlag,
  type DropInRegistration,
} from "@/lib/notion-dropins";
import { fetchSessionStatusByDate } from "@/lib/notion-sessions";
import { partitionByCancelledSession } from "@/lib/reminder-suppression";
import { sessionToSlug } from "@/lib/session-slug";
import { signCancelToken } from "@/lib/cancel-token";
import {
  bookingReminderHtml,
  bookingReminderText,
} from "@/lib/email/booking-reminder";
import { sendSms, bookingReminderSms } from "@/lib/sms";

export const runtime = "nodejs";
// Cron path — never cache.
export const dynamic = "force-dynamic";

const ADMIN_EMAIL = "nextgenacademypb@gmail.com";
const FROM_EMAIL = "Next Gen PB Academy <noreply@nextgenpbacademy.com>";
const REPLY_TO = "nextgenacademypb@gmail.com";
const SITE_ORIGIN =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://nextgenpbacademy.com";

/**
 * Return tomorrow's ISO date (YYYY-MM-DD) in America/New_York. Used both to
 * filter Notion rows and to compose the date window for fetchUpcomingDropIns.
 *
 * Reason for the formatter dance: `new Date()` returns UTC. Adding 24h and
 * slicing the ISO string would shift the boundary by 4–5 hours depending on
 * DST. Intl.DateTimeFormat with timeZone:'America/New_York' gives the
 * calendar day a parent would call "tomorrow."
 */
function tomorrowEtIso(now: Date = new Date()): string {
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(tomorrow);
  const y = parts.find((p) => p.type === "year")?.value ?? "";
  const m = parts.find((p) => p.type === "month")?.value ?? "";
  const d = parts.find((p) => p.type === "day")?.value ?? "";
  return `${y}-${m}-${d}`;
}

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

interface SendOutcome {
  pageId: string;
  parentEmail: string;
  childFirst: string;
  emailSent: boolean;
  smsResult: "sent" | "no_consent" | "no_phone" | "not_configured" | "error";
  flagged: boolean;
  error?: string;
}

async function sendOne(
  resend: Resend | null,
  row: DropInRegistration,
): Promise<SendOutcome> {
  const childFirst = row.childFirstName || "your player";
  const parentFirst = (row.parentName || "").split(/\s+/)[0] || "there";
  const sessionDateLong = formatLongDate(row.sessionDate);
  const sessionDateShort = formatShortDate(row.sessionDate);

  const slug =
    row.sessionTitle && row.sessionDate
      ? sessionToSlug({ title: row.sessionTitle, date: row.sessionDate })
      : "";
  const detailUrl = slug
    ? `${SITE_ORIGIN}/schedule/${slug}`
    : `${SITE_ORIGIN}/schedule`;

  // Locations are public (hidden-location retired 2026-06-05). Show the exact
  // venue, falling back to the broad area only if it isn't filled in yet.
  const displayLocation = row.location || row.publicArea;

  // Re-mint the same signed cancel URL the booking confirmation carried, so
  // the parent self-serve cancel flow works from the reminder too.
  const cancelToken = signCancelToken(row.stripeCheckoutSessionId);
  const cancelUrl = cancelToken
    ? `${SITE_ORIGIN}/schedule/cancel?token=${encodeURIComponent(cancelToken)}`
    : undefined;

  const outcome: SendOutcome = {
    pageId: row.id,
    parentEmail: row.parentEmail,
    childFirst,
    emailSent: false,
    smsResult: "not_configured",
    flagged: false,
  };

  // EMAIL — primary channel. Always attempt if parentEmail is well-formed.
  if (
    resend &&
    row.parentEmail &&
    EMAIL_RE.test(row.parentEmail)
  ) {
    const subject = `Tomorrow — ${row.sessionTitle || sessionDateLong}`;
    const html = bookingReminderHtml({
      parentFirst,
      childFirst,
      sessionTitle: row.sessionTitle,
      sessionDateLong,
      sessionStart: row.sessionStartTime,
      sessionLocation: displayLocation,
      locationHidden: false,
      detailUrl,
      cancelUrl,
    });
    const text = bookingReminderText({
      parentFirst,
      childFirst,
      sessionTitle: row.sessionTitle,
      sessionDateLong,
      sessionStart: row.sessionStartTime,
      sessionLocation: displayLocation,
      locationHidden: false,
      detailUrl,
      cancelUrl,
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
      console.error("[cron/dropin-reminder] Resend rejected", outcome.error);
      return outcome; // Don't flag — we want a retry on next cron tick.
    }
    outcome.emailSent = true;
  }

  // SMS — consent-gated. sendSms() refuses without consent (no_consent
  // result). If TWILIO_* envs aren't set, it returns not_configured — we
  // log and move on; the email already covered the user.
  if (!row.parentPhone) {
    outcome.smsResult = "no_phone";
  } else {
    const smsBody = bookingReminderSms({
      childFirst,
      sessionTitle: row.sessionTitle,
      sessionStart: row.sessionStartTime,
      sessionDateShort,
      detailUrl,
    });
    const result = await sendSms({
      to: row.parentPhone,
      body: smsBody,
      consent: row.smsConsent,
      tag: `reminder:${row.id}`,
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

  // Flip the idempotency flag only if the email landed. We accept missing
  // SMS (no consent / no phone / 10DLC pending) as a successful send for
  // flag purposes — the parent got the email.
  if (outcome.emailSent) {
    const flagged = await markDropInFlag(row.id, "Reminder Sent");
    outcome.flagged = flagged;
  }

  return outcome;
}

export const GET = withCronAlert("dropin-reminder", async () => {
  const targetIso = tomorrowEtIso();
  const candidates = await fetchUpcomingDropIns(targetIso, targetIso, {
    revalidate: 0,
  });

  // fetchUpcomingDropIns already filters Status === Confirmed. Drop rows
  // we've already sent a reminder for (idempotency).
  const notSent = candidates.filter((r) => !r.reminderSent);

  // A Confirmed drop-in can still point at a Cancelled session: cancelling a
  // session flips the SESSION row to Cancelled but the per-drop-in rows only
  // become Refunded later (async charge.refunded webhook) — or never, if the
  // session was cancelled by hand in Notion for weather. Cross-reference the
  // day's session statuses and never remind for a pulled session.
  const sessions = await fetchSessionStatusByDate(targetIso);
  const { send: toSend, suppressed } = partitionByCancelledSession(
    notSent,
    sessions,
  );
  if (suppressed.length > 0) {
    console.log(
      "[cron/dropin-reminder] suppressed reminders for cancelled session(s)",
      JSON.stringify({
        target_date_et: targetIso,
        suppressed: suppressed.map((r) => r.id),
      }),
    );
  }

  const resendApiKey = process.env.RESEND_API_KEY;
  const resend = resendApiKey ? new Resend(resendApiKey) : null;
  if (!resend) {
    console.warn("[cron/dropin-reminder] RESEND_API_KEY missing — skipping email sends");
  }

  const outcomes: SendOutcome[] = [];
  for (const row of toSend) {
    outcomes.push(await sendOne(resend, row));
  }

  // Surface the per-row failures the old version console.error'd and returned
  // 200 for. A due reminder with no Resend key is itself a failure — the exact
  // "misconfigured key, nothing reached Sam" incident class.
  const failures: CronFailure[] = [];
  if (!resend && toSend.length > 0) {
    failures.push({
      signature: "resend_not_configured",
      detail: `${toSend.length} reminder(s) due but RESEND_API_KEY is unset`,
    });
  }
  // One consistent posture with dropin-post-session: a due row with a missing
  // or malformed parent email can never get its primary send — these used to
  // be skipped silently here. Roll them into ONE failure entry per run (count
  // + page-id refs), not one per row, so the alert stays readable.
  const invalidEmail = rollupFailure(
    "invalid_parent_email",
    toSend
      .filter((r) => !r.parentEmail || !EMAIL_RE.test(r.parentEmail))
      .map((r) => r.id),
    "reminder row(s) with a missing/malformed parent email",
  );
  if (invalidEmail) failures.push(invalidEmail);
  for (const o of outcomes) {
    if (o.error) {
      failures.push({
        signature: o.error.includes("resend:") ? "resend_rejected" : "sms_send_failed",
        ref: o.pageId,
        detail: o.error,
      });
    }
    if (o.emailSent && !o.flagged) {
      failures.push({
        signature: "flag_write_failed",
        ref: o.pageId,
        detail: "Reminder Sent flag did not stick; row will re-send next tick",
      });
    }
  }

  const summary = {
    target_date_et: targetIso,
    candidates: candidates.length,
    skipped_already_sent: candidates.length - notSent.length,
    suppressed_cancelled: suppressed.length,
    attempted: toSend.length,
    email_sent: outcomes.filter((o) => o.emailSent).length,
    sms_sent: outcomes.filter((o) => o.smsResult === "sent").length,
    sms_no_consent: outcomes.filter((o) => o.smsResult === "no_consent").length,
    sms_not_configured: outcomes.filter((o) => o.smsResult === "not_configured")
      .length,
    errors: outcomes.filter((o) => o.error).length,
  };
  console.log("[cron/dropin-reminder]", JSON.stringify(summary));

  return {
    attempted: toSend.length,
    succeeded: outcomes.filter((o) => o.emailSent).length,
    failures,
    body: {
      ...summary,
      outcomes: outcomes.map((o) => ({
        pageId: o.pageId,
        childFirst: o.childFirst,
        emailSent: o.emailSent,
        smsResult: o.smsResult,
        flagged: o.flagged,
        ...(o.error ? { error: o.error } : {}),
      })),
    },
  };
});
