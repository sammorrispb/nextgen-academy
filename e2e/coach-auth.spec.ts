import crypto from "node:crypto";
import { test, expect } from "@playwright/test";

// Set the signing secret BEFORE importing so the module's getSecret() picks it
// up on first call. Coach-auth has no env fallback — missing secret throws.
process.env.COACH_SIGNING_SECRET = "test-coach-secret-xyz";

import {
  createMagicLinkToken,
  verifyMagicLinkToken,
  createSessionCookieValue,
  verifySessionCookieValue,
} from "../src/lib/coach-auth";

test.describe("coach magic-link token", () => {
  test("round-trips an email through sign+verify", () => {
    const token = createMagicLinkToken("coach@example.com");
    expect(token).toBeTruthy();
    expect(verifyMagicLinkToken(token)).toBe("coach@example.com");
  });

  test("normalizes case + whitespace before signing", () => {
    const token = createMagicLinkToken("  Coach@Example.COM  ");
    expect(verifyMagicLinkToken(token)).toBe("coach@example.com");
  });

  // Flip the last char to something it ISN'T — the token embeds Date.now()
  // (exp), so a fixed replacement char silently no-ops ~1/64 runs when the
  // char already matches (flaked in CI 2026-06-12).
  function flipLastChar(s: string): string {
    return s.slice(0, -1) + (s.endsWith("A") ? "B" : "A");
  }

  test("rejects a tampered payload (MAC stops matching)", () => {
    const token = createMagicLinkToken("coach@example.com");
    const [payload, mac] = token.split(".");
    const tampered = `${flipLastChar(payload)}.${mac}`;
    expect(verifyMagicLinkToken(tampered)).toBeNull();
  });

  test("rejects a tampered MAC", () => {
    const token = createMagicLinkToken("coach@example.com");
    const [payload, mac] = token.split(".");
    const tampered = `${payload}.${flipLastChar(mac)}`;
    expect(verifyMagicLinkToken(tampered)).toBeNull();
  });

  test("rejects malformed tokens", () => {
    expect(verifyMagicLinkToken("garbage")).toBeNull();
    expect(verifyMagicLinkToken("a.b.c")).toBeNull();
    expect(verifyMagicLinkToken("")).toBeNull();
    expect(verifyMagicLinkToken("only-one-part")).toBeNull();
  });

  test("rejects a token signed with a different secret", () => {
    const token = createMagicLinkToken("coach@example.com");
    // Swap the secret AFTER signing — verify must reject because HMAC re-computes
    // with the new key and won't match the stored MAC.
    const original = process.env.COACH_SIGNING_SECRET;
    try {
      process.env.COACH_SIGNING_SECRET = "different-secret";
      expect(verifyMagicLinkToken(token)).toBeNull();
    } finally {
      process.env.COACH_SIGNING_SECRET = original;
    }
  });

  test("magic-link token TTL is 10 minutes", () => {
    const token = createMagicLinkToken("coach@example.com");
    const [payload] = token.split(".");
    const decoded = Buffer.from(
      payload.replace(/-/g, "+").replace(/_/g, "/") + "==",
      "base64",
    ).toString("utf8");
    const parsed = JSON.parse(decoded);
    const now = Math.floor(Date.now() / 1000);
    expect(parsed.exp - now).toBeGreaterThanOrEqual(60 * 10 - 5);
    expect(parsed.exp - now).toBeLessThanOrEqual(60 * 10 + 5);
  });

  test("rejects expired tokens (exp in the past)", () => {
    // We can't reach the private signPayload directly, so build an expired
    // token manually using the same payload+HMAC format the module produces.
    const expiredPayload = {
      email: "coach@example.com",
      exp: Math.floor(Date.now() / 1000) - 60, // 1 min ago
    };
    const data = Buffer.from(JSON.stringify(expiredPayload))
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
    const mac = crypto
      .createHmac("sha256", process.env.COACH_SIGNING_SECRET ?? "")
      .update(data)
      .digest("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
    const expiredToken = `${data}.${mac}`;
    expect(verifyMagicLinkToken(expiredToken)).toBeNull();
  });
});

test.describe("coach session cookie", () => {
  test("round-trips an email through sign+verify", () => {
    const value = createSessionCookieValue("coach@example.com");
    expect(verifySessionCookieValue(value)).toBe("coach@example.com");
  });

  test("session TTL is 30 days", () => {
    const value = createSessionCookieValue("coach@example.com");
    const [payload] = value.split(".");
    const decoded = Buffer.from(
      payload.replace(/-/g, "+").replace(/_/g, "/") + "==",
      "base64",
    ).toString("utf8");
    const parsed = JSON.parse(decoded);
    const now = Math.floor(Date.now() / 1000);
    const expectedTtl = 60 * 60 * 24 * 30;
    expect(parsed.exp - now).toBeGreaterThanOrEqual(expectedTtl - 5);
    expect(parsed.exp - now).toBeLessThanOrEqual(expectedTtl + 5);
  });

  test("magic-link and session use the same secret, so a magic-link token verifies as a session cookie (and vice versa)", () => {
    // The two helpers share signPayload — without distinct payload-prefix
    // segregation, the tokens are interchangeable. This is by design today
    // (a magic-link click immediately mints the session cookie), but documents
    // the property for future security review.
    const magic = createMagicLinkToken("coach@example.com");
    expect(verifySessionCookieValue(magic)).toBe("coach@example.com");
  });
});
