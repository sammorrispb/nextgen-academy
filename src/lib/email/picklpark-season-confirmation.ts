import { PICKLPARK_INDOOR_NOTE } from "@/data/picklpark-2026";
import { signatureExtrasText } from "./signature";
/**
 * Pickl Park Saturday season registration confirmation — the parent's "you're
 * in" email. Plain-text only, pure builder (mirrors fall-season-confirmation)
 * so the copy is unit-testable without the slop-free webhook.
 *
 * This template MAY quote the paid amount: a real Stripe price backs the
 * season, so the no-quoting rule (which targets prices that don't exist yet)
 * doesn't apply here.
 *
 * The exact venue is deliberately included: it's a closed, post-payment
 * surface, and The Pickl Park is a public commercial facility.
 */

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

/** "2026-10-03" → "Saturday, October 3" — pure string math, no Date. */
function formatSaturday(iso: string): string {
  const [, month, day] = iso.split("-");
  return `Saturday, ${MONTHS[Number(month) - 1]} ${Number(day)}`;
}

export interface PicklParkSeasonConfirmationInput {
  parentFirst: string;
  childFirst: string;
  /** "Red & Orange Ball" */
  groupLabel: string;
  /** "3:00–4:00 PM" */
  timeLabel: string;
  /** Already formatted, e.g. "225.00". */
  amountUsd: string;
  /** Exact venue block. */
  venue: string;
  /** The season's ISO Saturdays, in order. */
  saturdays: readonly string[];
  /** ISO makeup dates, in order. */
  makeupDates: readonly string[];
}

export function buildPicklParkSeasonConfirmationEmail(
  input: PicklParkSeasonConfirmationInput,
): { subject: string; text: string } {
  const {
    parentFirst,
    childFirst,
    groupLabel,
    timeLabel,
    amountUsd,
    venue,
    saturdays,
    makeupDates,
  } = input;

  const subject = `You're in — Next Gen Pickl Park Saturday Season (${groupLabel})`;

  const text = [
    `Hi ${parentFirst},`,
    "",
    `${childFirst} has a spot in the Next Gen Pickl Park Saturday Season — ${groupLabel}, Saturdays ${timeLabel}. Welcome to the crew!`,
    "",
    `Your ${saturdays.length} Saturdays:`,
    ...saturdays.map((d) => `- ${formatSaturday(d)}`),
    "",
    `Where: ${venue}`,
    "",
    `Each Saturday is a full hour on dedicated pickleball courts — coached practice first, then a rotating-partner round robin, so ${childFirst} partners with everyone in the group across the season.`,
    "",
    PICKLPARK_INDOOR_NOTE,
    "",
    `In the rare case a Saturday can't run — a facility closure, say — we make it up on ${makeupDates.map(formatSaturday).join(" or ")} and email you before the weekend.`,
    "",
    `Paid: $${amountUsd} (full season).`,
    "",
    `That holds ${childFirst}'s spot for all six Saturdays, so it's non-refundable if you withdraw. If we ever have to cancel sessions we can't make up, we refund the ones we didn't run.`,
    "",
    `What to bring each week:`,
    `- Refillable water bottle`,
    `- Court shoes (no flat-soled sneakers)`,
    `- A paddle if you have one — we have loaners.`,
    "",
    `Questions? Just reply to this email or text Coach Sam at 301-325-4731.`,
    "",
    `See you on the court — better than yesterday, together.`,
    `Coach Sam · Next Gen Pickleball Academy`,
    "",
    signatureExtrasText(),
  ].join("\n");

  return { subject, text };
}
