import { c, s } from "./brand";
import { site } from "@/data/site";

// Rides along on the lead-form + Yellow Ball parent confirmations: confirms the
// inquiry landed, then asks the two things that let Coach Sam set up an eval in
// one reply instead of a phone-tag loop — which part of MoCo is convenient, and
// rough availability over the next week or two — and surfaces the phone as a
// real "call/text me" CTA (the footer mention is easy to miss). The phone uses
// a `tel:` link on purpose — the Yellow Ball funnel forbids email-link CTAs
// (enforced by verify-funnel.mjs). Neutral `s.card` chrome so it reads right
// inside both the lime (lead) and yellow (Yellow Ball) host emails.
export function evalQuestionsCardHtml(childFirstName?: string): string {
  const whose = childFirstName?.trim()
    ? `${childFirstName.trim()}&rsquo;s`
    : "your child&rsquo;s";
  return `<div style="${s.card}">
    <p style="margin:0 0 6px 0;font-size:13px;color:${c.muted};text-transform:uppercase;letter-spacing:0.15em;font-weight:700;">Two quick things</p>
    <p style="margin:0 0 12px 0;color:${c.text};font-size:14px;line-height:1.55;">
      To get ${whose} evaluation set up fast, it helps to know:
    </p>
    <ol style="margin:0 0 14px 0;padding-left:20px;color:${c.text};font-size:14px;line-height:1.55;">
      <li style="margin-bottom:6px;">Which part of Montgomery County is most convenient for you?</li>
      <li>Your general availability for an evaluation in the next week or two?</li>
    </ol>
    <p style="margin:0;color:${c.text};font-size:14px;line-height:1.55;">
      Just reply to this email &mdash; or call/text Coach Sam at <a href="tel:${site.phone}" style="${s.link}font-weight:700;font-size:15px;">${site.phone}</a>.
    </p>
  </div>`;
}

export function evalQuestionsText(childFirstName?: string): string {
  const whose = childFirstName?.trim()
    ? `${childFirstName.trim()}'s`
    : "your child's";
  return [
    `Two quick things to get ${whose} evaluation set up fast:`,
    `1. Which part of Montgomery County is most convenient for you?`,
    `2. Your general availability for an evaluation in the next week or two?`,
    `Just reply to this email — or call/text Coach Sam at ${site.phone}.`,
  ].join("\n");
}
