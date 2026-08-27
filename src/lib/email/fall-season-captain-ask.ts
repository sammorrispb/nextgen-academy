import { c, s } from "./brand";
import { signatureExtrasHtml, signatureExtrasText } from "./signature";

/**
 * The court-captain ask — recruiting one parent volunteer per court, per week.
 *
 * The honest reason, stated in the email: with two courts and one coach, the
 * coach spends the session running a clock instead of watching kids. A captain
 * per court buys back the coaching. Parents say yes to that far more readily
 * than to "we need volunteers," and it's true, which matters more.
 *
 * Two things this template is careful about:
 *   - It sells the job as SMALL and NON-TECHNICAL, because it is. A parent who
 *     thinks they're being asked to coach pickleball will decline, and a parent
 *     who says yes thinking that will coach, which is worse.
 *   - It states the background-check requirement up front rather than burying
 *     it. These are other people's children; a volunteer who is surprised by
 *     vetting later is a volunteer we lose at the worst moment.
 *
 * EASE value: Attitude — generous, low-ego, in it for the group.
 * One primary CTA: reply with the Sundays that work. Deliberately a reply and
 * not a form; a sign-up link for six slots is more friction than the ask.
 */

export interface FallSeasonCaptainAskInput {
  parentFirst: string;
  /** "Green Ball" — the block their own child is in. */
  groupLabel: string;
  /** "1:00–2:30 PM" */
  timeLabel: string;
  /** How early a captain arrives, in minutes. */
  arriveEarlyMinutes: number;
  /** Pre-formatted Sundays, e.g. ["Sunday, September 20", …]. */
  sundays: readonly string[];
  /** Where the full playbook lives, for the curious. */
  playbookUrl: string;
}

export function fallSeasonCaptainAskSubject(): string {
  return `Can you captain a court this season? (It's easier than it sounds)`;
}

