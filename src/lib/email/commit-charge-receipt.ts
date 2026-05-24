import { c, s } from "./brand";

interface CommitChargeReceiptInput {
  parentFirst: string;
  childFirst: string;
  sessionTitle: string;
  sessionDateLong: string;
  sessionStartTime: string;
  location: string;
  amountUsd: number;
  weeksReservedSoFar: number;
  weeksCommitted: number;
  cardLast4: string;
  cancelUrl: string;
  manageUrl: string;
}

export function commitChargeReceiptHtml(input: CommitChargeReceiptInput): string {
  const {
    parentFirst,
    childFirst,
    sessionTitle,
    sessionDateLong,
    sessionStartTime,
    location,
    amountUsd,
    weeksReservedSoFar,
    weeksCommitted,
    cardLast4,
    cancelUrl,
    manageUrl,
  } = input;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escape(childFirst)}&rsquo;s spot is reserved &mdash; ${escape(sessionDateLong)}</title>
</head>
<body style="margin:0;padding:0;background:${c.bgDark};">
  <div style="${s.wrapper}">
    <p style="margin:0 0 6px 0;font-size:12px;letter-spacing:0.15em;text-transform:uppercase;color:${c.accentLime};font-weight:700;">Week ${weeksReservedSoFar} of ${weeksCommitted}</p>
    <h1 style="${s.heading} margin:0 0 16px 0;">${escape(childFirst)}&rsquo;s spot is reserved.</h1>
    <p style="margin:0 0 20px 0;color:${c.text};line-height:1.55;">
      Hi ${escape(parentFirst)} &mdash; we just charged $${amountUsd.toFixed(0)} to the card ending in ${escape(cardLast4)} and reserved ${escape(childFirst)}&rsquo;s next session.
    </p>

    <div style="${s.cardAccent}">
      <p style="margin:0 0 6px 0;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:${c.accentLime};font-weight:700;">${escape(sessionDateLong)} &middot; ${escape(sessionStartTime)}</p>
      <p style="margin:0 0 4px 0;font-family:Montserrat,Arial,sans-serif;font-size:18px;font-weight:900;color:${c.text};">${escape(sessionTitle)}</p>
      <p style="margin:0;color:${c.muted};font-size:13px;">${escape(location)}</p>
    </div>

    <div style="${s.actionCallout}">
      <p style="${s.actionLabel}">Can&rsquo;t make this one?</p>
      <p style="margin:6px 0 0 0;color:${c.text};font-size:14px;line-height:1.55;">
        Skip this week and we&rsquo;ll refund the $${amountUsd.toFixed(0)}. Your spot in the crew stays put for the remaining weeks.
      </p>
      <p style="margin:14px 0 0 0;">
        <a href="${cancelUrl}" style="${s.link}font-weight:700;text-decoration:none;">Skip this week &rarr;</a>
      </p>
    </div>

    <div style="${s.footer}">
      <p style="margin:0 0 8px 0;color:${c.muted};font-size:13px;line-height:1.6;">
        See you on court.<br>
        <strong style="color:${c.text};">Coach Sam &middot; Next Gen Pickleball Academy</strong>
      </p>
      <p style="margin:0;color:${c.muted};font-size:11px;line-height:1.5;">
        Manage your 4-week commit (pause, change card, cancel): <a href="${manageUrl}" style="${s.link}">link</a>
      </p>
    </div>
  </div>
</body>
</html>`;
}

export function commitChargeReceiptText(input: CommitChargeReceiptInput): string {
  return [
    `Hi ${input.parentFirst},`,
    "",
    `${input.childFirst}'s spot is reserved (week ${input.weeksReservedSoFar} of ${input.weeksCommitted}).`,
    "",
    `${input.sessionDateLong} · ${input.sessionStartTime}`,
    `${input.sessionTitle}`,
    `${input.location}`,
    "",
    `We charged $${input.amountUsd.toFixed(0)} to the card ending in ${input.cardLast4}.`,
    "",
    `Can't make it? Skip this week and we'll refund: ${input.cancelUrl}`,
    "",
    `Manage your 4-week commit: ${input.manageUrl}`,
    "",
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
