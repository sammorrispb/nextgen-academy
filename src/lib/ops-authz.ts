/**
 * Authorization for the /coach/ops console BEYOND the coach allowlist.
 *
 * Parent first-contact blasts are a Sam-reserved surface, so authority is
 * split in two:
 *   - PREVIEW (dry run): any allow-listed coach — situational awareness only.
 *   - LIVE send (all three ops) and the camp `includeAmbiguous` bucket (even
 *     on preview): ADMIN identity only. Admin = the same ADMIN_ALLOWLIST the
 *     /admin portal uses (src/lib/admin-allowlist.ts) — one env var, one
 *     identity, fail-closed when unset.
 *
 * These are pure decision functions so the invariant can be pinned without a
 * request context; the ops server actions (src/app/coach/(authed)/ops/
 * actions.ts) MUST call them server-side — hiding a toggle in the UI is
 * convenience, never the gate. Pinned (including the actions wiring) by
 * e2e/invariant-ops-live-send-authz.spec.ts.
 */

import { isAllowedAdminEmail } from "@/lib/admin-allowlist";

export type OpsAuthzDenial = { ok: false; status: number; message: string };
export type OpsAuthzDecision = { ok: true } | OpsAuthzDenial;

/** Live-send identity: the /admin portal's ADMIN_ALLOWLIST. Fail-closed. */
export function isOpsLiveSendAdmin(email: string): boolean {
  return isAllowedAdminEmail(email);
}

/**
 * Gate an ops run for an authenticated coach. `live` = a real send (dryRun
 * false); `includeAmbiguous` is admin-only even when previewing.
 */
export function authorizeOpsSend(
  email: string,
  opts: { live: boolean; includeAmbiguous?: boolean },
): OpsAuthzDecision {
  if (opts.live && !isOpsLiveSendAdmin(email)) {
    return {
      ok: false,
      status: 403,
      message:
        "Live sends are admin-only — previews are open to every coach. Ask Sam to fire the send.",
    };
  }
  if (opts.includeAmbiguous === true && !isOpsLiveSendAdmin(email)) {
    return {
      ok: false,
      status: 403,
      message:
        "The ambiguous bucket is admin-only. Uncheck it to preview the eligible list.",
    };
  }
  return { ok: true };
}

/**
 * A live camp send from the console requires an EXPLICIT non-empty recipient
 * allow-list (the vetted warm list, pasted) — the full-eligible blast stays a
 * deliberate curl-with-secret act, never one button. Preview may run without
 * it (full eligible count for situational awareness). Returns the trimmed
 * list (null = no restriction, preview only).
 */
export function validateCampLiveOnly(
  live: boolean,
  only: string[] | undefined,
): { ok: true; only: string[] | null } | OpsAuthzDenial {
  const cleaned = Array.isArray(only)
    ? only
        .map((e) => (typeof e === "string" ? e.trim() : ""))
        .filter(Boolean)
    : [];
  if (live && cleaned.length === 0) {
    return {
      ok: false,
      status: 400,
      message:
        "Live camp sends require a pasted recipient allow-list (one email per line) — preview first, then paste the vetted warm list.",
    };
  }
  return { ok: true, only: cleaned.length ? cleaned : null };
}
