/**
 * Email allowlist for coach-area access. Comma-separated list in env var
 * COACH_ALLOWED_EMAILS. Case-insensitive matching.
 *
 * Keep this small — every email in the list can sign in and see every
 * registrant's parent name, email, phone, and child info.
 */

export function isAllowedCoachEmail(email: string): boolean {
  const raw = process.env.COACH_ALLOWED_EMAILS;
  if (!raw) return false;
  const target = email.toLowerCase().trim();
  return raw
    .split(",")
    .map((e) => e.toLowerCase().trim())
    .filter(Boolean)
    .includes(target);
}
