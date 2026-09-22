import { c, s } from "./brand";
import {
  signatureExtrasHtml,
  signatureExtrasText,
} from "./signature";
import {
  MVF_JUNIOR_TOURNAMENT_DATE_LABEL,
  MVF_JUNIOR_TOURNAMENT_TIME_LABEL,
  MVF_JUNIOR_TOURNAMENT_VENUE,
  MVF_JUNIOR_TOURNAMENT_PUBLIC_AREA,
  GUARANTEED_GAMES_TEXT,
  MEDALS_TEXT,
  NO_REFUNDS_TEXT,
  RAIN_OR_SHINE_TEXT,
} from "@/data/mvf-junior-tournament-2026";

/**
 * MVF Junior Tournament pre-event reminder — sent 5 days before the event
 * (Oct 19, 2026) to PAID registrants. Carries check-in procedures and a last
 * call to share the registration link with friends. Pure builder so the copy
 * is unit-testable.
 *
 * NOTE: the check-in procedures below are DRAFT copy — Sam reserves anything
 * a paying customer reads cold. Review before the Oct 19 send.
 */
export interface MvfTournamentPreEventReminderInput {
  parentFirst: string;
  childFirst: string;
  /** "10U" / "14U" */
  divisionLabel: string;
}

/** The one date (ET) this reminder fires: 5 days before Oct 24. */
export const MVF_TOURNAMENT_PRE_EVENT_SEND_DATE_ISO = "2026-10-19";

/** Today as YYYY-MM-DD in America/New_York. */
export function todayEtIso(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const y = parts.find((p) => p.type === "year")?.value ?? "";
  const m = parts.find((p) => p.type === "month")?.value ?? "";
  const d = parts.find((p) => p.type === "day")?.value ?? "";
  return `${y}-${m}-${d}`;
}

const REGISTRATION_URL =
  "https://nextgenpbacademy.com/mvf-junior-tournament";

export function mvfTournamentPreEventReminderSubject(): string {
  return `5 days out — MVF Junior Tournament check-in details`;
}

export function mvfTournamentPreEventReminderText(
  input: MvfTournamentPreEventReminderInput,
): string {
  const { parentFirst, childFirst, divisionLabel } = input;

  return [
    `Hi ${parentFirst},`,
    ``,
    `The MVF Junior Tournament is 5 days away — ${MVF_JUNIOR_TOURNAMENT_DATE_LABEL}, ${MVF_JUNIOR_TOURNAMENT_TIME_LABEL} at ${MVF_JUNIOR_TOURNAMENT_VENUE}, ${MVF_JUNIOR_TOURNAMENT_PUBLIC_AREA}. ${childFirst} is locked in for the ${divisionLabel} division.`,
    ``,
    `CHECK-IN (please arrive by 3:30 PM):`,
    `- Check in at the NGA tent by the courts — look for the Next Gen Pickleball Academy banner.`,
    `- Players warm up together at 3:45 PM; first games start at 4:00 PM sharp.`,
    `- Format: rotating-partner round robin — ${GUARANTEED_GAMES_TEXT} ${MEDALS_TEXT}`,
    ``,
    `WHAT TO BRING:`,
    `- A refillable water bottle and court shoes — we have loaner paddles.`,
    `- Sunscreen and a light snack for between games.`,
    ``,
    `${NO_REFUNDS_TEXT} ${RAIN_OR_SHINE_TEXT}`,
    ``,
    `KNOW A FRIEND WHO SHOULD PLAY?`,
    `Spots are limited to 12 players per division and registration closes soon — forward this link: ${REGISTRATION_URL}`,
    ``,
    `See you Saturday,`,
    `Coach Sam`,
    `Next Gen Pickleball Academy`,
    ``,
    signatureExtrasText(),
  ].join("\n");
}

export function mvfTournamentPreEventReminderHtml(
  input: MvfTournamentPreEventReminderInput,
): string {
  const { parentFirst, childFirst, divisionLabel } = input;

  return `<div style="${s.wrapper}">
  <h1 style="${s.heading}">5 days out, ${parentFirst}!</h1>
  <p>The MVF Junior Tournament is this Saturday — <strong>${MVF_JUNIOR_TOURNAMENT_DATE_LABEL}, ${MVF_JUNIOR_TOURNAMENT_TIME_LABEL}</strong> at ${MVF_JUNIOR_TOURNAMENT_VENUE}, ${MVF_JUNIOR_TOURNAMENT_PUBLIC_AREA}. <strong>${childFirst}</strong> is locked in for the ${divisionLabel} division.</p>
  <div style="${s.cardAccent}">
    <p style="${s.actionLabel}">Check-in — please arrive by 3:30 PM</p>
    <ul style="margin: 8px 0 0; padding-left: 20px;">
      <li>Check in at the NGA tent by the courts — look for the Next Gen Pickleball Academy banner.</li>
      <li>Players warm up together at 3:45 PM; first games start at 4:00 PM sharp.</li>
      <li>Format: rotating-partner round robin — ${GUARANTEED_GAMES_TEXT} ${MEDALS_TEXT}</li>
    </ul>
  </div>
  <div style="${s.card}">
    <p style="${s.actionLabel}">What to bring</p>
    <ul style="margin: 8px 0 0; padding-left: 20px;">
      <li>A refillable water bottle and court shoes — we have loaner paddles.</li>
      <li>Sunscreen and a light snack for between games.</li>
    </ul>
  </div>
  <p style="color: ${c.muted};">${NO_REFUNDS_TEXT} ${RAIN_OR_SHINE_TEXT}</p>
  <div style="${s.actionCalloutYellow}">
    <p style="${s.actionLabelYellow}">Know a friend who should play?</p>
    <p style="margin: 8px 0 0;">Spots are limited to 12 players per division and registration closes soon — forward this link: <a href="${REGISTRATION_URL}" style="${s.link}">${REGISTRATION_URL}</a></p>
  </div>
  <p>See you Saturday,<br>Coach Sam<br>Next Gen Pickleball Academy</p>
  ${signatureExtrasHtml()}
</div>`;
}
