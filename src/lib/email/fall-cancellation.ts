import { c, s } from "./brand";

/**
 * Fall season cancellation confirmation. Fired by cancelFallRegistration()
 * (src/lib/cancel-fall.ts) and by the charge.refunded webhook when a fall row
 * is the one being refunded.
 *
 * EASE = Community, per COMMS TEMPLATES: a cancelled seat is a seat another
 * family can take, and that framing is the honest one on a capped season.
 *
 * Two variants, keyed on whether money actually moved:
 *   refunded → confirm the amount and when to expect it
 *   not      → confirm the withdrawal, name the policy, no refund cue
 */

export interface FallCancellationInput {
  parentFirst: string;
  childFirst: string;
  /** "Green Ball" / "Yellow Ball" */
  groupLabel: string;
  /** Dollars returned, e.g. "225.00". "0.00"/empty → withdrawal without refund. */
  refundedUsd: string;
  fallUrl: string;
}

function isRefunded(refundedUsd: string): boolean {
  return Number(refundedUsd) > 0;
}

function esc(v: string): string {
  return v
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function fallCancellationSubject(input: FallCancellationInput): string {
  return isRefunded(input.refundedUsd)
    ? `Refunded — ${input.childFirst}'s fall season spot`
    : `Cancelled — ${input.childFirst}'s fall season spot`;
}

export function fallCancellationText(input: FallCancellationInput): string {
  const { parentFirst, childFirst, groupLabel, refundedUsd, fallUrl } = input;
  const refunded = isRefunded(refundedUsd);

  const moneyLine = refunded
    ? `We've refunded $${refundedUsd} to your original payment method. Card refunds usually land in 5–10 business days.`
    : `The season has already started, so this one isn't refundable — that's the policy you agreed to at registration, and I want to be straight about it rather than leave you wondering.`;

  return [
    `Hi ${parentFirst},`,
    ``,
    `${childFirst} is cancelled out of the ${groupLabel} group for the fall season.`,
    ``,
    moneyLine,
    ``,
    `Their spot goes back into the pool — it's eight kids to a court, so it won't sit empty long, and another family gets a season they wouldn't have had.`,
    ``,
    `If this was a mistake, or something changes, just reply to this email and I'll sort it out.`,
    ``,
    `Season details if you want them later: ${fallUrl}`,
    ``,
    `Better than yesterday — together.`,
    ``,
    `Coach Sam`,
    `Next Gen Pickleball Academy`,
    `301-325-4731`,
  ].join("\n");
}

export function fallCancellationHtml(input: FallCancellationInput): string {
  const { parentFirst, childFirst, groupLabel, refundedUsd, fallUrl } = input;
  const refunded = isRefunded(refundedUsd);

  const moneyLine = refunded
    ? `We&rsquo;ve refunded <strong style="color:${c.accentLime};">$${esc(refundedUsd)}</strong> to your original payment method. Card refunds usually land in 5&ndash;10 business days.`
    : `The season has already started, so this one isn&rsquo;t refundable &mdash; that&rsquo;s the policy you agreed to at registration, and I want to be straight about it rather than leave you wondering.`;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(fallCancellationSubject(input))}</title>
</head>
<body style="margin:0;padding:0;background:${c.bgDark};">
  <div style="${s.wrapper}">
    <p>Hi ${esc(parentFirst)},</p>

    <p>${esc(childFirst)} is cancelled out of the <strong>${esc(groupLabel)}</strong>
    group for the fall season.</p>

    <div style="${s.card}">
      <p style="margin:0;">${moneyLine}</p>
    </div>

    <p>Their spot goes back into the pool &mdash; it&rsquo;s eight kids to a court,
    so it won&rsquo;t sit empty long, and another family gets a season they
    wouldn&rsquo;t have had.</p>

    <p>If this was a mistake, or something changes, just reply to this email and
    I&rsquo;ll sort it out.</p>

    <p style="color:${c.muted};font-size:14px;">
      Season details if you want them later:
      <a href="${esc(fallUrl)}" style="color:${c.accentLime};">${esc(fallUrl)}</a>
    </p>

    <p style="color:${c.muted};font-size:14px;">Better than yesterday &mdash; together.</p>

    <p style="margin-bottom:0;">
      Coach Sam<br>
      Next Gen Pickleball Academy<br>
      301-325-4731
    </p>
  </div>
</body>
</html>`;
}
