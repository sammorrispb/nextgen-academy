// League season config — the single source of truth for the structured,
// growth-only youth league (distinct from the $20 drop-in scheduler and from
// Summer Camp). A season is a fixed-roster, 8-session commitment banded by age,
// with per-child growth tracking that lives in the community-os league app.
// See docs/youth-pickleball-league-blueprint.md for the full product design.
//
// PRICING IS TEASED, NOT QUOTED on every public surface. The only real dollar
// figure is the Stripe price referenced by `priceEnvVar` — when that env var is
// unset, the checkout route returns 503 ("enrollment isn't open yet") so the
// season product can ship dark and flip on the day the P0 launch gate clears
// and the price ID is created. `priceUsd` is an internal display value used by
// admin/confirmation surfaces only, never rendered in public JSX.
//
// LOCATION IS HIDDEN per NGA child-safety policy: public copy shows only the
// broad `publicArea`; the exact venue is shared with enrolled families before
// the season starts. Never put `exactLocation` on a public surface.

/** Age bands — division a child plays in. Age-band first, ball-color level within. */
export type LeagueBand = "7U" | "10U" | "14U" | "16U";

export interface LeagueBandInfo {
  band: LeagueBand;
  label: string;
  /** Inclusive age range for the band. */
  minAge: number;
  maxAge: number;
  /** Typical ball color(s) within the band — for public copy. */
  ballColor: "Red" | "Orange" | "Green" | "Yellow";
  /** One-line developmental framing for the public page. */
  blurb: string;
}

// Strict 6–16 academy range (no under-6 on-ramp). Bands "and under": a child
// plays the lowest division their age fits. Playing up is by coach approval,
// never down — that gate is a coach decision, not a form rule.
export const LEAGUE_AGE_MIN = 6;
export const LEAGUE_AGE_MAX = 16;

export const LEAGUE_BANDS: LeagueBandInfo[] = [
  {
    band: "7U",
    label: "7U",
    minAge: 6,
    maxAge: 7,
    ballColor: "Red",
    blurb:
      "First touches, cooperative rallying, no win/lose — FUNdamentals on a short court with the slow red ball.",
  },
  {
    band: "10U",
    label: "10U",
    minAge: 8,
    maxAge: 10,
    ballColor: "Orange",
    blurb:
      "The golden skill-acquisition years — rally to modified competition, the soft game and third shot begin.",
  },
  {
    band: "14U",
    label: "14U",
    minAge: 11,
    maxAge: 14,
    ballColor: "Green",
    blurb:
      "Competitive play, full court, real strategy — the dink battle, resets, speed-ups, moving as a unit.",
  },
  {
    band: "16U",
    label: "16U",
    minAge: 15,
    maxAge: 16,
    ballColor: "Yellow",
    blurb:
      "Tournament-grade execution and the Yellow Ball feeder — composure under pressure, leadership, mentoring.",
  },
];

export function bandForAge(age: number): LeagueBand | undefined {
  return LEAGUE_BANDS.find((b) => age >= b.minAge && age <= b.maxAge)?.band;
}

export function findBand(band: string): LeagueBandInfo | undefined {
  return LEAGUE_BANDS.find((b) => b.band === band);
}

// ── Season Stripe product (full-pay, env-gated scaffold) ─────────────────────
// Full-pay-only for v1. A deposit option (STRIPE_LEAGUE_DEPOSIT_PRICE_ID) and a
// payment-plan option (STRIPE_LEAGUE_PLAN_PRICE_ID) are intentionally deferred
// until after the P0 launch gate clears — see the launch-readiness register.

export type LeaguePriceKey = "season";

export interface LeaguePriceOption {
  key: LeaguePriceKey;
  label: string;
  /** Display price (USD). The charged amount is the Stripe price in priceEnvVar. */
  priceUsd: number;
  /** Env var holding the NGA Stripe price ID. Unset → checkout returns 503. */
  priceEnvVar: string;
}

export const LEAGUE_PRICE_OPTIONS: LeaguePriceOption[] = [
  {
    key: "season",
    label: "Full season — 8 sessions",
    // Internal/admin display only — never rendered publicly. Pilot price from
    // the launch-readiness cost model (~$240/season). Real charge is the Stripe
    // price referenced below.
    priceUsd: 240,
    priceEnvVar: "STRIPE_LEAGUE_SEASON_PRICE_ID",
  },
];

export interface LeagueSeason {
  slug: string;
  /** Internal/admin title, e.g. "Fall 2026 League — 10U". */
  title: string;
  /** Human season label shown publicly, e.g. "Fall 2026". */
  seasonLabel: string;
  band: LeagueBand;
  /** First session (ISO date-only). */
  startDate: string;
  /** Last session (ISO date-only). 8 sessions across ~9–10 weeks for weather make-ups. */
  endDate: string;
  /** Enrollment closes (ISO date-only). */
  registrationDeadline: string;
  /** Broad area shown publicly. */
  publicArea: string;
  /** Exact venue — admin/roster only, never public. Empty until booked. */
  exactLocation: string;
}

// Seeded with the pilot band only. Empty `exactLocation` until a venue + permit
// are confirmed (P0). The pilot band is 10U per the launch-readiness rec (golden
// skill age, easiest to fill).
export const LEAGUE_SEASONS: LeagueSeason[] = [
  {
    slug: "fall-2026-10u",
    title: "Fall 2026 League — 10U",
    seasonLabel: "Fall 2026",
    band: "10U",
    startDate: "2026-09-08",
    endDate: "2026-11-10",
    registrationDeadline: "2026-08-31",
    publicArea: "Montgomery County, MD",
    exactLocation: "",
  },
];

export function findSeasonBySlug(slug: string): LeagueSeason | undefined {
  return LEAGUE_SEASONS.find((s) => s.slug === slug);
}

export function findPriceOption(key: string): LeaguePriceOption | undefined {
  return LEAGUE_PRICE_OPTIONS.find((o) => o.key === key);
}
