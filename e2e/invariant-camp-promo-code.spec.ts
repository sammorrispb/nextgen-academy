/**
 * Invariant: the camp checkout must let parents enter a promotion code.
 *
 * The Macaroni Kid discount (`MACKID`, 15% off) is a Stripe promotion code the
 * parent types at checkout — it only works if /api/checkout-camp creates the
 * Checkout Session with `allow_promotion_codes: true`. This spec OBSERVES the
 * slop-free payments route (it never edits it) so a future refactor can't
 * silently drop the promo-code field and break the campaign without a red test.
 *
 * Pure-function spec (no dev server):
 *   npx playwright test e2e/invariant-camp-promo-code.spec.ts --project=desktop
 */
import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROUTE = join(
  __dirname,
  "..",
  "src",
  "app",
  "api",
  "checkout-camp",
  "route.ts",
);

test.describe("camp checkout — promotion codes enabled", () => {
  const src = readFileSync(ROUTE, "utf8");

  test("passes allow_promotion_codes: true to Stripe Checkout", () => {
    expect(src).toMatch(/allow_promotion_codes:\s*true/);
  });

  test("creates a Checkout Session (the surface MACKID is entered on)", () => {
    expect(src).toContain("checkout.sessions.create");
  });
});
