import { c, s } from "./brand";

// EASE pillar: Ethics — an admin-initiated move is honest about the change and
// quietly offers an out. Email-only (no SMS) for v1; a reschedule is usually
// days out, and the .ics-less email + a reply path covers the parent.

interface RescheduleInput {
  parentFirst: string;
  childFirst: string;
  sessionTitle: string;
  oldDateLong: string; // "Saturday, June 20, 2026"
  oldStart: string; // "6:00 PM"
  newDateLong: string; // "Saturday, June 27, 2026"
  newStart: string; // "6:00 PM"
  scheduleUrl: string;
}

export function sessionRescheduledHtml(input: RescheduleInput): string {
  const {
    parentFirst,
    childFirst,
    sessionTitle,
    oldDateLong,
    oldStart,
    newDateLong,
    newStart,
    scheduleUrl,
  } = input;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Session moved &mdash; ${escape(sessionTitle)}</title>
</head>
<body style="margin:0;padding:0;background:${c.bgDark};">
  <div style="${s.wrapper}">
    <p style="margin:0 0 6px 0;font-size:12px;letter-spacing:0.15em;text-transform:uppercase;color:${c.accentYellow};font-weight:700;">Rescheduled</p>
    <h1 style="${s.headingYellow} margin:0 0 16px 0;">${escape(childFirst)}&rsquo;s session moved to ${escape(newDateLong)}.</h1>
    <p style="margin:0 0 16px 0;color:${c.text};line-height:1.55;">
      Hi ${escape(parentFirst)} &mdash; we had to move this one. ${escape(childFirst)}&rsquo;s spot is already carried over to the new date, so there&rsquo;s nothing for you to re-book.
    </p>

    <div style="${s.cardAccent}">
      <p style="margin:0 0 6px 0;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:${c.accentLime};font-weight:700;">Now: ${escape(newDateLong)} &middot; ${escape(newStart)}</p>
      <p style="margin:0 0 4px 0;font-family:Montserrat,Arial,sans-serif;font-size:18px;font-weight:900;color:${c.text};">${escape(sessionTitle)}</p>
      <p style="margin:0;color:${c.muted};font-size:14px;">Was: ${escape(oldDateLong)} &middot; ${escape(oldStart)} &mdash; ${escape(childFirst)}&rsquo;s spot carried over.</p>
    </div>

    <div style="${s.actionCallout}">
      <p style="${s.actionLabel}">Can&rsquo;t make the new time?</p>
      <p style="margin:6px 0 0 0;color:${c.text};font-size:14px;line-height:1.55;">
        Just reply to this email and we&rsquo;ll take care of you &mdash; no hassle.
      </p>
    </div>

    <p style="margin:28px 0 0 0;color:${c.text};line-height:1.55;">
      Want to see what else is on the calendar?
    </p>
    <p style="margin:12px 0 0 0;">
      <a href="${scheduleUrl}" style="${s.link}font-weight:700;text-decoration:none;">View the schedule &rarr;</a>
    </p>

    <div style="${s.footer}">
      <p style="margin:0;color:${c.muted};font-size:13px;line-height:1.6;">
        Thanks for rolling with us &mdash; better than yesterday, together.<br>
        <strong style="color:${c.text};">Coach Sam &middot; Next Gen Pickleball Academy</strong>
      </p>
    </div>
  </div>
</body>
</html>`;
}

export function sessionRescheduledText(input: RescheduleInput): string {
  return [
    `Hi ${input.parentFirst},`,
    "",
    `${input.childFirst}'s session moved to ${input.newDateLong}.`,
    "",
    `We had to move this one. ${input.childFirst}'s spot is already carried over to the new date, so there's nothing for you to re-book.`,
    "",
    `Now: ${input.sessionTitle}`,
    `${input.newDateLong} · ${input.newStart}`,
    `Was: ${input.oldDateLong} · ${input.oldStart} — ${input.childFirst}'s spot carried over.`,
    "",
    `Can't make the new time? Just reply to this email and we'll take care of you — no hassle.`,
    "",
    `View the schedule: ${input.scheduleUrl}`,
    "",
    `Thanks for rolling with us — better than yesterday, together.`,
    `Coach Sam · Next Gen Pickleball Academy`,
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
