import { PICKLPARK_SATURDAYS } from "@/data/picklpark-2026";

/**
 * Two different questions about the Pickl Park Saturday, deliberately split
 * (Sam, 2026-09-07):
 *
 *   picklParkRegistrationOpen — is NGA taking the money?  → RETIRED, always false
 *   picklParkLeaguesOpen      — is the Saturday still on?  → true through the
 *                                                            last Saturday
 *
 * They used to be the same boolean, and that was a bug waiting to happen: the
 * moment NGA stopped selling, every surface that ADVERTISED Frederick — the
 * /fall cross-link, the /schedule callout, the open-now block, the weekly
 * newsletter — would have vanished with the checkout, hiding two leagues that
 * are very much running. Advertising a season and selling it are not the same
 * fact, so they are not the same function.
 */

export const PICKLPARK_REGISTRATION_FLAG_ENV =
  "NEXT_PUBLIC_PICKLPARK_REGISTRATION_OPEN";

/** Last day the Saturday runs — its final Saturday, derived never typed. */
export const PICKLPARK_REGISTRATION_CLOSES: string =
  PICKLPARK_SATURDAYS[PICKLPARK_SATURDAYS.length - 1];

/**
 * NGA's own $225 season checkout. RETIRED 2026-09-07 — The Pickl Park now
 * sells the Saturday itself through podplay, so this site takes no payment
 * for it and `/api/checkout-picklpark` returns 410.
 *
 * Kept as a function returning a constant, rather than deleted, so that every
 * caller flips together and a future reader sees WHY there is no season form
 * instead of finding an unexplained absence. It ignores both the date and the
 * env flag on purpose: no value of `NEXT_PUBLIC_PICKLPARK_REGISTRATION_OPEN`
 * may reopen a checkout whose Stripe branch is gone. To sell a season here
 * again, restore the branch deliberately — don't set an env var.
 */
export function picklParkRegistrationOpen(
  ...ignored: [todayIso?: string, flag?: string | undefined]
): boolean {
  // The parameters are accepted and DISCARDED. Callers (and specs) still pass
  // a date and the env flag; taking them keeps those call sites compiling
  // while making it impossible for either to influence the answer.
  void ignored;
  return false;
}

/**
 * Whether the Pickl Park Saturday is still something to point a family at.
 * True through the last Saturday, then the leagues retire themselves — same
 * self-retiring shape the fall season uses, so no surface can advertise a
 * finished season.
 *
 * Pure and date-injected (no `new Date()` here) so the spec pins the boundary
 * instead of the clock. ISO date-only strings compare lexicographically.
 */
export function picklParkLeaguesOpen(todayIso: string): boolean {
  return todayIso <= PICKLPARK_REGISTRATION_CLOSES;
}

/**
 * Whether the Saturday season has already started. NOT a sales gate — it only
 * decides whether a parent is warned about what podplay will show them.
 *
 * Once the season began, BOTH podplay listings started reporting "Admission is
 * no longer available" while still showing open spots, so the confident
 * "Register at The Pickl Park →" button became a dead end (found 2026-09-20,
 * after a parent emailed that he could not register online). We cannot read
 * podplay's state from here — it is a client-rendered SPA with no API — so the
 * page warns from the calendar instead, and the copy stays conditional so it
 * reads true whether or not The Pickl Park reopens the door.
 *
 * Derived from the season's own first Saturday, never typed, and date-injected
 * so the spec pins the boundary instead of the clock.
 */
export function picklParkSeasonUnderWay(todayIso: string): boolean {
  return todayIso >= PICKLPARK_SATURDAYS[0];
}

/** Today (America/New_York) as YYYY-MM-DD — the repo's todayET() pattern. */
export function picklParkTodayET(): string {
  return new Date().toLocaleDateString("en-CA", {
    timeZone: "America/New_York",
  });
}

/** The gate as the live site evaluates it. */
export function picklParkRegistrationOpenNow(): boolean {
  return false;
}

/** Whether the live site should still advertise the leagues. */
export function picklParkLeaguesOpenNow(): boolean {
  return picklParkLeaguesOpen(picklParkTodayET());
}
