import { createHmac } from "node:crypto";
import { secretEquals, signingSecrets } from "./secret-compare";

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
 * separate POST/confirm. Signing key: SESSION_CANCEL_TOKEN_SECRET, with
 * verify-fallback to the legacy NGA_ADMIN_SECRET (links in already-sent coach
 * briefing emails keep working until the legacy secret rotates).
 */

const PREFIX = "session:";

function secrets(): string[] {
  return signingSecrets("SESSION_CANCEL_TOKEN_SECRET");
}

export function signSessionCancelToken(sessionRowId: string): string | null {
  const [secret] = secrets();
  if (!secret || !sessionRowId) return null;
  const signed = `${PREFIX}${sessionRowId}`;
  const payload = Buffer.from(signed, "utf-8").toString("base64url");
  const mac = createHmac("sha256", secret).update(signed).digest("base64url");
  return `${payload}.${mac}`;
}

export function verifySessionCancelToken(token: string): string | null {
  const candidates = secrets();
  if (candidates.length === 0) return null;
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

  for (const secret of candidates) {
    const expected = createHmac("sha256", secret)
      .update(signed)
      .digest("base64url");
    if (secretEquals(mac, expected)) return signed.slice(PREFIX.length);
  }
  return null;
}
