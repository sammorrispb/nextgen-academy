import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * HMAC-signed token authorizing a SESSION-WIDE cancel (refund + notify all)
 * for one Notion session row id. Embedded in the coach 24h pre-event briefing
 * email so the cancel can be triggered without a login.
 *
 * Domain-separated from the per-row drop-in cancel token (cancel-token.ts) via
 * the "session:" prefix in the signed payload, so a leaked drop-in token can
 * never be replayed as a session-wide cancel and vice-versa.
 *
 * The signed link only ever lands on a confirmation PAGE (a GET that mutates
 * nothing — safe against email link-scanner prefetch); the actual cancel is a
 * separate POST/confirm. Signing key reuses NGA_ADMIN_SECRET.
 */

const PREFIX = "session:";

function getSecret(): string | null {
  return process.env.NGA_ADMIN_SECRET || null;
}

export function signSessionCancelToken(sessionRowId: string): string | null {
  const secret = getSecret();
  if (!secret || !sessionRowId) return null;
  const signed = `${PREFIX}${sessionRowId}`;
  const payload = Buffer.from(signed, "utf-8").toString("base64url");
  const mac = createHmac("sha256", secret).update(signed).digest("base64url");
  return `${payload}.${mac}`;
}

export function verifySessionCancelToken(token: string): string | null {
  const secret = getSecret();
  if (!secret) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payload, mac] = parts;
  if (!payload || !mac) return null;

  let signed: string;
  try {
    signed = Buffer.from(payload, "base64url").toString("utf-8");
  } catch {
    return null;
  }
  if (!signed.startsWith(PREFIX)) return null;

  const expected = createHmac("sha256", secret).update(signed).digest("base64url");
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return null;
  if (!timingSafeEqual(a, b)) return null;
  return signed.slice(PREFIX.length);
}
