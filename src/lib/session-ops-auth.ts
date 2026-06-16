import type { NextRequest } from "next/server";
import { ADMIN_SESSION_COOKIE, verifyAdminSessionEmail } from "@/lib/admin-auth";
import { isAllowedAdminEmail } from "@/lib/admin-allowlist";
import { secretEquals } from "@/lib/secret-compare";

/**
 * Authorize an admin session-ops call (cancel / reschedule). Two equal-trust
 * entry points share ONE engine, so they share ONE gate:
 *  - the admin UI sends the signed admin session cookie (`nga_admin`);
 *  - an agent / cron sends `Authorization: Bearer SESSION_OPS_SECRET`.
 *
 * Because both paths funnel through the SAME route → SAME engine
 * (executeSessionCancel / executeSessionReschedule), a back-office agent fires
 * the IDENTICAL trigger fan-out a human gets from the editor — that parity is
 * pinned by invariant-admin-session-ops-parity.spec.ts.
 *
 * Both methods fail CLOSED: a bad/expired cookie, a wrong token, OR an unset
 * SESSION_OPS_SECRET all return false. The Bearer secret is dedicated (NOT
 * NGA_ADMIN_SECRET) so this refund-capable surface can't ride the mega-secret's
 * blast radius, and it travels in a header, not the query string.
 */
export function authorizeSessionOps(req: NextRequest): boolean {
  // Cookie (admin UI).
  try {
    const email = verifyAdminSessionEmail(req.cookies.get(ADMIN_SESSION_COOKIE)?.value);
    if (email && isAllowedAdminEmail(email)) return true;
  } catch {
    // malformed token / unset signing secret → fall through to Bearer
  }

  // Bearer (agent / cron). secretEquals fails closed on an unset expected value.
  const expected = process.env.SESSION_OPS_SECRET;
  return secretEquals(req.headers.get("authorization"), expected ? `Bearer ${expected}` : undefined);
}
