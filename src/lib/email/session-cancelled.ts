import { c, s } from "./brand";

export type CancelReason = "weather" | "venue" | "low-enrollment" | "other";

interface CancelInput {
  parentFirst: string;
  childFirst: string;
  sessionTitle: string;
  sessionDateLong: string; // "Saturday, May 23, 2026"
  sessionStart: string; // "5:30 PM"
  reason: CancelReason;
  /** Optional Coach-voice freeform context. Shown verbatim after the headline. */
  note?: string;
  amountRefunded: string; // "40.00"
  scheduleUrl: string;
}

function reasonHeadline(reason: CancelReason): string {
  // Headlines stay date-agnostic — the cron can fire 24h out (weather) or
  // a week out (low-enrollment). The session date is shown in the card
  // below; parents don't need it duplicated in the eyebrow.
  switch (reason) {
    case "weather":
      return "Weather call — this session is off.";
    case "venue":
      return "Venue issue — this session is off.";
    case "low-enrollment":
      return "We're rescheduling this one.";
    case "other":
      return "Heads up — this session is cancelled.";
  }
}

function reasonBody(reason: CancelReason): string {
  switch (reason) {
    case "weather":
      return "The forecast crossed the line we hold for outdoor play. Safer to wait for a clean court than to grind through the bad one.";
    case "venue":
      return "The venue's not available — outside our control. We're sorry for the late notice.";
    case "low-enrollment":
      return "We didn't hit the player count we need to run a real session. Rather than thin reps, we're pulling this one and you'll see a stronger lineup on the next date.";
    case "other":
      return "We had to pull this session. Full details next time we see you on the court.";
  }
}

export function sessionCancelledHtml(input: CancelInput): string {
  const {
    parentFirst,
    childFirst,
    sessionTitle,
    sessionDateLong,
    sessionStart,
    reason,
    note,
    amountRefunded,
    scheduleUrl,
  } = input;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Session cancelled &mdash; ${escape(sessionTitle)}</title>
</head>
<body style="margin:0;padding:0;background:${c.bgDark};">
  <div style="${s.wrapper}">
    <p style="margin:0 0 6px 0;font-size:12px;letter-spacing:0.15em;text-transform:uppercase;color:${c.accentYellow};font-weight:700;">Cancelled</p>
    <h1 style="${s.headingYellow} margin:0 0 16px 0;">${escape(reasonHeadline(reason))}</h1>
    <p style="margin:0 0 16px 0;color:${c.text};line-height:1.55;">
      Hi ${escape(parentFirst)} &mdash; ${escape(reasonBody(reason))}
    </p>
    ${
      note
        ? `<p style="margin:0 0 20px 0;color:${c.text};line-height:1.55;font-style:italic;">${escape(note)}</p>`
        : ""
    }

    <div style="${s.cardAccent}">
      <p style="margin:0 0 6px 0;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:${c.accentLime};font-weight:700;">Was: ${escape(sessionDateLong)} &middot; ${escape(sessionStart)}</p>
      <p style="margin:0 0 4px 0;font-family:Montserrat,Arial,sans-serif;font-size:18px;font-weight:900;color:${c.text};">${escape(sessionTitle)}</p>
      <p style="margin:0;color:${c.muted};font-size:14px;">Reservation for ${escape(childFirst)} &mdash; cancelled.</p>
    </div>

    <div style="${s.actionCallout}">
      <p style="${s.actionLabel}">Your $${escape(amountRefunded)} is on the way back.</p>
      <p style="margin:6px 0 0 0;color:${c.text};font-size:14px;line-height:1.55;">
        Full refund issued to the card on file. Stripe usually has it on your statement in 5&ndash;10 business days. No action needed on your end &mdash; that&rsquo;s on us.
      </p>
    </div>

    <p style="margin:28px 0 0 0;color:${c.text};line-height:1.55;">
      When the next session opens, ${escape(childFirst)}&rsquo;s spot is wide open.
    </p>
    <p style="margin:12px 0 0 0;">
      <a href="${scheduleUrl}" style="${s.link}font-weight:700;text-decoration:none;">Find another session &rarr;</a>
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

export function sessionCancelledText(input: CancelInput): string {
  return [
    `Hi ${input.parentFirst},`,
    "",
    reasonHeadline(input.reason),
    "",
    reasonBody(input.reason),
    ...(input.note ? ["", input.note] : []),
    "",
    `Was: ${input.sessionTitle}`,
    `${input.sessionDateLong} · ${input.sessionStart}`,
    `Reservation for ${input.childFirst} — cancelled.`,
    "",
    `Your $${input.amountRefunded} is on the way back.`,
    `Full refund issued to the card on file. Stripe usually has it on your statement in 5–10 business days. No action needed on your end — that's on us.`,
    "",
    `When the next session opens, ${input.childFirst}'s spot is wide open.`,
    `Find another session: ${input.scheduleUrl}`,
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
