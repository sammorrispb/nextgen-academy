import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * HMAC-signed self-serve cancel tokens.
 *
 * The token authorizes one operation (cancel a single drop-in) for one
 * specific Stripe checkout session id. The webhook embeds this token in the
 * confirmation email; the parent clicks the link and gets to a confirmation
 * page that calls cancelDropIn() server-side.
 *
 * Format: base64url(cs_id) + "." + base64url(hmac_sha256(secret, cs_id))
 * Constant-time verification.
 *
 * The token is non-expiring on purpose: a parent might cancel a week out or
 * the morning of, and we don't gain much from an expiry window. The downside
 * (leaked links) is bounded — the only action is "cancel my own registration"
 * which is idempotent and we already log via Notion's row-history.
 *
 * Signing key: reuses NGA_ADMIN_SECRET. Same blast radius (admin-equivalent
 * power on a single row); avoids adding a new env var. If you ever need
 * to invalidate outstanding cancel links, rotate NGA_ADMIN_SECRET.
 */

function getSecret(): string | null {
  return process.env.NGA_ADMIN_SECRET || null;
}

export function signCancelToken(checkoutSessionId: string): string | null {
  const secret = getSecret();
  if (!secret) return null;
  const payload = Buffer.from(checkoutSessionId, "utf-8").toString("base64url");
  const mac = createHmac("sha256", secret)
    .update(checkoutSessionId)
    .digest("base64url");
  return `${payload}.${mac}`;
}

export function verifyCancelToken(token: string): string | null {
  const secret = getSecret();
  if (!secret) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payload, mac] = parts;
  if (!payload || !mac) return null;

  let cs: string;
  try {
    cs = Buffer.from(payload, "base64url").toString("utf-8");
  } catch {
    return null;
  }
  if (!cs) return null;

  const expected = createHmac("sha256", secret)
    .update(cs)
    .digest("base64url");
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return null;
  if (!timingSafeEqual(a, b)) return null;
  return cs;
}
