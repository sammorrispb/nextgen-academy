import { withCronAlert, type CronFailure } from "@/lib/cron-alert";
import { Resend } from "resend";
import {
  fetchUpcomingSessions,
  markSessionCoachReminderSent,
  type NgaSession,
} from "@/lib/notion-sessions";
import { sessionToSlug } from "@/lib/session-slug";
import { getCoachEmails } from "@/lib/coach-allowlist";
import { fetchWeatherForSessions } from "@/lib/weather";
import { isWithinPreEventWindow } from "@/lib/session-time";
import { signSessionCancelToken } from "@/lib/session-cancel-token";
import {
  coachPreEventHtml,
  coachPreEventText,
} from "@/lib/email/coach-pre-event";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FROM_EMAIL = "Next Gen PB Academy <noreply@nextgenpbacademy.com>";
const REPLY_TO = "nextgenacademypb@gmail.com";
const SITE_ORIGIN =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://nextgenpbacademy.com";

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

interface SendOutcome {
  sessionId: string;
  sessionTitle: string;
  emailSent: boolean;
  flagged: boolean;
  error?: string;
}

async function sendOne(
  resend: Resend,
  to: string[],
  session: NgaSession,
): Promise<SendOutcome> {
  const outcome: SendOutcome = {
    sessionId: session.id,
    sessionTitle: session.title,
    emailSent: false,
    flagged: false,
  };

  const token = signSessionCancelToken(session.id);
  if (!token) {
    outcome.error = "NGA_ADMIN_SECRET missing — cannot mint cancel link";
    return outcome;
  }
  const cancelUrl = `${SITE_ORIGIN}/coach/cancel-session/${encodeURIComponent(token)}`;
  const sessionUrl = `${SITE_ORIGIN}/coach/${sessionToSlug(session)}`;

  // Scope the forecast to THIS session's actual hours, not the whole day.
  const weatherMap = await fetchWeatherForSessions([session]);
  const w = weatherMap.get(session.date) ?? null;

  const payload = {
    sessionTitle: session.title,
    sessionDateLong: formatLongDate(session.date),
    sessionStart: session.startTime,
    location: session.location,
    rosterSize: session.registeredCount,
    weather: w
      ? { maxRain: w.maxRain, tempHigh: w.tempHigh, summary: w.summary, risk: w.risk }
      : null,
    cancelUrl,
    sessionUrl,
  };

  const rain = w ? `${w.maxRain}% rain` : "forecast pending";
  const { error } = await resend.emails.send({
    from: FROM_EMAIL,
    to,
    replyTo: REPLY_TO,
    subject: `Tomorrow: ${session.title} — ${rain}`,
    html: coachPreEventHtml(payload),
    text: coachPreEventText(payload),
  });
  if (error) {
    outcome.error = `resend: ${error.message ?? String(error)}`;
    console.error("[cron/coach-pre-event] Resend rejected", outcome.error);
    return outcome; // leave the flag unset so the next tick retries
  }
  outcome.emailSent = true;
  outcome.flagged = await markSessionCoachReminderSent(session.id);
  return outcome;
}

export const GET = withCronAlert("coach-pre-event", async () => {
  const coachEmails = getCoachEmails();
  const resendApiKey = process.env.RESEND_API_KEY;
  if (!resendApiKey || coachEmails.length === 0) {
    return {
      ok: true,
      attempted: 0,
      succeeded: 0,
      failures: [],
      body: {
        skipped: !resendApiKey ? "RESEND_API_KEY missing" : "no coach emails configured",
      },
    };
  }
  const resend = new Resend(resendApiKey);

  const now = new Date();
  const sessions = await fetchUpcomingSessions(now);
  // Fire once per session, ~24h before its start, only for live sessions we
  // haven't already briefed. (fetchUpcomingSessions excludes Cancelled.)
  const due = sessions.filter(
    (s) =>
      s.status !== "Cancelled" &&
      !s.coachReminderSent &&
      isWithinPreEventWindow(s.date, s.startTime, now),
  );

  const outcomes: SendOutcome[] = [];
  for (const session of due) {
    outcomes.push(await sendOne(resend, coachEmails, session));
  }

  // Previously a Resend reject was console.error'd and the route still
  // returned 200 with ok:false buried in the body — nothing reached Sam.
  const failures: CronFailure[] = outcomes
    .filter((o) => o.error)
    .map((o) => ({
      signature: o.error?.startsWith("resend:")
        ? "resend_rejected"
        : "cancel_token_unavailable",
      ref: o.sessionId,
      detail: o.error,
    }));
  for (const o of outcomes) {
    if (o.emailSent && !o.flagged) {
      failures.push({
        signature: "flag_write_failed",
        ref: o.sessionId,
        detail: "Coach Reminder Sent flag did not stick; brief will re-send next tick",
      });
    }
  }

  const summary = {
    upcoming: sessions.length,
    due: due.length,
    email_sent: outcomes.filter((o) => o.emailSent).length,
    errors: outcomes.filter((o) => o.error).length,
    outcomes,
  };
  console.log("[cron/coach-pre-event]", JSON.stringify(summary));
  return {
    ok: failures.length === 0,
    attempted: due.length,
    succeeded: outcomes.filter((o) => o.emailSent).length,
    failures,
    body: summary,
  };
});
