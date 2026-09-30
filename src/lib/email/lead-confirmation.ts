// Parent inquiry confirmation with text-to-schedule evaluation next step.

import { c, s } from "./brand";
import { EVALUATION_SMS_URL } from "@/data/scheduling";
import { site } from "@/data/site";
import { escapeHtml } from "@/lib/html";
import { signatureExtrasHtml } from "./signature";

export const LEAD_CONFIRMATION_SUBJECT =
  "Thanks for Reaching Out — Next Gen Pickleball Academy";

export interface LeadConfirmationInput {
  parentName: string;
  /** Gates the WhatsApp parent-group invite to confirmed-new families. */
  isFirstTimer: boolean;
}

export function leadConfirmationHtml(input: LeadConfirmationInput): string {
  return `
<div style="${s.wrapper}">
  <h1 style="${s.heading} margin-bottom: 8px;">
    Thanks for Reaching Out!
  </h1>
  <p style="font-size: 15px; line-height: 1.6;">Hi ${escapeHtml(input.parentName)},</p>
  <p style="font-size: 15px; line-height: 1.6;">
    Thanks for your interest in Next Gen Pickleball Academy! We’ll be in touch within 24 hours to help find the right group for your child.
  </p>
  <div style="${s.card}">
    <p style="margin: 0 0 4px; font-size: 13px; color: ${c.muted}; text-transform: uppercase; letter-spacing: 1px;">Arrange a free evaluation</p>
    <p style="margin: 0 0 12px; font-size: 15px; line-height: 1.6;">
      Text Coach Sam at ${site.phone} to arrange your child’s free 30-minute evaluation. Share the days that work and your preferred area; we’ll agree on a time and court by text.
    </p>
      ${signatureExtrasHtml()}
    <a href="${EVALUATION_SMS_URL}" style="${s.cta}">Text to schedule an evaluation →</a>
  </div>
  <div style="${s.card}">
    <p style="margin: 0 0 4px; font-size: 13px; color: ${c.muted}; text-transform: uppercase; letter-spacing: 1px;">In the meantime</p>
    <p style="margin: 0; font-size: 15px; line-height: 1.6;">
      Check out our <a href="https://nextgenpbacademy.com/schedule" style="${s.link} font-weight: 600;">upcoming sessions</a> to see what’s available.
    </p>
  </div>
  <div style="${s.footer}">
    <p style="font-size: 14px; line-height: 1.6;">
      Questions? Reply to this email or text Sam at <a href="${EVALUATION_SMS_URL}" style="${s.link}">${site.phone}</a>.
    </p>
    <p style="font-size: 14px; line-height: 1.6; margin-top: 16px;">
      See you on the court!<br/>
      <strong style="color: ${c.accentLime};">— Coach Sam &amp; Coach Amine</strong><br/>
      <span style="color: ${c.muted};">Next Gen Pickleball Academy</span><br/>
      <a href="https://nextgenpbacademy.com" style="${s.link}">nextgenpbacademy.com</a>
    </p>
  </div>
</div>`;
}
