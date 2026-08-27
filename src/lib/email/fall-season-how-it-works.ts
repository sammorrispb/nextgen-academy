import { c, s } from "./brand";
import { signatureExtrasHtml, signatureExtrasText } from "./signature";

/**
 * "Here's how the season actually works" — the one long email a registered
 * family gets before week 1.
 *
 * The confirmation email (fall-season-confirmation.ts) already told them WHAT
 * they bought: dates, times, venue, price. This one tells them what it will
 * feel like — the rhythm of a Sunday, the six-week arc, the rules their kid
 * plays under, and what a parent is actually supposed to do on the sideline.
 * It exists because "I paid $225 and I don't know what happens at 1pm" is how
 * a good season starts badly.
 *
 * EASE value: Excellence — preparedness. Everything here is a family arriving
 * ready. One primary CTA (directions), everything else is utility.
 *
 * Pure builder, no send path, so the copy unit-tests without a dev server.
 * Quoting the season price is fine here and elsewhere in the fall templates: a
 * real Stripe product backs it, and the no-quoting rule targets prices that
 * don't exist yet.
 */

export interface SeasonWeekLine {
  /** 1-indexed. */
  week: number;
  /** "Sunday, September 20" — pre-formatted by the caller. */
  dateLong: string;
  title: string;
  /** The one plain sentence a parent can repeat. */
  parentLine: string;
}

export interface FallSeasonHowItWorksInput {
  parentFirst: string;
  childFirst: string;
  /** "Green Ball" */
  groupLabel: string;
  /** "1:00–2:30 PM" */
  timeLabel: string;
  /** Exact venue block. */
  venue: string;
  /** "September 20 – October 25, 2026" */
  seasonLabel: string;
  /** The six weeks, in order. */
  weeks: readonly SeasonWeekLine[];
  /** The rules this child's ball color plays under. */
  rules: {
    label: string;
    serve: string;
    kitchen: string;
    scoring: string;
  };
  /** Rain/makeup dates, pre-formatted, e.g. ["Sunday, November 1", …]. */
  rainDates: readonly string[];
}

export function fallSeasonHowItWorksSubject(childFirst: string): string {
  return `How ${childFirst}'s fall season works — a Sunday, start to finish`;
}

