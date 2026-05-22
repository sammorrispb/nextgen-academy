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

export interface WeeklyNewsletterInput {
  parentFirst: string;
  sessions: NewsletterSessionGroup[];
  tip: CoachTip;
  scheduleUrl: string;
  unsubscribeUrl: string;
}

/** Honest, scannable spots phrasing. Low counts get urgency; never faked. */
export function spotsLabel(spotsLeft: number, capacity: number): string {
  if (spotsLeft <= 0) return "Full";
  if (spotsLeft <= 3) return `only ${spotsLeft} spot${spotsLeft === 1 ? "" : "s"} left`;
  return `${spotsLeft} of ${capacity} spots left`;
}

export function weeklyNewsletterHtml(input: WeeklyNewsletterInput): string {
  const { parentFirst, sessions, tip, scheduleUrl, unsubscribeUrl } = input;
  const hasSessions = sessions.length > 0;

  const sessionBlock = hasSessions
    ? `
    <p style="margin:0 0 6px 0;font-size:12px;letter-spacing:0.15em;text-transform:uppercase;color:${c.accentLime};font-weight:700;">This week's sessions</p>
    <p style="margin:0 0 14px 0;color:${c.muted};font-size:13px;">All times Eastern. Spots cap at 4 players per court and fill from the front — grab one early.</p>
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
        <a href="${scheduleUrl}" style="${s.link}font-weight:700;text-decoration:none;">See this week's sessions &rarr;</a>
      </p>
    </div>`
    : `
    <div style="${s.cardAccent}">
      <p style="margin:0 0 6px 0;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:${c.accentLime};font-weight:700;">This week</p>
      <p style="margin:0;color:${c.text};font-size:14px;line-height:1.55;">No open sessions this week — but new ones post regularly. <a href="${scheduleUrl}" style="${s.link}font-weight:700;text-decoration:none;">Check the schedule &rarr;</a></p>
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
    <p style="margin:0 0 20px 0;color:${c.text};line-height:1.55;">Short, useful, worth opening. Here's where to play this week and one thing to work on between sessions.</p>

    ${sessionBlock}

    <h2 style="margin:28px 0 10px 0;font-family:Montserrat,Arial,sans-serif;font-size:16px;color:${c.text};">Coach tip: ${escape(tip.title)}</h2>
    <p style="margin:0;color:${c.text};line-height:1.7;">${escape(tip.body)}</p>

    <div style="${s.card}">
      <p style="margin:0;color:${c.text};font-size:14px;line-height:1.55;">Monthly training spots open up soon, and the crew gets first dibs. Keep an eye on this inbox.</p>
    </div>

    <div style="${s.cardAccent}">
      <p style="margin:0;color:${c.text};font-size:14px;line-height:1.55;">Know a kid who'd love this? Forward this email — bring a friend and you both play for crew price.</p>
    </div>

    <div style="${s.footer}">
      <p style="margin:0 0 8px 0;color:${c.muted};font-size:13px;line-height:1.6;">
        See you on the court — better than yesterday, together.<br>
        <strong style="color:${c.text};">Coach Sam &middot; Next Gen Pickleball Academy</strong>
      </p>
      <p style="margin:0;color:${c.muted};font-size:11px;line-height:1.5;">
        You're getting this because you joined the Next Gen newsletter.
        <a href="${unsubscribeUrl}" style="color:${c.muted};text-decoration:underline;">Unsubscribe</a>.
      </p>
    </div>
  </div>
</body>
</html>`;
}

export function weeklyNewsletterText(input: WeeklyNewsletterInput): string {
  const { parentFirst, sessions, tip, scheduleUrl, unsubscribeUrl } = input;
  const lines: string[] = [
    `Where to play, ${parentFirst}.`,
    "",
    `Short, useful, worth opening. Here's where to play this week and one thing to work on between sessions.`,
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

  lines.push(
    `Coach tip: ${tip.title}`,
    tip.body,
    "",
    `Monthly training spots open up soon, and the crew gets first dibs. Keep an eye on this inbox.`,
    "",
    `Know a kid who'd love this? Forward this email — bring a friend and you both play for crew price.`,
    "",
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
