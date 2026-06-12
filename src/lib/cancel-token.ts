import { createHmac } from "node:crypto";
import { secretEquals, signingSecrets } from "./secret-compare";

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
 * Signing key: CANCEL_TOKEN_SECRET, with verify-fallback to the legacy
 * NGA_ADMIN_SECRET so outstanding links in parent inboxes keep working
 * (they're non-expiring). New tokens sign with the dedicated key when set.
 * To invalidate NEW links, rotate CANCEL_TOKEN_SECRET; legacy-era links die
 * when NGA_ADMIN_SECRET itself rotates.
 */

function secrets(): string[] {
  return signingSecrets("CANCEL_TOKEN_SECRET");
}

export function signCancelToken(checkoutSessionId: string): string | null {
  const [secret] = secrets();
  if (!secret) return null;
  const payload = Buffer.from(checkoutSessionId, "utf-8").toString("base64url");
  const mac = createHmac("sha256", secret)
    .update(checkoutSessionId)
    .digest("base64url");
  return `${payload}.${mac}`;
}

export function verifyCancelToken(token: string): string | null {
  const candidates = secrets();
  if (candidates.length === 0) return null;
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

  for (const secret of candidates) {
    const expected = createHmac("sha256", secret).update(cs).digest("base64url");
    if (secretEquals(mac, expected)) return cs;
  }
  return null;
}
