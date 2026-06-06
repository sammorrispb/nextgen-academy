/**
 * Session location display.
 *
 * The exact venue is shown on every public surface. If a row hasn't had its
 * exact `Location` filled in yet (e.g. a freshly seeded recurring Tuesday), we
 * fall back to the broad `Public Area` label ("Olney, MD") so the surface shows
 * the area rather than nothing.
 *
 * The former hide-the-venue-until-24h-before policy was retired 2026-06-05 —
 * youth-session locations are now public, same as L&D. Pure so it's trivially
 * testable and reused identically across web, email, and cron.
 */

/**
 * The location to display publicly: the exact venue when set, otherwise the
 * broad area as a fallback, otherwise an empty string.
 */
export function publicLocation(
  location: string,
  publicArea: string | null | undefined,
): string {
  return location?.trim() || publicArea?.trim() || "";
}
