import { test, expect } from "@playwright/test";
import type Stripe from "stripe";
import { FetchStub } from "./fixtures/fetch-stub";

// Env BEFORE importing the module under test.
process.env.NOTION_API_KEY = "ntn_test";
process.env.NOTION_NEWSLETTER_DB_ID = "newsletter-db";

import { processReferralReward } from "../src/lib/referral-rewards";

// processReferralReward mints TWO single-use 50%-off Stripe coupons + emails
// both parents the first time a referred friend pays. Its only idempotency gate
// against a double-mint (Stripe webhook redelivery / retry) is the friend row's
// `Referral Rewarded` flag (referral-rewards.ts:87 `if (friend.referralRewarded)
// return;`). This pins that gate. GAP-N4 in docs/audits/ui-agent-parity-nga.md.
//
// Observability note: getStripe() builds the Stripe SDK on Node's http client,
// NOT global fetch, so the coupon mint itself isn't visible to the FetchStub the
// repo's invariant specs use. We instead pin the GATE via the one thing that IS
// fetch-observable — the Notion subscriber lookups: the already-rewarded path
// returns after the FIRST lookup (friend) and never reaches the referrer lookup,
// the payout, or any send; the not-yet-rewarded path proceeds to the SECOND
// lookup (referrer) and the mint. That difference is the load-bearing guard.

const FRIEND_EMAIL = "friend@example.com";

function subscriberPage(opts: {
  referredBy: string | null;
  rewarded: boolean;
  email?: string;
}) {
  return {
    id: "sub-page-1",
    properties: {
      "Parent Name": { title: [{ plain_text: "Parent One" }] },
      Email: { email: opts.email ?? FRIEND_EMAIL },
      "Referred By": opts.referredBy ? { email: opts.referredBy } : { email: null },
      "Referral Rewarded": { checkbox: opts.rewarded },
      "Coupons Issued": { number: 0 },
    },
  };
}

const SESSION = {
  customer_details: { email: FRIEND_EMAIL },
  customer_email: null,
  metadata: { child_first_name: "Kid" },
} as unknown as Stripe.Checkout.Session;

const QUERY = "/databases/newsletter-db/query";

const stub = new FetchStub();
test.beforeEach(() => {
  stub.reset();
  stub.install();
});
test.afterEach(() => stub.uninstall());

test.describe("processReferralReward — double-mint idempotency gate", () => {
  test("already-rewarded friend → NO payout: returns after the friend lookup, no referrer lookup, no email, no flag write", async () => {
    stub.on(QUERY, {
      results: [subscriberPage({ referredBy: "ref@example.com", rewarded: true })],
    });

    await processReferralReward(SESSION); // resolves cleanly — the gate short-circuits

    expect(stub.callsTo(QUERY).length, "exactly ONE Notion lookup (friend only)").toBe(1);
    expect(stub.callsTo("api.resend.com").length, "no reward emails").toBe(0);
    expect(
      stub.calls.find((c) => c.method === "PATCH" && /\/pages\//.test(c.url)),
      "no Referral-Rewarded flag write on the no-op path",
    ).toBeFalsy();
  });

  test("NEGATIVE CONTROL: not-yet-rewarded friend → passes the gate to the referrer lookup + the mint (proves the gate is load-bearing)", async () => {
    stub.on(QUERY, {
      results: [subscriberPage({ referredBy: "ref@example.com", rewarded: false })],
    });
    // RESEND set, STRIPE unset → once past the gate the function reaches
    // getStripe() (referral-rewards.ts:111), which throws without a key. That
    // throw is the proof it did NOT no-op like the rewarded path above.
    const origStripe = process.env.STRIPE_SECRET_KEY;
    const origResend = process.env.RESEND_API_KEY;
    try {
      delete process.env.STRIPE_SECRET_KEY;
      process.env.RESEND_API_KEY = "re_test";

      await expect(
        processReferralReward(SESSION),
        "must proceed to the payout (not no-op) when the friend isn't yet rewarded",
      ).rejects.toThrow(/STRIPE_SECRET_KEY/);

      expect(
        stub.callsTo(QUERY).length,
        "reached the SECOND lookup (referrer) — i.e. passed the gate the rewarded path stops at",
      ).toBeGreaterThanOrEqual(2);
    } finally {
      if (origStripe === undefined) delete process.env.STRIPE_SECRET_KEY;
      else process.env.STRIPE_SECRET_KEY = origStripe;
      if (origResend === undefined) delete process.env.RESEND_API_KEY;
      else process.env.RESEND_API_KEY = origResend;
    }
  });
});
