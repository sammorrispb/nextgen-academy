import { c, s } from "./brand";

interface ReferralFriendRewardInput {
  parentFirst: string;
  childFirst: string;
  referrerFirst: string;
  promoCode: string;
  amountOffLabel: string;
  scheduleUrl: string;
}

/**
 * Sent to the *friend* — the parent who signed up via someone else's
 * forward-this-email link and just played their first paid drop-in. Carries
 * a single-use 50% promo code for their next session. EASE = Community ("you
 * came in through a friend, now you're crew").
 */
export function referralFriendRewardHtml(
  input: ReferralFriendRewardInput,
): string {
  const {
    parentFirst,
    childFirst,
    referrerFirst,
    promoCode,
    amountOffLabel,
    scheduleUrl,
  } = input;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escape(amountOffLabel)} off your next session, ${escape(parentFirst)}</title>
</head>
<body style="margin:0;padding:0;background:${c.bgDark};">
  <div style="${s.wrapper}">
    <p style="margin:0 0 6px 0;font-size:12px;letter-spacing:0.15em;text-transform:uppercase;color:${c.accentLime};font-weight:700;">Welcome to the crew</p>
    <h1 style="${s.heading} margin:0 0 16px 0;">Nice rep, ${escape(childFirst)}.</h1>
    <p style="margin:0 0 20px 0;color:${c.text};line-height:1.55;">
      ${escape(referrerFirst)} sent you our way and you showed up &mdash; thanks for trusting us with ${escape(childFirst)}&rsquo;s first session. As a thanks for coming in through the crew, here&rsquo;s ${escape(amountOffLabel)} off your next one.
    </p>

    <div style="${s.cardAccent}">
      <p style="margin:0 0 6px 0;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:${c.accentLime};font-weight:700;">Your code</p>
      <p style="margin:0 0 10px 0;font-family:'Roboto Mono',Menlo,monospace;font-size:22px;font-weight:900;color:${c.text};letter-spacing:0.08em;">${escape(promoCode)}</p>
      <p style="margin:0;color:${c.muted};font-size:13px;line-height:1.5;">Single-use, ${escape(amountOffLabel)} off any drop-in. Enter at checkout when you book your next session.</p>
    </div>

    <div style="${s.actionCallout}">
      <p style="${s.actionLabel}">Book the next one</p>
      <p style="margin:6px 0 0 0;color:${c.text};font-size:14px;line-height:1.55;">
        Sessions cap at 4 players per court and fill from the front. Lock the next slot in while it&rsquo;s open.
      </p>
      <p style="margin:14px 0 0 0;">
        <a href="${scheduleUrl}" style="${s.link}font-weight:700;text-decoration:none;">See open sessions &rarr;</a>
      </p>
    </div>

    <div style="${s.footer}">
      <p style="margin:0 0 8px 0;color:${c.muted};font-size:13px;line-height:1.6;">
        See you on the court &mdash; better than yesterday, together.<br>
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

export function referralFriendRewardText(
  input: ReferralFriendRewardInput,
): string {
  const {
    parentFirst,
    childFirst,
    referrerFirst,
    promoCode,
    amountOffLabel,
    scheduleUrl,
  } = input;
  return [
    `Nice rep, ${childFirst}.`,
    "",
    `${referrerFirst} sent you our way and you showed up — thanks for trusting us with ${childFirst}'s first session, ${parentFirst}. As a thanks for coming in through the crew, here's ${amountOffLabel} off your next one.`,
    "",
    `Your code: ${promoCode}`,
    `Single-use, ${amountOffLabel} off any drop-in. Enter at checkout when you book your next session.`,
    "",
    `Book the next one — sessions cap at 4 players per court and fill from the front.`,
    `See open sessions: ${scheduleUrl}`,
    "",
    `See you on the court — better than yesterday, together.`,
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
