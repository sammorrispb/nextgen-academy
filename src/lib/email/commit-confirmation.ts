import { c, s } from "./brand";

interface CommitConfirmationInput {
  parentFirst: string;
  childFirst: string;
  crewDescription: string;
  weeksCommitted: number;
  cardLast4: string;
  manageUrl: string;
}

export function commitConfirmationHtml(input: CommitConfirmationInput): string {
  const { parentFirst, childFirst, crewDescription, weeksCommitted, cardLast4, manageUrl } =
    input;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escape(childFirst)} is locked in for ${weeksCommitted} weeks</title>
</head>
<body style="margin:0;padding:0;background:${c.bgDark};">
  <div style="${s.wrapper}">
    <p style="margin:0 0 6px 0;font-size:12px;letter-spacing:0.15em;text-transform:uppercase;color:${c.accentLime};font-weight:700;">Locked in</p>
    <h1 style="${s.heading} margin:0 0 16px 0;">${escape(childFirst)} is in for ${weeksCommitted} weeks, ${escape(parentFirst)}.</h1>
    <p style="margin:0 0 20px 0;color:${c.text};line-height:1.55;">
      ${escape(crewDescription)}. ${escape(childFirst)}&rsquo;s name now auto-reserves into each weekly session and we charge $40 to the card ending in ${escape(cardLast4)} the morning each spot opens. Skip a week any time &mdash; we&rsquo;ll refund automatically.
    </p>

    <div style="${s.cardAccent}">
      <p style="margin:0 0 6px 0;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:${c.accentLime};font-weight:700;">What to expect</p>
      <ul style="margin:0;padding-left:18px;color:${c.text};line-height:1.7;font-size:14px;">
        <li>$40 per week, only on weeks ${escape(childFirst)} is reserved</li>
        <li>Email receipt + day-before reminder for each session</li>
        <li>Same court, same crew, same time of day &mdash; consistency is the whole point</li>
      </ul>
    </div>

    <div style="${s.actionCallout}">
      <p style="${s.actionLabel}">Need to pause or change card?</p>
      <p style="margin:14px 0 0 0;">
        <a href="${manageUrl}" style="${s.link}font-weight:700;text-decoration:none;">Manage your commit &rarr;</a>
      </p>
    </div>

    <div style="${s.footer}">
      <p style="margin:0 0 8px 0;color:${c.muted};font-size:13px;line-height:1.6;">
        Stoked to have you in the crew.<br>
        <strong style="color:${c.text};">Coach Sam &middot; Next Gen Pickleball Academy</strong>
      </p>
    </div>
  </div>
</body>
</html>`;
}

export function commitConfirmationText(input: CommitConfirmationInput): string {
  return [
    `Hi ${input.parentFirst},`,
    "",
    `${input.childFirst} is locked in for ${input.weeksCommitted} weeks. ${input.crewDescription}.`,
    "",
    `Their name now auto-reserves into each weekly session. We'll charge $40 to the card ending in ${input.cardLast4} the morning each spot opens. Skip any week — we'll refund automatically.`,
    "",
    `Manage your commit: ${input.manageUrl}`,
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
