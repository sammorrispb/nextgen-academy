import { c, s } from "./brand";
import { signatureExtrasHtml, signatureExtrasText } from "./signature";

/**
 * Pickl Park season cancellation confirmation. Fired by
 * cancelPicklParkRegistration() (src/lib/cancel-picklpark.ts) and by the
 * charge.refunded webhook when a Pickl Park row is the one being refunded.
 *
 * EASE = Community, per COMMS TEMPLATES: a cancelled seat is a seat another
 * family can take, and that framing is the honest one on a capped season.
 *
 * Two variants, keyed on whether money actually moved:
 *   refunded → confirm the amount and when to expect it
 *   not      → confirm the withdrawal, name the policy, no refund cue
 */

export interface PicklParkCancellationInput {
  parentFirst: string;
  childFirst: string;
  /** "Green Ball" / "Yellow Ball" */
  groupLabel: string;
  /** Dollars returned, e.g. "175.00". "0.00"/empty → withdrawal without refund. */
  refundedUsd: string;
  picklparkUrl: string;
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

export function picklParkCancellationSubject(
  input: PicklParkCancellationInput,
): string {
  return isRefunded(input.refundedUsd)
    ? `Refunded — ${input.childFirst}'s Pickl Park season spot`
    : `Cancelled — ${input.childFirst}'s Pickl Park season spot`;
}

export function picklParkCancellationText(
  input: PicklParkCancellationInput,
): string {
  const { parentFirst, childFirst, groupLabel, refundedUsd, picklparkUrl } = input;
  const refunded = isRefunded(refundedUsd);

  const moneyLine = refunded
    ? `We've refunded $${refundedUsd} to your original payment method. Card refunds usually land in 5–10 business days.`
    : `Registering held the spot for the full season, so this one isn't refundable — those are the terms from the registration page. I'd rather be straight about it than leave you wondering.`;

  return [
    `Hi ${parentFirst},`,
    ``,
    `${childFirst} is cancelled out of the ${groupLabel} group for the Pickl Park Saturday season.`,
    ``,
    moneyLine,
    ``,
    `Their spot goes back into the pool — it's eight kids to a group, so it won't sit empty long, and another family gets a season they wouldn't have had.`,
    ``,
    `If this was a mistake, or something changes, just reply to this email and I'll sort it out.`,
    ``,
    `Season details if you want them later: ${picklparkUrl}`,
    ``,
    `Better than yesterday — together.`,
    ``,
    `Coach Sam`,
    `Next Gen Pickleball Academy`,
    "",
    signatureExtrasText(),
    `301-325-4731`,
  ].join("\n");
}

export function picklParkCancellationHtml(
  input: PicklParkCancellationInput,
): string {
  const { parentFirst, childFirst, groupLabel, refundedUsd, picklparkUrl } = input;
  const refunded = isRefunded(refundedUsd);

  const moneyLine = refunded
    ? `We&rsquo;ve refunded <strong style="color:${c.accentLime};">$${esc(refundedUsd)}</strong> to your original payment method. Card refunds usually land in 5&ndash;10 business days.`
    : `Registering held the spot for the full season, so this one isn&rsquo;t refundable &mdash; those are the terms from the registration page. I&rsquo;d rather be straight about it than leave you wondering.`;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(picklParkCancellationSubject(input))}</title>
</head>
<body style="margin:0;padding:0;background:${c.bgDark};">
  <div style="${s.wrapper}">
    <p>Hi ${esc(parentFirst)},</p>

    <p>${esc(childFirst)} is cancelled out of the <strong>${esc(groupLabel)}</strong>
    group for the Pickl Park Saturday season.</p>

    <div style="${s.card}">
      <p style="margin:0;">${moneyLine}</p>
    </div>

    <p>Their spot goes back into the pool &mdash; it&rsquo;s eight kids to a group,
    so it won&rsquo;t sit empty long, and another family gets a season they
    wouldn&rsquo;t have had.</p>

    <p>If this was a mistake, or something changes, just reply to this email and
    I&rsquo;ll sort it out.</p>

    <p style="color:${c.muted};font-size:14px;">
      Season details if you want them later:
      <a href="${esc(picklparkUrl)}" style="color:${c.accentLime};">${esc(picklparkUrl)}</a>
    </p>

    <p style="color:${c.muted};font-size:14px;">Better than yesterday &mdash; together.</p>

    <p style="margin-bottom:0;">
      Coach Sam<br>
      Next Gen Pickleball Academy<br>
      301-325-4731
    </p>
      ${signatureExtrasHtml()}
  </div>
</body>
</html>`;
}
