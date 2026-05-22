import { c, s } from "./brand";

/**
 * One-time re-engagement email to existing eval leads, inviting them to opt
 * into the free newsletter. Brand-reviewed (brand-review-nga). Pricing teased,
 * not quoted. One primary CTA (join newsletter) with the free eval as a soft
 * reply-to. This is an invitation, not a subscriber send — recipients opt in
 * by clicking through to /newsletter, so there's no unsubscribe token; the
 * footer carries a "reply skip" cue instead.
 */

interface EvalReengagementInput {
  parentFirst: string;
  newsletterUrl: string; // https://nextgenpbacademy.com/newsletter
}

export const EVAL_REENGAGEMENT_SUBJECT = "Next Gen's back on the courts near you";

export function evalReengagementHtml(input: EvalReengagementInput): string {
  const { parentFirst, newsletterUrl } = input;
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Next Gen's back on the courts near you</title>
</head>
<body style="margin:0;padding:0;background:${c.bgDark};">
  <div style="${s.wrapper}">
    <p style="margin:0 0 20px 0;color:${c.text};line-height:1.55;">Hi ${escape(parentFirst)},</p>
    <p style="margin:0 0 20px 0;color:${c.text};line-height:1.55;">
      A while back you reached out about getting your kid on the court with Next Gen &mdash; thank you for that. A lot's changed: we're now on MCPS courts all across Montgomery County, and the crew is growing every week.
    </p>
    <p style="margin:0 0 12px 0;color:${c.text};line-height:1.55;">
      The easiest way to stay in the loop is our free newsletter. Once a week you'll get:
    </p>
    <ul style="margin:0 0 20px 0;padding-left:18px;color:${c.text};line-height:1.7;">
      <li>This week's drop-in session times, before they fill</li>
      <li>First dibs on monthly training spots</li>
      <li>A quick coach tip you can use at home</li>
    </ul>
    <p style="margin:0 0 4px 0;color:${c.muted};font-size:14px;line-height:1.55;">
      No commitment, no spam &mdash; just where to play and how your kid gets better. Unsubscribe anytime.
    </p>

    <div style="${s.actionCallout}">
      <p style="margin:0;">
        <a href="${newsletterUrl}" style="${s.link}font-weight:700;text-decoration:none;font-size:16px;">Join the free newsletter &rarr;</a>
      </p>
    </div>

    <p style="margin:20px 0 0 0;color:${c.text};line-height:1.55;">
      Still want that free evaluation you asked about? Just reply to this email and we'll find a time.
    </p>

    <div style="${s.footer}">
      <p style="margin:0 0 8px 0;color:${c.muted};font-size:13px;line-height:1.6;">
        See you on the court &mdash; better than yesterday, together.<br>
        <strong style="color:${c.text};">Coach Sam &middot; Next Gen Pickleball Academy</strong>
      </p>
      <p style="margin:0;color:${c.muted};font-size:11px;line-height:1.5;">
        You're getting this because you inquired about Next Gen. Not interested? Reply "skip" and we'll close the loop.
      </p>
    </div>
  </div>
</body>
</html>`;
}

export function evalReengagementText(input: EvalReengagementInput): string {
  return [
    `Hi ${input.parentFirst},`,
    "",
    `A while back you reached out about getting your kid on the court with Next Gen — thank you for that. A lot's changed: we're now on MCPS courts all across Montgomery County, and the crew is growing every week.`,
    "",
    `The easiest way to stay in the loop is our free newsletter. Once a week you'll get:`,
    `- This week's drop-in session times, before they fill`,
    `- First dibs on monthly training spots`,
    `- A quick coach tip you can use at home`,
    "",
    `No commitment, no spam — just where to play and how your kid gets better. Unsubscribe anytime.`,
    "",
    `Join the free newsletter: ${input.newsletterUrl}`,
    "",
    `Still want that free evaluation you asked about? Just reply to this email and we'll find a time.`,
    "",
    `See you on the court — better than yesterday, together.`,
    `Coach Sam · Next Gen Pickleball Academy`,
    "",
    `You're getting this because you inquired about Next Gen. Not interested? Reply "skip" and we'll close the loop.`,
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
