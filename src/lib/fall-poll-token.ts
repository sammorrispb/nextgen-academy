import { createHmac } from "node:crypto";
import { secretEquals, signingSecrets } from "./secret-compare";

/**
 * HMAC-signed one-click poll tokens for the Fall 2026 season email.
 *
 * Same construction as lead-consent-token, for the same reason: each link is a
 * capability, and the three capabilities ("in" / "interested" / "out") are
 * mutually exclusive answers. The action is signed INTO the payload, so a
 * token minted for one answer cannot be edited into another by changing the
 * query param.
 *
 * Non-expiring on purpose: a poll link in a two-week-old email should still
 * work, and re-answering is safe — the CRM stores one select value per family,
 * so the latest confirmed answer wins (that's the desired "changed my mind"
 * behavior).
 *
 * Signing key: FALL_POLL_SECRET, verify-fallback to NGA_ADMIN_SECRET. Distinct
 * from the other token families so a leaked poll token can never be replayed
 * as an unsubscribe/consent/referral capability and vice versa.
 */

export const FALL_POLL_ACTIONS = ["in", "interested", "out"] as const;
export type FallPollAction = (typeof FALL_POLL_ACTIONS)[number];

export function isFallPollAction(raw: unknown): raw is FallPollAction {
  return (
    typeof raw === "string" &&
    (FALL_POLL_ACTIONS as readonly string[]).includes(raw)
  );
}

function secrets(): string[] {
  return signingSecrets("FALL_POLL_SECRET");
}

function payloadFor(email: string, action: FallPollAction): string {
  return `${action}:${email.trim().toLowerCase()}`;
}

export function signFallPollToken(
  email: string,
  action: FallPollAction,
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
export function verifyFallPollToken(
  token: string,
  expected: FallPollAction,
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
