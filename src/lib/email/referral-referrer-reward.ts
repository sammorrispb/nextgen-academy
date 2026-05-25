import { c, s } from "./brand";

interface ReferralReferrerRewardInput {
  parentFirst: string;
  friendFirst: string;
  friendChildFirst: string;
  promoCode: string;
  amountOffLabel: string;
  scheduleUrl: string;
}

/**
 * Sent to the *referrer* — the existing subscriber whose forward-this-email
 * link a new family signed up through, after that family's kid played their
 * first paid drop-in. Carries a single-use 50% promo code as a thanks for
 * growing the crew. EASE = Community.
 */
export function referralReferrerRewardHtml(
  input: ReferralReferrerRewardInput,
): string {
  const {
    parentFirst,
    friendFirst,
    friendChildFirst,
    promoCode,
    amountOffLabel,
    scheduleUrl,
  } = input;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>You brought someone into the crew, ${escape(parentFirst)}</title>
</head>
<body style="margin:0;padding:0;background:${c.bgDark};">
  <div style="${s.wrapper}">
    <p style="margin:0 0 6px 0;font-size:12px;letter-spacing:0.15em;text-transform:uppercase;color:${c.accentLime};font-weight:700;">Crew grew</p>
    <h1 style="${s.heading} margin:0 0 16px 0;">${escape(friendChildFirst)} just played, ${escape(parentFirst)}.</h1>
    <p style="margin:0 0 20px 0;color:${c.text};line-height:1.55;">
      ${escape(friendFirst)} found us through your forward and ${escape(friendChildFirst)} just played their first session. The community grows because parents like you make the introduction &mdash; here&rsquo;s ${escape(amountOffLabel)} off your next session as a thanks.
    </p>

    <div style="${s.cardAccent}">
      <p style="margin:0 0 6px 0;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:${c.accentLime};font-weight:700;">Your code</p>
      <p style="margin:0 0 10px 0;font-family:'Roboto Mono',Menlo,monospace;font-size:22px;font-weight:900;color:${c.text};letter-spacing:0.08em;">${escape(promoCode)}</p>
      <p style="margin:0;color:${c.muted};font-size:13px;line-height:1.5;">Single-use, ${escape(amountOffLabel)} off any drop-in. Enter at checkout when you book your next session.</p>
    </div>

    <div style="${s.actionCallout}">
      <p style="${s.actionLabel}">Book your next one</p>
      <p style="margin:6px 0 0 0;color:${c.text};font-size:14px;line-height:1.55;">
        Every newsletter has your personal forward link &mdash; keep sharing it. The more crew, the more crews we can run.
      </p>
      <p style="margin:14px 0 0 0;">
        <a href="${scheduleUrl}" style="${s.link}font-weight:700;text-decoration:none;">See open sessions &rarr;</a>
      </p>
    </div>

    <div style="${s.footer}">
      <p style="margin:0 0 8px 0;color:${c.muted};font-size:13px;line-height:1.6;">
        Better than yesterday, together.<br>
        <strong style="color:${c.text};">Coach Sam &middot; Next Gen Pickleball Academy</strong>
      </p>
      <p style="margin:0;color:${c.muted};font-size:11px;line-height:1.5;">
        Single-use, no expiration. Reply to this email if you have any trouble using it.
      </p>
    </div>
  </div>
</body>
</html>`;
}

export function referralReferrerRewardText(
  input: ReferralReferrerRewardInput,
): string {
  const {
    parentFirst,
    friendFirst,
    friendChildFirst,
    promoCode,
    amountOffLabel,
    scheduleUrl,
  } = input;
  return [
    `${friendChildFirst} just played, ${parentFirst}.`,
    "",
    `${friendFirst} found us through your forward and ${friendChildFirst} just played their first session. The community grows because parents like you make the introduction — here's ${amountOffLabel} off your next session as a thanks.`,
    "",
    `Your code: ${promoCode}`,
    `Single-use, ${amountOffLabel} off any drop-in. Enter at checkout when you book your next session.`,
    "",
    `Book your next one — every newsletter has your personal forward link, keep sharing it.`,
    `See open sessions: ${scheduleUrl}`,
    "",
    `Better than yesterday, together.`,
    `Coach Sam · Next Gen Pickleball Academy`,
    "",
    `Single-use, no expiration. Reply to this email if you have any trouble using it.`,
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
