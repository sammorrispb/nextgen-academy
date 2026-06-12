import { createHmac } from "node:crypto";
import { secretEquals, signingSecrets } from "./secret-compare";

/**
 * HMAC-signed 4-week soft-commit tokens. Embedded in the post-session email
 * CTA: parent click → /commit/[token] → Stripe SetupIntent + Notion Crew Commit
 * row → daily autoreserve cron starts charging $20/week.
 *
 * Payload encodes parent email + child first name + crew-id so the commit
 * page can show the exact next 4 weekly Sessions this family belongs to
 * without the parent retyping anything. Crew-id is the join key with the
 * Sessions DB rows the coach manually creates after the poll confirms.
 *
 * Signing key: COMMIT_TOKEN_SECRET, with verify-fallback to the legacy
 * NGA_ADMIN_SECRET (same pattern as cancel-token / session-cancel-token) so
 * introducing the dedicated secret never bricks links already in parent
 * inboxes. Non-expiring: parents need to be able to retry after a card
 * decline a week later.
 */

export interface CommitTokenPayload {
  parentEmail: string;
  childFirstName: string;
  crewId: string;
}

function secrets(): string[] {
  return signingSecrets("COMMIT_TOKEN_SECRET");
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
  const [secret] = secrets();
  if (!secret) return null;
  const encoded = encodePayload(payload);
  const mac = createHmac("sha256", secret).update(encoded).digest("base64url");
  return `${encoded}.${mac}`;
}

export function verifyCommitToken(token: string): CommitTokenPayload | null {
  const candidates = secrets();
  if (candidates.length === 0) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [encoded, mac] = parts;
  if (!encoded || !mac) return null;

  for (const secret of candidates) {
    const expected = createHmac("sha256", secret)
      .update(encoded)
      .digest("base64url");
    if (secretEquals(mac, expected)) return decodePayload(encoded);
  }
  return null;
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
