import { c, s } from "./brand";
import {
  FALL_END_TIME,
  FALL_NO_HOLD_NOTE,
  FALL_SEASON_LABEL,
  FALL_START_TIME,
  FALL_VENUE_SHORT,
  type FallTrack,
} from "@/data/fall-2026";
import { signatureExtrasHtml, signatureExtrasText } from "./signature";

export interface FallInterestConfirmationInput {
  firstName: string;
  tracks: FallTrack[];
  days: string[];
  commitment: string;
  subListInterest: boolean;
}

export function fallInterestConfirmationSubject(): string {
  return "Got it — thanks for the fall feedback";
}

function trackLabel(tracks: FallTrack[]): string {
  const youth = tracks.includes("youth");
  const adult = tracks.includes("adult");
  if (youth && adult) return "Your kid's season and your own round robin";
  if (adult) return "The adult round robin";
  return "The youth season";
}

/**
 * Sent to anyone who answers the /fall season survey. Deliberately short: it
 * reflects their answers back so they know we heard them, and it states plainly
 * that nothing is reserved. Never names the child — the survey answer is about
 * the season, and the fewer surfaces a kid's name touches, the better.
 */
export function fallInterestConfirmationHtml(
  input: FallInterestConfirmationInput,
): string {
  const { firstName, tracks, days, commitment, subListInterest } = input;

  const subBlock = subListInterest
    ? `<p style="margin:12px 0 0 0;color:${c.text};font-size:14px;line-height:1.6;">
        You&rsquo;re on the <strong>sub list</strong> too &mdash; we&rsquo;ll reach out when a
        week-to-week spot opens up.
      </p>`
    : "";

  return `<!DOCTYPE html>
<html>
<body style="margin:0;padding:24px 12px;background:${c.bgDark};">
  <div style="${s.wrapper}">
    <p style="margin:0 0 8px 0;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:${c.accentLime};font-weight:700;">Fall 2026</p>
    <h1 style="${s.heading} margin:0 0 20px 0;">Thanks, ${escape(firstName)}.</h1>

    <p style="margin:0 0 20px 0;color:${c.text};font-size:15px;line-height:1.65;">
      That&rsquo;s exactly what we needed. We&rsquo;re working out whether a fall season at
      ${FALL_VENUE_SHORT} can run &mdash; ${FALL_SEASON_LABEL},
      ${FALL_START_TIME}&ndash;${FALL_END_TIME} &mdash; and your answer
      is part of that call.
    </p>

    <div style="${s.card}">
      <p style="margin:0 0 12px 0;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:${c.muted};font-weight:700;">What you told us</p>
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        <tr style="${s.tableRow}">
          <td style="${s.tableLabelWide}">Interested in</td>
          <td style="${s.tableValue}">${trackLabel(tracks)}</td>
        </tr>
        <tr style="${s.tableRow}">
          <td style="${s.tableLabelWide}">Days that work</td>
          <td style="${s.tableValue}">${escape(days.join(", "))}</td>
        </tr>
        <tr>
          <td style="${s.tableLabelWide}">Full season</td>
          <td style="${s.tableValue}">${escape(commitment)}</td>
        </tr>
      </table>
      ${subBlock}
    </div>

    <div style="${s.actionCallout}">
      <p style="${s.actionLabel}">One thing to be clear about</p>
      <p style="margin:8px 0 0 0;color:${c.text};font-size:14px;line-height:1.6;">${FALL_NO_HOLD_NOTE}</p>
    </div>

    <p style="margin:24px 0 0 0;color:${c.text};font-size:15px;line-height:1.65;">
      Anything else on your mind about the fall &mdash; a day that would work better, a
      level question, a friend who&rsquo;d want in &mdash; just reply to this email. It
      comes straight to me.
    </p>

    <div style="${s.footer}">
      <p style="margin:0;color:${c.muted};font-size:13px;line-height:1.6;">
        Coach Sam<br>
        Next Gen Pickleball Academy
      </p>
      ${signatureExtrasHtml()}
    </div>
  </div>
</body>
</html>`;
}

export function fallInterestConfirmationText(
  input: FallInterestConfirmationInput,
): string {
  const { firstName, tracks, days, commitment, subListInterest } = input;

  const lines: string[] = [
    `Thanks, ${firstName}.`,
    "",
    `That's exactly what we needed. We're working out whether a fall season at ${FALL_VENUE_SHORT} can run — ${FALL_SEASON_LABEL}, ${FALL_START_TIME}–${FALL_END_TIME} — and your answer is part of that call.`,
    "",
    "WHAT YOU TOLD US",
    `Interested in: ${trackLabel(tracks)}`,
    `Days that work: ${days.join(", ")}`,
    `Full season: ${commitment}`,
  ];

  if (subListInterest) {
    lines.push(
      "You're on the sub list too — we'll reach out when a week-to-week spot opens up.",
    );
  }

  lines.push(
    "",
    "ONE THING TO BE CLEAR ABOUT",
    FALL_NO_HOLD_NOTE,
    "",
    "Anything else on your mind about the fall — a day that would work better, a level question, a friend who'd want in — just reply to this email. It comes straight to me.",
    "",
    "Coach Sam",
    "Next Gen Pickleball Academy",
    "",
    signatureExtrasText(),
  );

  return lines.join("\n");
}

function escape(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
