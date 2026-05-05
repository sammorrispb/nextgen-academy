export interface Season {
  label: string;
  dates: string;
}

export const seasons: Season[] = [
  { label: "Spring 2026", dates: "April 11 – June 15" },
  { label: "Summer 2026", dates: "June 18 – August 15" },
];

/**
 * NGA pricing is uniform $35 per session, drop-in only across all levels
 * (Red/Orange/Green/Yellow). No subscription, no refunds. Each session opens
 * for registration 7 days ahead and is capped at 4 players per court.
 */
export const PRICE_PER_SESSION_USD = 35;
export const REGISTRATION_WINDOW_DAYS = 7;
export const PLAYERS_PER_COURT = 4;

