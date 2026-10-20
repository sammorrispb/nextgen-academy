// A child's last name, collected at season checkout (Sam, 2026-10-19).
//
// Why it exists: the season rosters held a first name only, so two kids who
// share one were told apart by a hand-typed initial. The rotation-league coach
// screens send the full name to Link & Dink's ld.rotation_league_roster, whose
// command parser accepts a name only when it matches the pattern below. Using
// the SAME rule here means every value NGA collects is one L&D will take, and a
// typed email, phone number or digit never becomes a "name".
//
// Where it goes: Stripe checkout metadata -> the webhook -> the season's Notion
// roster row (+ the admin notification). Never to Open Brain, the Player CRM,
// a parent email or a public page. Pinned by
// e2e/invariant-season-child-last-name.spec.ts.

/** Mirrors community-os apps/p3/src/lib/rotation-league/command.ts NAME. */
export const CHILD_LAST_NAME_RE = /^\p{L}[\p{L}\p{M}' .-]{0,39}$/u;

export const CHILD_LAST_NAME_MAX = 40;

/** Collapse inner whitespace and trim; the stored and synced form. */
export function cleanChildLastName(raw: string | undefined | null): string {
  return (raw ?? "").replace(/\s+/g, " ").trim();
}

/** Error copy for the form, or null when the value is acceptable. Required. */
export function childLastNameError(raw: string | undefined | null): string | null {
  const v = cleanChildLastName(raw);
  if (!v) return "Child last name is required";
  if (v.length > CHILD_LAST_NAME_MAX) {
    return `Please keep it to ${CHILD_LAST_NAME_MAX} characters`;
  }
  if (!CHILD_LAST_NAME_RE.test(v)) {
    return "Letters, spaces, hyphens and apostrophes only";
  }
  return null;
}
