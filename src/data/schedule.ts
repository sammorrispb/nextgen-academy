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
 * NGA group pricing is uniform $40 per 1-hour slot, drop-in only, across
 * Green / Yellow Ball group sessions. Sessions split into Early and Late
 * slots — pick one or both ($80 for both). No subscription, no refunds.
 * Each pickleball court is capped at 4 players. Red Ball and Orange Ball =
 * private lessons (no published rate, quoted post-evaluation).
 */
export const PRICE_PER_SESSION_USD = 40;
export const REGISTRATION_WINDOW_DAYS = 30;
export const PLAYERS_PER_COURT = 4;

