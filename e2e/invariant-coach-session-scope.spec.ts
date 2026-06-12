import crypto from "node:crypto";
import { test, expect } from "@playwright/test";

// Env BEFORE import (coach-auth throws on missing secret at call time).
process.env.COACH_SIGNING_SECRET = "test-coach-secret-scope";
process.env.COACH_ALLOWED_EMAILS = "coach@allowed.com, second@allowed.com";

import {
  createSessionCookieValue,
  verifySessionCookieValue,
} from "../src/lib/coach-auth";
import { isAllowedCoachEmail } from "../src/lib/coach-allowlist";

// The coach console is the only authed reader of child data. Its gate is the
// COMPOSITION used in src/app/coach/(authed)/layout.tsx requireCoach():
//   verifySessionCookieValue(cookie) AND isAllowedCoachEmail(email).
// Token mechanics (tamper/malformed/expiry) are pinned in coach-auth.spec.ts —
// this spec pins the composed child-data gate.
function gatePasses(cookieValue: string): boolean {
  const email = verifySessionCookieValue(cookieValue);
  return email !== null && isAllowedCoachEmail(email);
}

test.describe("coach gate composition (child-data access invariant)", () => {
  test("allowlisted coach with a valid cookie passes", () => {
    expect(gatePasses(createSessionCookieValue("coach@allowed.com"))).toBe(true);
  });

  test("VALID signature but non-allowlisted email is denied — signature alone is not authority", () => {
    const cookie = createSessionCookieValue("intruder@example.com");
    expect(verifySessionCookieValue(cookie)).toBe("intruder@example.com"); // sig fine
    expect(gatePasses(cookie)).toBe(false); // gate still denies
  });

  test("cookie forged under a different secret is denied", () => {
    const original = process.env.COACH_SIGNING_SECRET;
    let forged: string;
    try {
      process.env.COACH_SIGNING_SECRET = "attacker-secret";
      forged = createSessionCookieValue("coach@allowed.com");
    } finally {
      process.env.COACH_SIGNING_SECRET = original;
    }
    expect(gatePasses(forged)).toBe(false);
  });

  test("expired session cookie is denied even for an allowlisted coach", () => {
    const payload = {
      email: "coach@allowed.com",
      exp: Math.floor(Date.now() / 1000) - 60,
    };
    const data = Buffer.from(JSON.stringify(payload))
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
    expect(gatePasses(`${data}.${mac}`)).toBe(false);
  });

  test("allowlist matching is case/whitespace-insensitive but exact on address", () => {
    expect(isAllowedCoachEmail("  COACH@Allowed.com ")).toBe(true);
    expect(isAllowedCoachEmail("coach@allowed.com.evil.example")).toBe(false);
    expect(isAllowedCoachEmail("xcoach@allowed.com")).toBe(false);
  });

  test("fails closed: empty/unset allowlist admits nobody", () => {
    const original = process.env.COACH_ALLOWED_EMAILS;
    try {
      delete process.env.COACH_ALLOWED_EMAILS;
      expect(gatePasses(createSessionCookieValue("coach@allowed.com"))).toBe(false);
      process.env.COACH_ALLOWED_EMAILS = "";
      expect(gatePasses(createSessionCookieValue("coach@allowed.com"))).toBe(false);
    } finally {
      process.env.COACH_ALLOWED_EMAILS = original;
    }
  });

  test("fails closed: unset signing secret makes cookie minting throw", () => {
    const original = process.env.COACH_SIGNING_SECRET;
    try {
      delete process.env.COACH_SIGNING_SECRET;
      expect(() => createSessionCookieValue("coach@allowed.com")).toThrow();
    } finally {
      process.env.COACH_SIGNING_SECRET = original;
    }
  });
});
