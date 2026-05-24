import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * HMAC-signed 4-week soft-commit tokens. Embedded in the post-session email
 * CTA: parent click → /commit/[token] → Stripe SetupIntent + Notion Crew Commit
 * row → daily autoreserve cron starts charging $40/week.
 *
 * Payload encodes parent email + child first name + crew-id so the commit
 * page can show the exact next 4 weekly Sessions this family belongs to
 * without the parent retyping anything. Crew-id is the join key with the
 * Sessions DB rows the coach manually creates after the poll confirms.
 *
 * Signing key: COMMIT_TOKEN_SECRET, falls back to NGA_ADMIN_SECRET (same
 * pattern as newsletter-token / cancel-token). Non-expiring: parents need to
 * be able to retry after a card decline a week later.
 */

export interface CommitTokenPayload {
  parentEmail: string;
  childFirstName: string;
  crewId: string;
}

function getSecret(): string | null {
  return process.env.COMMIT_TOKEN_SECRET || process.env.NGA_ADMIN_SECRET || null;
}

function encodePayload(p: CommitTokenPayload): string {
  return Buffer.from(
    JSON.stringify({
      e: p.parentEmail,
      c: p.childFirstName,
      k: p.crewId,
    }),
    "utf-8",
  ).toString("base64url");
}

function decodePayload(encoded: string): CommitTokenPayload | null {
  try {
    const json = Buffer.from(encoded, "base64url").toString("utf-8");
    const obj = JSON.parse(json) as { e?: string; c?: string; k?: string };
    if (!obj.e || !obj.c || !obj.k) return null;
    return { parentEmail: obj.e, childFirstName: obj.c, crewId: obj.k };
  } catch {
    return null;
  }
}

export function signCommitToken(payload: CommitTokenPayload): string | null {
  const secret = getSecret();
  if (!secret) return null;
  const encoded = encodePayload(payload);
  const mac = createHmac("sha256", secret).update(encoded).digest("base64url");
  return `${encoded}.${mac}`;
}

export function verifyCommitToken(token: string): CommitTokenPayload | null {
  const secret = getSecret();
  if (!secret) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [encoded, mac] = parts;
  if (!encoded || !mac) return null;

  const expected = createHmac("sha256", secret).update(encoded).digest("base64url");
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return null;
  if (!timingSafeEqual(a, b)) return null;

  return decodePayload(encoded);
}

/**
 * Build the canonical crew-id for a (level, weekday, startTime, location)
 * combination. Both sides — the post-session CTA encoding and the autoreserve
 * cron's Sessions-row matching — must produce identical strings, so this is
 * the single source of truth.
 *
 * Weekday is the en-US long form from the session date. Location is folded
 * to lowercase and stripped of punctuation/commas (Sam types venue strings
 * by hand in Notion and "Sherwood HS Tennis Courts" vs "Sherwood HS Tennis
 * Courts, Sandy Spring MD" should match).
 */
export function buildCrewId(input: {
  level: string;
  date: string;
  startTime: string;
  location: string;
}): string {
  const { level, date, startTime, location } = input;
  const weekday = date
    ? new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", {
        weekday: "long",
        timeZone: "UTC",
      })
    : "";
  const normLocation = location
    .toLowerCase()
    .replace(/[,.]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  const normTime = startTime.toLowerCase().replace(/\s+/g, "").trim();
  return [level || "", weekday, normTime, normLocation].join("|");
}
