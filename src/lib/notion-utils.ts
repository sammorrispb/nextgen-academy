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

/**
 * NGA Player CRM (Notion "Next Gen Academy Player Database") id — ONE
 * env-backed constant for the id that was previously hardcoded in 6 files
 * (roadmap Phase 1a batch of 0.2/M4). Resolution order, read at CALL time so
 * specs can set env before/after import:
 *   1. NOTION_PLAYER_CRM_DB_ID (canonical env name)
 *   2. NOTION_DB_ID (legacy override already honored by notion-eval.ts +
 *      lead-outreach-run.ts and set by the existing invariant specs)
 *   3. the well-known literal (non-secret) so nothing breaks while unset.
 */
export const PLAYER_CRM_DB_ID_FALLBACK = "1e5e34c258384c6cb5f3e846543ecfc7";

export function playerCrmDbId(): string {
  return (
    process.env.NOTION_PLAYER_CRM_DB_ID ||
    process.env.NOTION_DB_ID ||
    PLAYER_CRM_DB_ID_FALLBACK
  );
}
