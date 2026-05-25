import { c, s } from "./brand";
import type { CoachTip } from "@/lib/newsletter-tips";

/** One open time slot within a date+location group. */
export interface NewsletterSessionSlot {
  label: string; // "4:30–5:30 PM"
  spotsLeft: number;
  capacity: number;
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

export interface WeeklyNewsletterInput {
  parentFirst: string;
  sessions: NewsletterSessionGroup[];
  openPolls: NewsletterOpenPoll[];
  /** Approved youth-pickleball news items from the scraper queue. Empty hides the block. */
  news: NewsletterNewsItem[];
  tip: CoachTip;
  scheduleUrl: string;
  crewInterestUrl: string;
  unsubscribeUrl: string;
  /** Personalized forward URL: /newsletter?ref=<signed-token>. Null when the signing key isn't configured. */
  referralUrl: string | null;
  /** Site origin for absolute links inside the poll cards. */
  origin: string;
}

/** Honest, scannable spots phrasing. Low counts get urgency; never faked. */
export function spotsLabel(spotsLeft: number, capacity: number): string {
  if (spotsLeft <= 0) return "Full";
  if (spotsLeft <= 3) return `only ${spotsLeft} spot${spotsLeft === 1 ? "" : "s"} left`;
  return `${spotsLeft} of ${capacity} spots left`;
}

function pollTimeRange(p: NewsletterOpenPoll): string {
  if (!p.startTime) return "";
  return p.endTime ? `${p.startTime}–${p.endTime}` : p.startTime;
}

function pollProgressLabel(p: NewsletterOpenPoll): string {
  const need = Math.max(0, p.minPartySize - p.yesCount);
  if (need <= 0) return "Crew locked — Sam will text the WhatsApp group";
  return `${p.yesCount} in · need ${need} more to lock the crew`;
}

export function weeklyNewsletterHtml(input: WeeklyNewsletterInput): string {
  const {
    parentFirst,
    sessions,
    openPolls,
    news,
    tip,
    scheduleUrl,
    crewInterestUrl,
    unsubscribeUrl,
    referralUrl,
    origin,
  } = input;
  const hasSessions = sessions.length > 0;
  const hasPolls = openPolls.length > 0;
  const hasNews = news.length > 0;

  const sessionBlock = hasSessions
    ? `
    <p style="margin:0 0 6px 0;font-size:12px;letter-spacing:0.15em;text-transform:uppercase;color:${c.accentLime};font-weight:700;">This week&rsquo;s sessions</p>
    <p style="margin:0 0 14px 0;color:${c.muted};font-size:13px;">All times Eastern. Spots cap at 4 players per court and fill from the front &mdash; grab one early.</p>
    ${sessions
      .map(
        (g) => `<div style="${s.card}">
      <p style="margin:0 0 4px 0;font-family:Montserrat,Arial,sans-serif;font-size:16px;font-weight:900;color:${c.text};">${escape(g.dateLong)}</p>
      <p style="margin:0 0 ${g.weatherNote ? "2px" : "8px"} 0;color:${c.muted};font-size:13px;">${escape(g.location)}</p>
      ${g.weatherNote ? `<p style="margin:0 0 8px 0;color:${c.muted};font-size:13px;">Forecast: ${escape(g.weatherNote)}</p>` : ""}
      ${g.slots
        .map(
          (slot) =>
            `<p style="margin:0 0 2px 0;color:${c.text};font-size:14px;">${escape(slot.label)} &mdash; <span style="color:${c.accentLime};font-weight:700;">${escape(spotsLabel(slot.spotsLeft, slot.capacity))}</span></p>`,
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

  const pollsBlock = hasPolls
    ? `
    <h2 style="margin:32px 0 6px 0;font-family:Montserrat,Arial,sans-serif;font-size:18px;color:${c.text};">Forming crews now</h2>
    <p style="margin:0 0 14px 0;color:${c.muted};font-size:13px;">Vote in the slots that work and Sam locks the crew when it hits the headcount.</p>
    ${openPolls
      .map(
        (p) => `<div style="${s.card}">
      <p style="margin:0 0 4px 0;font-family:Montserrat,Arial,sans-serif;font-size:15px;font-weight:900;color:${c.text};">${escape(p.title)}</p>
      <p style="margin:0 0 6px 0;color:${c.muted};font-size:13px;">${escape([p.day, pollTimeRange(p), p.location, p.level].filter(Boolean).join(" · "))}</p>
      <p style="margin:0 0 10px 0;color:${c.accentLime};font-size:13px;font-weight:700;">${escape(pollProgressLabel(p))}</p>
      <p style="margin:0;"><a href="${origin}/poll/${encodeURIComponent(p.slug)}" style="${s.link}font-weight:700;text-decoration:none;">Vote on this slot &rarr;</a></p>
    </div>`,
      )
      .join("")}`
    : "";

  // Crew Interest CTA — surfaced when no polls match, or as a low-pressure
  // "tell us what you want" anchor when polls are open. Always render.
  const crewBlock = `
    <div style="${s.cardAccent}">
      <p style="margin:0 0 6px 0;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:${c.accentLime};font-weight:700;">${hasPolls ? "None of these fit?" : "Want a regular crew?"}</p>
      <p style="margin:0 0 10px 0;color:${c.text};font-size:14px;line-height:1.55;">Tell us your kid&rsquo;s level and the days that work &mdash; Sam looks for 3 more kids who match and texts the WhatsApp link when the slot has takers.</p>
      <p style="margin:0;"><a href="${crewInterestUrl}" style="${s.link}font-weight:700;text-decoration:none;">Find your kid&rsquo;s crew &rarr;</a></p>
    </div>`;

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

  // Private lessons card — Red and Orange Ball are private-lesson-only per
  // CLAUDE.md. Routes to the lead form on the home page (#contact-form).
  const privateBlock = `
    <div style="${s.card}">
      <p style="margin:0 0 6px 0;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:${c.muted};font-weight:700;">Brand new to a court?</p>
      <p style="margin:0 0 10px 0;color:${c.text};font-size:14px;line-height:1.55;">If your kid hasn&rsquo;t held a paddle yet, a private one-on-one with Coach Sam is the right first step &mdash; we&rsquo;ll get them rallying before they join a crew. Book a free evaluation to see where they fit.</p>
      <p style="margin:0;"><a href="${origin}/#contact-form" style="${s.link}font-weight:700;text-decoration:none;">Get a free evaluation &rarr;</a></p>
    </div>`;

  // Forward card — personalized when the signing key is configured so the
  // referral payout (50% off both parents after the friend's first paid
  // session) can attribute correctly. Falls back to a plain forward ask if
  // not. Sharper framing than the old "bring a friend" line.
  const forwardBlock = referralUrl
    ? `
    <div style="${s.cardAccent}">
      <p style="margin:0 0 6px 0;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:${c.accentLime};font-weight:700;">Bring the crew</p>
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
    <p style="margin:0 0 20px 0;color:${c.text};line-height:1.55;">Short, useful, worth opening. Here&rsquo;s where to play this week, the crews forming now, and one thing to work on between sessions.</p>

    ${sessionBlock}

    ${pollsBlock}

    ${crewBlock}

    <h2 style="margin:28px 0 10px 0;font-family:Montserrat,Arial,sans-serif;font-size:16px;color:${c.text};">Coach tip: ${escape(tip.title)}</h2>
    <p style="margin:0;color:${c.text};line-height:1.7;">${escape(tip.body)}</p>

    ${newsBlock}

    ${privateBlock}

    ${forwardBlock}

    <div style="${s.footer}">
      <p style="margin:0 0 8px 0;color:${c.muted};font-size:13px;line-height:1.6;">
        See you on the court &mdash; better than yesterday, together.<br>
        <strong style="color:${c.text};">Coach Sam &middot; Next Gen Pickleball Academy</strong>
      </p>
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
    sessions,
    openPolls,
    news,
    tip,
    scheduleUrl,
    crewInterestUrl,
    unsubscribeUrl,
    referralUrl,
    origin,
  } = input;
  const lines: string[] = [
    `Where to play, ${parentFirst}.`,
    "",
    `Short, useful, worth opening. Here's where to play this week, the crews forming now, and one thing to work on between sessions.`,
    "",
  ];

  if (sessions.length > 0) {
    lines.push(
      "This week's sessions (all times Eastern):",
      "Spots cap at 4 players per court and fill from the front — grab one early.",
      "",
    );
    for (const g of sessions) {
      lines.push(`${g.dateLong} — ${g.location}`);
      if (g.weatherNote) lines.push(`  Forecast: ${g.weatherNote}`);
      for (const slot of g.slots) {
        lines.push(`  ${slot.label} — ${spotsLabel(slot.spotsLeft, slot.capacity)}`);
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

  if (openPolls.length > 0) {
    lines.push("Forming crews now:");
    lines.push("Vote in the slots that work and Sam locks the crew when it hits the headcount.");
    lines.push("");
    for (const p of openPolls) {
      lines.push(`- ${p.title}`);
      const meta = [p.day, pollTimeRange(p), p.location, p.level]
        .filter(Boolean)
        .join(" · ");
      if (meta) lines.push(`  ${meta}`);
      lines.push(`  ${pollProgressLabel(p)}`);
      lines.push(`  Vote: ${origin}/poll/${encodeURIComponent(p.slug)}`);
      lines.push("");
    }
  }

  lines.push(
    openPolls.length > 0
      ? `None of those fit? Tell us your kid's level and the days that work — Sam looks for 3 more kids who match.`
      : `Want a regular crew? Tell us your kid's level and the days that work — Sam looks for 3 more kids who match.`,
    `Find your kid's crew: ${crewInterestUrl}`,
    "",
    `Coach tip: ${tip.title}`,
    tip.body,
    "",
  );

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
    `Brand new to a court? A private one-on-one with Coach Sam gets your kid rallying before they join a crew.`,
    `Book a free evaluation: ${origin}/#contact-form`,
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
