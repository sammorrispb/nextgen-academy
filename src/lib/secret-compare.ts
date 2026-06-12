import { timingSafeEqual } from "node:crypto";

/**
 * Constant-time secret comparison + signing-key resolution.
 *
 * secretEquals replaces plain `!==` on bearer secrets across route gates: a
 * character-by-character string compare returns early on the first mismatch,
 * which leaks prefix length to a timing attacker. timingSafeEqual compares
 * the full buffer regardless. Length mismatch returns false (length itself
 * is not secret here). Missing/empty values fail CLOSED.
 */
export function secretEquals(
  provided: string | null | undefined,
  expected: string | null | undefined,
): boolean {
  if (!provided || !expected) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * Ordered candidate signing keys for an HMAC token family: the family's
 * dedicated secret first, the legacy NGA_ADMIN_SECRET second. Sign with the
 * FIRST candidate; verify against ALL of them.
 *
 * The legacy fallback is load-bearing: cancel/commit links are non-expiring
 * by design and live in parents' inboxes. Introducing a dedicated secret
 * must never brick outstanding links — they keep verifying via the legacy
 * key until NGA_ADMIN_SECRET itself rotates (which remains the kill switch
 * for everything legacy-signed).
 */
export function signingSecrets(dedicatedEnvVar: string): string[] {
  const dedicated = process.env[dedicatedEnvVar];
  const legacy = process.env.NGA_ADMIN_SECRET;
  const out: string[] = [];
  if (dedicated) out.push(dedicated);
  if (legacy && legacy !== dedicated) out.push(legacy);
  return out;
}
