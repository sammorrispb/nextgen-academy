import { c, s } from "./brand";
import { appendUtm } from "./utm";
import type { CoachTip } from "@/lib/newsletter-tips";
import { fillLabel, fillBar } from "@/lib/fill-meter";
import { seatStatusLabel } from "@/lib/seat-status";
import {
  phoneLineHtml,
  phoneLineText,
  whatsappGroupsTopHtml,
  whatsappGroupsTopText,
} from "./signature";

/** One open time slot within a date+location group. */
export interface NewsletterSessionSlot {
  label: string; // "4:30–5:30 PM"
  /** Players signed up so far — the meter fills toward `goal`. */
  registered: number;
  /** Full build-out of the session (maxCourts × 4) — the meter's target. */
  goal: number;
}

/** A date+location group with one or more open slots that week. */
export interface NewsletterSessionGroup {
  dateLong: string; // "Saturday, May 23"
  location: string; // "Walter Johnson HS, Bethesda"
  slots: NewsletterSessionSlot[];
  /** Short, pre-rendered weather note for the date (county-level). Empty if unavailable. */
  weatherNote?: string;
}

/** A youth-pickleball news item surfaced inside the newsletter. */
export interface NewsletterNewsItem {
  title: string;
  url: string;
  source: string;
  summary: string;
}

/** An Open Crew Poll surfaced inside the newsletter. */
export interface NewsletterOpenPoll {
  title: string;
  slug: string;
  day: string;
  startTime: string;
  endTime: string;
  location: string;
  level: string;
  minPartySize: number;
  yesCount: number;
}

/** One bookable group within the fall-season block. */
export interface NewsletterFallGroup {
  /** "Green Ball" — canonical ball-color label, never a synonym. */
  label: string;
  /** "1:00–2:30 PM" */
  timeLabel: string;
  /** Seats still open, or null when the roster count couldn't be read. */
  spotsLeft: number | null;
}

