import { c, s } from "./brand";

interface PostSessionInput {
  parentFirst: string;
  childFirst: string;
  sessionTitle: string;
  sessionDateLong: string; // "Saturday, May 23, 2026"
  scheduleUrl: string;
  /**
   * Optional signed `/commit/<token>` URL. When present, the email renders a
   * second CTA inviting the parent to lock in the next 4 weeks of the same
   * crew. Omitted when we can't build a valid crew-id from the row (e.g.
   * level missing) so we don't link parents into a broken page.
   */
  commitUrl?: string;
}

export function postSessionHtml(input: PostSessionInput): string {
  const { parentFirst, childFirst, sessionTitle, sessionDateLong, scheduleUrl, commitUrl } =
    input;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Thanks for ${escape(sessionDateLong)} &mdash; what&rsquo;s next for ${escape(childFirst)}</title>
</head>
<body style="margin:0;padding:0;background:${c.bgDark};">
  <div style="${s.wrapper}">
    <p style="margin:0 0 6px 0;font-size:12px;letter-spacing:0.15em;text-transform:uppercase;color:${c.accentLime};font-weight:700;">Recap</p>
    <h1 style="${s.heading} margin:0 0 16px 0;">${escape(childFirst)} got reps in on ${escape(sessionDateLong)}.</h1>
    <p style="margin:0 0 20px 0;color:${c.text};line-height:1.55;">
      Thanks for showing up, ${escape(parentFirst)}. Real progress is built one session at a time &mdash; today&rsquo;s reps become tomorrow&rsquo;s instincts. Keep the cadence going while it&rsquo;s fresh.
    </p>

    <div style="${s.cardAccent}">
      <p style="margin:0 0 6px 0;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:${c.accentLime};font-weight:700;">Session: ${escape(sessionDateLong)}</p>
      <p style="margin:0;font-family:Montserrat,Arial,sans-serif;font-size:18px;font-weight:900;color:${c.text};">${escape(sessionTitle)}</p>
    </div>

    <h2 style="margin:28px 0 10px 0;font-family:Montserrat,Arial,sans-serif;font-size:16px;color:${c.text};">What keeps the pathway moving</h2>
    <ul style="margin:0;padding-left:18px;color:${c.text};line-height:1.7;">
      <li>Show up to the next session within 7&ndash;10 days &mdash; consistency beats intensity</li>
      <li>If ${escape(childFirst)} mentioned a specific shot, ask them to walk you through it. Teaching it locks it in.</li>
      <li>No court at home? Twenty minutes of wall practice (any flat wall, paddle, ball) sharpens hands fast.</li>
    </ul>

    <div style="${s.actionCallout}">
      <p style="${s.actionLabel}">Book the next slot</p>
      <p style="margin:6px 0 0 0;color:${c.text};font-size:14px;line-height:1.55;">
        Sessions cap at 4 players per court and the good times fill 7&ndash;14 days out. Grab a spot before it goes.
      </p>
      <p style="margin:14px 0 0 0;">
        <a href="${scheduleUrl}" style="${s.link}font-weight:700;text-decoration:none;">See the next session &rarr;</a>
      </p>
    </div>
${
  commitUrl
    ? `
    <div style="${s.actionCallout}">
      <p style="${s.actionLabel}">Or lock in 4 weeks at once</p>
      <p style="margin:6px 0 0 0;color:${c.text};font-size:14px;line-height:1.55;">
        Same time, same court, same crew &mdash; we&rsquo;ll auto-reserve ${escape(childFirst)}&rsquo;s spot for the next 4 weeks and charge $20 only on weeks they actually play. Skip a week any time.
      </p>
      <p style="margin:14px 0 0 0;">
        <a href="${commitUrl}" style="${s.link}font-weight:700;text-decoration:none;">Lock in 4 weeks &rarr;</a>
      </p>
    </div>`
    : ""
}

    <div style="${s.footer}">
      <p style="margin:0 0 8px 0;color:${c.muted};font-size:13px;line-height:1.6;">
        Better than yesterday, together.<br>
        <strong style="color:${c.text};">Coach Sam &middot; Next Gen Pickleball Academy</strong>
      </p>
      <p style="margin:0;color:${c.muted};font-size:11px;line-height:1.5;">
        We send this one note after each session. If you&rsquo;d rather we skip the recap, just reply &ldquo;skip&rdquo; and we&rsquo;ll stop.
      </p>
    </div>
  </div>
</body>
</html>`;
}

export function postSessionText(input: PostSessionInput): string {
  const lines = [
    `Hi ${input.parentFirst},`,
    "",
    `${input.childFirst} got reps in on ${input.sessionDateLong}.`,
    "",
    `Thanks for showing up. Real progress is built one session at a time — today's reps become tomorrow's instincts. Keep the cadence going while it's fresh.`,
    "",
    `Session: ${input.sessionDateLong}`,
    `${input.sessionTitle}`,
    "",
    `What keeps the pathway moving:`,
    `- Show up to the next session within 7–10 days — consistency beats intensity`,
    `- If ${input.childFirst} mentioned a specific shot, ask them to walk you through it. Teaching it locks it in.`,
    `- No court at home? Twenty minutes of wall practice (any flat wall, paddle, ball) sharpens hands fast.`,
    "",
    `Book the next slot — sessions cap at 4 players per court and the good times fill 7–14 days out.`,
    `See the next session: ${input.scheduleUrl}`,
  ];
  if (input.commitUrl) {
    lines.push(
      "",
      `Or lock in 4 weeks at once — same time, same court, same crew. We'll auto-reserve ${input.childFirst}'s spot and charge $20 only on weeks they play. Skip any week.`,
      `Lock in 4 weeks: ${input.commitUrl}`,
    );
  }
  lines.push(
    "",
    `Better than yesterday, together.`,
    `Coach Sam · Next Gen Pickleball Academy`,
    "",
    `We send this one note after each session. If you'd rather we skip the recap, just reply "skip" and we'll stop.`,
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
