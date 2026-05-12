import crypto from "node:crypto";

/**
 * Coach-area auth: stateless magic-link sign-in over Resend.
 *
 * Two HMAC-signed primitives:
 *   - Magic-link token: emailed once, valid for 10 minutes. Single click sets
 *     a longer-lived session cookie.
 *   - Session cookie: 30-day expiry, signed payload `{ email, exp }`.
 *
 * Both use the same COACH_SIGNING_SECRET env var. Compromising the secret
 * lets an attacker forge both tokens and cookies — rotate by changing the
 * env var, which invalidates everything previously issued.
 */

const MAGIC_LINK_TTL_SECONDS = 60 * 10; // 10 min
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

export const COACH_SESSION_COOKIE = "coach_session";

function getSecret(): string {
  const s = process.env.COACH_SIGNING_SECRET;
  if (!s) throw new Error("COACH_SIGNING_SECRET is not set");
  return s;
}

function b64url(buf: Buffer | string): string {
  return Buffer.from(buf)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function fromB64url(s: string): Buffer {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  return Buffer.from(s, "base64");
}

function hmac(payload: string): string {
  return b64url(
    crypto.createHmac("sha256", getSecret()).update(payload).digest(),
  );
}

function timingSafeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

interface SignedPayload {
  email: string;
  exp: number; // unix seconds
}

function signPayload(payload: SignedPayload): string {
  const json = JSON.stringify(payload);
  const data = b64url(json);
  return `${data}.${hmac(data)}`;
}

function verifySigned(token: string): SignedPayload | null {
  const [data, sig] = token.split(".");
  if (!data || !sig) return null;
  if (!timingSafeEqual(sig, hmac(data))) return null;
  try {
    const json = fromB64url(data).toString("utf8");
    const payload = JSON.parse(json) as SignedPayload;
    if (typeof payload.email !== "string" || typeof payload.exp !== "number") {
      return null;
    }
    if (Math.floor(Date.now() / 1000) > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

export function createMagicLinkToken(email: string): string {
  return signPayload({
    email: email.toLowerCase().trim(),
    exp: Math.floor(Date.now() / 1000) + MAGIC_LINK_TTL_SECONDS,
  });
}

export function verifyMagicLinkToken(token: string): string | null {
  const p = verifySigned(token);
  return p?.email ?? null;
}

export function createSessionCookieValue(email: string): string {
  return signPayload({
    email: email.toLowerCase().trim(),
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
  });
}

export function verifySessionCookieValue(value: string): string | null {
  const p = verifySigned(value);
  return p?.email ?? null;
}

export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: true,
  sameSite: "lax" as const,
  path: "/",
  maxAge: SESSION_TTL_SECONDS,
};
