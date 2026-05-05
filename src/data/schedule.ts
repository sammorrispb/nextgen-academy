export interface Season {
  label: string;
  dates: string;
}

export const seasons: Season[] = [
  { label: "Spring 2026", dates: "April 11 – June 15" },
  { label: "Summer 2026", dates: "June 18 – August 15" },
];

/**
 * NGA pricing is uniform: $35/session across all levels (Red/Orange/Green/Yellow),
 * billed monthly via Stripe Subscription. Mid-month signups are prorated.
 */
export const PRICE_PER_SESSION_USD = 35;

