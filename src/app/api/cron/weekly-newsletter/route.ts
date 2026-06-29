import { secretEquals } from "@/lib/secret-compare";
import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { fetchUpcomingSessions, type NgaSession } from "@/lib/notion-sessions";
import { fetchActiveSubscribers } from "@/lib/notion-newsletter";
import { pickWeeklyTip } from "@/lib/newsletter-tips";
import { signUnsubscribeToken } from "@/lib/newsletter-token";
import { signReferralToken } from "@/lib/referral-token";
import { fetchOpenPolls, fetchPollResponses } from "@/lib/notion-crew-polls";
import { fetchApprovedNews, setNewsStatus } from "@/lib/notion-news";
import { fetchApprovedNewsletterDrafts, stampDraftsSentAt } from "@/lib/notion-newsletter-drafts";
import { fetchWeatherForSessions, type DayWeather } from "@/lib/weather";
import { fillGoal } from "@/lib/fill-meter";
import { c } from "@/lib/email/brand";
import { appendUtm } from "@/lib/email/utm";
import { CAMP_AGE_MIN, CAMP_OPTIONS } from "@/data/camps";
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

/** Group Open sessions matching `keep` by date+location, joining time slots. */
function groupSessions(
  sessions: NgaSession[],
  keep: (s: NgaSession) => boolean,
): DatedGroup[] {
  const open = sessions
    .filter((s) => s.status === "Open" && s.date && keep(s))
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
    const slot = { label, registered: s.registeredCount, goal: fillGoal(s) };
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
  if (!secretEquals(auth, `Bearer ${expected}`)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tip = pickWeeklyTip();
  const todayIso = isoEtPlusDays(0);
  const weekEndIso = isoEtPlusDays(WINDOW_DAYS);
  const allSessions = await fetchUpcomingSessions();
  // "This week" — Open sessions inside the 9-day window.
  const sessions = groupSessions(
    allSessions,
    (s) => s.date >= todayIso && s.date <= weekEndIso,
  );
  // Summer promo — Open sessions beyond the weekly window whose date falls in
  // June/July/August. Month-on-the-date-string keeps it timezone-safe.
  const summerSessions = groupSessions(allSessions, (s) => {
    if (s.date <= weekEndIso) return false;
    const month = s.date.slice(5, 7);
    return month === "06" || month === "07" || month === "08";
  });
  // County-level forecast scoped to each session's actual hours, rolled up to
  // the worst window per date. Fails soft — a miss (NWS down or date beyond the
  // ~6.5-day hourly horizon) just leaves the group without a note.
  const weekSessions = allSessions.filter(
    (s) =>
      s.status === "Open" &&
      s.date &&
      s.date >= todayIso &&
      s.date <= weekEndIso,
  );
  const weather = await fetchWeatherForSessions(weekSessions);
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

  // "From Coach Sam" lead block — sourced from EVERY Approved row in the
  // newsletter-drafts Notion DB within the freshness window (the Wednesday
  // cloud-drafter row plus anything else Sam approved, e.g. an event promo).
  // Empty when Sam hasn't approved anything this week → block stays hidden.
  // Fails soft on any Notion error so the cron still ships the rest.
  let newsletterDrafts: Awaited<
    ReturnType<typeof fetchApprovedNewsletterDrafts>
  > = [];
  try {
    newsletterDrafts = await fetchApprovedNewsletterDrafts();
  } catch (err) {
    console.warn(
      "[cron/weekly-newsletter] newsletter draft fetch failed:",
      err,
    );
  }
  // Concatenate every approved row into the single lead-block field so all of
  // them ship, not just the latest. A thin rule separates rows; null when none
  // so the template keeps the block hidden.
  const leadDivider = `<hr style="border:0;border-top:1px solid ${c.border};margin:18px 0;" />`;
  const newsletterLeadHtml = newsletterDrafts.length
    ? newsletterDrafts.map((d) => d.html).join(`\n${leadDivider}\n`)
    : null;
  const newsletterLeadText = newsletterDrafts.length
    ? newsletterDrafts.map((d) => d.text).join("\n\n---\n\n")
    : null;
  const newsletterLeadSections = newsletterDrafts.reduce(
    (n, d) => n + (d.sectionCount || 0),
    0,
  );

  const subscribers = await fetchActiveSubscribers();
  // First-party click attribution: tag this week's send so /api/analytics can
  // separate newsletter-driven traffic from organic. One campaign per issue.
  const utmCampaign = `weekly-${new Date().toISOString().slice(0, 10)}`;
  const scheduleUrl = appendUtm(`${SITE_ORIGIN}/schedule`, "schedule", utmCampaign);
  const crewInterestUrl = appendUtm(`${SITE_ORIGIN}/crew`, "crew", utmCampaign);
  // Dedicated camp block suppressed (2026-06-15): the camp is promoted via the
  // "From Coach Sam" lead block (NGA Newsletter Drafts DB) + the /camp page, so
  // the auto-tease was duplicating it. Re-enable by repopulating `camps` from
  // CAMPS.filter((c) => c.endDate >= today) and re-importing CAMPS.
  const camps: { weekLabel: string }[] = [];
  const campUrl = appendUtm(`${SITE_ORIGIN}/camp`, "camp", utmCampaign);
  const campPriceFromUsd = Math.min(...CAMP_OPTIONS.map((o) => o.priceUsd));

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
      : summerSessions.length
        ? "Summer sessions are live — Next Gen"
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
      summerSessions,
      openPolls,
      news,
      newsletterLeadHtml,
      newsletterLeadText,
      tip,
      scheduleUrl,
      crewInterestUrl,
      unsubscribeUrl,
      referralUrl,
      origin: SITE_ORIGIN,
      utmCampaign,
      camps,
      campUrl,
      campAgeMin: CAMP_AGE_MIN,
      campPriceFromUsd,
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
      summerSessions,
      openPolls,
      news,
      newsletterLeadHtml,
      newsletterLeadText,
      tip,
      scheduleUrl,
      crewInterestUrl,
      unsubscribeUrl: `${SITE_ORIGIN}/newsletter`,
      referralUrl: signReferralToken("sample@example.com")
        ? `${SITE_ORIGIN}/newsletter?ref=${encodeURIComponent(signReferralToken("sample@example.com") ?? "")}`
        : null,
      origin: SITE_ORIGIN,
      utmCampaign,
      camps,
      campUrl,
      campAgeMin: CAMP_AGE_MIN,
      campPriceFromUsd,
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
    // Stamp "Sent At" on every draft row that shipped so the Notion DB shows
    // exactly when each issue went out (fire-and-forget, never throws).
    if (newsletterDrafts.length > 0) {
      const sentDate = new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/New_York",
      }).format(new Date());
      await stampDraftsSentAt(
        newsletterDrafts.map((d) => d.pageId),
        sentDate,
      );
    }
  }

  const summary = {
    ok: true,
    has_sessions: sessions.length > 0,
    session_groups: sessions.length,
    summer_groups: summerSessions.length,
    open_polls: openPolls.length,
    news_items: news.length,
    news_marked_used: newsMarkedUsed,
    has_newsletter_lead: newsletterDrafts.length > 0,
    newsletter_lead_rows: newsletterDrafts.length,
    newsletter_lead_sections: newsletterLeadSections,
    subscribers: subscribers.length,
    sent,
    failed,
    tip: tip.title,
  };
  console.log("[cron/weekly-newsletter]", JSON.stringify(summary));
  return NextResponse.json(summary);
}
