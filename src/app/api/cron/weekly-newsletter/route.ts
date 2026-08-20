import { withCronAlert, rollupFailure, type CronFailure } from "@/lib/cron-alert";
import { Resend } from "resend";
import { fetchUpcomingSessions, type NgaSession } from "@/lib/notion-sessions";
import { fetchActiveSubscribers } from "@/lib/notion-newsletter";
import { pickWeeklyTip } from "@/lib/newsletter-tips";
import { signUnsubscribeToken } from "@/lib/newsletter-token";
import { signReferralToken } from "@/lib/referral-token";
import { fetchOpenPolls, fetchPollResponses } from "@/lib/notion-crew-polls";
import { fetchApprovedNews, setNewsStatus } from "@/lib/notion-news";
import {
  fetchApprovedNewsletterDrafts,
  stampDraftsSentAt,
  type NewsletterDraftsResult,
} from "@/lib/notion-newsletter-drafts";
import { fetchWeatherForSessions, type DayWeather } from "@/lib/weather";
import { fillGoal } from "@/lib/fill-meter";
import { c } from "@/lib/email/brand";
import { appendUtm } from "@/lib/email/utm";
import { CAMP_AGE_MIN, CAMP_OPTIONS, upcomingCamps } from "@/data/camps";
import { MVF_TOURNAMENT, mvfTournamentIsUpcoming } from "@/data/mvf";
import {
  FALL_PUBLIC_AREA,
  FALL_SEASON_LABEL,
  FALL_SEASON_WEEKS,
  FALL_SUNDAYS,
  FALL_VENUE_SHORT,
} from "@/data/fall-2026";
import {
  FALL_SEASON_GROUPS,
  FALL_SEASON_PRICE_USD,
  FALL_SEASON_SPOTS_PER_GROUP,
  FALL_SEASON_TITLE,
} from "@/data/fall-season-2026";
import { countFallRegistrations } from "@/lib/notion-fall-registrations";
import {
  weeklyNewsletterHtml,
  weeklyNewsletterText,
  type NewsletterFallGroup,
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

/**
 * Fall-season block input, or null when the season shouldn't be promoted.
 *
 * Gated on the same flag /fall reads, so the email can never advertise a
 * checkout that returns 503, and on the season's own last Sunday so the block
 * retires itself without anyone remembering to pull it.
 *
 * Seat counts come from the live roster and fail SOFT: `countFallRegistrations`
 * returns null on a Notion miss, and the template falls back to the group size
 * rather than printing a seat count that might be wrong.
 */
async function loadFallSeason(
  todayIso: string,
  utmCampaign: string,
): Promise<{
  title: string;
  seasonLabel: string;
  weeks: number;
  venueLine: string;
  priceUsd: number;
  groups: NewsletterFallGroup[];
  url: string;
} | null> {
  if (process.env.NEXT_PUBLIC_FALL_REGISTRATION_OPEN !== "true") return null;
  const lastSunday = FALL_SUNDAYS[FALL_SUNDAYS.length - 1];
  if (todayIso > lastSunday) return null;

  const groups: NewsletterFallGroup[] = [];
  for (const option of FALL_SEASON_GROUPS) {
    const taken = await countFallRegistrations(option.group);
    groups.push({
      label: option.label,
      timeLabel: option.timeLabel,
      spotsLeft:
        taken === null
          ? null
          : Math.max(0, FALL_SEASON_SPOTS_PER_GROUP - taken),
      spotsPerGroup: FALL_SEASON_SPOTS_PER_GROUP,
    });
  }

  return {
    title: FALL_SEASON_TITLE,
    seasonLabel: FALL_SEASON_LABEL,
    weeks: FALL_SEASON_WEEKS,
    venueLine: `${FALL_VENUE_SHORT}, ${FALL_PUBLIC_AREA}`,
    priceUsd: FALL_SEASON_PRICE_USD,
    groups,
    url: appendUtm(`${SITE_ORIGIN}/fall`, "fall-season", utmCampaign),
  };
}

/** True while at least one fall group still has a seat we know about. */
function fallHasOpenSeats(
  fallSeason: { groups: NewsletterFallGroup[] } | null,
): boolean {
  if (!fallSeason) return false;
  return fallSeason.groups.some((g) => g.spotsLeft === null || g.spotsLeft > 0);
}

export const GET = withCronAlert("weekly-newsletter", async () => {
  const failures: CronFailure[] = [];
  const tip = pickWeeklyTip();
  const todayIso = isoEtPlusDays(0);
  const weekEndIso = isoEtPlusDays(WINDOW_DAYS);
  const allSessions = await fetchUpcomingSessions();
  // "This week" — Open sessions inside the 9-day window.
  const sessions = groupSessions(
    allSessions,
    (s) => s.date >= todayIso && s.date <= weekEndIso,
  );
  // Plan-ahead block — every Open session past the weekly window, out to the
  // 30-day registration horizon `fetchUpcomingSessions` already applies. The
  // month filter this replaces ("06"/"07"/"08") was written for a summer promo
  // and would silently hide every September date from here on.
  const laterSessions = groupSessions(allSessions, (s) => s.date > weekEndIso);
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
  // Still fails soft on any Notion error so the cron ships the rest of the
  // issue — but the result now carries WHY it's empty, reported as failure
  // signatures after the send (see the diagnostics block below).
  let draftsResult: NewsletterDraftsResult = {
    drafts: [],
    status: "ok",
    unreadablePageIds: [],
    strandedPageIds: [],
  };
  try {
    draftsResult = await fetchApprovedNewsletterDrafts();
  } catch (err) {
    console.warn(
      "[cron/weekly-newsletter] newsletter draft fetch failed:",
      err,
    );
    draftsResult = { ...draftsResult, status: "query_failed" };
  }
  const newsletterDrafts = draftsResult.drafts;
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
  // Re-enabled 2026-08-05. It was suppressed on 2026-06-15 as a duplicate of
  // the "From Coach Sam" lead block, but that block is a hand-Approved Notion
  // row inside a 7-day Drafted At window — so a camp only gets promoted on the
  // weeks someone remembers to draft one, and the Aug 17–20 camp silently
  // dropped out of every issue after its 2026-07-23 send. This list derives
  // from camps.ts, so an upcoming camp can't fall off the issue.
  // `upcomingCamps` drops a camp once it starts, not once it ends: the Aug 20
  // 2026 issue promoted the Aug 17–20 camp on its final morning because this
  // used to filter on `endDate >= todayIso`.
  const camps = upcomingCamps(todayIso).map((c) => ({
    weekLabel: c.weekLabel,
    publicArea: c.publicArea,
  }));
  const campUrl = appendUtm(`${SITE_ORIGIN}/camp`, "camp", utmCampaign);
  const campPriceFromUsd = Math.min(...CAMP_OPTIONS.map((o) => o.priceUsd));

  // MVF tournament highlight — tops every issue through the rain date, then
  // drops out on its own. Derived from mvf.ts so it can't fall off the issue
  // the way a hand-drafted Notion row can.
  const mvfTournament = mvfTournamentIsUpcoming(todayIso)
    ? {
        title: MVF_TOURNAMENT.title,
        dateLabel: MVF_TOURNAMENT.dateLabel,
        timeLabel: MVF_TOURNAMENT.timeLabel,
        venueLine: `${MVF_TOURNAMENT.venue.name}, ${MVF_TOURNAMENT.venue.locality}`,
        ageMin: MVF_TOURNAMENT.ageMin,
        format: MVF_TOURNAMENT.format,
        bracketsLabel: MVF_TOURNAMENT.brackets.join(" / "),
        priceResidentUsd: MVF_TOURNAMENT.prices[0].usd,
        priceNonResidentUsd: MVF_TOURNAMENT.prices[1].usd,
        rainDateLabel: MVF_TOURNAMENT.rainDateLabel,
        url: appendUtm(MVF_TOURNAMENT.url, "mvf-tournament", utmCampaign),
      }
    : null;

  // Fall season — the lead block and, while seats remain, the subject line.
  const fallSeason = await loadFallSeason(todayIso, utmCampaign);

  const resendApiKey = process.env.RESEND_API_KEY;
  const resend = resendApiKey ? new Resend(resendApiKey) : null;
  if (!resend) {
    console.warn("[cron/weekly-newsletter] RESEND_API_KEY missing — nothing sent");
    return {
      attempted: subscribers.length,
      succeeded: 0,
      failures: [{ signature: "resend_not_configured" }],
      body: { error: "RESEND_API_KEY missing", subscribers: subscribers.length },
    };
  }

  // The fall season outranks even "open courts this week" — the one thing here
  // a family can't get a second chance at. Eight seats a group, sold once, and
  // the door shuts when the first Sunday arrives; a drop-in they skip this week
  // simply runs again next week. It steps aside the moment both groups fill.
  // Below that, camp outranks polls/plan-ahead/tip but never open courts — a
  // bookable session in the next 9 days is the more urgent ask.
  const subject = fallHasOpenSeats(fallSeason)
    ? "Fall season registration is open — Next Gen"
    : sessions.length
      ? "Open courts this week — Next Gen"
      : camps.length
        ? "Camp is coming up — Next Gen"
        : openPolls.length
          ? "Crews forming this week — Next Gen"
          : laterSessions.length
            ? "New dates on the calendar — Next Gen"
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
      fallSeason,
      mvfTournament,
      sessions,
      laterSessions,
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
      // Keep the subscriber's email in LOGS only — the alert failure ref is a
      // positional index so no parent PII rides the alert email.
      console.error(`[cron/weekly-newsletter] send failed for ${sub.email}:`, error);
      failures.push({
        signature: "subscriber_send_failed",
        ref: `subscriber#${i}`,
        detail: error.message ?? String(error),
      });
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
      fallSeason,
      mvfTournament,
      sessions,
      laterSessions,
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
      // Lead-row count rides the subject so "the From Coach Sam block was
      // empty this week" is visible at a glance in the one email Sam already
      // opens every Thursday — no dashboard, no query.
      subject: `[NGA newsletter sent · ${sent} recipients · lead ${newsletterDrafts.length} rows] ${subject}`,
      html: weeklyNewsletterHtml(adminInput),
      text: weeklyNewsletterText(adminInput),
    });
  } catch (err) {
    console.error("[cron/weekly-newsletter] admin copy failed:", err);
    // Class name only — raw exception text stays in the log line above.
    failures.push({
      signature: "admin_copy_failed",
      detail: err instanceof Error ? err.constructor.name : typeof err,
    });
  }

  // Flip the rows we actually included to Used so they don't reappear in
  // next week's issue. Only fire on a successful send — failed broadcasts
  // leave the queue intact so the next run can retry the same items.
  let newsMarkedUsed = 0;
  if (sent > 0) {
    for (const row of newsRows) {
      // A false return = the Used flip didn't stick → the same news item
      // repeats in next week's issue. Surface it instead of dropping it.
      const marked = await setNewsStatus(row.pageId, "Used");
      if (marked) newsMarkedUsed++;
      else
        failures.push({
          signature: "news_status_write_failed",
          ref: row.pageId,
          detail:
            "news row not flipped to Used; it will repeat in next week's issue",
        });
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

  // The "From Coach Sam" lead block can go missing five ways, and every one of
  // them used to look exactly like "Sam approved nothing this week". Name each
  // one so a dropped announcement can never pass for an empty queue.
  //
  // This cron is NOT idempotent — there is no per-subscriber sent flag, so a
  // re-run re-sends the whole issue to every Active subscriber. These failures
  // red the Vercel dashboard on a run whose emails already went out, so the
  // detail has to say so in as many words.
  const sendNote =
    sent > 0
      ? "the newsletter WAS sent to every subscriber, so do NOT re-run this cron — fix the row for next week's issue"
      : "no newsletter went out on this run";

  if (draftsResult.status === "config_missing") {
    failures.push({
      signature: "config_missing",
      detail: `NOTION_NEWSLETTER_DRAFTS_DB_ID is unset, so the "From Coach Sam" lead block cannot ship at all; ${sendNote}`,
    });
  } else if (draftsResult.status === "query_failed") {
    failures.push({
      signature: "newsletter_drafts_query_failed",
      detail: `the newsletter-drafts query failed, so any Approved lead block was dropped from this issue; ${sendNote}`,
    });
  }

  const unreadable = rollupFailure(
    "newsletter_draft_unreadable",
    draftsResult.unreadablePageIds,
    `Approved draft rows were dropped because their Notion body could not be read, so the lead block shipped SHORT; ${sendNote}. Page ids`,
  );
  if (unreadable) failures.push(unreadable);

  const stranded = rollupFailure(
    "approved_draft_did_not_ship",
    draftsResult.strandedPageIds,
    `Approved draft rows are still live (Expires At has not passed) but fell outside the 7-day Drafted At window, so they did NOT ship — bump Drafted At to send next week, or flip Status to Skip to stop this alert; ${sendNote}. Page ids`,
  );
  if (stranded) failures.push(stranded);

  const summary = {
    has_sessions: sessions.length > 0,
    session_groups: sessions.length,
    later_groups: laterSessions.length,
    fall_registration_open: fallSeason !== null,
    fall_spots_left: fallSeason
      ? fallSeason.groups.map((g) => `${g.label}:${g.spotsLeft ?? "unknown"}`).join(" ")
      : "",
    open_polls: openPolls.length,
    news_items: news.length,
    news_marked_used: newsMarkedUsed,
    has_newsletter_lead: newsletterDrafts.length > 0,
    newsletter_lead_rows: newsletterDrafts.length,
    newsletter_lead_sections: newsletterLeadSections,
    newsletter_lead_status: draftsResult.status,
    newsletter_lead_unreadable: draftsResult.unreadablePageIds.length,
    newsletter_lead_stranded: draftsResult.strandedPageIds.length,
    subscribers: subscribers.length,
    sent,
    failed,
    tip: tip.title,
  };
  console.log("[cron/weekly-newsletter]", JSON.stringify(summary));
  return {
    attempted: subscribers.length,
    succeeded: sent,
    failures,
    body: summary,
  };
});
