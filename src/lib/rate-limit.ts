import { NextRequest } from "next/server";

/**
 * Shared in-memory IP rate limiter (admin-reduction roadmap Phase 0.2),
 * extracted from the ~10 identical copies that lived inline in the public
 * form routes. Semantics are UNCHANGED and deliberately modest:
 *
 * - Per-limiter Map, one limiter per route module → per-route buckets, exactly
 *   like the per-file Maps it replaced.
 * - Per-serverless-instance and resets on every deploy — real protection is
 *   best-effort (documented, accepted; don't add Upstash unless abuse is
 *   actually observed).
 * - Fixed window: first hit opens a window, count > limit inside it → limited.
 */

interface Entry {
  count: number;
  resetAt: number;
}

export interface RateLimiter {
  isRateLimited(ip: string): boolean;
}

const DEFAULT_LIMIT = 5;
const DEFAULT_WINDOW_MS = 60 * 60 * 1000;

export function createRateLimiter(
  opts: { limit?: number; windowMs?: number } = {},
): RateLimiter {
  const limit = opts.limit ?? DEFAULT_LIMIT;
  const windowMs = opts.windowMs ?? DEFAULT_WINDOW_MS;
  const map = new Map<string, Entry>();
  return {
    isRateLimited(ip: string): boolean {
      const now = Date.now();
      const entry = map.get(ip);
      if (!entry || now > entry.resetAt) {
        map.set(ip, { count: 1, resetAt: now + windowMs });
        return false;
      }
      entry.count++;
      return entry.count > limit;
    },
  };
}

export function getClientIp(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}
