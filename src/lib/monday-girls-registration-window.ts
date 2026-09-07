import { MONDAY_GIRLS_MONDAYS } from "@/data/monday-girls-2026";
import { MONDAY_GIRLS_SEASON_PRICE_ENV_VAR } from "@/data/monday-girls-season-2026";

/**
 * Whether /monday-girls offers registration — the block's ONE gate, shared by
 * the page and the form so the two can never disagree about whether the season
 * is for sale.
 *
 * It returns a REASON, not a boolean. A single `false` collapsed four very
 * different states into one, and the page then had to pick one explanation for
 * all of them — so a visitor arriving before launch was told the block was
 * already "under way", which was simply untrue. Each closed state now carries
 * copy that matches why it is closed.
 *
 * The legs, in the order they are checked:
 *
 *  1. NOT CONFIGURED — the Stripe price env AND the Notion roster env must both
 *     exist. The price env is the charge guard. The ROSTER env matters just as
 *     much and is easy to miss: with a price but no roster DB, the capacity gate
 *     reads an empty list, the duplicate guard never fires, the webhook's row
 *     create fail-softs to "ok", and `rosterFailed` stays false — so a family
 *     pays $225 and leaves NO row, NO seat count and NO admin warning. Silent
 *     money-without-a-roster is worse than a closed form, so both envs gate.
 *     (`/api/checkout-monday-girls` enforces the same pair, so a direct POST
 *     cannot get past a form that never rendered.)
 *
 *  2. CLOSED BY FLAG — NEXT_PUBLIC_MONDAY_GIRLS_REGISTRATION_OPEN. Unset/blank
 *     and "true" both mean "let the calendar decide"; ANY other value closes. An
 *     operator setting this env var is trying to STOP sales, so "false", "no",
 *     "0" and a typo all fail closed rather than open.
 *
 *  3. SEASON STARTED — registration closes after the block's FIRST session.
 *     This block is a 6-session prepaid product: selling the full $225 in week
 *     four would charge a family for three sessions nobody delivered. A late
 *     joiner is a prorated conversation with Coach Sam, not a checkout.
 *
 * Pure and injected (no `new Date()`, no `process.env` here) so specs pin the
 * boundaries instead of the clock and the environment. ISO date-only strings
 * compare lexicographically.
 */

export const MONDAY_GIRLS_REGISTRATION_FLAG_ENV =
  "NEXT_PUBLIC_MONDAY_GIRLS_REGISTRATION_OPEN";

export const MONDAY_GIRLS_ROSTER_DB_ENV_VAR = "NOTION_MONDAY_GIRLS_REGS_DB_ID";

/**
 * Last day the block is sold at full price — its FIRST session, derived never
 * typed.
 */
export const MONDAY_GIRLS_REGISTRATION_CLOSES: string = MONDAY_GIRLS_MONDAYS[0];

/**
 * `not_configured` is the ships-dark state and is deliberately indistinguishable
 * to a visitor from "we're still setting up" — it never implies the block ran.
 */
export type MondayGirlsRegistrationState =
  | "open"
  | "not_configured"
  | "closed_by_flag"
  | "season_started";

export interface MondayGirlsRegistrationGate {
  todayIso: string;
  flag: string | undefined;
  /** Whether the Stripe price env var is set. */
  priceConfigured: boolean;
  /** Whether the Notion roster DB env var is set. */
  rosterConfigured: boolean;
}

export function mondayGirlsRegistrationState({
  todayIso,
  flag,
  priceConfigured,
  rosterConfigured,
}: MondayGirlsRegistrationGate): MondayGirlsRegistrationState {
  if (!priceConfigured || !rosterConfigured) return "not_configured";
  const value = (flag ?? "").trim().toLowerCase();
  if (value !== "" && value !== "true") return "closed_by_flag";
  if (todayIso > MONDAY_GIRLS_REGISTRATION_CLOSES) return "season_started";
  return "open";
}

export function mondayGirlsRegistrationOpen(
  gate: MondayGirlsRegistrationGate,
): boolean {
  return mondayGirlsRegistrationState(gate) === "open";
}

/** Today (America/New_York) as YYYY-MM-DD — the repo's todayET() pattern. */
export function mondayGirlsTodayET(): string {
  return new Date().toLocaleDateString("en-CA", {
    timeZone: "America/New_York",
  });
}

/**
 * The gate as the live site evaluates it. Server-only: it reads non-public env
 * vars, so never call this from a client component.
 */
export function mondayGirlsRegistrationStateNow(): MondayGirlsRegistrationState {
  return mondayGirlsRegistrationState({
    todayIso: mondayGirlsTodayET(),
    flag: process.env.NEXT_PUBLIC_MONDAY_GIRLS_REGISTRATION_OPEN,
    priceConfigured: Boolean(
      process.env[MONDAY_GIRLS_SEASON_PRICE_ENV_VAR]?.trim(),
    ),
    rosterConfigured: Boolean(
      process.env[MONDAY_GIRLS_ROSTER_DB_ENV_VAR]?.trim(),
    ),
  });
}

export function mondayGirlsRegistrationOpenNow(): boolean {
  return mondayGirlsRegistrationStateNow() === "open";
}
