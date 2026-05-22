import { test, expect } from "@playwright/test";

// The token helper reads the secret from env at call time. Set it before import-use.
process.env.NEWSLETTER_UNSUB_SECRET = "test-unsub-secret-xyz";

import {
  signUnsubscribeToken,
  verifyUnsubscribeToken,
} from "../src/lib/newsletter-token";

test.describe("newsletter unsubscribe token", () => {
  test("round-trips an email", () => {
    const token = signUnsubscribeToken("parent@example.com");
    expect(token).toBeTruthy();
    expect(verifyUnsubscribeToken(token!)).toBe("parent@example.com");
  });

  test("normalizes case + whitespace before signing", () => {
    const token = signUnsubscribeToken("  Parent@Example.COM  ");
    expect(verifyUnsubscribeToken(token!)).toBe("parent@example.com");
  });

  test("rejects a tampered payload", () => {
    const token = signUnsubscribeToken("parent@example.com")!;
    const [, mac] = token.split(".");
    const forged = `${Buffer.from("attacker@evil.com").toString("base64url")}.${mac}`;
    expect(verifyUnsubscribeToken(forged)).toBeNull();
  });

  test("rejects malformed tokens", () => {
    expect(verifyUnsubscribeToken("garbage")).toBeNull();
    expect(verifyUnsubscribeToken("a.b.c")).toBeNull();
    expect(verifyUnsubscribeToken("")).toBeNull();
  });
});
