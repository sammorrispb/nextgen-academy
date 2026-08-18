import { signatureExtrasText } from "./signature";
/**
 * Fall 2026 season registration confirmation — the parent's "you're in"
 * email. Plain-text only, pure builder (mirrors camp-confirmation.ts) so the
 * copy is unit-testable without the slop-free webhook.
 *
 * This template MAY quote the paid amount: a real Stripe price backs the
 * season, so the no-quoting rule (which targets prices that don't exist yet)
 * doesn't apply here. The /fall SURVEY templates keep their $-ban — those
 * assertions are untouched.
 *
 * The exact venue is deliberately included: it's a closed, post-payment
 * surface (the family already registered), and the fall venue is public on
 * the events feed anyway.
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

/** "2026-09-20" → "Sunday, September 20" — pure string math, no Date. */
function formatSunday(iso: string): string {
  const [, month, day] = iso.split("-");
  return `Sunday, ${MONTHS[Number(month) - 1]} ${Number(day)}`;
}

export interface FallSeasonConfirmationInput {
  parentFirst: string;
  childFirst: string;
  /** "Green Ball" */
  groupLabel: string;
  /** "1:00–2:30 PM" */
  timeLabel: string;
  /** Already formatted, e.g. "225.00". */
  amountUsd: string;
  /** Exact venue block. */
  venue: string;
  /** The season's ISO Sundays, in order. */
  sundays: readonly string[];
  /** ISO rain/makeup dates, in order. */
  rainDates: readonly string[];
}

export function buildFallSeasonConfirmationEmail(
  input: FallSeasonConfirmationInput,
): { subject: string; text: string } {
  const {
    parentFirst,
    childFirst,
    groupLabel,
    timeLabel,
    amountUsd,
    venue,
    sundays,
    rainDates,
  } = input;

  const subject = `You're in — Next Gen Youth Fall Season (${groupLabel})`;

  const text = [
    `Hi ${parentFirst},`,
    "",
    `${childFirst} has a spot in the Next Gen Youth Fall Season — ${groupLabel}, Sundays ${timeLabel}. Welcome to the crew!`,
    "",
    `Your ${sundays.length} Sundays:`,
    ...sundays.map((d) => `- ${formatSunday(d)}`),
    "",
    `Where: ${venue}`,
    "",
    `Each Sunday is ninety minutes — coached practice first, then a rotating-partner round robin, so ${childFirst} partners with everyone in the group across the season.`,
    "",
    `If a Sunday washes out we make it up on ${rainDates.map(formatSunday).join(" or ")} — we'll email you before the weekend either way.`,
    "",
    `Paid: $${amountUsd} (full season).`,
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
