// Coach-side notification for a parent self-booked eval (Phase 1a). Admin-only
// recipients (Sam + academy inbox) — this email intentionally carries the full
// booking (parent contact + child first name + level) so Sam can prep, and a
// METHOD:REQUEST .ics so his mail client offers add-to-calendar without any
// Google API integration.

import { buildDropInIcs } from "./ics";
import { c, s } from "./brand";
import type { OpenEvalSlot } from "../notion-eval-slots";
import { formatLongDate, formatShortDate } from "../eval-confirmation-send";

export interface EvalBookingNotifyInput {
  parentName: string;
  parentEmail: string;
  parentPhone: string;
  childFirst: string;
  level: string;
  slot: OpenEvalSlot;
}

export function evalBookingNotifySubject(input: EvalBookingNotifyInput): string {
  return `Eval booked — ${input.childFirst} (${input.level}) · ${formatShortDate(input.slot.date)} ${input.slot.startTime}`;
}

/** METHOD:REQUEST invite for the coach's mailbox (Gmail + Apple Calendar). */
export function buildEvalBookingRequestIcs(
  input: EvalBookingNotifyInput,
  attendeeEmails: string[],
): string | null {
  const { slot } = input;
  return buildDropInIcs({
    // Distinct UID from the parent's PUBLISH .ics so the two copies never
    // collide in a shared calendar store.
    uid: `eval-${slot.date}-${encodeURIComponent(input.childFirst.toLowerCase())}-coach@nextgenpbacademy.com`,
    date: slot.date,
    startTime: slot.startTime,
    endTime: slot.endTime,
    title: `Eval: ${input.childFirst} (${input.level}) — ${slot.location}`,
    location: slot.location,
    description: `Free evaluation (self-booked). Parent: ${input.parentName}, ${input.parentEmail}, ${input.parentPhone}. Child: ${input.childFirst}, level ${input.level}.`,
    method: "REQUEST",
    organizer: {
      name: "Next Gen PB Academy",
      email: "noreply@nextgenpbacademy.com",
    },
    attendees: attendeeEmails.map((email) => ({ email })),
  });
}

export function evalBookingNotifyHtml(input: EvalBookingNotifyInput): string {
  const { slot } = input;
  const esc = (v: string) =>
    v.replace(/[<>&]/g, (ch) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" })[ch] || ch);
  return `
<div style="${s.wrapper}">
  <h1 style="${s.heading} margin-bottom: 24px;">
    Eval Self-Booked
  </h1>
  <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
    <tr style="${s.tableRow}">
      <td style="${s.tableLabelWide}">When</td>
      <td style="${s.tableValue}">${esc(formatLongDate(slot.date))}, ${esc(slot.startTime)}&ndash;${esc(slot.endTime)}</td>
    </tr>
    <tr style="${s.tableRow}">
      <td style="${s.tableLabel}">Where</td>
      <td style="${s.tableValue}">${esc(slot.location)}</td>
    </tr>
    <tr style="${s.tableRow}">
      <td style="${s.tableLabel}">Child</td>
      <td style="${s.tableValue}">${esc(input.childFirst)} &mdash; ${esc(input.level)} level</td>
    </tr>
    <tr style="${s.tableRow}">
      <td style="${s.tableLabel}">Parent</td>
      <td style="${s.tableValue}">${esc(input.parentName)}</td>
    </tr>
    <tr style="${s.tableRow}">
      <td style="${s.tableLabel}">Contact</td>
      <td style="padding: 10px 8px;">
        <a href="mailto:${esc(input.parentEmail)}" style="${s.link}">${esc(input.parentEmail)}</a>
        &middot;
        <a href="tel:${esc(input.parentPhone)}" style="${s.link}">${esc(input.parentPhone)}</a>
      </td>
    </tr>
  </table>
  <div style="${s.actionCallout}">
    <p style="${s.actionLabel}">NO ACTION NEEDED</p>
    <p style="margin: 8px 0 0; font-size: 13px; color: ${c.text};">
      The parent already got their confirmation + calendar invite. Accept the
      attached invite to put it on your calendar. The slot is marked Booked in
      the NGA Eval Slots db.
    </p>
  </div>
</div>`;
}
