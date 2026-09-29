import { SITE_URL } from "@/lib/seo";

/**
 * The origin every emailed link and Stripe return URL is built from.
 *
 * Server configuration only — never the request. The request's Origin / Host /
 * X-Forwarded-Host headers are attacker-controlled: building a sign-in link
 * from them let anyone make NGA's real sender email Sam a login link pointing
 * at their own host (security review 2026-09-28, H1). Pinned, with a source
 * guard against reintroducing a request-derived origin, by
 * e2e/invariant-canonical-site-origin.spec.ts.
 *
 * NEXT_PUBLIC_SITE_URL wins when it is a well-formed https URL (reduced to its
 * origin); plain http is accepted only for localhost outside production, so
 * local dev can point links at itself. Anything else — unset, empty,
 * malformed, http on a real host — falls back to the canonical SITE_URL.
 */
export function siteOrigin(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!raw) return SITE_URL;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return SITE_URL;
  }
  if (url.protocol === "https:") return url.origin;
  const isLocal = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  if (url.protocol === "http:" && isLocal && process.env.NODE_ENV !== "production") {
    return url.origin;
  }
  return SITE_URL;
}
