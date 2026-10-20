import { createHmac } from "node:crypto";
import { secretEquals } from "./secret-compare";

/**
 * HMAC-signed parent links for a Link & Dink rotation-league season
 * (/standings/<season slug>/<token>). One token per season; the slug is signed
 * INTO the payload, so a Green token presented on the Yellow route fails.
 *
 * Same posture as standings-link-token (the Notion Fall season links): reads
 * ONLY STANDINGS_LINK_SECRET with NO admin-secret fallback, so an unset secret
 * keeps the pages dark, and rotating it revokes every link at once. The
 * payload prefix differs ("league-standings:" vs "standings:"), so a token
 * from one family can never open a page of the other.
 *
 * Non-expiring: the link lives in a WhatsApp group for a season. The page is
 * read-only (chat and mail prefetch-safe). Pinned by
 * e2e/invariant-league-standings-link.spec.ts.
 */

const SLUG = /^[a-z0-9][a-z0-9-]{1,79}$/;

function secret(): string | null {
  const s = process.env.STANDINGS_LINK_SECRET;
  return s && s.length > 0 ? s : null;
}

function payloadFor(slug: string): string {
  return `league-standings:${slug}`;
}

export function signLeagueStandingsLink(slug: string): string | null {
  const key = secret();
  if (!key || !SLUG.test(slug)) return null;
  const raw = payloadFor(slug);
  const encoded = Buffer.from(raw, "utf-8").toString("base64url");
  const mac = createHmac("sha256", key).update(raw).digest("base64url");
  return `${encoded}.${mac}`;
}

/** True iff the token is well-formed, signed with the current secret, and was
 * minted for exactly this season. Fails closed on everything else. */
export function verifyLeagueStandingsLink(token: string | null | undefined, slug: string): boolean {
  const key = secret();
  if (!key || !SLUG.test(slug)) return false;
  const parts = (token ?? "").split(".");
  if (parts.length !== 2) return false;
  const [encoded, mac] = parts;
  if (!encoded || !mac) return false;
  let raw: string;
  try {
    raw = Buffer.from(encoded, "base64url").toString("utf-8");
  } catch {
    return false;
  }
  if (raw !== payloadFor(slug)) return false;
  const want = createHmac("sha256", key).update(raw).digest("base64url");
  return secretEquals(mac, want);
}

export function leagueStandingsPath(slug: string, token: string): string {
  return `/standings/${slug}/${token}`;
}
