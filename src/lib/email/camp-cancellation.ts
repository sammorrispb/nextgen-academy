import { c, s } from "./brand";

/**
 * Summer Camp cancellation + refund confirmation. Camps are a separate product
 * from the $20 drop-in (no Notion roster, no seat count), so this has its own
 * template rather than reusing cancel-confirmation.ts. Fired by
 * cancelCampRegistration() (src/lib/cancel-camp.ts) and the refund-camp CLI.
 *
 * Camps ARE refundable (unlike drop-ins), so there's a single refund-cue
 * variant — when no money is returned (refund === "none") the copy drops the
 * refund line and just confirms the withdrawal.
 */

export interface CampCancellationInput {
  parentFirst: string;
  childFirst: string;
  campTitle: string;
  campWeek: string; // "July 20 – July 23, 2026"
  optionLabel: string; // "Full day"
  /** Dollars returned, e.g. "295.00". Empty/"0.00" → no-refund withdrawal. */
  refundedUsd: string;
  campsUrl: string;
}

function isRefunded(refundedUsd: string): boolean {
  return Number(refundedUsd) > 0;
}

export function campCancellationHtml(input: CampCancellationInput): string {
  const {
    parentFirst,
    childFirst,
    campTitle,
    campWeek,
    optionLabel,
    refundedUsd,
    campsUrl,
  } = input;

  const refunded = isRefunded(refundedUsd);

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Camp cancellation confirmed &mdash; ${escape(campTitle)}</title>
</head>
<body style="margin:0;padding:0;background:${c.bgDark};">
  <div style="${s.wrapper}">
    <p style="margin:0 0 6px 0;font-size:12px;letter-spacing:0.15em;text-transform:uppercase;color:${c.accentLime};font-weight:700;">Cancelled</p>
    <h1 style="${s.heading} margin:0 0 16px 0;">${escape(childFirst)}&rsquo;s camp spot is cancelled.</h1>
    <p style="margin:0 0 20px 0;color:${c.text};line-height:1.55;">
      ${
        refunded
          ? `Got it, ${escape(parentFirst)}. We&rsquo;ve taken ${escape(childFirst)} off the ${escape(campTitle)} roster and your $${escape(refundedUsd)} is on the way back.`
          : `Got it, ${escape(parentFirst)}. We&rsquo;ve taken ${escape(childFirst)} off the ${escape(campTitle)} roster.`
      }
    </p>

    <div style="${s.cardAccent}">
      <p style="margin:0 0 6px 0;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:${c.accentLime};font-weight:700;">Was: ${escape(campWeek)} &middot; ${escape(optionLabel)}</p>
      <p style="margin:0;font-family:Montserrat,Arial,sans-serif;font-size:18px;font-weight:900;color:${c.text};">${escape(campTitle)}</p>
    </div>

    ${
      refunded
        ? `<div style="${s.actionCallout}">
            <p style="${s.actionLabel}">Refund: $${escape(refundedUsd)}</p>
            <p style="margin:6px 0 0 0;color:${c.text};font-size:14px;line-height:1.55;">
              Issued to the card on file. Stripe usually has it on your statement in 5&ndash;10 business days.
            </p>
          </div>`
        : ""
    }

    <p style="margin:28px 0 0 0;color:${c.text};line-height:1.55;">
      When the timing&rsquo;s better, we&rsquo;d love to have ${escape(childFirst)} on the court. Our camp weeks and weekly sessions are one tap away.
    </p>
    <p style="margin:12px 0 0 0;">
      <a href="${campsUrl}" style="${s.link}font-weight:700;text-decoration:none;">See what&rsquo;s coming up &rarr;</a>
    </p>

    <div style="${s.footer}">
      <p style="margin:0;color:${c.muted};font-size:13px;line-height:1.6;">
        Thanks for letting us know early &mdash; better than yesterday, together.<br>
        <strong style="color:${c.text};">Coach Sam &middot; Next Gen Pickleball Academy</strong>
      </p>
    </div>
  </div>
</body>
</html>`;
}

export function campCancellationText(input: CampCancellationInput): string {
  const refunded = isRefunded(input.refundedUsd);
  return [
    `Hi ${input.parentFirst},`,
    "",
    `${input.childFirst}'s camp spot is cancelled.`,
    "",
    refunded
      ? `We've taken ${input.childFirst} off the ${input.campTitle} roster and your $${input.refundedUsd} is on the way back. Issued to the card on file — Stripe usually has it on your statement in 5–10 business days.`
      : `We've taken ${input.childFirst} off the ${input.campTitle} roster.`,
    "",
    `Was: ${input.campTitle}`,
    `${input.campWeek} · ${input.optionLabel}`,
    "",
    `When the timing's better, we'd love to have ${input.childFirst} on the court.`,
    `See what's coming up: ${input.campsUrl}`,
    "",
    `Thanks for letting us know early — better than yesterday, together.`,
    `Coach Sam · Next Gen Pickleball Academy`,
  ].join("\n");
}

function escape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
