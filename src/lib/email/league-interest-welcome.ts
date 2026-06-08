import { c, s } from "./brand";

interface LeagueInterestWelcomeInput {
  parentFirst: string;
  childFirst: string;
  bandLabel: string;
  /** e.g. "10U · Green" — what the parent told us. */
  interestSummary: string;
  scheduleUrl: string;
}

export function leagueInterestWelcomeSubject(input: {
  childFirst: string;
}): string {
  return `${input.childFirst} is on the league interest list`;
}

/**
 * Sent to a parent who raises their hand for a structured league season. EASE =
 * Excellence: we're building something better than a one-off class, and we want
 * to see their kid grow across a full season. Price is TEASED, never quoted —
 * the season product isn't live yet and the public "price teased" rule applies
 * to comms as well as the page.
 */
export function leagueInterestWelcomeHtml(
  input: LeagueInterestWelcomeInput,
): string {
  const { parentFirst, childFirst, bandLabel, interestSummary, scheduleUrl } =
    input;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escape(leagueInterestWelcomeSubject({ childFirst }))}</title>
</head>
<body style="margin:0;padding:0;background:${c.bgDark};">
  <div style="${s.wrapper}">
    <p style="margin:0 0 6px 0;font-size:12px;letter-spacing:0.15em;text-transform:uppercase;color:${c.accentLime};font-weight:700;">You're on the list</p>
    <h1 style="${s.heading} margin:0 0 16px 0;">${escape(childFirst)} is on the ${escape(bandLabel)} interest list, ${escape(parentFirst)}.</h1>
    <p style="margin:0 0 20px 0;color:${c.text};line-height:1.55;">
      Thanks for raising your hand. The Next Gen league is a fixed-roster,
      8-session season &mdash; same kids every week, real growth you can actually
      see. It&rsquo;s the structured next step up from drop-ins, built around one
      idea: <strong style="color:${c.text};">better than yesterday, together.</strong>
    </p>

    <div style="${s.card}">
      <p style="margin:0 0 6px 0;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:${c.muted};font-weight:700;">What you told us</p>
      <p style="margin:0;color:${c.text};font-size:14px;line-height:1.55;">${escape(interestSummary)}</p>
    </div>

    <h2 style="margin:28px 0 10px 0;font-family:Montserrat,Arial,sans-serif;font-size:16px;color:${c.text};">What happens next</h2>
    <ul style="margin:0;padding-left:18px;color:${c.text};line-height:1.7;">
      <li>We&rsquo;re lining up venues, days, and the coach roster for the ${escape(bandLabel)} division now.</li>
      <li>The moment a season near you is confirmed, you&rsquo;ll be first to hear &mdash; with the start date, the weekly slot, and how to enroll.</li>
      <li>Every season tracks ${escape(childFirst)}&rsquo;s own progress &mdash; touches, skills unlocked, personal bests. No leaderboards, just your kid vs. yesterday.</li>
    </ul>

    <div style="${s.cardAccent}">
      <p style="margin:0 0 6px 0;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:${c.accentLime};font-weight:700;">Want to play before the season starts?</p>
      <p style="margin:0;color:${c.text};font-size:14px;line-height:1.55;">
        ${escape(childFirst)} can drop in on any open session in the meantime &mdash; a great way to get a first touch on the court while we build the league.
      </p>
    </div>

    <div style="${s.actionCallout}">
      <p style="${s.actionLabel}">See open sessions</p>
      <p style="margin:14px 0 0 0;">
        <a href="${scheduleUrl}" style="${s.link}font-weight:700;text-decoration:none;">Check this week&rsquo;s schedule &rarr;</a>
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

export function leagueInterestWelcomeText(
  input: LeagueInterestWelcomeInput,
): string {
  const { parentFirst, childFirst, bandLabel, interestSummary, scheduleUrl } =
    input;

  return [
    `${childFirst} is on the ${bandLabel} interest list, ${parentFirst}.`,
    "",
    `Thanks for raising your hand. The Next Gen league is a fixed-roster, 8-session season — same kids every week, real growth you can actually see. It's the structured next step up from drop-ins, built around one idea: better than yesterday, together.`,
    "",
    `What you told us:`,
    interestSummary,
    "",
    `What happens next:`,
    `- We're lining up venues, days, and the coach roster for the ${bandLabel} division now.`,
    `- The moment a season near you is confirmed, you'll be first to hear — with the start date, the weekly slot, and how to enroll.`,
    `- Every season tracks ${childFirst}'s own progress — touches, skills unlocked, personal bests. No leaderboards, just your kid vs. yesterday.`,
    "",
    `Want to play before the season starts? ${childFirst} can drop in on any open session in the meantime.`,
    "",
    `See open sessions: ${scheduleUrl}`,
    "",
    `Better than yesterday, together.`,
    `Coach Sam · Next Gen Pickleball Academy`,
    "",
    `Reply to this email any time — that's the fastest way to reach Sam.`,
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