export interface WeeklyNewsletterInput {
  parentFirst: string;
  /**
   * Fall season registration — the top block while registration is open, ahead
   * of even the tournament card. A season is the one thing in this email a
   * family can only buy once: 8 seats a group, full-season commitment, and the
   * door closes when the first Sunday arrives. A drop-in they miss this week
   * runs again next week; a season they miss is gone until next fall.
   *
   * The price is real (a live Stripe product), so this block quotes it — the
   * no-quoting rule targets prices that don't exist yet. Null hides the block;
   * the cron gates on the registration flag and the season's own end date.
   */
  fallSeason: {
    title: string;
    /** "September 20 – October 25, 2026" */
    seasonLabel: string;
    weeks: number;
    /** "Walter Johnson High School, Bethesda, MD" */
    venueLine: string;
    priceUsd: number;
    groups: NewsletterFallGroup[];
    /** UTM-stamped /fall registration URL. */
    url: string;
  } | null;
  /**
   * MVF tournament highlight — the top block until the event. Null hides it;
   * the cron gates on date (through the rain date) via `mvfTournamentIsUpcoming`.
   * Prices are the real MVF registration fees (already public on the register
   * page), so this block may quote them — camps precedent, not the teased
   * drop-in price. Registration is on Link & Dink's surface, never NGA's.
   */
  mvfTournament: {
    title: string;
    dateLabel: string;
    timeLabel: string;
    venueLine: string; // "Apple Ridge Pickleball Courts, Montgomery Village"
    ageMin: number;
    format: string;
    bracketsLabel: string; // "Playing / Competing / Tournament Level"
    priceResidentUsd: number;
    priceNonResidentUsd: number;
    rainDateLabel: string;
    /** UTM-stamped register URL (p3.linkanddink.com). */
    url: string;
  } | null;
  sessions: NewsletterSessionGroup[];
  /**
   * Open sessions beyond the weekly window, so parents can plan ahead.
   * Empty hides the block. Registration for any given date still opens 30 days
   * out on /schedule; this block is the heads-up + sign-up nudge.
   *
   * Was `summerSessions` with "Summer sessions are live" copy and a June/July/
   * August date filter. Both went stale on their own: the Aug 20 2026 issue
   * pitched "lock in your summer spot" for a single Aug 30 date with school
   * starting the 25th, and the month filter would have hidden every September
   * date outright. A season word in a template that ships every week is a bug
   * with a delay on it — keep this block's copy season-neutral.
   */
  laterSessions: NewsletterSessionGroup[];
  openPolls: NewsletterOpenPoll[];
  /** Approved youth-pickleball news items from the scraper queue. Empty hides the block. */
  news: NewsletterNewsItem[];
  /**
   * Pre-rendered HTML for the "From Coach Sam" lead block, sourced from an
   * Approved row in the newsletter-drafts Notion DB. Null/undefined hides
   * the block — default behavior when Sam hasn't approved a draft this week.
   * See notion-newsletter-drafts.ts.
   */
  newsletterLeadHtml?: string | null;
  /** Plain-text mirror of newsletterLeadHtml for the text/plain MIME part. */
  newsletterLeadText?: string | null;
  tip: CoachTip;
  scheduleUrl: string;
  crewInterestUrl: string;
  unsubscribeUrl: string;
  /** Personalized forward URL: /newsletter?ref=<signed-token>. Null when the signing key isn't configured. */
  referralUrl: string | null;
  /** Site origin for absolute links inside the poll cards. */
  origin: string;
  /**
   * UTM campaign label for first-party click attribution (e.g. "weekly-2026-06-04").
   * Stamps the same-origin CTAs built inside this template (poll, eval). The
   * scheduleUrl/crewInterestUrl passed in are already UTM-stamped by the cron.
   */
  utmCampaign: string;
  /**
   * Upcoming summer-camp weeks for the dedicated camp block. Empty hides the
   * block. Camp pricing is real (a concrete bookable product), so this block
   * may quote it — unlike the teased drop-in price. `publicArea` travels per
   * row because camps move venues between weeks; it is the broad area only,
   * never `exactLocation` (child-safety policy in camps.ts).
   */
  camps: { weekLabel: string; publicArea: string }[];
  /** UTM-stamped /camp link. */
  campUrl: string;
  /** Minimum camp age (8) — the day-camp runs older than the 6–16 academy range. */
  campAgeMin: number;
  /** Lowest camp-option price (USD) for the "from $X/week" tease. */
  campPriceFromUsd: number;
}

/** Email-safe segmented meter: lime filled blocks, muted empty blocks. */
function meterHtml(registered: number, goal: number): string {
  if (goal <= 0) return "";
  const r = Math.min(Math.max(0, registered), goal);
  const filled = r > 0 ? `<span style="color:${c.accentLime};">${"▰".repeat(r)}</span>` : "";
  const empty = r < goal ? `<span style="color:${c.muted};">${"▱".repeat(goal - r)}</span>` : "";
  return `<span style="letter-spacing:2px;">${filled}${empty}</span>`;
}

function pollTimeRange(p: NewsletterOpenPoll): string {
  if (!p.startTime) return "";
  return p.endTime ? `${p.startTime}–${p.endTime}` : p.startTime;
}

function pollProgressLabel(p: NewsletterOpenPoll): string {
  const need = Math.max(0, p.minPartySize - p.yesCount);
  if (need <= 0) return "Locked in — Sam will text the WhatsApp group";
  return `${p.yesCount} in · need ${need} more to lock it in`;
}

/**
 * Seat line for one fall group, or "" when the roster read failed — a null
 * count used to fall back to the group size, but the group size is exactly the
 * number this email no longer publishes, and silence beats a stale cap.
 */
export function fallSpotsLabel(g: NewsletterFallGroup): string {
  return seatStatusLabel(g.spotsLeft, { fullLabel: "Full — ask about the sub list" }) ?? "";
}

function fallGroupLine(g: NewsletterFallGroup): string {
  const spots = fallSpotsLabel(g);
  return `Sundays ${g.timeLabel}${spots ? ` · ${spots}` : ""}`;
}

