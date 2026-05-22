import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * HMAC-signed one-click unsubscribe tokens for the weekly newsletter.
 *
 * The token authorizes one operation (unsubscribe one email) and embeds the
 * subscriber's email so /api/newsletter/unsubscribe can flip the right row to
 * Unsubscribed without any session/lookup-by-id. Mirrors the cancel-token
 * design (base64url(email) + "." + base64url(hmac)) with constant-time verify.
 *
 * Non-expiring on purpose: an unsubscribe link in an old issue should still
 * work. The only action it grants is "unsubscribe this address," which is
 * idempotent and harmless if leaked.
 *
 * Signing key: NEWSLETTER_UNSUB_SECRET, falling back to NGA_ADMIN_SECRET so
 * the feature works without provisioning a new env var. Set the dedicated
 * secret if you ever want to rotate unsubscribe links independently.
 */

function getSecret(): string | null {
  return process.env.NEWSLETTER_UNSUB_SECRET || process.env.NGA_ADMIN_SECRET || null;
}

export function signUnsubscribeToken(email: string): string | null {
  const secret = getSecret();
  if (!secret) return null;
  const normalized = email.trim().toLowerCase();
  const payload = Buffer.from(normalized, "utf-8").toString("base64url");
  const mac = createHmac("sha256", secret).update(normalized).digest("base64url");
  return `${payload}.${mac}`;
}

export function verifyUnsubscribeToken(token: string): string | null {
  const secret = getSecret();
  if (!secret) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payload, mac] = parts;
  if (!payload || !mac) return null;

  let email: string;
  try {
    email = Buffer.from(payload, "base64url").toString("utf-8");
  } catch {
    return null;
  }
  if (!email) return null;

  const expected = createHmac("sha256", secret).update(email).digest("base64url");
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return null;
  if (!timingSafeEqual(a, b)) return null;
  return email;
}
