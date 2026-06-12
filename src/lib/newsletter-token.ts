import { createHmac } from "node:crypto";
import { secretEquals, signingSecrets } from "./secret-compare";

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
 * Signing key: NEWSLETTER_UNSUB_SECRET, with verify-fallback to the legacy
 * NGA_ADMIN_SECRET (dual-verify) — unsubscribe links in every past issue MUST
 * keep working when the dedicated secret is introduced (CAN-SPAM). Rotate the
 * dedicated secret to invalidate new-era links only.
 */

function secrets(): string[] {
  return signingSecrets("NEWSLETTER_UNSUB_SECRET");
}

export function signUnsubscribeToken(email: string): string | null {
  const [secret] = secrets();
  if (!secret) return null;
  const normalized = email.trim().toLowerCase();
  const payload = Buffer.from(normalized, "utf-8").toString("base64url");
  const mac = createHmac("sha256", secret).update(normalized).digest("base64url");
  return `${payload}.${mac}`;
}

export function verifyUnsubscribeToken(token: string): string | null {
  const candidates = secrets();
  if (candidates.length === 0) return null;
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

  for (const secret of candidates) {
    const expected = createHmac("sha256", secret)
      .update(email)
      .digest("base64url");
    if (secretEquals(mac, expected)) return email;
  }
  return null;
}
