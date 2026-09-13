import { createHmac } from "node:crypto";
import { test, expect } from "@playwright/test";

// Set the secret BEFORE importing (read per call, but the pure-spec convention).
process.env.STANDINGS_LINK_SECRET = "test-standings-secret";
process.env.NGA_ADMIN_SECRET = "legacy-admin-secret-must-not-verify";

import {
  signStandingsLink,
  standingsLinkPath,
  verifyStandingsLink,
} from "../src/lib/standings-link-token";

// The parent standings link is a capability: it opens one colour group's
// standings to anyone holding it. These pins are the token-scope rules the
// other HMAC families carry (cancel-token-scope), plus the one this family
// deliberately adds — NO NGA_ADMIN_SECRET fallback.
//   npx playwright test e2e/standings-link-token.spec.ts --project=desktop
//
// Mutation checks: read NGA_ADMIN_SECRET as a fallback in secret() → the
// "admin secret never verifies" pin fails; drop the `raw !== payloadFor(group)`
// check → the cross-group pin fails.

test.describe("standings link token", () => {
  test("round-trips for the group it was minted for", () => {
    const token = signStandingsLink("Green");
    expect(token).toBeTruthy();
    expect(verifyStandingsLink(token!, "Green")).toBe(true);
    expect(standingsLinkPath("Green", token!)).toBe(`/fall/standings/green/${token}`);
    expect(token).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/); // URL-safe path segment
  });

  test("a Green token presented on the Yellow route fails (and vice versa)", () => {
    const green = signStandingsLink("Green")!;
    const yellow = signStandingsLink("Yellow")!;
    expect(verifyStandingsLink(green, "Yellow")).toBe(false);
    expect(verifyStandingsLink(yellow, "Green")).toBe(false);
    expect(verifyStandingsLink(yellow, "Yellow")).toBe(true);
  });

  test("swapping the payload while keeping the MAC fails", () => {
    const green = signStandingsLink("Green")!;
    const mac = green.split(".")[1];
    const yellowPayload = Buffer.from("standings:yellow", "utf-8").toString("base64url");
    expect(verifyStandingsLink(`${yellowPayload}.${mac}`, "Yellow")).toBe(false);
  });

  test("a MAC forged with a guessed secret never verifies", () => {
    const payload = Buffer.from("standings:green", "utf-8").toString("base64url");
    const forged = createHmac("sha256", "guessed-wrong").update("standings:green").digest("base64url");
    expect(verifyStandingsLink(`${payload}.${forged}`, "Green")).toBe(false);
  });

  test("the admin secret is NOT a fallback: a token signed with it never verifies", () => {
    const payload = Buffer.from("standings:green", "utf-8").toString("base64url");
    const adminMac = createHmac("sha256", "legacy-admin-secret-must-not-verify")
      .update("standings:green")
      .digest("base64url");
    expect(verifyStandingsLink(`${payload}.${adminMac}`, "Green")).toBe(false);
  });

  test("rotating STANDINGS_LINK_SECRET revokes every outstanding link", () => {
    const token = signStandingsLink("Green")!;
    const original = process.env.STANDINGS_LINK_SECRET;
    try {
      process.env.STANDINGS_LINK_SECRET = "rotated";
      expect(verifyStandingsLink(token, "Green")).toBe(false);
    } finally {
      process.env.STANDINGS_LINK_SECRET = original;
    }
  });

  test("unset secret → sign and verify both refuse, even with the admin secret present", () => {
    const original = process.env.STANDINGS_LINK_SECRET;
    try {
      delete process.env.STANDINGS_LINK_SECRET;
      expect(signStandingsLink("Green")).toBeNull();
      expect(verifyStandingsLink("anything.anything", "Green")).toBe(false);
      process.env.STANDINGS_LINK_SECRET = "";
      expect(signStandingsLink("Green")).toBeNull();
    } finally {
      process.env.STANDINGS_LINK_SECRET = original;
    }
  });

  test("rejects malformed tokens", () => {
    expect(verifyStandingsLink("", "Green")).toBe(false);
    expect(verifyStandingsLink(undefined, "Green")).toBe(false);
    expect(verifyStandingsLink(null, "Green")).toBe(false);
    expect(verifyStandingsLink("no-dot", "Green")).toBe(false);
    expect(verifyStandingsLink("a.b.c", "Green")).toBe(false);
    expect(verifyStandingsLink(".", "Green")).toBe(false);
    const valid = signStandingsLink("Green")!;
    expect(verifyStandingsLink(valid.slice(0, -2), "Green")).toBe(false);
  });
});