export function fallSeasonCaptainAskHtml(
  input: FallSeasonCaptainAskInput,
): string {
  const {
    parentFirst,
    groupLabel,
    timeLabel,
    arriveEarlyMinutes,
    sundays,
    playbookUrl,
  } = input;

  const sundaysHtml = sundays
    .map(
      (d) =>
        `<li style="color:${c.text};line-height:1.7;">${escape(d)}</li>`,
    )
    .join("");

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Can you captain a court this season?</title>
</head>
<body style="margin:0;padding:0;background:${c.bgDark};">
  <div style="${s.wrapper}">
    <p style="margin:0 0 6px 0;font-size:12px;letter-spacing:0.15em;text-transform:uppercase;color:${c.accentLime};font-weight:700;">A small ask</p>
    <h1 style="${s.heading} margin:0 0 16px 0;">Court captains &mdash; one parent per court</h1>
    <p style="margin:0 0 20px 0;color:${c.text};line-height:1.55;">
      Hi ${escape(parentFirst)} &mdash; here&rsquo;s the honest version. We run two courts at once in ${escape(
        groupLabel,
      )} (${escape(timeLabel)}). With one coach and two courts, I spend a chunk of every Sunday calling a clock and sorting out whose turn it is &mdash; which is time I&rsquo;m not spending watching your kid hit a ball.
    </p>
    <p style="margin:0 0 20px 0;color:${c.text};line-height:1.55;">
      One parent per court fixes that completely. You&rsquo;d run the clock and the rotation; I&rsquo;d coach.
    </p>

    <div style="${s.cardAccent}">
      <p style="margin:0 0 6px 0;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:${c.accentLime};font-weight:700;">What you&rsquo;d actually do</p>
      <ul style="margin:0;padding-left:18px;color:${c.text};font-size:14px;line-height:1.7;">
        <li>Start a timer and call &ldquo;switch&rdquo; every few minutes</li>
        <li>Say who&rsquo;s playing who next, before the last point finishes</li>
        <li>Keep the score out loud so nobody argues about it</li>
        <li>Feed a ball when the drill needs one, and keep the caddy full</li>
        <li>Cheer kids by name when they do the thing right</li>
      </ul>
    </div>

    <div style="${s.card}">
      <p style="margin:0 0 6px 0;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:${c.accentYellow};font-weight:700;">What you would NOT do</p>
      <p style="margin:0;color:${c.text};font-size:14px;line-height:1.6;">
        Coach. Genuinely &mdash; no technique, no fixing anyone&rsquo;s grip. If a kid asks a pickleball question the whole answer is &ldquo;Coach, can you look at this?&rdquo; You do not need to have played pickleball. You need to be able to read a clock and say a name loudly.
      </p>
    </div>

    <h2 style="margin:28px 0 10px 0;font-family:Montserrat,Arial,sans-serif;font-size:16px;color:${c.text};">The commitment</h2>
    <ul style="margin:0;padding-left:18px;color:${c.text};line-height:1.7;">
      <li>Arrive ${arriveEarlyMinutes} minutes early to help set up, then you&rsquo;re on court for the session</li>
      <li>One Sunday is a real contribution. Six is heroic. Take whatever you can.</li>
      <li>I&rsquo;ll send you a one-page run sheet the day before &mdash; every block, every time, every game, written out</li>
      <li>You&rsquo;re on court with your own kid&rsquo;s group, which most parents find is the best seat in the house</li>
    </ul>

    <h2 style="margin:28px 0 10px 0;font-family:Montserrat,Arial,sans-serif;font-size:16px;color:${c.text};">The part I won&rsquo;t bury</h2>
    <p style="margin:0 0 12px 0;color:${c.text};font-size:14px;line-height:1.6;">
      These are other families&rsquo; children, so anyone in this role goes through a background check first &mdash; I cover the cost, it takes about a week, and it carries over to future seasons. Until it clears you&rsquo;d still be welcome on court, just working within my line of sight. There are always two adults present, and no adult is ever alone with a child who isn&rsquo;t theirs. Those aren&rsquo;t formalities; they&rsquo;re how the program runs.
    </p>

    <div style="${s.actionCallout}">
      <p style="${s.actionLabel}">Which Sundays work?</p>
      <p style="margin:6px 0 0 0;color:${c.text};font-size:14px;line-height:1.55;">
        Just reply to this email with the dates you could take &mdash; even one.
      </p>
      <ul style="margin:10px 0 0 0;padding-left:18px;font-size:14px;">${sundaysHtml}</ul>
      <p style="margin:14px 0 0 0;color:${c.muted};font-size:13px;line-height:1.55;">
        Curious what the job looks like in full? The captain playbook is here: <a href="${playbookUrl}" style="${s.link}">${escape(
          playbookUrl,
        )}</a>
      </p>
    </div>

    <p style="margin:20px 0 0 0;color:${c.muted};font-size:13px;line-height:1.6;">
      And if this isn&rsquo;t your thing &mdash; genuinely no problem, and no follow-up. Come watch and cheer; that&rsquo;s worth plenty too.
    </p>

    <div style="${s.footer}">
      <p style="margin:0 0 8px 0;color:${c.muted};font-size:13px;line-height:1.6;">
        Thanks for even reading this far &mdash; better than yesterday, together.<br>
        <strong style="color:${c.text};">Coach Sam &middot; Next Gen Pickleball Academy</strong>
      </p>
      ${signatureExtrasHtml()}
    </div>
  </div>
</body>
</html>`;
}

export function fallSeasonCaptainAskText(
  input: FallSeasonCaptainAskInput,
): string {
  return [
    `Hi ${input.parentFirst},`,
    "",
    `Court captains — one parent per court.`,
    "",
    `Here's the honest version. We run two courts at once in ${input.groupLabel} (${input.timeLabel}). With one coach and two courts, I spend a chunk of every Sunday calling a clock and sorting out whose turn it is — which is time I'm not spending watching your kid hit a ball.`,
    "",
    `One parent per court fixes that completely. You'd run the clock and the rotation; I'd coach.`,
    "",
    `WHAT YOU'D ACTUALLY DO`,
    `- Start a timer and call "switch" every few minutes`,
    `- Say who's playing who next, before the last point finishes`,
    `- Keep the score out loud so nobody argues about it`,
    `- Feed a ball when the drill needs one, and keep the caddy full`,
    `- Cheer kids by name when they do the thing right`,
    "",
    `WHAT YOU WOULD NOT DO`,
    `Coach. Genuinely — no technique, no fixing anyone's grip. If a kid asks a pickleball question the whole answer is "Coach, can you look at this?" You do not need to have played pickleball. You need to be able to read a clock and say a name loudly.`,
    "",
    `THE COMMITMENT`,
    `- Arrive ${input.arriveEarlyMinutes} minutes early to help set up, then you're on court for the session`,
    `- One Sunday is a real contribution. Six is heroic. Take whatever you can.`,
    `- I'll send you a one-page run sheet the day before — every block, every time, every game, written out`,
    `- You're on court with your own kid's group, which most parents find is the best seat in the house`,
    "",
    `THE PART I WON'T BURY`,
    `These are other families' children, so anyone in this role goes through a background check first — I cover the cost, it takes about a week, and it carries over to future seasons. Until it clears you'd still be welcome on court, just working within my line of sight. There are always two adults present, and no adult is ever alone with a child who isn't theirs. Those aren't formalities; they're how the program runs.`,
    "",
    `WHICH SUNDAYS WORK?`,
    `Just reply to this email with the dates you could take — even one.`,
    ...input.sundays.map((d) => `- ${d}`),
    "",
    `Curious what the job looks like in full? The captain playbook is here: ${input.playbookUrl}`,
    "",
    `And if this isn't your thing — genuinely no problem, and no follow-up. Come watch and cheer; that's worth plenty too.`,
    "",
    "",
    `Thanks for even reading this far — better than yesterday, together.`,
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
