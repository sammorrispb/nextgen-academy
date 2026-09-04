import { c, s } from "./brand";
import {
  phoneLineHtml,
  phoneLineText,
  whatsappGroupsTopHtml,
  whatsappGroupsTopText,
} from "./signature";

interface NewsletterWelcomeInput {
  parentFirst: string;
  childFirst?: string;
  scheduleUrl: string;
  /** /crew route — surfaced as the "I want a regular crew" next step. */
  crewInterestUrl?: string;
}

export function newsletterWelcomeHtml(input: NewsletterWelcomeInput): string {
  const { parentFirst, childFirst, scheduleUrl, crewInterestUrl } = input;
  const kid = childFirst?.trim() ? escape(childFirst) : "your kid";

  // A plain forward ask, on purpose. The personalized referral link and its
  // "you both get 50% off" perk came out 2026-09-03 (the referral program isn't
  // set up), here and in the weekly issue together — this card used to promise
  // that every Thursday issue carries the link.
  const forwardBlock = `
    <div style="${s.cardAccent}">
      <p style="margin:0 0 6px 0;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:${c.accentLime};font-weight:700;">Bring the crew</p>
      <p style="margin:0;color:${c.text};font-size:14px;line-height:1.55;">
        Know another kid who&rsquo;d love this? Forward this email &mdash; the community grows because parents like you make the introduction.
      </p>
    </div>`;

  const crewBlock = crewInterestUrl
    ? `
    <div style="${s.card}">
      <p style="margin:0 0 6px 0;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:${c.muted};font-weight:700;">Want a regular crew?</p>
      <p style="margin:0 0 10px 0;color:${c.text};font-size:14px;line-height:1.55;">
        If you&rsquo;d rather play with the same four kids every week than drop in, tell us your level and the days that work &mdash; Sam looks for 3 more kids who match.
      </p>
      <p style="margin:0;"><a href="${crewInterestUrl}" style="${s.link}font-weight:700;text-decoration:none;">Find your kid&rsquo;s crew &rarr;</a></p>
    </div>`
    : "";

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>You&rsquo;re in the crew, ${escape(parentFirst)}</title>
</head>
<body style="margin:0;padding:0;background:${c.bgDark};">
  <div style="${s.wrapper}">
    <p style="margin:0 0 6px 0;font-size:12px;letter-spacing:0.15em;text-transform:uppercase;color:${c.accentLime};font-weight:700;">Welcome</p>
    <h1 style="${s.heading} margin:0 0 16px 0;">You&rsquo;re in the crew, ${escape(parentFirst)}.</h1>
    <p style="margin:0 0 20px 0;color:${c.text};line-height:1.55;">
      Montgomery County&rsquo;s youth pickleball crew is growing, and ${kid} just got a spot in the loop. Here&rsquo;s what lands in your inbox from here on out.
    </p>

    <h2 style="margin:28px 0 10px 0;font-family:Montserrat,Arial,sans-serif;font-size:16px;color:${c.text};">What to expect</h2>
    <ul style="margin:0;padding-left:18px;color:${c.text};line-height:1.7;">
      <li>This week&rsquo;s drop-in session times, before they fill</li>
      <li>The crews forming now &mdash; vote in the slots that work for your kid</li>
      <li>Coach tips and the occasional &ldquo;how your kid gets better&rdquo; note</li>
    </ul>

    ${whatsappGroupsTopHtml()}

    <div style="${s.actionCallout}">
      <p style="${s.actionLabel}">Start playing</p>
      <p style="margin:6px 0 0 0;color:${c.text};font-size:14px;line-height:1.55;">
        Sessions cap at 4 players per court and the good times fill fast. See what&rsquo;s open this week.
      </p>
      <p style="margin:14px 0 0 0;">
        <a href="${scheduleUrl}" style="${s.link}font-weight:700;text-decoration:none;">See this week&rsquo;s sessions &rarr;</a>
      </p>
    </div>

    ${crewBlock}

    ${forwardBlock}


    <div style="${s.footer}">
      <p style="margin:0 0 8px 0;color:${c.muted};font-size:13px;line-height:1.6;">
        Better than yesterday, together.<br>
        <strong style="color:${c.text};">Coach Sam &middot; Next Gen Pickleball Academy</strong>
      </p>
      ${phoneLineHtml()}
      <p style="margin:0;color:${c.muted};font-size:11px;line-height:1.5;">
        We&rsquo;ll only send you where to play and how your kid gets better. If you&rsquo;d rather we stop, just reply &ldquo;skip&rdquo; and we&rsquo;ll take you off the list.
      </p>
    </div>
  </div>
</body>
</html>`;
}

export function newsletterWelcomeText(input: NewsletterWelcomeInput): string {
  const kid = input.childFirst?.trim() ? input.childFirst : "your kid";
  const lines: string[] = [
    `You're in the crew, ${input.parentFirst}.`,
    "",
    `Montgomery County's youth pickleball crew is growing, and ${kid} just got a spot in the loop. Here's what lands in your inbox from here on out.`,
    "",
    `What to expect:`,
    `- This week's drop-in session times, before they fill`,
    `- The crews forming now — vote in the slots that work for your kid`,
    `- Coach tips and the occasional "how your kid gets better" note`,
    "",
    whatsappGroupsTopText(),
    "",
    `Start playing — sessions cap at 4 players per court and the good times fill fast.`,
    `See this week's sessions: ${input.scheduleUrl}`,
    "",
  ];

  if (input.crewInterestUrl) {
    lines.push(
      `Want a regular crew? If you'd rather play with the same four kids every week, tell us your level and the days that work — Sam looks for 3 more kids who match.`,
      `Find your kid's crew: ${input.crewInterestUrl}`,
      "",
    );
  }

  lines.push(
    `Bring the crew: know another kid who'd love this? Forward this email — the community grows because parents like you make the introduction.`,
    "",
  );

  lines.push(
    "",
    `Better than yesterday, together.`,
    `Coach Sam · Next Gen Pickleball Academy`,
    "",
    phoneLineText(),
    "",
    `We'll only send you where to play and how your kid gets better. If you'd rather we stop, just reply "skip" and we'll take you off the list.`,
  );
  return lines.join("\n");
}

function escape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
