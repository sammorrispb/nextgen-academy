import { c, s } from "./brand";

interface CrewInterestWelcomeInput {
  parentFirst: string;
  childFirst: string;
  preferredSummary: string;
  newsletterUrl: string;
}

/**
 * Sent to a parent who fills out the Crew Interest form when no Open poll
 * matches their preferred day/level. EASE = Community — we're listening, your
 * kid + 3 others is a crew, we'll text the WhatsApp link the moment a poll
 * for your slot goes live.
 */
export function crewInterestWelcomeHtml(input: CrewInterestWelcomeInput): string {
  const { parentFirst, childFirst, preferredSummary, newsletterUrl } = input;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>We&rsquo;re looking for ${escape(childFirst)}&rsquo;s crew</title>
</head>
<body style="margin:0;padding:0;background:${c.bgDark};">
  <div style="${s.wrapper}">
    <p style="margin:0 0 6px 0;font-size:12px;letter-spacing:0.15em;text-transform:uppercase;color:${c.accentLime};font-weight:700;">Got it</p>
    <h1 style="${s.heading} margin:0 0 16px 0;">We&rsquo;re looking for ${escape(childFirst)}&rsquo;s crew, ${escape(parentFirst)}.</h1>
    <p style="margin:0 0 20px 0;color:${c.text};line-height:1.55;">
      Thanks for telling us what works. Same four kids every week, same court, same time &mdash; that&rsquo;s how skills actually compound. Here&rsquo;s what happens next.
    </p>

    <div style="${s.card}">
      <p style="margin:0 0 6px 0;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:${c.muted};font-weight:700;">What you told us</p>
      <p style="margin:0;color:${c.text};font-size:14px;line-height:1.55;">${escape(preferredSummary)}</p>
    </div>

    <h2 style="margin:28px 0 10px 0;font-family:Montserrat,Arial,sans-serif;font-size:16px;color:${c.text};">What happens next</h2>
    <ul style="margin:0;padding-left:18px;color:${c.text};line-height:1.7;">
      <li>Sam looks for 3 more kids at ${escape(childFirst)}&rsquo;s level who can make the same day and court.</li>
      <li>When there are enough takers, Sam shares a WhatsApp link &mdash; one tap to vote you in.</li>
      <li>Hit the minimum and the crew locks in. Four weeks, same slot, same kids.</li>
    </ul>

    <div style="${s.cardAccent}">
      <p style="margin:0 0 6px 0;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:${c.accentLime};font-weight:700;">Want to play this week?</p>
      <p style="margin:0;color:${c.text};font-size:14px;line-height:1.55;">
        While we&rsquo;re building the crew, ${escape(childFirst)} can drop in on any open session. The weekly newsletter shows everything that&rsquo;s open &mdash; you&rsquo;re already on the list.
      </p>
    </div>

    <div style="${s.actionCallout}">
      <p style="${s.actionLabel}">See open sessions</p>
      <p style="margin:14px 0 0 0;">
        <a href="${newsletterUrl}" style="${s.link}font-weight:700;text-decoration:none;">Check this week&rsquo;s schedule &rarr;</a>
      </p>
    </div>

    <div style="${s.footer}">
      <p style="margin:0 0 8px 0;color:${c.muted};font-size:13px;line-height:1.6;">
        Better than yesterday, together.<br>
        <strong style="color:${c.text};">Coach Sam &middot; Next Gen Pickleball Academy</strong>
      </p>
      <p style="margin:0;color:${c.muted};font-size:11px;line-height:1.5;">
        Reply to this email any time &mdash; that&rsquo;s the fastest way to reach Sam.
      </p>
    </div>
  </div>
</body>
</html>`;
}

export function crewInterestWelcomeText(input: CrewInterestWelcomeInput): string {
  const { parentFirst, childFirst, preferredSummary, newsletterUrl } = input;
  return [
    `We're looking for ${childFirst}'s crew, ${parentFirst}.`,
    "",
    `Thanks for telling us what works. Same four kids every week, same court, same time — that's how skills actually compound. Here's what happens next.`,
    "",
    `What you told us:`,
    preferredSummary,
    "",
    `What happens next:`,
    `- Sam looks for 3 more kids at ${childFirst}'s level who can make the same day and court.`,
    `- When there are enough takers, Sam shares a WhatsApp link — one tap to vote you in.`,
    `- Hit the minimum and the crew locks in. Four weeks, same slot, same kids.`,
    "",
    `Want to play this week? While we're building the crew, ${childFirst} can drop in on any open session — the weekly newsletter shows everything that's open.`,
    "",
    `See open sessions: ${newsletterUrl}`,
    "",
    `Better than yesterday, together.`,
    `Coach Sam · Next Gen Pickleball Academy`,
    "",
    `Reply to this email any time — that's the fastest way to reach Sam.`,
  ].join("\n");
}

function escape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
