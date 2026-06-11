import crypto from "node:crypto";

/**
 * NGA admin auth — stateless email magic-link sign-in over Resend, restricted
 * to the ADMIN_ALLOWLIST (see src/lib/admin-allowlist.ts). Mirrors the
 * coach-auth primitives.
 *
 *   - Magic-link token: emailed once, valid for 10 minutes. A single click
 *     mints the longer-lived session cookie.
 *   - Session cookie: 30-day expiry, signed payload `{ email, exp, scope }`.
 *
 * Both reuse COACH_SIGNING_SECRET (no second signing secret to manage) but
 * stamp `scope: "admin"` into the payload and require it on verify, so a coach
 * token can never be replayed as an admin one. Rotating the secret invalidates
 * every issued token + cookie.
 */

const MAGIC_LINK_TTL_SECONDS = 60 * 10; // 10 min
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days
const SCOPE = "admin" as const;

export const ADMIN_SESSION_COOKIE = "nga_admin";

export const ADMIN_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: true,
  sameSite: "lax" as const,
  path: "/",
  maxAge: SESSION_TTL_SECONDS,
};

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
  scope: typeof SCOPE;
}

function signPayload(payload: SignedPayload): string {
  const data = b64url(JSON.stringify(payload));
  return `${data}.${hmac(data)}`;
}

function verifySigned(token: string): SignedPayload | null {
  const [data, sig] = token.split(".");
  if (!data || !sig) return null;
  if (!timingSafeEqual(sig, hmac(data))) return null;
  try {
    const payload = JSON.parse(fromB64url(data).toString("utf8")) as SignedPayload;
    if (typeof payload.email !== "string" || typeof payload.exp !== "number") {
      return null;
    }
    if (payload.scope !== SCOPE) return null; // blocks cross-scope (coach) replay
    if (Math.floor(Date.now() / 1000) > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

export function createAdminMagicLinkToken(email: string): string {
  return signPayload({
    email: email.toLowerCase().trim(),
    exp: Math.floor(Date.now() / 1000) + MAGIC_LINK_TTL_SECONDS,
    scope: SCOPE,
  });
}

export function verifyAdminMagicLinkToken(token: string): string | null {
  return verifySigned(token)?.email ?? null;
}

export function createAdminSessionValue(email: string): string {
  return signPayload({
    email: email.toLowerCase().trim(),
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
    scope: SCOPE,
  });
}

export function verifyAdminSessionEmail(value: string | undefined | null): string | null {
  if (!value) return null;
  return verifySigned(value)?.email ?? null;
}