export function weeklyNewsletterHtml(input: WeeklyNewsletterInput): string {
  const {
    parentFirst,
    fallSeason,
    mvfTournament,
    sessions,
    laterSessions,
    openPolls,
    news,
    newsletterLeadHtml,
    tip,
    scheduleUrl,
    crewInterestUrl,
    unsubscribeUrl,
    referralUrl,
    origin,
    utmCampaign,
    camps,
    campUrl,
    campAgeMin,
    campPriceFromUsd,
  } = input;
  const hasSessions = sessions.length > 0;
  const hasLater = laterSessions.length > 0;
  const hasCamps = camps.length > 0;
  const hasPolls = openPolls.length > 0;
  const hasNews = news.length > 0;
  const hasLead = !!(newsletterLeadHtml && newsletterLeadHtml.trim());

  // Fall season — the lead block while registration is open. Derived from the
  // season data files by the cron, so (like camps and the tournament) it can't
  // fall off the issue the way a hand-drafted Notion row can.
  const fallBlock = fallSeason
    ? `
    <div style="${s.cardAccent}">
      <p style="margin:0 0 6px 0;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:${c.accentLime};font-weight:700;">Fall season &mdash; registration is open</p>
      <p style="margin:0 0 8px 0;font-family:Montserrat,Arial,sans-serif;font-size:16px;font-weight:900;color:${c.text};">${escape(fallSeason.title)} &mdash; ${escape(fallSeason.seasonLabel)}</p>
      <p style="margin:0 0 12px 0;color:${c.text};font-size:14px;line-height:1.55;">${fallSeason.weeks} Sundays at ${escape(fallSeason.venueLine)}. Coached practice first, then a rotating-partner round robin &mdash; so your kid plays with everyone in their group across the season, not just the friend they came with. One registration covers all ${fallSeason.weeks} Sundays.</p>
      ${fallSeason.groups
        .map(
          (g) =>
            `<p style="margin:0 0 4px 0;color:${c.text};font-size:14px;"><strong>${escape(g.label)}</strong> &mdash; <span style="color:${c.muted};">${escape(fallGroupLine(g))}</span></p>`,
        )
        .join("")}
      <p style="margin:10px 0 0 0;color:${c.muted};font-size:13px;">$${fallSeason.priceUsd} per player for the full season &middot; first come, first serve. Can&rsquo;t make all ${fallSeason.weeks}? Reply and we&rsquo;ll put you on the sub list.</p>
      <p style="margin:14px 0 0 0;"><a href="${fallSeason.url}" style="${s.link}font-weight:700;text-decoration:none;">Register for the season &rarr;</a></p>
    </div>`
    : "";

  // MVF tournament highlight — leads the issue until the event so no family
  // hears about tournament day after it happened. Registration is on Link &
  // Dink; this card only links out.
  const mvfBlock = mvfTournament
    ? `
    <div style="${s.cardAccent}">
      <p style="margin:0 0 6px 0;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:${c.accentLime};font-weight:700;">Tournament day &mdash; Sept 5</p>
      <p style="margin:0 0 8px 0;font-family:Montserrat,Arial,sans-serif;font-size:16px;font-weight:900;color:${c.text};">${escape(mvfTournament.title)}</p>
      <p style="margin:0 0 8px 0;color:${c.text};font-size:14px;line-height:1.55;">${escape(mvfTournament.dateLabel)}, ${escape(mvfTournament.timeLabel)} at ${escape(mvfTournament.venueLine)}. Ages ${mvfTournament.ageMin}+ &mdash; ${escape(mvfTournament.format.toLowerCase())}, so every pair gets a full morning of games. Brackets: ${escape(mvfTournament.bracketsLabel)}.</p>
      <p style="margin:0 0 8px 0;color:${c.muted};font-size:13px;">$${mvfTournament.priceResidentUsd} resident &middot; $${mvfTournament.priceNonResidentUsd} non-resident, per player &middot; partner required &middot; rain date ${escape(mvfTournament.rainDateLabel)}.</p>
      <p style="margin:14px 0 0 0;"><a href="${mvfTournament.url}" style="${s.link}font-weight:700;text-decoration:none;">Register with your partner &rarr;</a></p>
    </div>`
    : "";

  const sessionBlock = hasSessions
    ? `
    <p style="margin:0 0 6px 0;font-size:12px;letter-spacing:0.15em;text-transform:uppercase;color:${c.accentLime};font-weight:700;">This week&rsquo;s sessions</p>
    <p style="margin:0 0 14px 0;color:${c.muted};font-size:13px;">All times Eastern. Every signup fills the meter &mdash; full courts make the best games. Grab a slot and move it.</p>
    ${sessions
      .map(
        (g) => `<div style="${s.card}">
      <p style="margin:0 0 4px 0;font-family:Montserrat,Arial,sans-serif;font-size:16px;font-weight:900;color:${c.text};">${escape(g.dateLong)}</p>
      <p style="margin:0 0 ${g.weatherNote ? "2px" : "8px"} 0;color:${c.muted};font-size:13px;">${escape(g.location)}</p>
      ${g.weatherNote ? `<p style="margin:0 0 8px 0;color:${c.muted};font-size:13px;">Forecast: ${escape(g.weatherNote)}</p>` : ""}
      ${g.slots
        .map(
          (slot) =>
            `<p style="margin:0 0 2px 0;color:${c.text};font-size:14px;">${escape(slot.label)} &mdash; ${meterHtml(slot.registered, slot.goal)} <span style="color:${c.accentLime};font-weight:700;">${escape(fillLabel(slot.registered, slot.goal))}</span></p>`,
        )
        .join("")}
    </div>`,
      )
      .join("")}
    <div style="${s.actionCallout}">
      <p style="${s.actionLabel}">Book a spot</p>
      <p style="margin:14px 0 0 0;">
        <a href="${scheduleUrl}" style="${s.link}font-weight:700;text-decoration:none;">See this week&rsquo;s sessions &rarr;</a>
      </p>
    </div>`
    : `
    <div style="${s.cardAccent}">
      <p style="margin:0 0 6px 0;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:${c.accentLime};font-weight:700;">This week</p>
      <p style="margin:0;color:${c.text};font-size:14px;line-height:1.55;">No open sessions this week &mdash; but new ones post regularly. <a href="${scheduleUrl}" style="${s.link}font-weight:700;text-decoration:none;">Check the schedule &rarr;</a></p>
    </div>`;

  // Open sessions past the weekly window. Lists each date+location so parents
  // can plan ahead, with a single sign-up CTA to the schedule. Spots aren't
  // shown (registration opens 30 days out, so the count isn't meaningful yet).
  // Copy stays season-neutral on purpose — see `laterSessions` above.
  const laterBlock = hasLater
    ? `
    <div style="${s.cardAccent}">
      <p style="margin:0 0 6px 0;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:${c.accentLime};font-weight:700;">Further out on the calendar</p>
      <p style="margin:0 0 12px 0;color:${c.text};font-size:14px;line-height:1.55;">Planning ahead? These dates are already on the calendar. Registration for each one opens 30 days out.</p>
      ${laterSessions
        .map(
          (g) => `<p style="margin:0 0 4px 0;color:${c.text};font-size:14px;">${escape(g.dateLong)} &mdash; <span style="color:${c.muted};">${escape(g.location)}</span></p>`,
        )
        .join("")}
      <p style="margin:14px 0 0 0;"><a href="${scheduleUrl}" style="${s.link}font-weight:700;text-decoration:none;">See the full schedule &rarr;</a></p>
    </div>`
    : "";

  // Summer camp block — a distinct product from drop-in sessions (multi-day,
  // flat weekly price). Camp pricing is real, so we quote a "from $X" tease and
  // link to /camp for dates + booking. Hidden when no upcoming camp weeks.
  const campBlock = hasCamps
    ? `
    <div style="${s.cardAccent}">
      <p style="margin:0 0 6px 0;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:${c.accentLime};font-weight:700;">Summer camp</p>
      <p style="margin:0 0 12px 0;color:${c.text};font-size:14px;line-height:1.55;">Next Gen Summer Pickleball Camp &mdash; ages ${campAgeMin}+, half-day mornings, small groups. Come for a single morning or the full week. Real reps, real coaching, a ton of fun.</p>
      ${camps
        .map(
          (w) => `<p style="margin:0 0 4px 0;color:${c.text};font-size:14px;">${escape(w.weekLabel)} &mdash; <span style="color:${c.muted};">${escape(w.publicArea)}</span></p>`,
        )
        .join("")}
      <p style="margin:10px 0 0 0;color:${c.muted};font-size:13px;">From $${campPriceFromUsd}/day &middot; $150 full week.</p>
      <p style="margin:14px 0 0 0;"><a href="${campUrl}" style="${s.link}font-weight:700;text-decoration:none;">See camp dates &amp; book &rarr;</a></p>
    </div>`
    : "";

  const pollsBlock = hasPolls
    ? `
    <h2 style="margin:32px 0 6px 0;font-family:Montserrat,Arial,sans-serif;font-size:18px;color:${c.text};">Forming groups now</h2>
    <p style="margin:0 0 14px 0;color:${c.muted};font-size:13px;">Vote in the slots that work and Sam locks the group in when it hits the headcount.</p>
    ${openPolls
      .map(
        (p) => `<div style="${s.card}">
      <p style="margin:0 0 4px 0;font-family:Montserrat,Arial,sans-serif;font-size:15px;font-weight:900;color:${c.text};">${escape(p.title)}</p>
      <p style="margin:0 0 6px 0;color:${c.muted};font-size:13px;">${escape([p.day, pollTimeRange(p), p.location, p.level].filter(Boolean).join(" · "))}</p>
      <p style="margin:0 0 10px 0;color:${c.accentLime};font-size:13px;font-weight:700;">${escape(pollProgressLabel(p))}</p>
      <p style="margin:0;"><a href="${appendUtm(`${origin}/poll/${encodeURIComponent(p.slug)}`, "poll", utmCampaign)}" style="${s.link}font-weight:700;text-decoration:none;">Vote on this slot &rarr;</a></p>
    </div>`,
      )
      .join("")}`
    : "";

  // Crew Interest CTA — surfaced when no polls match, or as a low-pressure
  // "tell us what you want" anchor when polls are open. Always render.
  const crewBlock = `
    <div style="${s.cardAccent}">
      <p style="margin:0 0 6px 0;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:${c.accentLime};font-weight:700;">${hasPolls ? "None of these fit?" : "Want a regular group?"}</p>
      <p style="margin:0 0 10px 0;color:${c.text};font-size:14px;line-height:1.55;">Tell us your kid&rsquo;s level and the days that work &mdash; Sam looks for 3 more kids who match and texts the WhatsApp link when the slot has takers.</p>
      <p style="margin:0;"><a href="${crewInterestUrl}" style="${s.link}font-weight:700;text-decoration:none;">Find your kid&rsquo;s group &rarr;</a></p>
    </div>`;

  // "From Coach Sam" lead block — rendered HTML from an Approved row in the
  // newsletter-drafts Notion DB. Sits between the Coach Tip and the existing
  // news-cards block so the editorial voice leads into the raw news items.
  // Hidden by default; only renders when Sam has flipped a draft to Approved
  // for this week's send.
  const leadBlock = hasLead
    ? `
    <div style="${s.cardAccent}">
      <p style="margin:0 0 10px 0;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:${c.accentLime};font-weight:700;">From Coach Sam this week</p>
      ${newsletterLeadHtml}
    </div>`
    : "";

  // News block — only renders items Sam has Approved in the news Notion DB.
  // Each title links to the original source so parents can read in context.
  const newsBlock = hasNews
    ? `
    <h2 style="margin:32px 0 6px 0;font-family:Montserrat,Arial,sans-serif;font-size:18px;color:${c.text};">In the news: youth pickleball</h2>
    <p style="margin:0 0 14px 0;color:${c.muted};font-size:13px;">A few stories Sam thought you&rsquo;d want to see.</p>
    ${news
      .map(
        (n) => `<div style="${s.card}">
      <p style="margin:0 0 4px 0;font-family:Montserrat,Arial,sans-serif;font-size:15px;font-weight:900;color:${c.text};"><a href="${n.url}" style="color:${c.text};text-decoration:none;">${escape(n.title)}</a></p>
      <p style="margin:0 0 8px 0;color:${c.muted};font-size:12px;letter-spacing:0.05em;text-transform:uppercase;font-weight:700;">${escape(n.source)}</p>
      ${n.summary ? `<p style="margin:0 0 10px 0;color:${c.text};font-size:14px;line-height:1.55;">${escape(n.summary)}</p>` : ""}
      <p style="margin:0;"><a href="${n.url}" style="${s.link}font-weight:700;text-decoration:none;">Read the story &rarr;</a></p>
    </div>`,
      )
      .join("")}`
    : "";

  // "Brand new to a court?" card — surfaces the Red Ball group court plus the
  // optional private-lesson fast-track. Routes to the lead form (#contact-form).
  const privateBlock = `
    <div style="${s.card}">
      <p style="margin:0 0 6px 0;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:${c.muted};font-weight:700;">Brand new to a court?</p>
      <p style="margin:0 0 10px 0;color:${c.text};font-size:14px;line-height:1.55;">No problem &mdash; our Red Ball court is built for kids just starting out, so they can jump in and play right away. Prefer to fast-track? A private one-on-one with Coach Sam is there too. Book a free evaluation to see where they fit.</p>
      <p style="margin:0;"><a href="${appendUtm(`${origin}/#contact-form`, "eval", utmCampaign)}" style="${s.link}font-weight:700;text-decoration:none;">Get a free evaluation &rarr;</a></p>
    </div>`;

  // Forward card — personalized when the signing key is configured so the
  // referral payout (50% off both parents after the friend's first paid
  // session) can attribute correctly. Falls back to a plain forward ask if
  // not. Sharper framing than the old "bring a friend" line.
  const forwardBlock = referralUrl
    ? `
    <div style="${s.cardAccent}">
      <p style="margin:0 0 6px 0;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:${c.accentLime};font-weight:700;">Bring a friend</p>
      <p style="margin:0 0 10px 0;color:${c.text};font-size:14px;line-height:1.55;">Forward this email to one parent whose kid would love this. When they sign up through your link and play their first session, you both get <strong>50% off</strong> your next drop-in.</p>
      <p style="margin:0;color:${c.muted};font-size:12px;line-height:1.5;">Your forward link: <a href="${referralUrl}" style="${s.link}text-decoration:underline;">${escape(referralUrl)}</a></p>
    </div>`
    : `
    <div style="${s.cardAccent}">
      <p style="margin:0;color:${c.text};font-size:14px;line-height:1.55;">Know a kid who&rsquo;d love this? Forward this email &mdash; the community grows because parents like you make the introduction.</p>
    </div>`;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Next Gen this week</title>
</head>
<body style="margin:0;padding:0;background:${c.bgDark};">
  <div style="${s.wrapper}">
    <p style="margin:0 0 6px 0;font-size:12px;letter-spacing:0.15em;text-transform:uppercase;color:${c.accentLime};font-weight:700;">Next Gen this week</p>
    <h1 style="${s.heading} margin:0 0 16px 0;">Where to play, ${escape(parentFirst)}.</h1>
    <p style="margin:0 0 20px 0;color:${c.text};line-height:1.55;">Short, useful, worth opening &mdash; where to play this week, what&rsquo;s new at Next Gen, and one thing to work on between sessions.</p>

    ${whatsappGroupsTopHtml()}

    ${fallBlock}

    ${mvfBlock}

    ${sessionBlock}

    ${laterBlock}

    ${campBlock}

    ${pollsBlock}

    ${crewBlock}

    <h2 style="margin:28px 0 10px 0;font-family:Montserrat,Arial,sans-serif;font-size:16px;color:${c.text};">Coach tip: ${escape(tip.title)}</h2>
    <p style="margin:0;color:${c.text};line-height:1.7;">${escape(tip.body)}</p>

    ${leadBlock}

    ${newsBlock}

    ${privateBlock}

    ${forwardBlock}

    <div style="${s.footer}">
      <p style="margin:0 0 8px 0;color:${c.muted};font-size:13px;line-height:1.6;">
        See you on the court &mdash; better than yesterday, together.<br>
        <strong style="color:${c.text};">Coach Sam &middot; Next Gen Pickleball Academy</strong>
      </p>
      ${phoneLineHtml()}
      <p style="margin:0;color:${c.muted};font-size:11px;line-height:1.5;">
        You&rsquo;re getting this because you joined the Next Gen newsletter.
        <a href="${unsubscribeUrl}" style="color:${c.muted};text-decoration:underline;">Unsubscribe</a>.
      </p>
    </div>
  </div>
</body>
</html>`;
}

