"use server";

import { cookies } from "next/headers";
import {
  COACH_SESSION_COOKIE,
  verifySessionCookieValue,
} from "@/lib/coach-auth";
import { isAllowedCoachEmail } from "@/lib/coach-allowlist";
import {
  runEvalReengagement,
  runCampOutreach,
} from "@/lib/lead-outreach-run";
import { runPostEvalFollowup } from "@/lib/post-eval-followup-run";
import type { Level } from "@/lib/email/post-eval-followup";

// Cookie-authed ops actions — thin requireCoach wrappers over the SAME shared
// cores the secret-gated curl routes call (lead-outreach-run.ts /
// post-eval-followup-run.ts). They add NO fan-out of their own, so the
// route↔core parity pinned in e2e/invariant-ops-trigger-parity.spec.ts covers
// these actions too. NGA_ADMIN_SECRET never reaches the client — there is no
// secret here at all, only the coach session cookie.

async function requireCoach(): Promise<string | null> {
  const c = await cookies();
  const value = c.get(COACH_SESSION_COOKIE)?.value;
  const email = value ? verifySessionCookieValue(value) : null;
  return email && isAllowedCoachEmail(email) ? email : null;
}

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

export async function evalReengagementAction(opts: {
  dryRun: boolean;
}): Promise<OpsActionResult> {
  if (!(await requireCoach())) return UNAUTHORIZED;
  const r = await runEvalReengagement({ dryRun: opts.dryRun });
  return { ok: r.status === 200, status: r.status, body: r.body };
}

export async function campOutreachAction(opts: {
  dryRun: boolean;
  includeAmbiguous: boolean;
}): Promise<OpsActionResult> {
  if (!(await requireCoach())) return UNAUTHORIZED;
  const r = await runCampOutreach({
    dryRun: opts.dryRun,
    includeAmbiguous: opts.includeAmbiguous,
  });
  return { ok: r.status === 200, status: r.status, body: r.body };
}

export async function postEvalFollowupAction(
  input: { playerId: string; level: string; observations?: string },
  opts: { dryRun: boolean },
): Promise<OpsActionResult> {
  if (!(await requireCoach())) return UNAUTHORIZED;
  const r = await runPostEvalFollowup(
    {
      playerId: input.playerId.trim(),
      // The core validates against LEVEL_DESCRIPTIONS and 400s on junk.
      level: input.level as Level,
      observations: input.observations?.trim() || undefined,
    },
    { dryRun: opts.dryRun },
  );
  return { ok: r.status === 200, status: r.status, body: r.body };
}
