import { cookies } from "next/headers";
import {
  COACH_SESSION_COOKIE,
  verifySessionCookieValue,
} from "@/lib/coach-auth";
import { isAllowedCoachEmail } from "@/lib/coach-allowlist";

/**
 * THE shared coach gate — the one copy of the requireCoach helper that was
 * previously duplicated verbatim across the coach layout and every coach
 * server-action file. Reads the signed session cookie and returns the coach's
 * email iff the signature verifies AND the email is on COACH_ALLOWED_EMAILS;
 * otherwise null. Callers decide what a null means (actions return an
 * unauthorized result; the layout redirects to /coach/login).
 *
 * Server-only (imports next/headers); the gate COMPOSITION is pinned by
 * e2e/invariant-coach-session-scope.spec.ts and the single-copy rule by
 * e2e/invariant-ops-live-send-authz.spec.ts.
 */
export async function requireCoach(): Promise<string | null> {
  const c = await cookies();
  const value = c.get(COACH_SESSION_COOKIE)?.value;
  const email = value ? verifySessionCookieValue(value) : null;
  return email && isAllowedCoachEmail(email) ? email : null;
}
