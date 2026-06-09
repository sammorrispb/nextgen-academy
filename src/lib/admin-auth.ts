import crypto from "node:crypto";

/**
 * NGA admin auth — a single-operator (Sam) password gate over an HMAC-signed
 * session cookie. Mirrors the coach-auth primitives but with one shared
 * password instead of per-email magic links.
 *
 *   - Login: POST the password to /api/admin/login. Verified timing-safe
 *     against NGA_ADMIN_PASSWORD, then a signed `{ exp }` cookie is set.
 *   - Session cookie: 30-day expiry, signed with COACH_SIGNING_SECRET (reused
 *     so there's no second signing secret to manage). Rotating that secret —
 *     or changing the password — invalidates every issued session.
 *
 * The cookie carries no identity, only an expiry; possession of a valid signed
 * cookie IS admin. httpOnly + secure so it never leaks to client JS.
 */

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

export const ADMIN_SESSION_COOKIE = "nga_admin";

export const ADMIN_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: true,
  sameSite: "lax" as const,
  path: "/",
  maxAge: SESSION_TTL_SECONDS,
};

function getSigningSecret(): string {
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
    crypto.createHmac("sha256", getSigningSecret()).update(payload).digest(),
  );
}

function timingSafeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

/** Timing-safe check of a submitted password against NGA_ADMIN_PASSWORD. */
export function checkAdminPassword(submitted: string): boolean {
  const expected = process.env.NGA_ADMIN_PASSWORD;
  if (!expected) throw new Error("NGA_ADMIN_PASSWORD is not set");
  // Compare HMACs so the comparison is constant-length regardless of input.
  return timingSafeEqual(hmac(submitted), hmac(expected));
}

/** Signed cookie value `{exp}.sig` for a fresh 30-day session. */
export function createAdminSessionValue(): string {
  const payload = { exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS };
  const data = b64url(JSON.stringify(payload));
  return `${data}.${hmac(data)}`;
}

/** True when the cookie value is well-signed and unexpired. */
export function verifyAdminSessionValue(value: string | undefined | null): boolean {
  if (!value) return false;
  const [data, sig] = value.split(".");
  if (!data || !sig) return false;
  if (!timingSafeEqual(sig, hmac(data))) return false;
  try {
    const { exp } = JSON.parse(fromB64url(data).toString("utf8")) as { exp: number };
    return typeof exp === "number" && exp > Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}