export function fallSeasonHowItWorksHtml(
  input: FallSeasonHowItWorksInput,
): string {
  const {
    parentFirst,
    childFirst,
    groupLabel,
    timeLabel,
    venue,
    seasonLabel,
    weeks,
    rules,
    rainDates,
  } = input;

  const directions = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
    venue,
  )}`;

  const weeksHtml = weeks
    .map(
      (w) => `
      <tr style="${s.tableRow}">
        <td style="${s.tableLabelWide}">Week ${w.week}<br><span style="font-size:12px;">${escape(
          w.dateLong,
        )}</span></td>
        <td style="${s.tableValue}"><strong>${escape(w.title)}</strong><br><span style="color:${
          c.muted
        };font-size:13px;line-height:1.5;">${escape(w.parentLine)}</span></td>
      </tr>`,
    )
    .join("");

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>How ${escape(childFirst)}&rsquo;s fall season works</title>
</head>
<body style="margin:0;padding:0;background:${c.bgDark};">
  <div style="${s.wrapper}">
    <p style="margin:0 0 6px 0;font-size:12px;letter-spacing:0.15em;text-transform:uppercase;color:${c.accentLime};font-weight:700;">Before week one</p>
    <h1 style="${s.heading} margin:0 0 16px 0;">How a Next Gen Sunday actually runs</h1>
    <p style="margin:0 0 20px 0;color:${c.text};line-height:1.55;">
      Hi ${escape(parentFirst)} &mdash; ${escape(childFirst)} is in ${escape(groupLabel)}, Sundays ${escape(timeLabel)}, ${escape(seasonLabel)}. You already have the dates. This is the part that&rsquo;s harder to put on a registration page: what ninety minutes on court actually looks like, and what we&rsquo;re building week to week.
    </p>

    <div style="${s.cardAccent}">
      <p style="margin:0 0 6px 0;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:${c.accentLime};font-weight:700;">The shape of every Sunday</p>
      <p style="margin:0 0 10px 0;color:${c.text};font-size:14px;line-height:1.6;">
        Same order, every week. Kids who&rsquo;ve been twice stop needing to be told what&rsquo;s next &mdash; which is the point.
      </p>
      <ul style="margin:0;padding-left:18px;color:${c.text};font-size:14px;line-height:1.7;">
        <li><strong>Arrival rally</strong> &mdash; they pair up and start hitting the moment they walk on. No lines, no lecture.</li>
        <li><strong>Huddle</strong> &mdash; one word for the day, one thing we&rsquo;re working on.</li>
        <li><strong>The Skill Stack</strong> &mdash; six short blocks, kitchen out to the baseline, then the serve.</li>
        <li><strong>Modified games</strong> &mdash; the drill turned into a game with a rule that forces the shot.</li>
        <li><strong>Round robin</strong> &mdash; rotating partners, so across the season every kid plays with every kid.</li>
        <li><strong>Jailbreak</strong> &mdash; the loud one they&rsquo;ll tell you about in the car.</li>
      </ul>
    </div>

    <h2 style="margin:28px 0 10px 0;font-family:Montserrat,Arial,sans-serif;font-size:16px;color:${c.text};">The six weeks</h2>
    <p style="margin:0 0 12px 0;color:${c.muted};font-size:14px;line-height:1.55;">
      Each week adds one thing to the week before. That&rsquo;s the difference between a season and six drop-ins.
    </p>
    <table style="width:100%;border-collapse:collapse;">${weeksHtml}</table>

    <div style="${s.card}">
      <p style="margin:0 0 8px 0;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:${c.accentLime};font-weight:700;">${escape(rules.label)} rules</p>
      <p style="margin:0 0 10px 0;color:${c.muted};font-size:13px;line-height:1.55;">
        Every level plays real pickleball. What changes is how much of the rulebook is switched on, so a kid is always playing a game they can win points in.
      </p>
      <p style="margin:0 0 4px 0;color:${c.text};font-size:14px;line-height:1.6;"><strong>Serve:</strong> ${escape(rules.serve)}</p>
      <p style="margin:0 0 4px 0;color:${c.text};font-size:14px;line-height:1.6;"><strong>Kitchen:</strong> ${escape(rules.kitchen)}</p>
      <p style="margin:0;color:${c.text};font-size:14px;line-height:1.6;"><strong>Scoring:</strong> ${escape(rules.scoring)}</p>
    </div>

    <h2 style="margin:28px 0 10px 0;font-family:Montserrat,Arial,sans-serif;font-size:16px;color:${c.text};">What to bring, every week</h2>
    <ul style="margin:0;padding-left:18px;color:${c.text};line-height:1.7;">
      <li>Refillable water bottle</li>
      <li>Court shoes &mdash; not flat-soled sneakers</li>
      <li>A paddle if you have one; we have loaners if you don&rsquo;t</li>
      <li>Layers. Late October at 3pm gets cold fast.</li>
    </ul>

    <h2 style="margin:28px 0 10px 0;font-family:Montserrat,Arial,sans-serif;font-size:16px;color:${c.text};">Drop-off, pick-up, and the sideline</h2>
    <ul style="margin:0;padding-left:18px;color:${c.text};line-height:1.7;">
      <li>Arrive five minutes early. The arrival rally is real coaching time, not a warm-up buffer.</li>
      <li>You&rsquo;re welcome to stay &mdash; most parents do. Cheer effort and good sportsmanship, and cheer for every kid, not just yours.</li>
      <li>Please leave the coaching and the line calls to us. Calls belong to the kids; that&rsquo;s half of what they&rsquo;re learning.</li>
      <li>Car-ride-home rule, and it works: lead with &ldquo;I love watching you play.&rdquo;</li>
      <li>Pick-up is at the court. We do a headcount before anyone leaves.</li>
    </ul>

    <div style="${s.actionCallout}">
      <p style="${s.actionLabel}">Where we play</p>
      <p style="margin:6px 0 0 0;color:${c.text};font-size:14px;line-height:1.55;">
        ${escape(venue).replace(/\n/g, "<br>")}
      </p>
      <p style="margin:14px 0 0 0;">
        <a href="${directions}" style="${s.link}font-weight:700;text-decoration:none;">Open in Google Maps &rarr;</a>
      </p>
    </div>

    <p style="margin:24px 0 0 0;color:${c.text};font-size:14px;line-height:1.6;">
      <strong>If it rains.</strong> We make the call by noon and email you either way &mdash; never guess from the sky. A washed-out Sunday moves to ${escape(
        rainDates.join(" or "),
      )}.
    </p>

    <p style="margin:16px 0 0 0;color:${c.text};font-size:14px;line-height:1.6;">
      <strong>One ask.</strong> Tell me anything I should know about ${escape(childFirst)} before week one &mdash; a friend they&rsquo;d love to be paired with, something they&rsquo;re nervous about, an injury, anything. Just reply to this email. It genuinely changes how I run their first Sunday.
    </p>

    <div style="${s.footer}">
      <p style="margin:0 0 8px 0;color:${c.muted};font-size:13px;line-height:1.6;">
        See you on the court &mdash; better than yesterday, together.<br>
        <strong style="color:${c.text};">Coach Sam &middot; Next Gen Pickleball Academy</strong>
      </p>
      ${signatureExtrasHtml()}
    </div>
  </div>
</body>
</html>`;
}

