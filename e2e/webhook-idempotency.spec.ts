import { test, expect } from "@playwright/test";
import { NextRequest } from "next/server";
import { FetchStub } from "./fixtures/fetch-stub";
import {
  setWebhookTestEnv,
  dropInSession,
  checkoutEvent,
  signedHeader,
  existingDropInPage,
  TEST_DROPINS_DB,
} from "./fixtures/stripe-sessions";

setWebhookTestEnv();

import { POST } from "../src/app/api/stripe/webhook/route";

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

test.describe("stripe webhook idempotency (Stripe redelivers; exactly one roster row)", () => {
  test("redelivered event for an existing row → idempotent ack, NO second create", async () => {
    stub
      .on(`databases/${TEST_DROPINS_DB}/query`, {
        results: [existingDropInPage("cs_test_dropin_a")],
      })
      .on("api.notion.com", { results: [] }) // player-CRM first-timer lookup
      .install();

    const payload = checkoutEvent(dropInSession({ id: "cs_test_dropin_a" }));
    const res = await POST(webhookRequest(payload));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ received: true, idempotent: true });
    // The dropins DB was only QUERIED — never written.
    expect(stub.callsTo("/v1/pages")).toHaveLength(0);
  });

  test("first delivery creates exactly one roster row (the critical write)", async () => {
    stub
      .on(`databases/${TEST_DROPINS_DB}/query`, { results: [] })
      .on("api.notion.com/v1/pages", { id: "notion-page-created" })
      .on("api.notion.com", { results: [] })
      .on("api.resend.com", { id: "email_test" })
      .install();

    const payload = checkoutEvent(dropInSession({ id: "cs_first_delivery" }));
    // after() registers best-effort comms; outside a Next request scope it may
    // throw AFTER the critical row create. The invariant under test is the
    // create itself, so settle either way and assert on captured calls.
    const settled = await POST(webhookRequest(payload)).then(
      (r) => ({ ok: true as const, res: r }),
      (e) => ({ ok: false as const, err: e as Error }),
    );

    const creates = stub.callsTo("/v1/pages");
    expect(creates).toHaveLength(1);
    expect(creates[0].body).toContain("cs_first_delivery");
    if (settled.ok) {
      expect(settled.res.status).toBe(200);
    }
  });

  test("transient Notion failure (429) → 500 so Stripe redelivers", async () => {
    stub
      .on(`databases/${TEST_DROPINS_DB}/query`, { results: [] })
      .on("api.notion.com/v1/pages", { error: "rate_limited" }, 429)
      .on("api.notion.com", { results: [] })
      .install();

    const payload = checkoutEvent(dropInSession({ id: "cs_transient" }));
    const res = await POST(webhookRequest(payload));
    expect(res.status).toBe(500);
    expect(stub.callsTo("/v1/pages")).toHaveLength(1);
  });
});
