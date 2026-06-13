import { c, s } from "./brand";
import { whatsappInviteHtml, whatsappInviteText } from "./whatsapp-invite";

interface RebookInput {
  parentFirst: string;
  childFirst: string;
  sessionTitle: string;
  sessionDateLong: string; // "Saturday, June 6, 2026"
  scheduleUrl: string;
}

// Sent when a registered player was marked No-show. Warm and blame-free — the
// goal is to get them back on the calendar, not to guilt them. No "great reps"
// recap copy (they weren't there) and no 4-week commit upsell (don't push a
// lock-in on someone who just missed one).
export function postSessionRebookHtml(input: RebookInput): string {
  const { parentFirst, childFirst, sessionTitle, sessionDateLong, scheduleUrl } =
    input;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>We missed ${escape(childFirst)} &mdash; the next session is open</title>
</head>
<body style="margin:0;padding:0;background:${c.bgDark};">
  <div style="${s.wrapper}">
    <p style="margin:0 0 6px 0;font-size:12px;letter-spacing:0.15em;text-transform:uppercase;color:${c.accentLime};font-weight:700;">We missed you</p>
    <h1 style="${s.heading} margin:0 0 16px 0;">We missed ${escape(childFirst)} on the court.</h1>
    <p style="margin:0 0 20px 0;color:${c.text};line-height:1.55;">
      No worries, ${escape(parentFirst)} &mdash; life happens. ${escape(childFirst)}&rsquo;s spot in the pathway is always here, and the easiest way back into rhythm is to grab the next session while it&rsquo;s on your mind.
    </p>

    <div style="${s.cardAccent}">
      <p style="margin:0 0 6px 0;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:${c.accentLime};font-weight:700;">Missed: ${escape(sessionDateLong)}</p>
      <p style="margin:0;font-family:Montserrat,Arial,sans-serif;font-size:18px;font-weight:900;color:${c.text};">${escape(sessionTitle)}</p>
    </div>

    <div style="${s.actionCallout}">
      <p style="${s.actionLabel}">Get back on the calendar</p>
      <p style="margin:6px 0 0 0;color:${c.text};font-size:14px;line-height:1.55;">
        Sessions cap at 4 players per court and the good times fill 7&ndash;14 days out. Pick the next one that fits and we&rsquo;ll see ${escape(childFirst)} there.
      </p>
      <p style="margin:14px 0 0 0;">
        <a href="${scheduleUrl}" style="${s.link}font-weight:700;text-decoration:none;">Grab the next session &rarr;</a>
      </p>
    </div>

    <p style="margin:24px 0 0 0;color:${c.text};line-height:1.55;">
      If something came up that we should know about &mdash; scheduling, fit, anything &mdash; just reply to this email. We&rsquo;re here to help ${escape(childFirst)} keep climbing.
    </p>

    ${whatsappInviteHtml()}

    <div style="${s.footer}">
      <p style="margin:0 0 8px 0;color:${c.muted};font-size:13px;line-height:1.6;">
        Better than yesterday, together.<br>
        <strong style="color:${c.text};">Coach Sam &middot; Next Gen Pickleball Academy</strong>
      </p>
      <p style="margin:0;color:${c.muted};font-size:11px;line-height:1.5;">
        We send this one note after a missed session. If you&rsquo;d rather we skip it, just reply &ldquo;skip&rdquo; and we&rsquo;ll stop.
      </p>
    </div>
  </div>
</body>
</html>`;
}

export function postSessionRebookText(input: RebookInput): string {
  return [
    `Hi ${input.parentFirst},`,
    "",
    `We missed ${input.childFirst} on the court.`,
    "",
    `No worries — life happens. ${input.childFirst}'s spot in the pathway is always here, and the easiest way back into rhythm is to grab the next session while it's on your mind.`,
    "",
    `Missed: ${input.sessionDateLong}`,
    `${input.sessionTitle}`,
    "",
    `Get back on the calendar — sessions cap at 4 players per court and the good times fill 7–14 days out.`,
    `Grab the next session: ${input.scheduleUrl}`,
    "",
    `If something came up that we should know about — scheduling, fit, anything — just reply to this email. We're here to help ${input.childFirst} keep climbing.`,
    "",
    whatsappInviteText(),
    "",
    `Better than yesterday, together.`,
    `Coach Sam · Next Gen Pickleball Academy`,
    "",
    `We send this one note after a missed session. If you'd rather we skip it, just reply "skip" and we'll stop.`,
  ].join("\n");
}

function escape(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