export function fallSeasonHowItWorksText(
  input: FallSeasonHowItWorksInput,
): string {
  const {
    parentFirst,
    childFirst,
    groupLabel,
    timeLabel,
    venue,
    seasonLabel,
    weeks,
    rules,
    rainDates,
  } = input;

  const directions = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
    venue,
  )}`;

  return [
    `Hi ${parentFirst},`,
    "",
    `How a Next Gen Sunday actually runs.`,
    "",
    `${childFirst} is in ${groupLabel}, Sundays ${timeLabel}, ${seasonLabel}. You already have the dates. This is the part that's harder to put on a registration page: what ninety minutes on court actually looks like, and what we're building week to week.`,
    "",
    `THE SHAPE OF EVERY SUNDAY`,
    `Same order, every week. Kids who've been twice stop needing to be told what's next — which is the point.`,
    `- Arrival rally — they pair up and start hitting the moment they walk on. No lines, no lecture.`,
    `- Huddle — one word for the day, one thing we're working on.`,
    `- The Skill Stack — six short blocks, kitchen out to the baseline, then the serve.`,
    `- Modified games — the drill turned into a game with a rule that forces the shot.`,
    `- Round robin — rotating partners, so across the season every kid plays with every kid.`,
    `- Jailbreak — the loud one they'll tell you about in the car.`,
    "",
    `THE SIX WEEKS`,
    `Each week adds one thing to the week before. That's the difference between a season and six drop-ins.`,
    ...weeks.map(
      (w) => `- Week ${w.week} (${w.dateLong}) — ${w.title}: ${w.parentLine}`,
    ),
    "",
    `${rules.label.toUpperCase()} RULES`,
    `Every level plays real pickleball. What changes is how much of the rulebook is switched on, so a kid is always playing a game they can win points in.`,
    `- Serve: ${rules.serve}`,
    `- Kitchen: ${rules.kitchen}`,
    `- Scoring: ${rules.scoring}`,
    "",
    `WHAT TO BRING, EVERY WEEK`,
    `- Refillable water bottle`,
    `- Court shoes — not flat-soled sneakers`,
    `- A paddle if you have one; we have loaners if you don't`,
    `- Layers. Late October at 3pm gets cold fast.`,
    "",
    `DROP-OFF, PICK-UP, AND THE SIDELINE`,
    `- Arrive five minutes early. The arrival rally is real coaching time, not a warm-up buffer.`,
    `- You're welcome to stay — most parents do. Cheer effort and good sportsmanship, and cheer for every kid, not just yours.`,
    `- Please leave the coaching and the line calls to us. Calls belong to the kids; that's half of what they're learning.`,
    `- Car-ride-home rule, and it works: lead with "I love watching you play."`,
    `- Pick-up is at the court. We do a headcount before anyone leaves.`,
    "",
    `WHERE WE PLAY`,
    venue,
    `Directions: ${directions}`,
    "",
    `IF IT RAINS`,
    `We make the call by noon and email you either way — never guess from the sky. A washed-out Sunday moves to ${rainDates.join(
      " or ",
    )}.`,
    "",
    `ONE ASK`,
    `Tell me anything I should know about ${childFirst} before week one — a friend they'd love to be paired with, something they're nervous about, an injury, anything. Just reply to this email. It genuinely changes how I run their first Sunday.`,
    "",
    "",
    `See you on the court — better than yesterday, together.`,
    `Coach Sam · Next Gen Pickleball Academy`,
    "",
    signatureExtrasText(),
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
