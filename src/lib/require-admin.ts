import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_SESSION_COOKIE, verifyAdminSessionEmail } from "@/lib/admin-auth";
import { isAllowedAdminEmail } from "@/lib/admin-allowlist";

/**
 * The admin gate, callable from a PAGE as well as the `(authed)` layout.
 *
 * WHY IT IS NOT LAYOUT-ONLY (2026-09-15, a live leak). A layout and its page
 * render CONCURRENTLY in the App Router, so a `redirect()` thrown in the layout
 * sets the response status while the page has already run. An unauthenticated
 * GET of /admin/monday-girls therefore returned 307 → /admin/login whose BODY
 * carried the roster Notion had just handed the page: three parent emails and
 * two children's first names, on an unauthenticated request.
 *
 * The route group's layout is still the gate for pages that render nothing
 * sensitive — /admin/sessions defers campers to an authed API route fetched on
 * click, which is why it never leaked. But a page that SERVER-RENDERS child PII
 * has to verify first, so an unauthenticated request never fetches the data and
 * has nothing to serialize. Call this before the first read on any such page;
 * `e2e/invariant-admin-monday-girls-roster.spec.ts` pins the ordering.
 *
 * Composes the existing primitives (`admin-auth`, `admin-allowlist`) rather
 * than re-implementing them — those stay the single source of truth for what a
 * valid admin session is.
 */
export async function requireAdmin(): Promise<string> {
  const c = await cookies();
  const email = verifyAdminSessionEmail(c.get(ADMIN_SESSION_COOKIE)?.value);
  if (!email || !isAllowedAdminEmail(email)) {
    redirect("/admin/login");
  }
  return email;
}
