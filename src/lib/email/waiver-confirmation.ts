import { c, s } from "./brand";
import {
  WAIVER_VERSION,
  WAIVER_UPDATED,
  WAIVER_INTRO,
  WAIVER_SECTIONS,
} from "@/data/waiver";

// The signed-waiver confirmation email. The parent's record copy: it carries
// the FULL waiver text they agreed to plus the signed name/date/version, so the
// "stored to their email" half of the one-time-waiver requirement is the email
// body itself (no attachment needed). BCC admin; replyTo the academy inbox.

export interface WaiverConfirmationInput {
  parentFirst: string;
  signatureName: string;
  /** Human-readable signed date, e.g. "June 27, 2026". */
  signedAtLong: string;
}

function escape(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function waiverConfirmationSubject(): string {
  return "Your Next Gen waiver — signed & on file";
}

export function waiverConfirmationHtml(input: WaiverConfirmationInput): string {
  const sections = WAIVER_SECTIONS.map(
    (sec) => `
    <h3 style="font-family: Montserrat, Arial, sans-serif; color: ${c.text}; font-size: 15px; margin: 18px 0 6px;">
      ${sec.n}. ${escape(sec.title)}
    </h3>
    <p style="margin: 0; font-size: 13px; line-height: 1.6; color: ${c.muted};">
      ${escape(sec.body)}
    </p>`,
  ).join("");

  return `
<div style="${s.wrapper}">
  <h1 style="${s.heading} margin-bottom: 8px;">You're all set — waiver on file</h1>
  <p style="font-size: 15px; line-height: 1.6; color: ${c.text};">
    Hi ${escape(input.parentFirst)}, thanks for signing the Next Gen Pickleball
    Academy waiver. It covers your child for <strong>every</strong> NGA program —
    you won't be asked to sign again. Keep this email for your records.
  </p>

  <div style="${s.cardAccent}">
    <p style="margin: 0 0 6px; font-size: 13px; color: ${c.muted};">Signed by</p>
    <p style="margin: 0 0 12px; font-size: 16px; font-weight: 700; color: ${c.text};">
      ${escape(input.signatureName)}
    </p>
    <p style="margin: 0; font-size: 13px; color: ${c.muted};">
      Date: ${escape(input.signedAtLong)} &nbsp;·&nbsp; Waiver version: ${WAIVER_VERSION} (updated ${WAIVER_UPDATED})
    </p>
  </div>

  <h2 style="${s.heading} font-size: 17px; margin: 28px 0 4px;">The agreement you signed</h2>
  <p style="margin: 0 0 4px; font-size: 13px; line-height: 1.6; color: ${c.muted};">
    ${escape(WAIVER_INTRO)}
  </p>
  ${sections}

  <div style="${s.footer}">
    <p style="margin: 0; font-size: 12px; color: ${c.muted};">
      Questions about this waiver? Just reply to this email.
    </p>
  </div>
</div>`;
}

export function waiverConfirmationText(input: WaiverConfirmationInput): string {
  const sections = WAIVER_SECTIONS.map(
    (sec) => `${sec.n}. ${sec.title}\n${sec.body}`,
  ).join("\n\n");

  return [
    `Hi ${input.parentFirst}, thanks for signing the Next Gen Pickleball Academy waiver.`,
    `It covers your child for every NGA program — you won't be asked to sign again. Keep this email for your records.`,
    ``,
    `Signed by: ${input.signatureName}`,
    `Date: ${input.signedAtLong}`,
    `Waiver version: ${WAIVER_VERSION} (updated ${WAIVER_UPDATED})`,
    ``,
    `THE AGREEMENT YOU SIGNED`,
    WAIVER_INTRO,
    ``,
    sections,
    ``,
    `Questions about this waiver? Just reply to this email.`,
  ].join("\n");
}
