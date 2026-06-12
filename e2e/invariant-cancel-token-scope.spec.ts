import { createHmac } from "node:crypto";
import { test, expect } from "@playwright/test";

// Set the signing secret BEFORE importing — cancel-token reads it per call,
// but keeping the existing pure-spec convention (see coach-auth.spec.ts).
process.env.NGA_ADMIN_SECRET = "test-admin-secret";

import { signCancelToken, verifyCancelToken } from "../src/lib/cancel-token";

// THE parent-scope invariant for this stack: a cancel token authorizes exactly
// one registration (one Stripe checkout session id). A token minted for child
// A's registration must never verify as authority over child B's.
test.describe("cancel token scope (parent↔child invariant)", () => {
  test("round-trips: token for A verifies back to exactly A", () => {
    const token = signCancelToken("cs_child_A");
    expect(token).toBeTruthy();
    expect(verifyCancelToken(token!)).toBe("cs_child_A");
  });

  test("token for A cannot be rebound to B: swapping the payload kills the MAC", () => {
    const tokenA = signCancelToken("cs_child_A")!;
    const macA = tokenA.split(".")[1];
    // Attacker keeps A's MAC, swaps in B's payload — the classic rebind.
    const payloadB = Buffer.from("cs_child_B", "utf-8").toString("base64url");
    expect(verifyCancelToken(`${payloadB}.${macA}`)).toBeNull();
  });

  test("a MAC forged with a guessed secret never verifies", () => {
    const payload = Buffer.from("cs_child_B", "utf-8").toString("base64url");
    const forgedMac = createHmac("sha256", "guessed-wrong-secret")
      .update("cs_child_B")
      .digest("base64url");
    expect(verifyCancelToken(`${payload}.${forgedMac}`)).toBeNull();
  });

  test("rotating NGA_ADMIN_SECRET invalidates every outstanding token", () => {
    // cancel-token.ts:19-21 documents rotation as the kill switch — pin it.
    const token = signCancelToken("cs_child_A")!;
    const original = process.env.NGA_ADMIN_SECRET;
    try {
      process.env.NGA_ADMIN_SECRET = "rotated-secret";
      expect(verifyCancelToken(token)).toBeNull();
    } finally {
      process.env.NGA_ADMIN_SECRET = original;
    }
  });

  test("fails closed when the secret is unset: sign and verify both refuse", () => {
    const original = process.env.NGA_ADMIN_SECRET;
    try {
      delete process.env.NGA_ADMIN_SECRET;
      expect(signCancelToken("cs_child_A")).toBeNull();
      expect(verifyCancelToken("anything.anything")).toBeNull();
    } finally {
      process.env.NGA_ADMIN_SECRET = original;
    }
  });

  test("rejects malformed tokens", () => {
    expect(verifyCancelToken("")).toBeNull();
    expect(verifyCancelToken("no-dot-at-all")).toBeNull();
    expect(verifyCancelToken("a.b.c")).toBeNull();
    expect(verifyCancelToken(".")).toBeNull();
    const valid = signCancelToken("cs_child_A")!;
    expect(verifyCancelToken(valid.slice(0, -2))).toBeNull(); // truncated MAC
  });
});
