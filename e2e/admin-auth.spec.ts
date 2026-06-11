import crypto from "node:crypto";
import { test, expect } from "@playwright/test";

// Set the signing secret + allowlist BEFORE importing so the modules pick them
// up on first call. admin-auth has no env fallback — missing secret throws.
process.env.COACH_SIGNING_SECRET = "test-admin-secret-xyz";
process.env.ADMIN_ALLOWLIST = "sam@example.com, Staff@Example.com";

import {
  createAdminMagicLinkToken,
  verifyAdminMagicLinkToken,
  createAdminSessionValue,
  verifyAdminSessionEmail,
} from "../src/lib/admin-auth";
import { isAllowedAdminEmail, getAdminEmails } from "../src/lib/admin-allowlist";
// coach-auth shares the signing secret — used to prove cross-scope replay fails.
import { createMagicLinkToken } from "../src/lib/coach-auth";

function b64url(s: string): string {
  return Buffer.from(s)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

// Flip the final char to a guaranteed-different one (so the tamper is real
// even when the original char is the one we'd otherwise swap in).
function flipLast(s: string): string {
  const last = s[s.length - 1];
  return s.slice(0, -1) + (last === "A" ? "B" : "A");
}

function macFor(data: string): string {
  return crypto
    .createHmac("sha256", process.env.COACH_SIGNING_SECRET ?? "")
    .update(data)
    .digest("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

test.describe("admin magic-link token", () => {
  test("round-trips an email through sign+verify", () => {
    const token = createAdminMagicLinkToken("sam@example.com");
    expect(token).toBeTruthy();
    expect(verifyAdminMagicLinkToken(token)).toBe("sam@example.com");
  });

  test("normalizes case + whitespace before signing", () => {
    const token = createAdminMagicLinkToken("  Sam@Example.COM  ");
    expect(verifyAdminMagicLinkToken(token)).toBe("sam@example.com");
  });

  test("rejects a tampered payload", () => {
    const token = createAdminMagicLinkToken("sam@example.com");
    const [payload, mac] = token.split(".");
    expect(verifyAdminMagicLinkToken(`${flipLast(payload)}.${mac}`)).toBeNull();
  });

  test("rejects a tampered MAC", () => {
    const token = createAdminMagicLinkToken("sam@example.com");
    const [payload, mac] = token.split(".");
    expect(verifyAdminMagicLinkToken(`${payload}.${flipLast(mac)}`)).toBeNull();
  });

  test("rejects malformed tokens", () => {
    expect(verifyAdminMagicLinkToken("garbage")).toBeNull();
    expect(verifyAdminMagicLinkToken("a.b.c")).toBeNull();
    expect(verifyAdminMagicLinkToken("")).toBeNull();
    expect(verifyAdminMagicLinkToken("only-one-part")).toBeNull();
  });

  test("rejects a token signed with a different secret", () => {
    const token = createAdminMagicLinkToken("sam@example.com");
    const original = process.env.COACH_SIGNING_SECRET;
    try {
      process.env.COACH_SIGNING_SECRET = "different-secret";
      expect(verifyAdminMagicLinkToken(token)).toBeNull();
    } finally {
      process.env.COACH_SIGNING_SECRET = original;
    }
  });

  test("magic-link token TTL is 10 minutes", () => {
    const [payload] = createAdminMagicLinkToken("sam@example.com").split(".");
    const parsed = JSON.parse(
      Buffer.from(payload.replace(/-/g, "+").replace(/_/g, "/") + "==", "base64").toString("utf8"),
    );
    const now = Math.floor(Date.now() / 1000);
    expect(parsed.exp - now).toBeGreaterThanOrEqual(60 * 10 - 5);
    expect(parsed.exp - now).toBeLessThanOrEqual(60 * 10 + 5);
  });

  test("rejects expired tokens", () => {
    const data = b64url(
      JSON.stringify({ email: "sam@example.com", exp: Math.floor(Date.now() / 1000) - 60, scope: "admin" }),
    );
    expect(verifyAdminMagicLinkToken(`${data}.${macFor(data)}`)).toBeNull();
  });
});

test.describe("admin session cookie", () => {
  test("round-trips an email through sign+verify", () => {
    const value = createAdminSessionValue("sam@example.com");
    expect(verifyAdminSessionEmail(value)).toBe("sam@example.com");
  });

  test("session TTL is 30 days", () => {
    const [payload] = createAdminSessionValue("sam@example.com").split(".");
    const parsed = JSON.parse(
      Buffer.from(payload.replace(/-/g, "+").replace(/_/g, "/") + "==", "base64").toString("utf8"),
    );
    const now = Math.floor(Date.now() / 1000);
    const expectedTtl = 60 * 60 * 24 * 30;
    expect(parsed.exp - now).toBeGreaterThanOrEqual(expectedTtl - 5);
    expect(parsed.exp - now).toBeLessThanOrEqual(expectedTtl + 5);
  });

  test("verifyAdminSessionEmail handles empty/undefined", () => {
    expect(verifyAdminSessionEmail(undefined)).toBeNull();
    expect(verifyAdminSessionEmail(null)).toBeNull();
    expect(verifyAdminSessionEmail("")).toBeNull();
  });
});

test.describe("admin/coach scope separation", () => {
  test("a coach token (no admin scope) does NOT verify as an admin token", () => {
    // Same signing secret, but the coach payload carries no scope:"admin",
    // so admin verify must reject it — blocks coach→admin privilege escalation.
    const coachToken = createMagicLinkToken("sam@example.com");
    expect(verifyAdminMagicLinkToken(coachToken)).toBeNull();
    expect(verifyAdminSessionEmail(coachToken)).toBeNull();
  });

  test("rejects a payload with a wrong scope value", () => {
    const data = b64url(
      JSON.stringify({ email: "sam@example.com", exp: Math.floor(Date.now() / 1000) + 600, scope: "coach" }),
    );
    expect(verifyAdminMagicLinkToken(`${data}.${macFor(data)}`)).toBeNull();
  });
});

test.describe("admin allowlist", () => {
  test("matches allowlisted emails case-insensitively + trims", () => {
    expect(isAllowedAdminEmail("sam@example.com")).toBe(true);
    expect(isAllowedAdminEmail("  STAFF@example.com ")).toBe(true);
  });

  test("rejects non-allowlisted emails", () => {
    expect(isAllowedAdminEmail("stranger@example.com")).toBe(false);
    expect(isAllowedAdminEmail("")).toBe(false);
  });

  test("getAdminEmails returns the trimmed list", () => {
    expect(getAdminEmails()).toEqual(["sam@example.com", "Staff@Example.com"]);
  });

  test("empty allowlist denies all", () => {
    const original = process.env.ADMIN_ALLOWLIST;
    try {
      delete process.env.ADMIN_ALLOWLIST;
      expect(isAllowedAdminEmail("sam@example.com")).toBe(false);
      expect(getAdminEmails()).toEqual([]);
    } finally {
      process.env.ADMIN_ALLOWLIST = original;
    }
  });
});
