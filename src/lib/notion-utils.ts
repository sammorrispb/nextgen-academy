/**
 * Shared Notion property helpers (admin-reduction roadmap Phase 0.2),
 * extracted from the 7 files that each carried their own identical
 * readPlainText copy. First brick of the incremental typed-Notion layer —
 * grow this file instead of re-inlining helpers.
 */

/** Concatenated plain text of a Notion rich_text/title property. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function readPlainText(prop: any): string {
  if (!prop) return "";
  const arr = prop.rich_text ?? prop.title ?? [];
  if (!Array.isArray(arr)) return "";
  return arr.map((r: { plain_text?: string }) => r.plain_text ?? "").join("");
}

/** The house email-shape check (same literal previously redefined ~24×).
 * Migration is opportunistic — swap call sites only when already editing. */
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
