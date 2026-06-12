import { createHmac } from "node:crypto";
import { secretEquals, signingSecrets } from "./secret-compare";

/**
 * HMAC-signed referral tokens. Each newsletter subscriber gets one signed
 * over their email; we stash it on the subscriber row and stamp it onto
 * forward-this-email links. When a friend lands on /newsletter?ref=<token>,
 * we verify the token, decode the referrer's email, and write it into the
 * new subscriber's `Referred By` column.
 *
 * Same scheme as newsletter-token.ts (base64url(email) + "." + base64url(hmac)
 * with constant-time verify) but with a distinct HMAC payload prefix so a
 * leaked unsubscribe token can never be replayed as a referral and vice
 * versa.
 *
 * Signing key: REFERRAL_TOKEN_SECRET, with verify-fallback to the legacy
 * NGA_ADMIN_SECRET (same dual-verify pattern as the other token libs) so
 * setting the dedicated secret never breaks links already in inboxes. Tokens
 * never expire — a forwarded-email link from six months ago should still
 * attribute the new signup correctly.
 */

function secrets(): string[] {
  return signingSecrets("REFERRAL_TOKEN_SECRET");
}

function macInput(email: string): string {
  return `ref:${email}`;
}

export function signReferralToken(email: string): string | null {
  const [secret] = secrets();
  if (!secret) return null;
  const normalized = email.trim().toLowerCase();
  if (!normalized || !normalized.includes("@")) return null;
  const payload = Buffer.from(normalized, "utf-8").toString("base64url");
  const mac = createHmac("sha256", secret)
    .update(macInput(normalized))
    .digest("base64url");
  return `${payload}.${mac}`;
}

export function verifyReferralToken(token: string): string | null {
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
  if (!email || !email.includes("@")) return null;

  for (const secret of candidates) {
    const expected = createHmac("sha256", secret)
      .update(macInput(email))
      .digest("base64url");
    if (secretEquals(mac, expected)) return email;
  }
  return null;
}
