// Summer Camp config — the single source of truth for the /camp registration
// flow. Camps are a distinct product from the $20 drop-in scheduler: multi-day,
// morning half-day, flat weekly price. Pricing is real (unlike the teased
// website drop-in price) because a camp is a concrete bookable product.
//
// 2026-06-15: collapsed to a single morning half-day option at $50/week (the
// standing camp price). The full-day and afternoon options were retired; their
// Stripe prices are archived and STRIPE_CAMP_FULL/PM_PRICE_ID env vars are
// unused. `CampOptionKey` is narrowed to "am" so any stray full/pm reference
// fails typecheck rather than silently 503-ing at checkout.
//
// Location is HIDDEN per NGA child-safety policy: public copy shows only the
// `publicArea` ("Gaithersburg, MD"); the exact venue is shared with registered
// families before camp. Do not put `exactLocation` in any public surface.

export type CampOptionKey = "am";

export interface CampOption {
  key: CampOptionKey;
  label: string;
  hours: string;
  /** Display price (USD). The charged amount is the Stripe price referenced by priceEnvVar. */
  priceUsd: number;
  /** Env var holding the NGA Stripe price ID for this option. */
  priceEnvVar: string;
}

export interface Camp {
  slug: string;
  /** Internal/admin title, e.g. "Summer Camp — Week 1". */
  title: string;
  /** Human week label, e.g. "June 29 – July 2, 2026". */
  weekLabel: string;
  /** Monday (ISO date-only). */
  startDate: string;
  /** Thursday (ISO date-only). */
  endDate: string;
  /** Friday makeup/rain date (ISO date-only). */
  makeupDate: string;
  /** Broad area shown publicly. */
  publicArea: string;
  /** Exact venue — admin/roster only, never public. Empty until booked. */
  exactLocation: string;
}

// Camp is ages 8+ (distinct from the academy's general 6–16 range) — the
// day-camp format runs older than the youngest private-lesson on-ramp.
export const CAMP_AGE_MIN = 8;
export const CAMP_AGE_MAX = 16;
// Macaroni Kid promo (`MACKID`, 15% off) lives in Stripe and is entered at
// checkout. Intentionally NOT advertised on the public page — it's exclusive to
// Macaroni Kid families who receive it in the campaign.

export const CAMP_OPTIONS: CampOption[] = [
  {
    key: "am",
    label: "Morning half-day",
    hours: "9:30 AM – 12:30 PM",
    priceUsd: 50,
    priceEnvVar: "STRIPE_CAMP_AM_PRICE_ID",
  },
];

export const CAMPS: Camp[] = [
  {
    slug: "june-29",
    title: "Summer Camp — Week 1",
    weekLabel: "June 29 – July 2, 2026",
    startDate: "2026-06-29",
    endDate: "2026-07-02",
    makeupDate: "2026-07-03",
    publicArea: "Gaithersburg, MD",
    exactLocation: "Gaithersburg HS, 314 South Frederick Ave, Gaithersburg, MD 20877",
  },
  {
    slug: "july-20",
    title: "Summer Camp — Week 2",
    weekLabel: "July 20 – July 23, 2026",
    startDate: "2026-07-20",
    endDate: "2026-07-23",
    makeupDate: "2026-07-24",
    publicArea: "Gaithersburg, MD",
    exactLocation: "Gaithersburg HS, 314 South Frederick Ave, Gaithersburg, MD 20877",
  },
];

export function findCampBySlug(slug: string): Camp | undefined {
  return CAMPS.find((c) => c.slug === slug);
}

export function findCampOption(key: string): CampOption | undefined {
  return CAMP_OPTIONS.find((o) => o.key === key);
}
