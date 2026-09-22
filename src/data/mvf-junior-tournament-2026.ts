// NGA MVF Junior Tournament at Apple Ridge Courts, Montgomery Village MD.
//
// A NEW product (Sam, 2026-09-22): NGA sells this one on the NGA site —
// invoice-based signup, same pattern as lessons and the Monday Girls drop-in.
// NGA collects payment and splits revenue 80/20
// with Montgomery Village Foundation (MVF) — the split is stamped on the
// Stripe invoice metadata (nga_share_usd / mvf_share_usd); remittance is
// manual, there is no automatic transfer.
//
// EVENT: Saturday, October 24, 2026, 4:00–7:00 PM, Apple Ridge Courts.
// Format: rotating partner round robin, minimum 4 guaranteed games per
// player. Medals for the winners of each division.
//
// Divisions: 10U (age 10 and under as of Oct 24, 2026) and 14U (ages 11–14
// as of Oct 24, 2026). Min 6 players per division to run, max 12.
//
// PRICING SET BY SAM 2026-09-22: $50 Montgomery Village resident, $60
// non-resident, per player. Residency is self-attested on the form; the price
// is resolved SERVER-SIDE from the resident flag — the client never sends an
// amount.
//
// POLICY (Sam 2026-09-22): No refunds. Rain or shine — we play. No rain date.

export const MVF_JUNIOR_TOURNAMENT_KIND = "mvf-junior-tournament";
export const MVF_JUNIOR_TOURNAMENT_TITLE = "MVF Junior Tournament";
export const MVF_JUNIOR_TOURNAMENT_DATE_LABEL = "Saturday, October 24, 2026";
export const MVF_JUNIOR_TOURNAMENT_DATE_ISO = "2026-10-24";
export const MVF_JUNIOR_TOURNAMENT_TIME_LABEL = "4:00–7:00 PM";
export const MVF_JUNIOR_TOURNAMENT_VENUE = "Apple Ridge Courts";
export const MVF_JUNIOR_TOURNAMENT_PUBLIC_AREA = "Montgomery Village, MD";

/** Minimum players per division for the division to run. */
export const MVF_JUNIOR_TOURNAMENT_DIVISION_MIN = 6;
/** Maximum players per division — enforced as a 409 sold_out in the route. */
export const MVF_JUNIOR_TOURNAMENT_DIVISION_MAX = 12;

export const RESIDENT_PRICE_USD = 50;
export const NONRESIDENT_PRICE_USD = 60;

/** NGA's share of each entry fee; MVF gets the remainder. Remitted manually. */
export const NGA_REVENUE_SHARE = 0.8;

/** Exact copy — shown pre-submit on the form and on the success page. */
export const NO_REFUNDS_TEXT = "No refunds.";
export const RAIN_OR_SHINE_TEXT = "Rain or shine — we play. No rain date.";
export const GUARANTEED_GAMES_TEXT = "Minimum 4 guaranteed games.";
export const MEDALS_TEXT = "Medals for the winners of each division.";

/**
 * What happens when a division draws fewer than 6 players. Sam has not
 * decided yet (2026-09-22) — this constant is the single place the final
 * policy lands; nothing renders a fallback in its place.
 */
export const LOW_ENROLLMENT_POLICY_TEXT = "If either division doesn't reach the 6-player minimum, both divisions will be merged into a single division.";

export interface MvfTournamentDivision {
  division: "10u" | "14u";
  label: string;
  ageLabel: string;
  blurb: string;
}

export const MVF_JUNIOR_TOURNAMENT_DIVISIONS: readonly MvfTournamentDivision[] = [
  {
    division: "10u",
    label: "10U",
    ageLabel: "Age 10 and under",
    blurb:
      "Rotating partner round robin for players 10 and under as of October 24, 2026.",
  },
  {
    division: "14u",
    label: "14U",
    ageLabel: "Ages 11–14",
    blurb:
      "Rotating partner round robin for players ages 11–14 as of October 24, 2026.",
  },
];

export function findMvfTournamentDivision(
  division: string,
): MvfTournamentDivision | undefined {
  return MVF_JUNIOR_TOURNAMENT_DIVISIONS.find((d) => d.division === division);
}

/**
 * Is this birthdate eligible for the division? Age is taken as of the event
 * date (2026-10-24), not "today" — a player who turns 11 on October 25 still
 * plays 10U.
 *
 * 10U: born after 2015-10-24 (10 or under on event day).
 * 14U: born after 2011-10-24 and on/before 2015-10-24 (11–14 on event day).
 */
export function isDobEligibleForDivision(
  division: "10u" | "14u",
  dobIso: string,
): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dobIso)) return false;
  const TEN_U_CUTOFF = "2015-10-24";
  const FOURTEEN_U_CUTOFF = "2011-10-24";
  if (division === "10u") return dobIso > TEN_U_CUTOFF;
  return dobIso > FOURTEEN_U_CUTOFF && dobIso <= TEN_U_CUTOFF;
}

/** Resolve the per-player price server-side from the resident flag. */
export function resolveTournamentPriceUsd(resident: boolean): number {
  return resident ? RESIDENT_PRICE_USD : NONRESIDENT_PRICE_USD;
}

/** Split an entry fee 80/20 (NGA/MVF) into whole-cent-safe USD strings. */
export function splitTournamentRevenueUsd(priceUsd: number): {
  ngaShareUsd: string;
  mvfShareUsd: string;
} {
  const ngaCents = Math.round(priceUsd * 100 * NGA_REVENUE_SHARE);
  const mvfCents = priceUsd * 100 - ngaCents;
  return {
    ngaShareUsd: (ngaCents / 100).toFixed(2),
    mvfShareUsd: (mvfCents / 100).toFixed(2),
  };
}
