import { c, s } from "./brand";

/**
 * Per-row cancellation confirmation. Fires from cancelDropIn() so all four
 * cancel paths (parent self-serve PR #65, coach one-click PR #62, admin
 * curl PR #60, Stripe charge.refunded webhook PR #60) automatically send
 * it. Suppressed if Cancellation Notified is already true — that means the
 * session-wide broadcast (PR #68) already covered the parent.
 *
 * Two micro-variants:
 *   - status === "Refunded" — parent gets their payment back (Stripe-initiated
 *     refund or admin-initiated). Copy leads with the refund cue.
 *   - status === "Cancelled" — parent self-cancel without refund.
 *     Drop-ins are non-refundable; copy leads with the community cue
 *     ("seat is open for another player").
 */

export type CancelConfirmationStatus = "Cancelled" | "Refunded";

interface CancelConfirmationInput {
  parentFirst: string;
  childFirst: string;
  sessionTitle: string;
  sessionDateLong: string; // "Saturday, May 23, 2026"
  sessionStart: string; // "5:30 PM"
  status: CancelConfirmationStatus;
  amountUsd: string; // "40.00"
  scheduleUrl: string;
}

export function cancelConfirmationHtml(input: CancelConfirmationInput): string {
  const {
    parentFirst,
    childFirst,
    sessionTitle,
    sessionDateLong,
    sessionStart,
    status,
    amountUsd,
    scheduleUrl,
  } = input;

  const isRefund = status === "Refunded";

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Cancellation confirmed &mdash; ${escape(sessionTitle)}</title>
</head>
<body style="margin:0;padding:0;background:${c.bgDark};">
  <div style="${s.wrapper}">
    <p style="margin:0 0 6px 0;font-size:12px;letter-spacing:0.15em;text-transform:uppercase;color:${c.accentLime};font-weight:700;">Cancelled</p>
    <h1 style="${s.heading} margin:0 0 16px 0;">${
      isRefund
        ? `${escape(childFirst)}&rsquo;s seat is cancelled.`
        : `${escape(childFirst)}&rsquo;s seat is open for the next player.`
    }</h1>
    <p style="margin:0 0 20px 0;color:${c.text};line-height:1.55;">
      ${
        isRefund
          ? `Got it, ${escape(parentFirst)}. The reservation is off the books and your $${escape(amountUsd)} is on the way back.`
          : `Got it, ${escape(parentFirst)}. We&rsquo;ve dropped the reservation so another family can grab the slot. That&rsquo;s the community at work.`
      }
    </p>

    <div style="${s.cardAccent}">
      <p style="margin:0 0 6px 0;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:${c.accentLime};font-weight:700;">Was: ${escape(sessionDateLong)} &middot; ${escape(sessionStart)}</p>
      <p style="margin:0;font-family:Montserrat,Arial,sans-serif;font-size:18px;font-weight:900;color:${c.text};">${escape(sessionTitle)}</p>
    </div>

    ${
      isRefund
        ? `<div style="${s.actionCallout}">
            <p style="${s.actionLabel}">Refund: $${escape(amountUsd)}</p>
            <p style="margin:6px 0 0 0;color:${c.text};font-size:14px;line-height:1.55;">
              Issued to the card on file. Stripe usually has it on your statement in 5&ndash;10 business days.
            </p>
          </div>`
        : `<div style="${s.actionCallout}">
            <p style="${s.actionLabel}">No refund &mdash; that&rsquo;s the drop-in deal</p>
            <p style="margin:6px 0 0 0;color:${c.text};font-size:14px;line-height:1.55;">
              Drop-ins are non-refundable by design (it&rsquo;s how we keep the cap and the price honest). Thanks for calling it early &mdash; your seat opens up for another family.
            </p>
          </div>`
    }

    <p style="margin:28px 0 0 0;color:${c.text};line-height:1.55;">
      When you&rsquo;re ready, ${escape(childFirst)}&rsquo;s next session is one tap away.
    </p>
    <p style="margin:12px 0 0 0;">
      <a href="${scheduleUrl}" style="${s.link}font-weight:700;text-decoration:none;">See the schedule &rarr;</a>
    </p>

    <div style="${s.footer}">
      <p style="margin:0;color:${c.muted};font-size:13px;line-height:1.6;">
        See you on the next one &mdash; better than yesterday, together.<br>
        <strong style="color:${c.text};">Coach Sam &middot; Next Gen Pickleball Academy</strong>
      </p>
    </div>
  </div>
</body>
</html>`;
}

export function cancelConfirmationText(input: CancelConfirmationInput): string {
  const isRefund = input.status === "Refunded";
  return [
    `Hi ${input.parentFirst},`,
    "",
    isRefund
      ? `${input.childFirst}'s seat is cancelled.`
      : `${input.childFirst}'s seat is open for the next player.`,
    "",
    isRefund
      ? `The reservation is off the books and your $${input.amountUsd} is on the way back. Issued to the card on file — Stripe usually has it on your statement in 5–10 business days.`
      : `We've dropped the reservation so another family can grab the slot. Drop-ins are non-refundable by design (it's how we keep the cap and the price honest). Thanks for calling it early — your seat opens up for another family.`,
    "",
    `Was: ${input.sessionTitle}`,
    `${input.sessionDateLong} · ${input.sessionStart}`,
    "",
    `When you're ready, ${input.childFirst}'s next session is one tap away.`,
    `See the schedule: ${input.scheduleUrl}`,
    "",
    `See you on the next one — better than yesterday, together.`,
    `Coach Sam · Next Gen Pickleball Academy`,
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
