import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test, expect } from "@playwright/test";

// The Stripe webhook's checkout.session.completed fan-out used to call
// processReferralReward(session): on a referred newsletter subscriber's first
// paid drop-in it minted two single-use 50%-off Stripe coupons and emailed both
// parents. Sam switched the payout off 2026-09-04 — the referral program isn't
// set up, and no recipient-facing email has promoted the link since 2026-09-03
// (PR #314). A link already in a parent's inbox must now be inert for money:
// signing up through it still stamps `Referred By` (tracking, not a payout),
// but a paid drop-in never mints anything.
//
// The payout rode after() post-response, which the pure harness cannot observe
// (after() throws outside a Next request scope — see webhook-idempotency.spec),
// so this pins the WIRING the way invariant-coach-inbox-authz pins that the
// cron never imports setDraftStatus: the webhook source must not reference the
// payout function, its module, or the Stripe coupon / promo-code mint APIs.
//
// Mutation check: re-add `processReferralReward(session)` to the fan-out, or
// its import → the first pin goes red.

const read = (...parts: string[]) =>
  readFileSync(join(__dirname, "..", ...parts), "utf8");
const webhookSrc = () =>
  read("src", "app", "api", "stripe", "webhook", "route.ts");

test.describe("stripe webhook — the referral payout is switched off", () => {
  test("the webhook never references the referral payout or its module", () => {
    const src = webhookSrc();
    expect(src).not.toContain("processReferralReward");
    expect(src).not.toContain("referral-rewards");
  });

  test("the webhook never mints a coupon or promotion code itself", () => {
    const src = webhookSrc();
    expect(src).not.toMatch(/coupons\s*\.\s*create/);
    expect(src).not.toMatch(/promotionCodes\s*\.\s*create/);
  });
});
