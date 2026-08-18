import { c, s } from "./brand";
import { signatureExtrasHtml, signatureExtrasText } from "./signature";

/**
 * Back-to-school camp outreach + permission pass to the lead CRM.
 *
 * Two jobs in one send (Aug 2026). The camp is the reason to open it; the
 * explicit consent choice is the reason to send it. Only ~6% of CRM families
 * were on the newsletter, because the subscriber DB is only ever written by a
 * self-signup at /newsletter — so this asks every remaining family to make a
 * deliberate choice rather than quietly enrolling them.
 *
 * Both choices are one-click and equally weighted: a "yes, keep me posted"
 * link and a "no thanks, take me off" link, adjacent and legible. Burying the
 * opt-out below the opt-in would be the exact dark pattern the brand rules
 * forbid — a permission email that makes leaving hard isn't asking permission.
 *
 * Camp pricing IS quoted ($50/$150) — unlike the teased drop-in price, a camp
 * is a concrete bookable product with a real price.
 *
 * Parent-email egress only: copy is generic ("your camper"), NO child name, so
 * this send adds no child-PII egress surface.
 */

interface CampOutreachInput {
  parentFirst: string;
  campUrl: string; // https://nextgenpbacademy.com/camp?utm_...
  /** One-click "keep me posted" link; null when no signing secret is set. */
  consentUrl?: string | null;
  /** One-click "take me off" link; null when no signing secret is set. */
  optOutUrl?: string | null;
}

export const CAMP_OUTREACH_SUBJECT =
  "Back-to-school camp Aug 17–20 — and a quick ask";

/** Verbatim in both HTML and text so the ask can't drift between them. */
export const CONSENT_ASK =
  "One quick thing: we're tidying up our email list so we only write to families who actually want to hear from us.";

export function campOutreachHtml(input: CampOutreachInput): string {
  const { parentFirst, campUrl, consentUrl, optOutUrl } = input;
  const oneClick = Boolean(consentUrl && optOutUrl);

  const choiceBlock = oneClick
    ? `
    <div style="${s.actionCallout}">
      <p style="margin:0 0 14px 0;color:${c.text};line-height:1.55;">
        ${CONSENT_ASK} Two buttons, one tap &mdash; whichever you pick, that's the last we'll ask.
      </p>
      <p style="margin:0 0 10px 0;">
        <a href="${consentUrl}" style="display:inline-block;background:${c.accentLime};color:${c.bgDark};padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px;">Yes, keep me posted</a>
      </p>
      <p style="margin:0;">
        <a href="${optOutUrl}" style="display:inline-block;border:1px solid ${c.muted};color:${c.text};padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;">No thanks, take me off the list</a>
      </p>
    </div>`
    : `
    <div style="${s.actionCallout}">
      <p style="margin:0;color:${c.text};line-height:1.55;">
        ${CONSENT_ASK} If you'd rather not hear from us, just reply &ldquo;skip&rdquo; and we'll take you off &mdash; no hard feelings.
      </p>
    </div>`;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Back-to-school camp, Aug 17&ndash;20</title>
</head>
<body style="margin:0;padding:0;background:${c.bgDark};">
  <div style="${s.wrapper}">
    <p style="margin:0 0 20px 0;color:${c.text};line-height:1.55;">Hi ${escape(parentFirst)},</p>
    <p style="margin:0 0 20px 0;color:${c.text};line-height:1.55;">
      A while back you reached out about getting your kid on the court with Next Gen &mdash; thank you for that. We've got one more camp week before MCPS goes back, and this one's in Rockville &mdash; a good last shot at getting your camper playing before school starts.
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
      <strong>Back to School camp:</strong> August 17&ndash;20 (Mon&ndash;Thu) in Rockville, rain or shine, with Friday the 21st held as a makeup morning.<br>
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
      ${signatureExtrasHtml()}

    ${choiceBlock}

    <div style="${s.footer}">
      <p style="margin:0 0 8px 0;color:${c.muted};font-size:13px;line-height:1.6;">
        See you on the court &mdash; better than yesterday, together.<br>
        <strong style="color:${c.text};">Coach Sam &middot; Next Gen Pickleball Academy</strong>
      </p>
      <p style="margin:0;color:${c.muted};font-size:11px;line-height:1.5;">
        You're getting this because you inquired about Next Gen. ${
          oneClick
            ? `Prefer to stop hearing from us? <a href="${optOutUrl}" style="color:${c.muted};">Unsubscribe here</a>.`
            : `Not interested? Reply "skip" and we'll close the loop.`
        }
      </p>
    </div>
  </div>
</body>
</html>`;
}

export function campOutreachText(input: CampOutreachInput): string {
  const { parentFirst, campUrl, consentUrl, optOutUrl } = input;
  const oneClick = Boolean(consentUrl && optOutUrl);
  return [
    `Hi ${parentFirst},`,
    "",
    `A while back you reached out about getting your kid on the court with Next Gen — thank you for that. We've got one more camp week before MCPS goes back, and this one's in Rockville — a good last shot at getting your camper playing before school starts.`,
    "",
    `Here's what a morning looks like (9:30am–12:30pm ET, ages 8–16):`,
    `- Athleticism games, real drills, and live game play`,
    `- Grouped by age and skill, so every kid gets real reps and real feedback`,
    `- An end-of-day tournament — campers leave more confident than they arrived`,
    "",
    `Back to School camp: August 17–20 (Mon–Thu) in Rockville, rain or shine, with Friday the 21st held as a makeup morning.`,
    `$50 a morning, or $150 for the full week.`,
    "",
    `Register for camp: ${campUrl}`,
    "",
    `Not sure it's the right level? Just reply to this email (or text Coach Sam at 301-325-4731) and we'll figure out the right fit — or start with a free evaluation.`,
    "",
    CONSENT_ASK,
    ...(oneClick
      ? [
          `Yes, keep me posted: ${consentUrl}`,
          `No thanks, take me off the list: ${optOutUrl}`,
        ]
      : [
          `If you'd rather not hear from us, just reply "skip" and we'll take you off — no hard feelings.`,
        ]),
    "",
    `See you on the court — better than yesterday, together.`,
    `Coach Sam · Next Gen Pickleball Academy`,
    "",
    signatureExtrasText(),
    "",
    `You're getting this because you inquired about Next Gen.`,
    ...(oneClick ? [`Unsubscribe: ${optOutUrl}`] : []),
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
