// NGA MVF Junior Tournament at North Creek Community Center, Montgomery
// Village MD.
//
// A NEW product (Sam, 2026-09-22): NGA sells this one on the NGA site —
// invoice-based signup, same pattern as lessons and the Monday Girls drop-in.
// NGA collects payment and splits revenue 80/20
// with Montgomery Village Foundation (MVF) — the split is stamped on the
// Stripe invoice metadata (nga_share_usd / mvf_share_usd); remittance is
// manual, there is no automatic transfer.
//
// EVENT: Saturday, October 24, 2026, 4:00–7:00 PM, North Creek Community
// Center.
// Format: rotating partner round robin, minimum 4 guaranteed games per
// player. Medals for the winners of each division.
//
// VENUE MOVED 2026-09-28 (Sam): Apple Ridge Courts → North Creek Community
// Center, which has lights and 3 dedicated pickleball courts. Sunset on Oct 24
// is about 6:15 PM, so the last hour of a 4–7 PM event plays under the lights.
// Nobody had registered yet (the registrations DB was empty and no invoice had
// gone out), so no family was ever told Apple Ridge and no change notice was
// needed. The address comes from `NORTH_CREEK` in mvf.ts — the same courts the
// MVF Thursday classes use — so the two can't drift. Note that MVF's North
// Creek court-renovation contingency (Watkins Mill) is written for the
// Thursday classes; it does not move this event on its own.
//
// The Link & Dink event shells for the two divisions carry their own venue in
// ld.events (community-os) — a venue change there is a separate edit.
//
// Divisions: 10U (ages 6–10 as of Oct 24, 2026) and 14U (ages 11–14
// as of Oct 24, 2026). Min 6 players per division to run, max 12.
//
// PRICING SET BY SAM 2026-09-22: $50 Montgomery Village resident, $60
// non-resident, per player. Residency is self-attested on the form; the price
// is resolved SERVER-SIDE from the resident flag — the client never sends an
// amount.
//
// POLICY (Sam 2026-09-22): No refunds. Rain or shine — we play. No rain date.

import { NORTH_CREEK } from "@/data/mvf";

export const MVF_JUNIOR_TOURNAMENT_KIND = "mvf-junior-tournament";
export const MVF_JUNIOR_TOURNAMENT_TITLE = "MVF Junior Tournament";
export const MVF_JUNIOR_TOURNAMENT_DATE_LABEL = "Saturday, October 24, 2026";
export const MVF_JUNIOR_TOURNAMENT_DATE_ISO = "2026-10-24";
export const MVF_JUNIOR_TOURNAMENT_START_TIME = "4:00 PM";
export const MVF_JUNIOR_TOURNAMENT_END_TIME = "7:00 PM";
export const MVF_JUNIOR_TOURNAMENT_TIME_LABEL = `${MVF_JUNIOR_TOURNAMENT_START_TIME.replace(/ PM$/, "")}–${MVF_JUNIOR_TOURNAMENT_END_TIME}`;
export const MVF_JUNIOR_TOURNAMENT_VENUE = NORTH_CREEK.center;
/** Street address for the "Where" lines — the page, the success page, every email. */
export const MVF_JUNIOR_TOURNAMENT_ADDRESS = `${NORTH_CREEK.streetAddress}, ${NORTH_CREEK.locality}, ${NORTH_CREEK.region} ${NORTH_CREEK.postalCode}`;
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
/** Why this venue (Sam 2026-09-28) — rendered wherever the address is. */
export const COURTS_TEXT = "3 dedicated pickleball courts with lights.";

/** The "Where" line every tournament email carries: name, address, courts. */
export const MVF_JUNIOR_TOURNAMENT_WHERE_LINE = `${MVF_JUNIOR_TOURNAMENT_VENUE}, ${MVF_JUNIOR_TOURNAMENT_ADDRESS} — ${COURTS_TEXT}`;

/**
 * What happens when a division draws fewer than 6 players.
 * Sam confirmed this merge policy on 2026-10-04.
 */
export const LOW_ENROLLMENT_POLICY_TEXT = "If either division doesn't reach the 6-player minimum, both divisions will be merged into a single division.";

export interface MvfTournamentDivision {
  division: "10u" | "14u";
  label: string;
  ageLabel: string;
  minAge: number;
  maxAge: number;
  blurb: string;
}

export const MVF_JUNIOR_TOURNAMENT_DIVISIONS: readonly MvfTournamentDivision[] = [
  {
    division: "10u",
    label: "10U",
    ageLabel: "Ages 6–10",
    minAge: 6,
    maxAge: 10,
    blurb:
      "Rotating partner round robin for players ages 6–10 as of October 24, 2026.",
  },
  {
    division: "14u",
    label: "14U",
    ageLabel: "Ages 11–14",
    minAge: 11,
    maxAge: 14,
    blurb:
      "Rotating partner round robin for players ages 11–14 as of October 24, 2026.",
  },
];

export function findMvfTournamentDivision(
  division: string,
): MvfTournamentDivision | undefined {
  return MVF_JUNIOR_TOURNAMENT_DIVISIONS.find((d) => d.division === division);
}

/** A date input must name an actual calendar day, not a normalized overflow. */
export function isCalendarDob(dobIso: string): boolean {
  if (typeof dobIso !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(dobIso)) return false;
  const date = new Date(`${dobIso}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === dobIso;
}

/** Inclusive DOB limits shared by the form and server; age is on event day. */
export function getMvfTournamentDobBounds(
  division: string,
): { min: string; max: string } | undefined {
  const selected = findMvfTournamentDivision(division);
  if (!selected) return undefined;
  const event = new Date(`${MVF_JUNIOR_TOURNAMENT_DATE_ISO}T00:00:00Z`);
  const min = new Date(event);
  min.setUTCFullYear(event.getUTCFullYear() - selected.maxAge - 1);
  min.setUTCDate(min.getUTCDate() + 1);
  const max = new Date(event);
  max.setUTCFullYear(event.getUTCFullYear() - selected.minAge);
  return { min: min.toISOString().slice(0, 10), max: max.toISOString().slice(0, 10) };
}

/** Reject invalid dates/divisions; never use today's date or local timezone. */
export function isDobEligibleForDivision(
  division: "10u" | "14u",
  dobIso: string,
): boolean {
  const bounds = getMvfTournamentDobBounds(division);
  return !!bounds && isCalendarDob(dobIso) && dobIso >= bounds.min && dobIso <= bounds.max;
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
