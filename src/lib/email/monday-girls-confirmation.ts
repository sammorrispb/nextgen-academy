import {
  MONDAY_GIRLS_PEER_NOTE,
  MONDAY_GIRLS_SESSION_FORMAT,
  MONDAY_GIRLS_SKIPPED_REASON,
} from "@/data/monday-girls-2026";
import { signatureExtrasText } from "./signature";

/**
 * Monday Girls Beginner Group registration confirmation — the parent's "you're
 * in" email. Plain-text only, pure builder (mirrors fall-season-confirmation
 * and picklpark-season-confirmation) so the copy is unit-testable without the
 * slop-free webhook.
 *
 * This template MAY quote the paid amount: a real Stripe price backs the block,
 * so the no-quoting rule (which targets prices that don't exist yet) doesn't
 * apply here.
 *
 * The exact venue is deliberately included: it's a closed, post-payment
 * surface, and Wood MS is a public MCPS facility.
 *
 * THE SKIPPED MONDAY IS THE POINT OF THIS EMAIL. Every family in this block was
 * recruited by text quoting "Sept 14 – Oct 19". The block now ends Oct 26
 * because Sep 21 is Yom Kippur and an MCPS closure. Shipping the corrected
 * dates without naming the change would read as a bait-and-switch to a parent
 * who wrote the old dates on their calendar — so the missing Monday is called
 * out in its own paragraph, with the reason, above the date list.
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

/** "2026-09-14" → "Monday, September 14" — pure string math, no Date. */
function formatMonday(iso: string): string {
  const [, month, day] = iso.split("-");
  return `Monday, ${MONTHS[Number(month) - 1]} ${Number(day)}`;
}

export interface MondayGirlsConfirmationInput {
  parentFirst: string;
  childFirst: string;
  /** "6:00–7:00 PM" */
  timeLabel: string;
  /** Already formatted, e.g. "225.00". */
  amountUsd: string;
  /** Exact venue block. */
  venue: string;
  /** The block's ISO Mondays, in order. */
  mondays: readonly string[];
  /** The Monday the block skips (ISO), or null if none. */
  skippedDate: string | null;
  /** ISO rain dates, in order. */
  rainDates: readonly string[];
}

export function buildMondayGirlsConfirmationEmail(
  input: MondayGirlsConfirmationInput,
): { subject: string; text: string } {
  const {
    parentFirst,
    childFirst,
    timeLabel,
    amountUsd,
    venue,
    mondays,
    skippedDate,
    rainDates,
  } = input;

  const subject = `You're in — ${childFirst} has a spot in the Monday Girls group`;

  const text = [
    `Hi ${parentFirst},`,
    "",
    `${childFirst} has a spot in the Next Gen Monday Girls Beginner Group — Mondays ${timeLabel}. Welcome to the crew!`,
    "",
    MONDAY_GIRLS_PEER_NOTE,
    "",
    ...(skippedDate
      ? [
          `ONE SCHEDULE NOTE, and it may not match what we first told you: we skip ${formatMonday(
            skippedDate,
          )} — ${MONDAY_GIRLS_SKIPPED_REASON} So the block runs one week later than the dates in our early texts. You still get all ${mondays.length} sessions. The full list is right here:`,
          "",
        ]
      : [`Your ${mondays.length} Mondays:`, ""]),
    ...mondays.map((d) => `- ${formatMonday(d)}`),
    "",
    `Where: ${venue}`,
    "",
    `Each Monday is a full hour — ${MONDAY_GIRLS_SESSION_FORMAT}. It's a small group on one court, so ${childFirst} gets real coaching time every single week, not a spot in a line.`,
    "",
    ...(rainDates.length
      ? [
          `We're outdoors, so if a Monday gets rained out we make it up on ${rainDates
            .map(formatMonday)
            .join(" or ")} and text you before you leave the house.`,
          "",
        ]
      : []),
    `Paid: $${amountUsd} (full ${mondays.length}-session block).`,
    "",
    `That holds ${childFirst}'s spot for the whole block, so it's non-refundable if you withdraw. If we ever have to cancel sessions we can't make up, we refund the ones we didn't run.`,
    "",
    `What to bring each week:`,
    `- Refillable water bottle`,
    `- Court shoes (no flat-soled sneakers)`,
    `- A paddle if you have one — we have loaners.`,
    "",
    `Questions? Just reply to this email or text Coach Sam at 301-325-4731.`,
    "",
    `See you Monday — better than yesterday, together.`,
    `Coach Sam · Next Gen Pickleball Academy`,
    "",
    signatureExtrasText(),
  ].join("\n");

  return { subject, text };
}
