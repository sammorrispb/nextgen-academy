import { createHmac } from "node:crypto";
import { secretEquals } from "./secret-compare";
import {
  seasonLeagueGroupSlug,
  type SeasonLeagueGroup,
} from "@/data/season-league-2026";

/**
 * HMAC-signed links for the parent-facing Fall Season standings pages
 * (/fall/standings/<group>/<token>). One token per colour group; the group is
 * signed INTO the payload, so a Green token presented on the Yellow route
 * fails — same construction as fall-poll-token.
 *
 * Deliberate deviation from the other token families: this reads ONLY
 * STANDINGS_LINK_SECRET and has NO fallback to the legacy admin secret. The
 * shared resolver in secret-compare exists to keep legacy links in parents'
 * inboxes alive across a secret introduction; a brand-new family has no
 * legacy links, so a fallback would only widen the admin secret's blast
 * radius (hostile-review item 9). Unset secret ⇒ sign AND verify refuse, so
 * the pages stay dark. Pinned by invariant-season-league-authz.
 *
 * Non-expiring: the link lives in a WhatsApp group for six weeks. Revocation
 * is rotating the secret, which kills every outstanding link at once. The
 * page it opens is read-only and mutates nothing (mail/chat prefetch-safe).
 */

function secret(): string | null {
  const s = process.env.STANDINGS_LINK_SECRET;
  return s && s.length > 0 ? s : null;
}

function payloadFor(group: SeasonLeagueGroup): string {
  return `standings:${seasonLeagueGroupSlug(group)}`;
}

export function signStandingsLink(group: SeasonLeagueGroup): string | null {
  const key = secret();
  if (!key) return null;
  const raw = payloadFor(group);
  const encoded = Buffer.from(raw, "utf-8").toString("base64url");
  const mac = createHmac("sha256", key).update(raw).digest("base64url");
  return `${encoded}.${mac}`;
}

/** True iff the token is well-formed, signed with the current secret, and
 * was minted for exactly this group. Fails closed on everything else. */
export function verifyStandingsLink(
  token: string | null | undefined,
  group: SeasonLeagueGroup,
): boolean {
  const key = secret();
  if (!key) return false;
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
  if (raw !== payloadFor(group)) return false;

  const want = createHmac("sha256", key).update(raw).digest("base64url");
  return secretEquals(mac, want);
}

export function standingsLinkPath(group: SeasonLeagueGroup, token: string): string {
  return `/fall/standings/${seasonLeagueGroupSlug(group)}/${token}`;
}
