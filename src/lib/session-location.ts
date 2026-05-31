/**
 * Hidden-location sessions (e.g. the Tuesday Olney evenings): the exact venue
 * is withheld from every public surface and from pre-reveal emails, then sent
 * to confirmed registrants ~24h before start by the reveal-location cron.
 *
 * The single source of truth for "is this session location-hidden" is the
 * presence of a `Public Area` value on the Notion session row. When set, every
 * public render + pre-reveal email shows the broad area ("Olney, MD") and never
 * the exact `Location`. These helpers are pure so they're trivially testable and
 * reused identically across web, email, and the cron — one logic path, no drift.
 */

/** True when the session withholds its exact venue (a non-empty public area). */
export function isLocationHidden(publicArea: string | null | undefined): boolean {
  return !!(publicArea && publicArea.trim());
}

/**
 * What to display as the location RIGHT NOW on a public/pre-reveal surface.
 * Hidden → the broad area; otherwise → the exact location. Never returns the
 * exact venue for a hidden session.
 */
export function publicLocation(
  location: string,
  publicArea: string | null | undefined,
): string {
  return isLocationHidden(publicArea) ? publicArea!.trim() : location;
}

/** Standard parent-facing line explaining the withheld venue. */
export const HIDDEN_LOCATION_NOTE =
  "Exact location is sent to registered families 24 hours before start.";
