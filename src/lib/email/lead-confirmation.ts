// Parent confirmation for the lead form — extracted from the inline HTML in
// src/app/api/lead/route.ts (Phase 1a ride-along; that route is minor-PII, so
// the template now lives beside the other email modules instead of inside the
// handler). Adds the /free-evaluation/book self-scheduling CTA — the piece
// that deletes the email/phone tag from eval scheduling.

import { c, s } from "./brand";
import { site } from "@/data/site";
import { whatsappInviteHtml } from "./whatsapp-invite";

export const LEAD_CONFIRMATION_SUBJECT =
  "Thanks for Reaching Out — Next Gen Pickleball Academy";

const BOOK_URL = "https://nextgenpbacademy.com/free-evaluation/book";

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
  <p style="font-size: 15px; line-height: 1.6;">Hi ${input.parentName},</p>
  <p style="font-size: 15px; line-height: 1.6;">
    Thanks for your interest in Next Gen Pickleball Academy! We’ll be in touch within 24 hours to help find the right group for your child.
  </p>
  <div style="${s.card}">
    <p style="margin: 0 0 4px; font-size: 13px; color: ${c.muted}; text-transform: uppercase; letter-spacing: 1px;">Skip the phone tag</p>
    <p style="margin: 0 0 12px; font-size: 15px; line-height: 1.6;">
      Want to lock in your child’s free evaluation right now? Pick any open time that works for you — you’ll get an instant confirmation with a calendar invite.
    </p>
    <a href="${BOOK_URL}" style="${s.cta}">Pick your eval time →</a>
  </div>
  <div style="${s.card}">
    <p style="margin: 0 0 4px; font-size: 13px; color: ${c.muted}; text-transform: uppercase; letter-spacing: 1px;">In the meantime</p>
    <p style="margin: 0; font-size: 15px; line-height: 1.6;">
      Check out our <a href="https://nextgenpbacademy.com/schedule" style="${s.link} font-weight: 600;">upcoming sessions</a> to see what’s available.
    </p>
  </div>
  ${input.isFirstTimer ? whatsappInviteHtml() : ""}
  <div style="${s.footer}">
    <p style="font-size: 14px; line-height: 1.6;">
      Questions? Reply to this email or text Sam at <a href="tel:${site.phone}" style="${s.link}">${site.phone}</a>.
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
