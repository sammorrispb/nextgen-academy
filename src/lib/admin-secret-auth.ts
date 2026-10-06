import type { NextRequest } from "next/server";
import { secretEquals } from "@/lib/secret-compare";

/**
 * The ONE gate for every operator route keyed on NGA_ADMIN_SECRET.
 *
 * The secret belongs in `Authorization: Bearer <NGA_ADMIN_SECRET>`. Until
 * 2026-10-06 thirteen routes read it ONLY from `?secret=`, which puts the
 * mega-secret into Vercel request logs, shell history, and any proxy or
 * browser history that sees the URL (security audit, 2026-10-06).
 *
 * `?secret=` still works as a DEPRECATED fallback so runbooks and agents
 * mid-season don't break, and every such call logs `admin_secret_in_query`
 * (never the value) so we can see when it's safe to delete. Header wins: a
 * request carrying a header is judged on the header alone.
 *
 * Fails CLOSED: an unset NGA_ADMIN_SECRET or an empty value rejects.
 * Pinned by e2e/invariant-admin-secret-auth.spec.ts.
 */
export function authorizeAdminSecret(req: NextRequest): boolean {
  const expected = process.env.NGA_ADMIN_SECRET;
  if (!expected) return false;

  const header = req.headers.get("authorization");
  if (header) return secretEquals(header, `Bearer ${expected}`);

  const query = req.nextUrl.searchParams.get("secret");
  if (!query) return false;
  const ok = secretEquals(query, expected);
  if (ok) {
    console.warn(
      JSON.stringify({ event: "admin_secret_in_query", path: req.nextUrl.pathname }),
    );
  }
  return ok;
}
