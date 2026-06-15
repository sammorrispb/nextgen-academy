import { test, expect } from "@playwright/test";
import { NextRequest } from "next/server";
import { FetchStub } from "./fixtures/fetch-stub";
import {
  setWebhookTestEnv,
  checkoutEvent,
  signedHeader,
} from "./fixtures/stripe-sessions";

setWebhookTestEnv();
// Processed-events dedupe DB must be configured or the helpers fail-soft (no
// dedupe) — that fail-soft path is exactly today's behavior and is covered by
// the env-unset story, not here.
process.env.NOTION_PROCESSED_EVENTS_DB_ID = "db-processed-test";

import { POST } from "../src/app/api/stripe/webhook/route";

// Camp + league checkouts have no roster row of their own, so before this guard
// a Stripe redelivery of a 200'd checkout.session.completed re-fired the parent
// + admin emails. The shared processed-events ledger (keyed on the checkout
// session id) is their dedupe key: a redelivered event must no-op (idempotent
// ack, no record write, no comms registered), while a first delivery records the
// session id exactly once. A transient ledger-write failure must 500 so Stripe
// redelivers (the find guard makes the retry safe).
const PROCESSED_DB = "db-processed-test";

function kindSession(
  kind: "camp" | "league",
  id: string,
): Record<string, unknown> {
  return {
    id,
    object: "checkout.session",
    payment_status: "paid",
    amount_total: 30000,
    customer_email: "parent@example.com",
    customer_details: { email: "parent@example.com" },
    payment_intent: `pi_${id}`,
    metadata: {
      kind,
      parent_name: "Test Parent",
      parent_email: "parent@example.com",
      parent_phone: "3015550100",
      child_first_name: "Testkid",
      child_birth_year: "2015",
      camp_title: "Summer Week 1",
      camp_week: "Week 1",
      season_title: "Fall Season",
      season_band_label: "10U",
      option_label: "Full day",
    },
  };
}

function webhookRequest(payload: string): NextRequest {
  return new NextRequest("http://localhost/api/stripe/webhook", {
    method: "POST",
    body: payload,
    headers: { "stripe-signature": signedHeader(payload) },
  });
}

const stub = new FetchStub();
test.beforeEach(() => stub.reset());
test.afterEach(() => stub.uninstall());

for (const kind of ["camp", "league"] as const) {
  test.describe(`stripe webhook ${kind} idempotency`, () => {
    test(`redelivered ${kind} event → idempotent ack, NO record write, NO email`, async () => {
      stub
        .on(`/databases/${PROCESSED_DB}/query`, {
          results: [{ id: "processed-row-existing" }],
        })
        .on("api.notion.com/v1/pages", { id: "should-not-be-called" })
        .on("api.resend.com", { id: "email_test" })
        .install();

      const payload = checkoutEvent(kindSession(kind, `cs_${kind}_redeliver`));
      const res = await POST(webhookRequest(payload));

      expect(res.status).toBe(200);
      expect(await res.json()).toMatchObject({ received: true, idempotent: true });
      // Guard tripped before any ledger write or comms.
      expect(stub.callsTo("/v1/pages")).toHaveLength(0);
      expect(stub.callsTo("api.resend.com")).toHaveLength(0);
    });

    test(`first ${kind} delivery records the session id exactly once`, async () => {
      stub
        .on(`/databases/${PROCESSED_DB}/query`, { results: [] })
        .on("api.notion.com/v1/pages", { id: "processed-row-created" })
        .on("api.notion.com", { results: [] })
        .on("api.resend.com", { id: "email_test" })
        .install();

      const payload = checkoutEvent(kindSession(kind, `cs_${kind}_first`));
      // after() comms are registered but do not flush outside a real request
      // scope; the invariant under test is the synchronous ledger write.
      const settled = await POST(webhookRequest(payload)).then(
        (r) => ({ ok: true as const, res: r }),
        (e) => ({ ok: false as const, err: e as Error }),
      );

      const records = stub
        .callsTo("/v1/pages")
        .filter((c) => c.body.includes(`cs_${kind}_first`) && c.body.includes('"Kind"'));
      expect(records, "exactly one processed-events record").toHaveLength(1);
      expect(records[0].body).toContain(kind);
      if (settled.ok) {
        expect(settled.res.status).toBe(200);
        expect(await settled.res.json()).toMatchObject({ received: true, [kind]: true });
      }
    });

    test(`transient ledger-write failure (429) → 500 so Stripe redelivers`, async () => {
      stub
        .on(`/databases/${PROCESSED_DB}/query`, { results: [] })
        .on("api.notion.com/v1/pages", { error: "rate_limited" }, 429)
        .on("api.resend.com", { id: "email_test" })
        .install();

      const payload = checkoutEvent(kindSession(kind, `cs_${kind}_transient`));
      const res = await POST(webhookRequest(payload));
      expect(res.status).toBe(500);
      // No email fired — we 500'd before registering comms.
      expect(stub.callsTo("api.resend.com")).toHaveLength(0);
    });
  });
}
