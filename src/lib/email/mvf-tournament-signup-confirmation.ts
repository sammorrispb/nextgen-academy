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
 * MVF Junior Tournament signup confirmation — the parent's "you're almost
 * in" email, sent at registration (BEFORE payment). Pure builder so the copy
 * is unit-testable without the checkout route.
 *
 * This is deliberately DIFFERENT from the webhook's post-payment "You're in"
 * email: the spot is not locked until the invoice is paid. The single primary
 * CTA is the hosted pay link.
 *
 * This template MAY quote the entry fee: a real Stripe invoice backs it, so
 * the no-quoting rule (which targets prices that don't exist yet) doesn't
 * apply here.
 */
export interface MvfTournamentSignupConfirmationInput {
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

export function mvfTournamentSignupConfirmationSubject(input: {
  childFirst: string;
}): string {
  return `One step left — lock in ${input.childFirst}'s MVF Junior Tournament spot`;
}

export function mvfTournamentSignupConfirmationText(
  input: MvfTournamentSignupConfirmationInput,
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
    `Thanks for registering ${childFirst} for the MVF Junior Tournament (${divisionLabel} division)! One step left: complete the $${amountUsd} entry fee (${residencyLabel}) to lock in the spot.`,
    ``,
    `Pay here: ${payUrl}`,
    ``,
    `When: ${MVF_JUNIOR_TOURNAMENT_DATE_LABEL}, ${MVF_JUNIOR_TOURNAMENT_TIME_LABEL}`,
    `Where: ${MVF_JUNIOR_TOURNAMENT_VENUE}, ${MVF_JUNIOR_TOURNAMENT_PUBLIC_AREA}`,
    `Format: rotating-partner round robin — ${GUARANTEED_GAMES_TEXT} ${MEDALS_TEXT}`,
    ``,
    `${NO_REFUNDS_TEXT} ${RAIN_OR_SHINE_TEXT}`,
    ``,
    `What to bring: a refillable water bottle and court shoes — we have loaner paddles.`,
    ``,
    `See you on the court,`,
    `Coach Sam`,
    `Next Gen Pickleball Academy`,
    ``,
    signatureExtrasText(),
  ].join("\n");
}

export function mvfTournamentSignupConfirmationHtml(
  input: MvfTournamentSignupConfirmationInput,
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
  <h1 style="${s.heading}">One step left, ${parentFirst}!</h1>
  <p>Thanks for registering <strong>${childFirst}</strong> for the MVF Junior Tournament (${divisionLabel} division). Complete the <strong>$${amountUsd}</strong> entry fee (${residencyLabel}) to lock in the spot.</p>
  <p style="margin: 24px 0;"><a href="${payUrl}" style="${s.cta}">Pay the entry fee</a></p>
  <div style="${s.card}">
    <p style="margin: 0 0 8px;"><strong>When:</strong> ${MVF_JUNIOR_TOURNAMENT_DATE_LABEL}, ${MVF_JUNIOR_TOURNAMENT_TIME_LABEL}</p>
    <p style="margin: 0 0 8px;"><strong>Where:</strong> ${MVF_JUNIOR_TOURNAMENT_VENUE}, ${MVF_JUNIOR_TOURNAMENT_PUBLIC_AREA}</p>
    <p style="margin: 0;"><strong>Format:</strong> rotating-partner round robin — ${GUARANTEED_GAMES_TEXT} ${MEDALS_TEXT}</p>
  </div>
  <p style="color: ${c.muted};">${NO_REFUNDS_TEXT} ${RAIN_OR_SHINE_TEXT}</p>
  <div style="${s.actionCallout}">
    <p style="${s.actionLabel}">What to bring</p>
    <p style="margin: 8px 0 0;">A refillable water bottle and court shoes — we have loaner paddles.</p>
  </div>
  <p>See you on the court,<br>Coach Sam<br>Next Gen Pickleball Academy</p>
  ${signatureExtrasHtml()}
</div>`;
}
