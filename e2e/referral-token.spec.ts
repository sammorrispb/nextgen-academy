import { test, expect } from "@playwright/test";

// Token helpers read secrets at call time; set both so the referral token can
// be told apart from the unsub token even when they fall back to the same key.
process.env.REFERRAL_TOKEN_SECRET = "test-referral-secret-xyz";
process.env.NEWSLETTER_UNSUB_SECRET = "test-referral-secret-xyz";

import {
  signReferralToken,
  verifyReferralToken,
} from "../src/lib/referral-token";
import {
  signUnsubscribeToken,
  verifyUnsubscribeToken,
} from "../src/lib/newsletter-token";

test.describe("referral token", () => {
  test("round-trips an email", () => {
    const token = signReferralToken("parent@example.com");
    expect(token).toBeTruthy();
    expect(verifyReferralToken(token!)).toBe("parent@example.com");
  });

  test("normalizes case + whitespace before signing", () => {
    const token = signReferralToken("  Parent@Example.COM  ");
    expect(verifyReferralToken(token!)).toBe("parent@example.com");
  });

  test("rejects a tampered payload", () => {
    const token = signReferralToken("parent@example.com")!;
    const [, mac] = token.split(".");
    const forged = `${Buffer.from("attacker@evil.com").toString("base64url")}.${mac}`;
    expect(verifyReferralToken(forged)).toBeNull();
  });

  test("rejects malformed tokens", () => {
    expect(verifyReferralToken("garbage")).toBeNull();
    expect(verifyReferralToken("a.b.c")).toBeNull();
    expect(verifyReferralToken("")).toBeNull();
  });

  test("rejects payloads that don't look like an email", () => {
    const noAt = `${Buffer.from("notanemail").toString("base64url")}.junk`;
    expect(verifyReferralToken(noAt)).toBeNull();
  });

  test("refuses to sign an empty or invalid email", () => {
    expect(signReferralToken("")).toBeNull();
    expect(signReferralToken("   ")).toBeNull();
    expect(signReferralToken("no-at-sign")).toBeNull();
  });

  test("cannot be replayed as an unsubscribe token (distinct HMAC payload prefix)", () => {
    const refToken = signReferralToken("parent@example.com")!;
    expect(verifyUnsubscribeToken(refToken)).toBeNull();

    const unsubToken = signUnsubscribeToken("parent@example.com")!;
    expect(verifyReferralToken(unsubToken)).toBeNull();
  });
});
