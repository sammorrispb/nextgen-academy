import { c, s } from "./brand";

/**
 * One-shot summer-camp outreach email to existing (non-DD) leads. Brand-reviewed
 * (brand-review-nga). Camp pricing IS quoted ($50/$150) — unlike the teased
 * drop-in price, a camp is a concrete bookable product with a real price.
 *
 * Parent-email egress only: the copy is generic ("your camper") and carries NO
 * child name, so this send adds no new child-PII egress surface (mirrors the
 * eval-reengagement blast). One primary CTA (register) with the free eval as a
 * soft reply-to. Reply-based opt-out in the footer, matching the eval-
 * reengagement convention — proportionate for a one-shot lead send.
 */

interface CampOutreachInput {
  parentFirst: string;
  campUrl: string; // https://nextgenpbacademy.com/camp?utm_...
}

export const CAMP_OUTREACH_SUBJECT =
  "Two weeks of summer camp left — Gaithersburg";

export function campOutreachHtml(input: CampOutreachInput): string {
  const { parentFirst, campUrl } = input;
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Two weeks of summer camp left</title>
</head>
<body style="margin:0;padding:0;background:${c.bgDark};">
  <div style="${s.wrapper}">
    <p style="margin:0 0 20px 0;color:${c.text};line-height:1.55;">Hi ${escape(parentFirst)},</p>
    <p style="margin:0 0 20px 0;color:${c.text};line-height:1.55;">
      A while back you reached out about getting your kid on the court with Next Gen &mdash; thank you for that. Summer's flying by, and we've got two morning camp weeks left in Gaithersburg that would be a great way to get your camper playing.
    </p>
    <p style="margin:0 0 12px 0;color:${c.text};line-height:1.55;">
      Here's what a morning looks like (9:30am&ndash;12:30pm ET, ages 8&ndash;16):
    </p>
    <ul style="margin:0 0 20px 0;padding-left:18px;color:${c.text};line-height:1.7;">
      <li>Athleticism games, real drills, and live game play</li>
      <li>Grouped by age and skill, so every kid gets real reps and real feedback</li>
      <li>An end-of-day tournament &mdash; campers leave more confident than they arrived</li>
    </ul>
    <p style="margin:0 0 8px 0;color:${c.text};line-height:1.55;">
      <strong>Two weeks left:</strong> June 29&ndash;July 2 and July 20&ndash;23 (Mon&ndash;Thu), rain or shine.<br>
      <strong>$50</strong> a morning, or <strong>$150</strong> for the full week.
    </p>

    <div style="${s.actionCallout}">
      <p style="margin:0;">
        <a href="${campUrl}" style="${s.link}font-weight:700;text-decoration:none;font-size:16px;">Register for camp &rarr;</a>
      </p>
    </div>

    <p style="margin:20px 0 0 0;color:${c.text};line-height:1.55;">
      Not sure it's the right level? Just reply to this email (or text Coach Sam at 301-325-4731) and we'll figure out the right fit &mdash; or start with a free evaluation.
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

export function campOutreachText(input: CampOutreachInput): string {
  return [
    `Hi ${input.parentFirst},`,
    "",
    `A while back you reached out about getting your kid on the court with Next Gen — thank you for that. Summer's flying by, and we've got two morning camp weeks left in Gaithersburg that would be a great way to get your camper playing.`,
    "",
    `Here's what a morning looks like (9:30am–12:30pm ET, ages 8–16):`,
    `- Athleticism games, real drills, and live game play`,
    `- Grouped by age and skill, so every kid gets real reps and real feedback`,
    `- An end-of-day tournament — campers leave more confident than they arrived`,
    "",
    `Two weeks left: June 29–July 2 and July 20–23 (Mon–Thu), rain or shine.`,
    `$50 a morning, or $150 for the full week.`,
    "",
    `Register for camp: ${input.campUrl}`,
    "",
    `Not sure it's the right level? Just reply to this email (or text Coach Sam at 301-325-4731) and we'll figure out the right fit — or start with a free evaluation.`,
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
