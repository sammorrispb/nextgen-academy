import { PICKLPARK_SATURDAYS } from "@/data/picklpark-2026";

/**
 * Whether /picklpark offers registration — the Pickl Park season's ONE gate,
 * shared by the page, the empty-state offers and the /fall cross-link so the
 * three can never disagree about whether the season is for sale.
 *
 * Until 2026-09-05 this was `NEXT_PUBLIC_PICKLPARK_REGISTRATION_OPEN === "true"`,
 * the same ships-dark convention /fall still uses: the flag existed so nobody
 * could quote a price before its Stripe product existed. That product has
 * existed since 2026-08-31 and Sam asked for the season to sell from the site,
 * so the default flipped: registration is OPEN through the season's last
 * Saturday, and the flag is now a kill switch — set it to "false" (any value
 * other than blank or "true" closes) for a no-go, a full stop, or to pull the
 * form early. "true" is accepted and means the same as unset, so an
 * environment that already carries it keeps working.
 *
 * Pure and date-injected (no `new Date()` here) so the spec pins the boundary
 * instead of the clock. ISO date-only strings compare lexicographically.
 */

export const PICKLPARK_REGISTRATION_FLAG_ENV =
  "NEXT_PUBLIC_PICKLPARK_REGISTRATION_OPEN";

/** Last day the season is offered — its final Saturday, derived never typed. */
export const PICKLPARK_REGISTRATION_CLOSES: string =
  PICKLPARK_SATURDAYS[PICKLPARK_SATURDAYS.length - 1];

export function picklParkRegistrationOpen(
  todayIso: string,
  flag: string | undefined,
): boolean {
  // Unset/blank and "true" both mean "let the calendar decide". ANY other
  // value closes the form: an operator setting this env var is trying to stop
  // sales, so "False", "no", "0" and "off" must all fail closed, not open.
  const value = (flag ?? "").trim().toLowerCase();
  if (value !== "" && value !== "true") return false;
  return todayIso <= PICKLPARK_REGISTRATION_CLOSES;
}

/** Today (America/New_York) as YYYY-MM-DD — the repo's todayET() pattern. */
export function picklParkTodayET(): string {
  return new Date().toLocaleDateString("en-CA", {
    timeZone: "America/New_York",
  });
}

/** The gate as the live site evaluates it. */
export function picklParkRegistrationOpenNow(): boolean {
  return picklParkRegistrationOpen(
    picklParkTodayET(),
    process.env.NEXT_PUBLIC_PICKLPARK_REGISTRATION_OPEN,
  );
}
