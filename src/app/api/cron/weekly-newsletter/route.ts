import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { fetchUpcomingSessions, type NgaSession } from "@/lib/notion-sessions";
import { fetchActiveSubscribers } from "@/lib/notion-newsletter";
import { pickWeeklyTip } from "@/lib/newsletter-tips";
import { signUnsubscribeToken } from "@/lib/newsletter-token";
import { fetchWeatherByDate, type DayWeather } from "@/lib/weather";
import {
  weeklyNewsletterHtml,
  weeklyNewsletterText,
  type NewsletterSessionGroup,
} from "@/lib/email/weekly-newsletter";

export const runtime = "nodejs";
// Cron path — never cache.
export const dynamic = "force-dynamic";

const ADMIN_EMAIL = "nextgenacademypb@gmail.com";
const FROM_EMAIL = "Next Gen PB Academy <noreply@nextgenpbacademy.com>";
const REPLY_TO = "nextgenacademypb@gmail.com";
const SITE_ORIGIN =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.nextgenpbacademy.com";

// How far ahead "this week" reaches — covers the coming weekend plus a peek.
const WINDOW_DAYS = 9;

function isoEtPlusDays(days: number, now: Date = new Date()): string {
  const d = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const y = parts.find((p) => p.type === "year")?.value ?? "";
  const m = parts.find((p) => p.type === "month")?.value ?? "";
  const day = parts.find((p) => p.type === "day")?.value ?? "";
  return `${y}-${m}-${day}`;
}

function formatLongDate(isoDate: string): string {
  if (!isoDate) return "";
  const d = new Date(`${isoDate}T12:00:00Z`);
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

/** A session group plus the raw ISO date, used to join the weather forecast. */
type DatedGroup = NewsletterSessionGroup & { date: string };

/** Group Open sessions in the window by date+location, joining time slots. */
function groupSessions(sessions: NgaSession[]): DatedGroup[] {
  const todayIso = isoEtPlusDays(0);
  const endIso = isoEtPlusDays(WINDOW_DAYS);

  const open = sessions
    .filter(
      (s) =>
        s.status === "Open" &&
        s.date &&
        s.date >= todayIso &&
        s.date <= endIso,
    )
    .sort((a, b) =>
      a.date === b.date
        ? a.startTime.localeCompare(b.startTime)
        : a.date.localeCompare(b.date),
    );

  const groups = new Map<string, DatedGroup>();
  for (const s of open) {
    const key = `${s.date}|${s.location}`;
    const label =
      s.startTime && s.endTime
        ? `${s.startTime}–${s.endTime}`
        : s.startTime || "";
    const slot = { label, spotsLeft: s.spotsLeft, capacity: s.capacity };
    const existing = groups.get(key);
    if (existing) {
      if (label) existing.slots.push(slot);
    } else {
      groups.set(key, {
        date: s.date,
        dateLong: formatLongDate(s.date),
        location: s.location,
        slots: label ? [slot] : [],
      });
    }
  }
  return [...groups.values()];
}

/** Render a short, parent-readable weather note from a county-level forecast. */
function weatherNote(dw: DayWeather): string {
  const temp = dw.tempHigh != null ? `, ${dw.tempHigh}°` : "";
  if (dw.risk === "cancel") {
    return `${dw.maxRain}% chance of rain — watch for a cancellation note`;
  }
  if (dw.risk === "watch") {
    return `${dw.summary} — ${dw.maxRain}% chance of rain${temp}`;
  }
  return `${dw.summary}${temp}`;
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

  const tip = pickWeeklyTip();
  const sessions = groupSessions(await fetchUpcomingSessions());
  // County-level forecast per session date. Fails soft — a miss (NWS down or
  // date beyond the ~7-day horizon) just leaves the group without a note.
  const weather = await fetchWeatherByDate([
    ...new Set(sessions.map((g) => g.date)),
  ]);
  for (const g of sessions) {
    const dw = weather.get(g.date);
    if (dw) g.weatherNote = weatherNote(dw);
  }
  const subscribers = await fetchActiveSubscribers();
  const scheduleUrl = `${SITE_ORIGIN}/schedule`;

  const resendApiKey = process.env.RESEND_API_KEY;
  const resend = resendApiKey ? new Resend(resendApiKey) : null;
  if (!resend) {
    console.warn("[cron/weekly-newsletter] RESEND_API_KEY missing — nothing sent");
    return NextResponse.json(
      { ok: false, error: "RESEND_API_KEY missing", subscribers: subscribers.length },
      { status: 500 },
    );
  }

  const subject = sessions.length
    ? "Open courts this week — Next Gen"
    : `Coach tip of the week — ${tip.title}`;

  let sent = 0;
  let failed = 0;
  for (const sub of subscribers) {
    const parentFirst = (sub.parentName || "").split(/\s+/)[0] || "there";
    const token = signUnsubscribeToken(sub.email);
    const unsubscribeUrl = token
      ? `${SITE_ORIGIN}/api/newsletter/unsubscribe?token=${encodeURIComponent(token)}`
      : `${SITE_ORIGIN}/newsletter`;

    const input = { parentFirst, sessions, tip, scheduleUrl, unsubscribeUrl };
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: sub.email,
      replyTo: REPLY_TO,
      subject,
      html: weeklyNewsletterHtml(input),
      text: weeklyNewsletterText(input),
    });
    if (error) {
      failed++;
      console.error(`[cron/weekly-newsletter] send failed for ${sub.email}:`, error);
    } else {
      sent++;
    }
  }

  // QA / archive copy to the admin inbox so Sam sees exactly what went out.
  // Uses a no-op unsubscribe link (admin isn't a subscriber row).
  try {
    const adminInput = {
      parentFirst: "Coach",
      sessions,
      tip,
      scheduleUrl,
      unsubscribeUrl: `${SITE_ORIGIN}/newsletter`,
    };
    await resend.emails.send({
      from: FROM_EMAIL,
      to: ADMIN_EMAIL,
      replyTo: REPLY_TO,
      subject: `[NGA newsletter sent · ${sent} recipients] ${subject}`,
      html: weeklyNewsletterHtml(adminInput),
      text: weeklyNewsletterText(adminInput),
    });
  } catch (err) {
    console.error("[cron/weekly-newsletter] admin copy failed:", err);
  }

  const summary = {
    ok: true,
    has_sessions: sessions.length > 0,
    session_groups: sessions.length,
    subscribers: subscribers.length,
    sent,
    failed,
    tip: tip.title,
  };
  console.log("[cron/weekly-newsletter]", JSON.stringify(summary));
  return NextResponse.json(summary);
}
