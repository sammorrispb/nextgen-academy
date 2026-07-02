"use server";

import { requireCoach } from "@/lib/coach-auth-server";
import {
  authorizeOpsSend,
  validateCampLiveOnly,
  type OpsAuthzDenial,
} from "@/lib/ops-authz";
import {
  runEvalReengagement,
  runCampOutreach,
} from "@/lib/lead-outreach-run";
import { runPostEvalFollowup } from "@/lib/post-eval-followup-run";
import type { Level } from "@/lib/email/post-eval-followup";

// Cookie-authed ops actions — thin wrappers over the SAME shared cores the
// secret-gated curl routes call (lead-outreach-run.ts /
// post-eval-followup-run.ts). They add NO fan-out of their own, so the
// route↔core parity pinned in e2e/invariant-ops-trigger-parity.spec.ts covers
// these actions too. NGA_ADMIN_SECRET never reaches the client — there is no
// secret here at all, only the coach session cookie.
//
// Two authority tiers, enforced HERE (server-side), never just in the UI —
// parent first-contact blasts are a Sam-reserved surface:
//   - any allow-listed coach: previews (dry runs);
//   - admin identity only (the /admin ADMIN_ALLOWLIST, via authorizeOpsSend):
//     live sends on all three ops, and camp's includeAmbiguous even on preview.
// A live camp send additionally requires an explicit non-empty `only`
// allow-list (validateCampLiveOnly) — the full-eligible camp blast stays a
// deliberate curl-with-secret act. Both gates are pinned (logic + this file's
// wiring) by e2e/invariant-ops-live-send-authz.spec.ts.

export interface OpsActionResult {
  ok: boolean;
  status: number;
  body: Record<string, unknown> | null;
  message?: string;
}

const UNAUTHORIZED: OpsActionResult = {
  ok: false,
  status: 401,
  body: null,
  message: "Unauthorized — sign in again.",
};

function denied(d: OpsAuthzDenial): OpsActionResult {
  return {
    ok: false,
    status: d.status,
    body: { error: d.message },
    message: d.message,
  };
}

export async function evalReengagementAction(opts: {
  dryRun: boolean;
  /** Optional allow-list (retry-failed-only). Narrows the send; never widens. */
  only?: string[];
}): Promise<OpsActionResult> {
  const email = await requireCoach();
  if (!email) return UNAUTHORIZED;
  const authz = authorizeOpsSend(email, { live: !opts.dryRun });
  if (!authz.ok) return denied(authz);
  const r = await runEvalReengagement({ dryRun: opts.dryRun, only: opts.only });
  return { ok: r.status === 200, status: r.status, body: r.body };
}

export async function campOutreachAction(opts: {
  dryRun: boolean;
  includeAmbiguous: boolean;
  /** Recipient allow-list. REQUIRED (non-empty) for a live send; a preview may
   * omit it to see the full eligible count for situational awareness. */
  only?: string[];
}): Promise<OpsActionResult> {
  const email = await requireCoach();
  if (!email) return UNAUTHORIZED;
  const authz = authorizeOpsSend(email, {
    live: !opts.dryRun,
    includeAmbiguous: opts.includeAmbiguous,
  });
  if (!authz.ok) return denied(authz);
  const onlyCheck = validateCampLiveOnly(!opts.dryRun, opts.only);
  if (!onlyCheck.ok) return denied(onlyCheck);
  const r = await runCampOutreach({
    dryRun: opts.dryRun,
    includeAmbiguous: opts.includeAmbiguous,
    only: onlyCheck.only ?? undefined,
  });
  return { ok: r.status === 200, status: r.status, body: r.body };
}

export async function postEvalFollowupAction(
  input: { playerId: string; level: string; observations?: string },
  opts: { dryRun: boolean },
): Promise<OpsActionResult> {
  const email = await requireCoach();
  if (!email) return UNAUTHORIZED;
  const authz = authorizeOpsSend(email, { live: !opts.dryRun });
  if (!authz.ok) return denied(authz);
  // Guard BEFORE .trim(): a missing/non-string playerId must yield the same
  // friendly 400 the route path returns (the core 400s on ""), not a throw.
  const playerId =
    typeof input.playerId === "string" ? input.playerId.trim() : "";
  const r = await runPostEvalFollowup(
    {
      playerId,
      // The core validates against LEVEL_DESCRIPTIONS and 400s on junk.
      level: input.level as Level,
      observations: input.observations?.trim() || undefined,
    },
    { dryRun: opts.dryRun },
  );
  return { ok: r.status === 200, status: r.status, body: r.body };
}
