import { c, s } from "./brand";
import type { CrewSessionLine } from "./crew-session-lines";

/**
 * 7-day re-engagement to a parent whose Crew Interest submission hasn't matched
 * a crew yet. EASE = Community + Skills: we're still looking, here's what's
 * open right now so {child} can keep playing while we build the crew. Coach
 * voice, one arrowed CTA. Recipients are always the parent (+ admin BCC) — this
 * never goes to a minor.
 */
export interface CrewFollowupParentInput {
  parentFirst: string;
  childFirst: string;
  preferredSummary: string;
  matchedSessions: CrewSessionLine[];
  scheduleUrl: string;
  crewUrl: string;
}

export function crewFollowupParentSubject(input: {
  childFirst: string;
}): string {
  return `Still looking for ${input.childFirst}'s crew`;
}

function escape(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function crewFollowupParentHtml(input: CrewFollowupParentInput): string {
  const {
    parentFirst,
    childFirst,
    preferredSummary,
    matchedSessions,
    scheduleUrl,
    crewUrl,
  } = input;

  const sessionsBlock = matchedSessions.length
    ? `<div style="${s.cardAccent}">
      <p style="margin:0 0 10px 0;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:${c.accentLime};font-weight:700;">Open this week that fit ${escape(childFirst)}</p>
      ${matchedSessions
        .map(
          (m) => `<p style="margin:0 0 10px 0;color:${c.text};font-size:14px;line-height:1.5;">
        <a href="${m.url}" style="color:${c.link};font-weight:700;text-decoration:none;">${escape(m.title || "Open session")}</a><br>
        <span style="color:${c.muted};font-size:13px;">${escape([m.dateLabel, m.timeLabel, m.location].filter(Boolean).join(" · "))}</span>
      </p>`,
        )
        .join("")}
    </div>`
    : `<div style="${s.cardAccent}">
      <p style="margin:0 0 6px 0;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:${c.accentLime};font-weight:700;">Play while we build the crew</p>
      <p style="margin:0;color:${c.text};font-size:14px;line-height:1.55;">
        No exact match on ${escape(childFirst)}&rsquo;s days this week yet &mdash; but the schedule changes fast. Take a look at everything that&rsquo;s open.
      </p>
    </div>`;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escape(crewFollowupParentSubject({ childFirst }))}</title>
</head>
<body style="margin:0;padding:0;background:${c.bgDark};">
  <div style="${s.wrapper}">
    <p style="margin:0 0 6px 0;font-size:12px;letter-spacing:0.15em;text-transform:uppercase;color:${c.accentLime};font-weight:700;">Still on it</p>
    <h1 style="${s.heading} margin:0 0 16px 0;">We haven&rsquo;t forgotten ${escape(childFirst)}, ${escape(parentFirst)}.</h1>
    <p style="margin:0 0 20px 0;color:${c.text};line-height:1.55;">
      A crew is four kids at the same level who can make the same court, same time &mdash; and we&rsquo;re still matching ${escape(childFirst)} with the right group. The more families that come through, the faster it locks in.
    </p>

    <div style="${s.card}">
      <p style="margin:0 0 6px 0;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:${c.muted};font-weight:700;">What you told us</p>
      <p style="margin:0;color:${c.text};font-size:14px;line-height:1.55;">${escape(preferredSummary)}</p>
    </div>

    ${sessionsBlock}

    <div style="${s.actionCallout}">
      <p style="${s.actionLabel}">See open sessions</p>
      <p style="margin:14px 0 0 0;">
        <a href="${scheduleUrl}" style="${s.link}font-weight:700;text-decoration:none;">Browse this week&rsquo;s schedule &rarr;</a>
      </p>
    </div>

    <p style="margin:24px 0 0 0;color:${c.muted};font-size:13px;line-height:1.6;">
      Anything change &mdash; new days, a friend who wants in, a different level? <a href="${crewUrl}" style="${s.link}">Update what works</a> and we&rsquo;ll re-match.
    </p>

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

export function crewFollowupParentText(input: CrewFollowupParentInput): string {
  const {
    parentFirst,
    childFirst,
    preferredSummary,
    matchedSessions,
    scheduleUrl,
    crewUrl,
  } = input;

  const sessionLines = matchedSessions.length
    ? [
        `Open this week that fit ${childFirst}:`,
        ...matchedSessions.map(
          (m) =>
            `- ${[m.title, m.dateLabel, m.timeLabel, m.location]
              .filter(Boolean)
              .join(" · ")} — ${m.url}`,
        ),
      ]
    : [
        `No exact match on ${childFirst}'s days this week yet — but the schedule changes fast.`,
      ];

  return [
    `We haven't forgotten ${childFirst}, ${parentFirst}.`,
    "",
    `A crew is four kids at the same level who can make the same court, same time — and we're still matching ${childFirst} with the right group. The more families that come through, the faster it locks in.`,
    "",
    `What you told us:`,
    preferredSummary,
    "",
    ...sessionLines,
    "",
    `See open sessions: ${scheduleUrl}`,
    "",
    `Anything change — new days, a friend who wants in, a different level? Update what works: ${crewUrl}`,
    "",
    `Better than yesterday, together.`,
    `Coach Sam · Next Gen Pickleball Academy`,
    "",
    `Reply to this email any time — that's the fastest way to reach Sam.`,
  ].join("\n");
}
