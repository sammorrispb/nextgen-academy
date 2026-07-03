// Parent "request received" email — sent by POST /api/eval-book at claim time
// (flow change 2026-07-02: bookings are REQUESTS until Sam confirms). This is
// NOT the confirmation: no .ics, no "you're booked" language — it promises
// Sam's confirmation within 24 hours. The real confirmation (+ calendar
// invite + CRM stamp) fires from the coach-portal confirm step via the shared
// sendEvalConfirmation engine.
//
// SLOP-FREE ZONE (LSN-015): parent-facing first-contact copy — drafted by the
// agent, Sam finalizes. The exact strings are listed in the PR body for edit.

import { c, s } from "./brand";
import { site } from "@/data/site";
import { escapeHtml } from "@/lib/html";

export interface EvalRequestReceivedInput {
  parentFirst: string;
  childFirst: string;
  /** "Friday, July 10, 2036" */
  dateLong: string;
  /** "5:30 PM" */
  startTime: string;
  /** "6:00 PM" */
  endTime: string;
  location: string;
}

export function evalRequestReceivedSubject(childFirst: string): string {
  return `Request received — ${childFirst}'s free evaluation`;
}

export function evalRequestReceivedHtml(input: EvalRequestReceivedInput): string {
  const esc = escapeHtml;
  return `
<div style="${s.wrapper}">
  <h1 style="${s.heading} margin-bottom: 8px;">
    Request Received!
  </h1>
  <p style="font-size: 15px; line-height: 1.6;">Hi ${esc(input.parentFirst)},</p>
  <p style="font-size: 15px; line-height: 1.6;">
    Thanks for requesting a free evaluation for ${esc(input.childFirst)}! Here&rsquo;s the time you picked:
  </p>
  <div style="${s.card}">
    <p style="margin: 0; font-size: 16px; font-weight: 700;">
      ${esc(input.dateLong)}
    </p>
    <p style="margin: 4px 0 0; font-size: 15px;">
      ${esc(input.startTime)}&ndash;${esc(input.endTime)} &middot; ${esc(input.location)}
    </p>
  </div>
  <p style="font-size: 15px; line-height: 1.6;">
    <strong>Coach Sam will confirm within 24 hours.</strong> As soon as your
    time is locked in, you&rsquo;ll get a confirmation email with a calendar
    invite. Nothing else to do right now — that time is held for you while we
    confirm.
  </p>
  <div style="${s.footer}">
    <p style="font-size: 14px; line-height: 1.6;">
      Need a different time, or have a question? Reply to this email or text
      Coach Sam at <a href="tel:${site.phone}" style="${s.link}">${site.phone}</a>.
    </p>
    <p style="font-size: 14px; line-height: 1.6; margin-top: 16px;">
      See you on the court &mdash; better than yesterday, together.<br/>
      <strong style="color: ${c.accentLime};">Coach Sam &middot; Next Gen Pickleball Academy</strong><br/>
      <a href="https://nextgenpbacademy.com" style="${s.link}">nextgenpbacademy.com</a>
    </p>
  </div>
</div>`;
}

export function evalRequestReceivedText(input: EvalRequestReceivedInput): string {
  return [
    `Hi ${input.parentFirst},`,
    "",
    `Thanks for requesting a free evaluation for ${input.childFirst}! Here's the time you picked:`,
    "",
    `${input.dateLong}`,
    `${input.startTime}-${input.endTime} at ${input.location}`,
    "",
    "Coach Sam will confirm within 24 hours. As soon as your time is locked in, you'll get a confirmation email with a calendar invite. Nothing else to do right now - that time is held for you while we confirm.",
    "",
    `Need a different time, or have a question? Reply to this email or text Coach Sam at ${site.phone}.`,
    "",
    "See you on the court - better than yesterday, together.",
    "Coach Sam · Next Gen Pickleball Academy",
    "nextgenpbacademy.com",
  ].join("\n");
}
