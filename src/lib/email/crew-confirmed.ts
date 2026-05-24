import { c, s } from "./brand";

interface CrewConfirmedInput {
  parentFirst: string;
  childFirst: string;
  crewDescription: string;
  firstSessionLong: string;
  scheduleUrl: string;
}

export function crewConfirmedHtml(input: CrewConfirmedInput): string {
  const { parentFirst, childFirst, crewDescription, firstSessionLong, scheduleUrl } =
    input;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escape(childFirst)}&rsquo;s crew is set</title>
</head>
<body style="margin:0;padding:0;background:${c.bgDark};">
  <div style="${s.wrapper}">
    <p style="margin:0 0 6px 0;font-size:12px;letter-spacing:0.15em;text-transform:uppercase;color:${c.accentLime};font-weight:700;">Crew confirmed</p>
    <h1 style="${s.heading} margin:0 0 16px 0;">${escape(childFirst)}&rsquo;s crew is set, ${escape(parentFirst)}.</h1>
    <p style="margin:0 0 20px 0;color:${c.text};line-height:1.55;">
      We hit the headcount. ${escape(crewDescription)}. First session is ${escape(firstSessionLong)} &mdash; book it below and you&rsquo;re in.
    </p>

    <div style="${s.cardAccent}">
      <p style="margin:0 0 6px 0;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:${c.accentLime};font-weight:700;">How it works</p>
      <p style="margin:0;color:${c.text};font-size:14px;line-height:1.55;">
        Book session 1 ($40, 4-player cap). After that first session you&rsquo;ll get a one-tap option to lock in the next 4 weeks &mdash; same time, same court, same crew. Skip a week any time, no questions asked.
      </p>
    </div>

    <div style="${s.actionCallout}">
      <p style="${s.actionLabel}">Book session 1</p>
      <p style="margin:14px 0 0 0;">
        <a href="${scheduleUrl}" style="${s.link}font-weight:700;text-decoration:none;">Reserve your spot &rarr;</a>
      </p>
    </div>

    <div style="${s.footer}">
      <p style="margin:0 0 8px 0;color:${c.muted};font-size:13px;line-height:1.6;">
        See you on court.<br>
        <strong style="color:${c.text};">Coach Sam &middot; Next Gen Pickleball Academy</strong>
      </p>
    </div>
  </div>
</body>
</html>`;
}

export function crewConfirmedText(input: CrewConfirmedInput): string {
  return [
    `Hi ${input.parentFirst},`,
    "",
    `${input.childFirst}'s crew is set. ${input.crewDescription}.`,
    "",
    `First session is ${input.firstSessionLong}. Book it here: ${input.scheduleUrl}`,
    "",
    `After that first session you'll get a one-tap option to lock in the next 4 weeks — same time, same court, same crew. Skip a week any time.`,
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