export function weeklyNewsletterText(input: WeeklyNewsletterInput): string {
  const {
    parentFirst,
    fallSeason,
    mvfTournament,
    sessions,
    laterSessions,
    openPolls,
    news,
    newsletterLeadText,
    tip,
    scheduleUrl,
    crewInterestUrl,
    unsubscribeUrl,
    referralUrl,
    origin,
    utmCampaign,
    camps,
    campUrl,
    campAgeMin,
    campPriceFromUsd,
  } = input;
  const lines: string[] = [
    `Where to play, ${parentFirst}.`,
    "",
    `Short, useful, worth opening — where to play this week, what's new at Next Gen, and one thing to work on between sessions.`,
    "",
    whatsappGroupsTopText(),
    "",
  ];

  if (fallSeason) {
    lines.push(
      "Fall season — registration is open:",
      `${fallSeason.title} — ${fallSeason.seasonLabel}`,
      `${fallSeason.weeks} Sundays at ${fallSeason.venueLine}. Coached practice first, then a rotating-partner round robin — so your kid plays with everyone in their group across the season, not just the friend they came with. One registration covers all ${fallSeason.weeks} Sundays.`,
      "",
    );
    for (const g of fallSeason.groups) {
      lines.push(`  ${g.label} — ${fallGroupLine(g)}`);
    }
    lines.push(
      "",
      `$${fallSeason.priceUsd} per player for the full season · first come, first serve. Can't make all ${fallSeason.weeks}? Reply and we'll put you on the sub list.`,
      `Register for the season: ${fallSeason.url}`,
      "",
    );
  }

  if (mvfTournament) {
    lines.push(
      "Tournament day — Sept 5:",
      `${mvfTournament.title}`,
      `${mvfTournament.dateLabel}, ${mvfTournament.timeLabel} at ${mvfTournament.venueLine}. Ages ${mvfTournament.ageMin}+ — ${mvfTournament.format.toLowerCase()}, so every pair gets a full morning of games. Brackets: ${mvfTournament.bracketsLabel}.`,
      `$${mvfTournament.priceResidentUsd} resident · $${mvfTournament.priceNonResidentUsd} non-resident, per player · partner required · rain date ${mvfTournament.rainDateLabel}.`,
      `Register with your partner: ${mvfTournament.url}`,
      "",
    );
  }

  if (sessions.length > 0) {
    lines.push(
      "This week's sessions (all times Eastern):",
      "Every signup fills the meter — full courts make the best games. Grab a slot and move it.",
      "",
    );
    for (const g of sessions) {
      lines.push(`${g.dateLong} — ${g.location}`);
      if (g.weatherNote) lines.push(`  Forecast: ${g.weatherNote}`);
      for (const slot of g.slots) {
        lines.push(
          `  ${slot.label} — ${fillBar(slot.registered, slot.goal)} ${fillLabel(slot.registered, slot.goal)}`,
        );
      }
      lines.push("");
    }
    lines.push(`Book a spot: ${scheduleUrl}`, "");
  } else {
    lines.push(
      `No open sessions this week — but new ones post regularly.`,
      `Check the schedule: ${scheduleUrl}`,
      "",
    );
  }

  if (laterSessions.length > 0) {
    lines.push(
      "Further out on the calendar:",
      "Planning ahead? These dates are already on the calendar. Registration for each one opens 30 days out.",
      "",
    );
    for (const g of laterSessions) {
      lines.push(`  ${g.dateLong} — ${g.location}`);
    }
    lines.push("", `See the full schedule: ${scheduleUrl}`, "");
  }

  if (camps.length > 0) {
    lines.push(
      "Summer camp:",
      `Next Gen Summer Pickleball Camp — ages ${campAgeMin}+, half-day mornings, small groups. Single morning or full week. From $${campPriceFromUsd}/day · $150 full week.`,
      "",
    );
    for (const w of camps) {
      lines.push(`  ${w.weekLabel} — ${w.publicArea}`);
    }
    lines.push("", `See camp dates & book: ${campUrl}`, "");
  }

  if (openPolls.length > 0) {
    lines.push("Forming groups now:");
    lines.push("Vote in the slots that work and Sam locks the group in when it hits the headcount.");
    lines.push("");
    for (const p of openPolls) {
      lines.push(`- ${p.title}`);
      const meta = [p.day, pollTimeRange(p), p.location, p.level]
        .filter(Boolean)
        .join(" · ");
      if (meta) lines.push(`  ${meta}`);
      lines.push(`  ${pollProgressLabel(p)}`);
      lines.push(`  Vote: ${appendUtm(`${origin}/poll/${encodeURIComponent(p.slug)}`, "poll", utmCampaign)}`);
      lines.push("");
    }
  }

  lines.push(
    openPolls.length > 0
      ? `None of those fit? Tell us your kid's level and the days that work — Sam looks for 3 more kids who match.`
      : `Want a regular group? Tell us your kid's level and the days that work — Sam looks for 3 more kids who match.`,
    `Find your kid's group: ${crewInterestUrl}`,
    "",
    `Coach tip: ${tip.title}`,
    tip.body,
    "",
  );

  if (newsletterLeadText && newsletterLeadText.trim()) {
    lines.push("From Coach Sam this week", "", newsletterLeadText.trim(), "");
  }

  if (news.length > 0) {
    lines.push("In the news: youth pickleball", "A few stories Sam thought you'd want to see.", "");
    for (const n of news) {
      lines.push(`- ${n.title} (${n.source})`);
      if (n.summary) lines.push(`  ${n.summary}`);
      lines.push(`  ${n.url}`);
      lines.push("");
    }
  }

  lines.push(
    `Brand new to a court? A private one-on-one with Coach Sam gets your kid rallying before they join a group.`,
    `Book a free evaluation: ${appendUtm(`${origin}/#contact-form`, "eval", utmCampaign)}`,
    "",
  );

  if (referralUrl) {
    lines.push(
      `Forward this email to one parent whose kid would love this. When they sign up through your link and play their first session, you both get 50% off your next drop-in.`,
      `Your forward link: ${referralUrl}`,
      "",
    );
  } else {
    lines.push(
      `Know a kid who'd love this? Forward this email — the community grows because parents like you make the introduction.`,
      "",
    );
  }

  lines.push(
    `See you on the court — better than yesterday, together.`,
    `Coach Sam · Next Gen Pickleball Academy`,
    "",
    phoneLineText(),
    "",
    `You're getting this because you joined the Next Gen newsletter.`,
    `Unsubscribe: ${unsubscribeUrl}`,
  );

  return lines.join("\n");
}

function escape(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
