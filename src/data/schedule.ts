export interface Season {
  label: string;
  dates: string;
}

export const seasons: Season[] = [
  { label: "Spring 2026", dates: "April 11 – June 15" },
  { label: "Summer 2026", dates: "June – July 2026" },
];

/**
 * NGA group pricing is a flat $20 per 1-hour session, drop-in only, across
 * all four ball colors (Red / Orange / Green / Yellow) — each runs its own
 * group court. No subscription; non-refundable unless NGA cancels
 * (weather/venue/low-enrollment → auto refund). Each pickleball court is
 * capped at 4 players. Private lessons remain available at any level as a
 * fast-track option (no published rate, quoted post-evaluation).
 */
export const PRICE_PER_SESSION_USD = 20;
export const REGISTRATION_WINDOW_DAYS = 30;
export const PLAYERS_PER_COURT = 4;

