/**
 * Email allowlist for the NGA admin area (the Sessions editor). Comma-separated
 * list in env var ADMIN_ALLOWLIST. Case-insensitive matching. Empty/unset =
 * deny all.
 *
 * Keep this small — every email in the list can sign in and edit the public
 * class schedule.
 */

/** All allow-listed admin emails. */
export function getAdminEmails(): string[] {
  const raw = process.env.ADMIN_ALLOWLIST;
  if (!raw) return [];
  return raw
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean);
}

export function isAllowedAdminEmail(email: string): boolean {
  const raw = process.env.ADMIN_ALLOWLIST;
  if (!raw) return false;
  const target = email.toLowerCase().trim();
  return raw
    .split(",")
    .map((e) => e.toLowerCase().trim())
    .filter(Boolean)
    .includes(target);
}
