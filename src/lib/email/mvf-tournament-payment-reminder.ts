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
  NO_REFUNDS_TEXT,
  RAIN_OR_SHINE_TEXT,
} from "@/data/mvf-junior-tournament-2026";

/**
 * MVF Junior Tournament payment reminder — sent 5 days after signup when the
 * invoice is still unpaid. The invoice is due in 7 days, so this is the
 * last-chance nudge. Pure builder so the copy is unit-testable.
 *
 * May quote the entry fee: a real Stripe invoice backs it.
 */
export interface MvfTournamentPaymentReminderInput {
  parentFirst: string;
  childFirst: string;
  /** "10U" / "14U" */
  divisionLabel: string;
  /** Already formatted, e.g. "50.00". */
  amountUsd: string;
  /** "MV resident" / "non-resident" */
  residencyLabel: string;
  /** Hosted Stripe invoice pay link. */
  payUrl: string;
}

export function mvfTournamentPaymentReminderSubject(input: {
  childFirst: string;
}): string {
  return `${input.childFirst}'s tournament spot expires in 2 days — finish payment`;
}

export function mvfTournamentPaymentReminderText(
  input: MvfTournamentPaymentReminderInput,
): string {
  const {
    parentFirst,
    childFirst,
    divisionLabel,
    amountUsd,
    residencyLabel,
    payUrl,
  } = input;

  return [
    `Hi ${parentFirst},`,
    ``,
    `Quick heads-up: ${childFirst}'s MVF Junior Tournament (${divisionLabel} division) registration is still awaiting the $${amountUsd} entry fee (${residencyLabel}). The invoice expires in 2 days, and spots go to paid players first.`,
    ``,
    `Finish payment here: ${payUrl}`,
    ``,
    `When: ${MVF_JUNIOR_TOURNAMENT_DATE_LABEL}, ${MVF_JUNIOR_TOURNAMENT_TIME_LABEL}`,
    `Where: ${MVF_JUNIOR_TOURNAMENT_VENUE}, ${MVF_JUNIOR_TOURNAMENT_PUBLIC_AREA}`,
    ``,
    `${NO_REFUNDS_TEXT} ${RAIN_OR_SHINE_TEXT}`,
    ``,
    `Already paid or need a hand? Just reply to this email.`,
    ``,
    `Coach Sam`,
    `Next Gen Pickleball Academy`,
    ``,
    signatureExtrasText(),
  ].join("\n");
}

export function mvfTournamentPaymentReminderHtml(
  input: MvfTournamentPaymentReminderInput,
): string {
  const {
    parentFirst,
    childFirst,
    divisionLabel,
    amountUsd,
    residencyLabel,
    payUrl,
  } = input;

  return `<div style="${s.wrapper}">
  <h1 style="${s.headingYellow}">${childFirst}'s spot expires in 2 days</h1>
  <p>Hi ${parentFirst} — quick heads-up: ${childFirst}'s MVF Junior Tournament (${divisionLabel} division) registration is still awaiting the <strong>$${amountUsd}</strong> entry fee (${residencyLabel}). The invoice expires in 2 days, and spots go to paid players first.</p>
  <p style="margin: 24px 0;"><a href="${payUrl}" style="${s.cta}">Finish payment</a></p>
  <div style="${s.card}">
    <p style="margin: 0 0 8px;"><strong>When:</strong> ${MVF_JUNIOR_TOURNAMENT_DATE_LABEL}, ${MVF_JUNIOR_TOURNAMENT_TIME_LABEL}</p>
    <p style="margin: 0;"><strong>Where:</strong> ${MVF_JUNIOR_TOURNAMENT_VENUE}, ${MVF_JUNIOR_TOURNAMENT_PUBLIC_AREA}</p>
  </div>
  <p style="color: ${c.muted};">${NO_REFUNDS_TEXT} ${RAIN_OR_SHINE_TEXT}</p>
  <p>Already paid or need a hand? Just reply to this email.</p>
  <p>Coach Sam<br>Next Gen Pickleball Academy</p>
  ${signatureExtrasHtml()}
</div>`;
}
