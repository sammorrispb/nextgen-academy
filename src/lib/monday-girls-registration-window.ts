import { MONDAY_GIRLS_MONDAYS } from "@/data/monday-girls-2026";
import { MONDAY_GIRLS_SEASON_PRICE_ENV_VAR } from "@/data/monday-girls-season-2026";

/**
 * Whether /monday-girls offers registration — the block's ONE gate, shared by
 * the page and the form so the two can never disagree about whether the season
 * is for sale.
 *
 * THREE legs, and the third is the one this block adds over
 * picklpark-registration-window:
 *
 *  1. KILL SWITCH — NEXT_PUBLIC_MONDAY_GIRLS_REGISTRATION_OPEN. Unset/blank and
 *     "true" both mean "let the calendar decide"; ANY other value closes. An
 *     operator setting this env var is trying to STOP sales, so "false", "no",
 *     "0" and a typo all fail closed rather than open.
 *
 *  2. CALENDAR — registration closes after the block's FIRST session. This
 *     block is a 6-session prepaid product: selling the full $225 in week four
 *     would charge a family for three sessions nobody delivered. A late joiner
 *     after week one is a prorated conversation with Coach Sam, not a checkout
 *     — which is why the closed state points at him rather than hiding.
 *
 *  3. PRICE CONFIGURED — the Stripe price env must exist. /picklpark renders
 *     its form on legs 1–2 alone and lets /api/checkout-picklpark answer 503,
 *     so a parent can fill in every field and their child's birth year before
 *     learning the season cannot charge. These families were recruited by hand
 *     over text; sending them to a dead form is worse than showing them a
 *     closed one. Gating the render on the same env var the route requires
 *     means the form only ever appears when checkout can actually complete.
 *
 * Pure and injected (no `new Date()`, no `process.env` here) so specs pin the
 * boundaries instead of the clock and the environment. ISO date-only strings
 * compare lexicographically.
 */

export const MONDAY_GIRLS_REGISTRATION_FLAG_ENV =
  "NEXT_PUBLIC_MONDAY_GIRLS_REGISTRATION_OPEN";

/**
 * Last day the block is sold at full price — its FIRST session, derived never
 * typed.
 */
export const MONDAY_GIRLS_REGISTRATION_CLOSES: string = MONDAY_GIRLS_MONDAYS[0];

export interface MondayGirlsRegistrationGate {
  todayIso: string;
  flag: string | undefined;
  /** Whether the Stripe price env var is set. */
  priceConfigured: boolean;
}

export function mondayGirlsRegistrationOpen({
  todayIso,
  flag,
  priceConfigured,
}: MondayGirlsRegistrationGate): boolean {
  if (!priceConfigured) return false;
  const value = (flag ?? "").trim().toLowerCase();
  if (value !== "" && value !== "true") return false;
  return todayIso <= MONDAY_GIRLS_REGISTRATION_CLOSES;
}

/** Today (America/New_York) as YYYY-MM-DD — the repo's todayET() pattern. */
export function mondayGirlsTodayET(): string {
  return new Date().toLocaleDateString("en-CA", {
    timeZone: "America/New_York",
  });
}

/**
 * The gate as the live site evaluates it. Server-only: it reads the non-public
 * Stripe price env var, so never call this from a client component.
 */
export function mondayGirlsRegistrationOpenNow(): boolean {
  return mondayGirlsRegistrationOpen({
    todayIso: mondayGirlsTodayET(),
    flag: process.env.NEXT_PUBLIC_MONDAY_GIRLS_REGISTRATION_OPEN,
    priceConfigured: Boolean(
      process.env[MONDAY_GIRLS_SEASON_PRICE_ENV_VAR]?.trim(),
    ),
  });
}
