import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { fetchUpcomingSessions, type NgaSession } from "@/lib/notion-sessions";
import { fetchActiveSubscribers } from "@/lib/notion-newsletter";
import { pickWeeklyTip } from "@/lib/newsletter-tips";
import { signUnsubscribeToken } from "@/lib/newsletter-token";
import { signReferralToken } from "@/lib/referral-token";
import { fetchOpenPolls, fetchPollResponses } from "@/lib/notion-crew-polls";
import { fetchApprovedNews, setNewsStatus } from "@/lib/notion-news";
import { fetchApprovedNewsletterDraft } from "@/lib/notion-newsletter-drafts";
import { fetchWeatherByDate, type DayWeather } from "@/lib/weather";
import {
  weeklyNewsletterHtml,
  weeklyNewsletterText,
  type NewsletterOpenPoll,
  type NewsletterSessionGroup,
} from "@/lib/email/weekly-newsletter";

export const runtime = "nodejs";
// Cron path — never cache.
export const dynamic = "force-dynamic";

const ADMIN_EMAIL = "nextgenacademypb@gmail.com";
const FROM_EMAIL = "Next Gen PB Academy <noreply@nextgenpbacademy.com>";
const REPLY_TO = "nextgenacademypb@gmail.com";
const SITE_ORIGIN =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://nextgenpbacademy.com";

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

/**
 * Pull Open polls + their Yes-vote counts for the newsletter polls block.
 * Capped at 5 polls (any more would crowd the email). Each poll incurs one
 * extra Notion query for the response count — fine at typical fan-out, and
 * the cron is the only caller.
 */
async function loadOpenPolls(): Promise<NewsletterOpenPoll[]> {
  try {
    const polls = (await fetchOpenPolls()).slice(0, 5);
    const out: NewsletterOpenPoll[] = [];
    for (const p of polls) {
      let yesCount = 0;
      try {
        const responses = await fetchPollResponses(p.id);
        yesCount = responses.filter((r) => r.vote === "Yes").length;
      } catch (err) {
        console.warn(
          `[cron/weekly-newsletter] poll responses fetch failed for ${p.slug}:`,
          err,
        );
      }
      out.push({
        title: p.title,
        slug: p.slug,
        day: p.day,
        startTime: p.startTime,
        endTime: p.endTime,
        location: p.location,
        level: p.level || "Any",
        minPartySize: p.minPartySize,
        yesCount,
      });
    }
    return out;
  } catch (err) {
    console.warn("[cron/weekly-newsletter] open polls fetch failed:", err);
    return [];
  }
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

  // Open crew polls + Yes-vote counts. Fails soft — if Notion is down we
  // ship the email without the polls block instead of failing the whole
  // weekly send.
  const openPolls = await loadOpenPolls();

  // Approved news items from the scraper queue (max 4 per issue so the
  // email stays scannable). Fails soft — no news just hides the block.
  // Keep the original rows so we can flip them to Used after a successful
  // send (avoids a race with anything Sam approves mid-broadcast).
  const newsRows = await fetchApprovedNews(4);
  const news = newsRows.map((n) => ({
    title: n.title,
    url: n.url,
    source: n.source,
    summary: n.summary,
  }));

  // "From Coach Sam" lead block — sourced from an Approved row in the
  // newsletter-drafts Notion DB written by the Wednesday cloud drafter.
  // Null when Sam hasn't approved a draft this week → block stays hidden.
  // Fails soft on any Notion error so the cron still ships the rest.
  let newsletterDraft: Awaited<
    ReturnType<typeof fetchApprovedNewsletterDraft>
  > = null;
  try {
    newsletterDraft = await fetchApprovedNewsletterDraft();
  } catch (err) {
    console.warn(
      "[cron/weekly-newsletter] newsletter draft fetch failed:",
      err,
    );
  }

  const subscribers = await fetchActiveSubscribers();
  const scheduleUrl = `${SITE_ORIGIN}/schedule`;
  const crewInterestUrl = `${SITE_ORIGIN}/crew`;

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
    : openPolls.length
      ? "Crews forming this week — Next Gen"
      : `Coach tip of the week — ${tip.title}`;

  let sent = 0;
  let failed = 0;
  // Throttle to stay under Resend's 5 req/sec limit (~3.3/sec).
  for (let i = 0; i < subscribers.length; i++) {
    const sub = subscribers[i];
    if (i > 0) await new Promise((res) => setTimeout(res, 300));
    const parentFirst = (sub.parentName || "").split(/\s+/)[0] || "there";
    const token = signUnsubscribeToken(sub.email);
    const unsubscribeUrl = token
      ? `${SITE_ORIGIN}/api/newsletter/unsubscribe?token=${encodeURIComponent(token)}`
      : `${SITE_ORIGIN}/newsletter`;

    // Prefer the stamped Referral Token (issued at signup) so the same link
    // appears in every issue; fall back to signing on the fly if older rows
    // never got one.
    const refToken = sub.referralToken || signReferralToken(sub.email);
    const referralUrl = refToken
      ? `${SITE_ORIGIN}/newsletter?ref=${encodeURIComponent(refToken)}`
      : null;

    const input = {
      parentFirst,
      sessions,
      openPolls,
      news,
      newsletterLeadHtml: newsletterDraft?.html ?? null,
      newsletterLeadText: newsletterDraft?.text ?? null,
      tip,
      scheduleUrl,
      crewInterestUrl,
      unsubscribeUrl,
      referralUrl,
      origin: SITE_ORIGIN,
    };
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
  // Uses a no-op unsubscribe link (admin isn't a subscriber row) and a
  // sample referral URL so the forward block renders.
  try {
    const adminInput = {
      parentFirst: "Coach",
      sessions,
      openPolls,
      news,
      newsletterLeadHtml: newsletterDraft?.html ?? null,
      newsletterLeadText: newsletterDraft?.text ?? null,
      tip,
      scheduleUrl,
      crewInterestUrl,
      unsubscribeUrl: `${SITE_ORIGIN}/newsletter`,
      referralUrl: signReferralToken("sample@example.com")
        ? `${SITE_ORIGIN}/newsletter?ref=${encodeURIComponent(signReferralToken("sample@example.com") ?? "")}`
        : null,
      origin: SITE_ORIGIN,
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

  // Flip the rows we actually included to Used so they don't reappear in
  // next week's issue. Only fire on a successful send — failed broadcasts
  // leave the queue intact so the next run can retry the same items.
  let newsMarkedUsed = 0;
  if (sent > 0) {
    for (const row of newsRows) {
      const ok = await setNewsStatus(row.pageId, "Used");
      if (ok) newsMarkedUsed++;
    }
  }

  const summary = {
    ok: true,
    has_sessions: sessions.length > 0,
    session_groups: sessions.length,
    open_polls: openPolls.length,
    news_items: news.length,
    news_marked_used: newsMarkedUsed,
    has_newsletter_lead: !!newsletterDraft,
    newsletter_lead_sections: newsletterDraft?.sectionCount ?? 0,
    subscribers: subscribers.length,
    sent,
    failed,
    tip: tip.title,
  };
  console.log("[cron/weekly-newsletter]", JSON.stringify(summary));
  return NextResponse.json(summary);
}
