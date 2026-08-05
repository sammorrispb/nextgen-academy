import { createHmac } from "node:crypto";
import { secretEquals, signingSecrets } from "./secret-compare";

/**
 * HMAC-signed one-click consent tokens for the lead-CRM permission pass.
 *
 * The Aug-2026 camp blast asks every family to make an explicit choice: opt in
 * to future updates, or opt out. Each choice is a one-click link, so each link
 * is a capability — and the two capabilities are opposites. The action is
 * therefore signed INTO the payload ("subscribe:<email>" / "optout:<email>"),
 * so a token minted for one action cannot be replayed as the other. A shared
 * email-only token would let a forwarded "yes" link be edited into an opt-out
 * (or vice versa) simply by changing a query param.
 *
 * Non-expiring on purpose, matching newsletter-token: a choice link in an old
 * email should still work, and both actions are idempotent.
 *
 * Signing key: LEAD_CONSENT_SECRET, verify-fallback to NGA_ADMIN_SECRET.
 * Distinct from NEWSLETTER_UNSUB_SECRET and REFERRAL_TOKEN_SECRET so a leaked
 * token from one family can never be replayed against another.
 */

export type ConsentAction = "subscribe" | "optout";

function secrets(): string[] {
  return signingSecrets("LEAD_CONSENT_SECRET");
}

function payloadFor(email: string, action: ConsentAction): string {
  return `${action}:${email.trim().toLowerCase()}`;
}

export function signLeadConsentToken(
  email: string,
  action: ConsentAction,
): string | null {
  const [secret] = secrets();
  if (!secret) return null;
  const raw = payloadFor(email, action);
  const encoded = Buffer.from(raw, "utf-8").toString("base64url");
  const mac = createHmac("sha256", secret).update(raw).digest("base64url");
  return `${encoded}.${mac}`;
}

/**
 * Returns the normalized email iff the token is valid AND was signed for
 * `expected`. Any mismatch — bad mac, wrong action, malformed payload,
 * missing secret — returns null. Fails closed.
 */
export function verifyLeadConsentToken(
  token: string,
  expected: ConsentAction,
): string | null {
  const candidates = secrets();
  if (candidates.length === 0) return null;
  const parts = (token ?? "").split(".");
  if (parts.length !== 2) return null;
  const [encoded, mac] = parts;
  if (!encoded || !mac) return null;

  let raw: string;
  try {
    raw = Buffer.from(encoded, "base64url").toString("utf-8");
  } catch {
    return null;
  }

  const sep = raw.indexOf(":");
  if (sep <= 0) return null;
  const action = raw.slice(0, sep);
  const email = raw.slice(sep + 1);
  if (action !== expected || !email) return null;

  for (const secret of candidates) {
    const want = createHmac("sha256", secret).update(raw).digest("base64url");
    if (secretEquals(mac, want)) return email;
  }
  return null;
}
