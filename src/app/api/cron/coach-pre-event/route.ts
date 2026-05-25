import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import {
  fetchUpcomingSessions,
  markSessionCoachReminderSent,
  type NgaSession,
} from "@/lib/notion-sessions";
import { sessionToSlug } from "@/lib/session-slug";
import { getCoachEmails } from "@/lib/coach-allowlist";
import { fetchWeatherByDate } from "@/lib/weather";
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

  const weatherMap = await fetchWeatherByDate([session.date]);
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

export async function GET(req: NextRequest) {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }
  const auth = req.headers.get("authorization") ?? "";
  if (auth !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const coachEmails = getCoachEmails();
  const resendApiKey = process.env.RESEND_API_KEY;
  if (!resendApiKey || coachEmails.length === 0) {
    return NextResponse.json({
      ok: true,
      skipped: !resendApiKey ? "RESEND_API_KEY missing" : "no coach emails configured",
    });
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

  const summary = {
    ok: outcomes.every((o) => !o.error),
    upcoming: sessions.length,
    due: due.length,
    email_sent: outcomes.filter((o) => o.emailSent).length,
    errors: outcomes.filter((o) => o.error).length,
    outcomes,
  };
  console.log("[cron/coach-pre-event]", JSON.stringify(summary));
  return NextResponse.json(summary);
}
