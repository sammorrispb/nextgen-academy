import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import {
  fetchUpcomingDropIns,
  markDropInFlag,
  type DropInRegistration,
} from "@/lib/notion-dropins";
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
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.nextgenpbacademy.com";

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
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.parentEmail)
  ) {
    const subject = `Tomorrow — ${row.sessionTitle || sessionDateLong}`;
    const html = bookingReminderHtml({
      parentFirst,
      childFirst,
      sessionTitle: row.sessionTitle,
      sessionDateLong,
      sessionStart: row.sessionStartTime,
      sessionLocation: row.location,
      detailUrl,
      cancelUrl,
    });
    const text = bookingReminderText({
      parentFirst,
      childFirst,
      sessionTitle: row.sessionTitle,
      sessionDateLong,
      sessionStart: row.sessionStartTime,
      sessionLocation: row.location,
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

export async function GET(req: NextRequest) {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    return NextResponse.json(
      { error: "CRON_SECRET not configured" },
      { status: 500 },
    );
  }
  const auth = req.headers.get("authorization") ?? "";
  if (auth !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const targetIso = tomorrowEtIso();
  const candidates = await fetchUpcomingDropIns(targetIso, targetIso, {
    revalidate: 0,
  });

  // fetchUpcomingDropIns already filters Status === Confirmed. Drop rows
  // we've already sent a reminder for (idempotency).
  const toSend = candidates.filter((r) => !r.reminderSent);

  const resendApiKey = process.env.RESEND_API_KEY;
  const resend = resendApiKey ? new Resend(resendApiKey) : null;
  if (!resend) {
    console.warn("[cron/dropin-reminder] RESEND_API_KEY missing — skipping email sends");
  }

  const outcomes: SendOutcome[] = [];
  for (const row of toSend) {
    outcomes.push(await sendOne(resend, row));
  }

  const summary = {
    target_date_et: targetIso,
    candidates: candidates.length,
    skipped_already_sent: candidates.length - toSend.length,
    attempted: toSend.length,
    email_sent: outcomes.filter((o) => o.emailSent).length,
    sms_sent: outcomes.filter((o) => o.smsResult === "sent").length,
    sms_no_consent: outcomes.filter((o) => o.smsResult === "no_consent").length,
    sms_not_configured: outcomes.filter((o) => o.smsResult === "not_configured")
      .length,
    errors: outcomes.filter((o) => o.error).length,
  };
  console.log("[cron/dropin-reminder]", JSON.stringify(summary));

  return NextResponse.json({
    ok: true,
    ...summary,
    outcomes: outcomes.map((o) => ({
      pageId: o.pageId,
      childFirst: o.childFirst,
      emailSent: o.emailSent,
      smsResult: o.smsResult,
      flagged: o.flagged,
      ...(o.error ? { error: o.error } : {}),
    })),
  });
}
