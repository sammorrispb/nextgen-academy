// Summer Camp config — the single source of truth for the /camp registration
// flow. Camps are a distinct product from the $20 drop-in scheduler: a morning
// half-day. Pricing is real (unlike the teased website drop-in price) because a
// camp is a concrete bookable product.
//
// 2026-06-15: per-morning pricing — two flat SKUs. "day" = a single Mon–Thu
// morning at $50 (parent picks which day). "week" = the full Mon–Thu morning
// week at $150 (4 mornings for the price of 3). Each SKU is one Stripe line item
// at quantity 1 — NO multi-day cart, so there's no misleading "3 days = 4 days"
// math. `priceUsd` is display-only; the charged amount is the Stripe price
// object referenced by `priceEnvVar`.
//
// Location is HIDDEN per NGA child-safety policy: public copy shows only the
// `publicArea` ("Gaithersburg, MD"); the exact venue is shared with registered
// families before camp. Do not put `exactLocation` in any public surface.

export type CampOptionKey = "day" | "week";

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
    key: "day",
    label: "Single morning",
    hours: "9:30 AM – 12:30 PM",
    priceUsd: 50,
    priceEnvVar: "STRIPE_CAMP_DAY_PRICE_ID",
  },
  {
    key: "week",
    label: "Full week (Mon–Thu)",
    hours: "9:30 AM – 12:30 PM",
    priceUsd: 150,
    priceEnvVar: "STRIPE_CAMP_WEEK_PRICE_ID",
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
  {
    // Back-to-school half-day camp the week before MCPS starts (first day
    // 2026-08-25). Mon–Thu mornings + Fri makeup, at the new weekend venue.
    slug: "august-17",
    title: "Summer Camp — Back to School",
    weekLabel: "August 17 – August 20, 2026",
    startDate: "2026-08-17",
    endDate: "2026-08-20",
    makeupDate: "2026-08-21",
    publicArea: "Rockville, MD",
    exactLocation: "Earle B. Wood Middle School, 14615 Bauer Dr, Rockville, MD 20853",
  },
];

export function findCampBySlug(slug: string): Camp | undefined {
  return CAMPS.find((c) => c.slug === slug);
}

export function findCampOption(key: string): CampOption | undefined {
  return CAMP_OPTIONS.find((o) => o.key === key);
}

// The four camp mornings as ISO date-only strings (Mon..Thu). Anchored at noon
// UTC and stepped by whole days so it never off-by-ones on Vercel's UTC build
// servers (see the date-only hazard). Single source of truth for both the
// form's day picker and validateCampForm — no recomputation drift.
export function campDays(camp: Camp): string[] {
  const startMs = new Date(`${camp.startDate}T12:00:00Z`).getTime();
  return Array.from({ length: 4 }, (_, i) =>
    new Date(startMs + i * 86_400_000).toISOString().slice(0, 10),
  );
}
