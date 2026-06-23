/**
 * Summer Camp registration confirmation — the parent's "you're registered"
 * email. Plain-text only (matches the existing inline body the Stripe webhook
 * sent before this was extracted). Pulled into a pure builder so the copy can
 * be unit-tested without the slop-free webhook; mirrors the camp-cancellation.ts
 * template precedent.
 *
 * `location` is pre-resolved by the caller: the webhook reads the camp's exact
 * venue from camps.ts (a closed, post-payment surface — never public) and passes
 * the two-line "Where" block; if no exact venue is set yet it passes the broad
 * area fallback. Keeping the camps.ts lookup in the caller leaves this template
 * pure.
 */

export interface CampConfirmationInput {
  parentFirst: string;
  childFirst: string;
  campTitle: string;
  campWeek: string; // "June 29 – July 2, 2026"
  optionLabel: string; // "Full week (Mon–Thu)"
  optionHours: string; // "9:30 AM – 12:30 PM"
  /** Already formatted, e.g. "150.00". */
  amountUsd: string;
  /** Resolved "Where" block — exact venue (may be multi-line) or broad-area fallback. */
  location: string;
}

export function buildCampConfirmationEmail(input: CampConfirmationInput): {
  subject: string;
  text: string;
} {
  const {
    parentFirst,
    childFirst,
    campTitle,
    campWeek,
    optionLabel,
    optionHours,
    amountUsd,
    location,
  } = input;

  const subject = `You're registered — ${campTitle}`;

  const text = [
    `Hi ${parentFirst},`,
    "",
    `${childFirst} is registered for Next Gen Summer Camp!`,
    "",
    `${campTitle}`,
    `${campWeek} (Mon–Thu)`,
    `${optionLabel} · ${optionHours}`,
    "",
    `Where: ${location}`,
    "",
    `We're outdoors on the courts. There's shade and a water cooler on site, and we play rain or shine — send a refillable water bottle and dress for the weather.`,
    "",
    `Paid: $${amountUsd}.`,
    "",
    `What to bring each day:`,
    `- Refillable water bottle`,
    `- Court shoes (no flat-soled sneakers)`,
    `- A morning snack`,
    `- A paddle if you have one — we have loaners.`,
    "",
    `Questions? Just reply to this email or text Coach Sam at 301-325-4731.`,
    "",
    `See you on the court — better than yesterday, together.`,
    `Coach Sam · Next Gen Pickleball Academy`,
  ].join("\n");

  return { subject, text };
}
