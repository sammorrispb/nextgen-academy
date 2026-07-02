/**
 * Shared HTML escaper for anything user-supplied that gets interpolated into
 * email/markup templates. Escapes the five XSS-relevant characters (&<>"') so
 * it's safe in BOTH element content and double/single-quoted attribute values
 * (mailto:/tel: hrefs included).
 *
 * TODO(cleanup): 9 pre-existing inline `[<>&]`-only escaper copies remain in
 * older templates/routes (see PR #244 body for the list) — migrate them to
 * this helper opportunistically when those files are next touched; the new
 * Phase 1a templates already use it.
 */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
