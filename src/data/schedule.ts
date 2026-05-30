export interface Season {
  label: string;
  dates: string;
}

export const seasons: Season[] = [
  { label: "Spring 2026", dates: "April 11 – June 15" },
  { label: "Summer 2026", dates: "June 18 – August 15" },
  { label: "Late Spring 2026", dates: "May 23 – June (rolling)" },
];

/**
 * NGA group pricing is uniform $20 per 1-hour slot, drop-in only, across
 * Green / Yellow Ball group sessions. Sessions split into Early and Late
 * slots — pick one or both. No subscription; non-refundable unless NGA
 * cancels the session (weather/venue/low-enrollment → auto refund). Each
 * pickleball court is capped at 4 players. Red Ball and Orange Ball =
 * private lessons (no published rate, quoted post-evaluation).
 *
 * Booking both consecutive slots is a discounted $35 two-hour bundle (one
 * $35 checkout that reserves a seat in both slots) — offered at checkout when
 * the adjacent slot is itself open. See src/lib/session-bundle.ts.
 */
export const PRICE_PER_SESSION_USD = 20;
export const REGISTRATION_WINDOW_DAYS = 30;
export const PLAYERS_PER_COURT = 4;

