import { test, expect } from "@playwright/test";
import { NextRequest } from "next/server";
import { FetchStub } from "./fixtures/fetch-stub";
import {
  setWebhookTestEnv,
  dropInSession,
  checkoutEvent,
  signedHeader,
} from "./fixtures/stripe-sessions";

// Env BEFORE importing the route module (pure-spec convention).
setWebhookTestEnv();

import { POST } from "../src/app/api/stripe/webhook/route";

function webhookRequest(payload: string, sig?: string): NextRequest {
  return new NextRequest("http://localhost/api/stripe/webhook", {
    method: "POST",
    body: payload,
    headers: sig ? { "stripe-signature": sig } : {},
  });
}

const stub = new FetchStub();

test.beforeEach(() => {
  stub.reset();
  stub.install();
});
test.afterEach(() => stub.uninstall());

test.describe("stripe webhook signature gate", () => {
  test("fails closed (500) when STRIPE_WEBHOOK_SECRET is unset — zero downstream calls", async () => {
    const original = process.env.STRIPE_WEBHOOK_SECRET;
    try {
      delete process.env.STRIPE_WEBHOOK_SECRET;
      const payload = checkoutEvent(dropInSession());
      const res = await POST(webhookRequest(payload, signedHeader(payload)));
      expect(res.status).toBe(500);
      expect(stub.calls.length).toBe(0);
    } finally {
      process.env.STRIPE_WEBHOOK_SECRET = original;
    }
  });

  test("missing stripe-signature header → 400, zero downstream calls", async () => {
    const res = await POST(webhookRequest(checkoutEvent(dropInSession())));
    expect(res.status).toBe(400);
    expect(stub.calls.length).toBe(0);
  });

  test("invalid signature → 400, zero downstream calls", async () => {
    const payload = checkoutEvent(dropInSession());
    const res = await POST(webhookRequest(payload, "t=1,v1=deadbeef"));
    expect(res.status).toBe(400);
    expect(stub.calls.length).toBe(0);
  });

  test("signature over a DIFFERENT payload → 400 (no body swap)", async () => {
    const signedPayload = checkoutEvent(dropInSession({ id: "cs_real" }));
    const swappedPayload = checkoutEvent(dropInSession({ id: "cs_attacker" }));
    const res = await POST(
      webhookRequest(swappedPayload, signedHeader(signedPayload)),
    );
    expect(res.status).toBe(400);
    expect(stub.calls.length).toBe(0);
  });

  test("valid signature, irrelevant event type → plain ack, zero downstream calls", async () => {
    const payload = checkoutEvent(dropInSession(), "invoice.paid");
    const res = await POST(webhookRequest(payload, signedHeader(payload)));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ received: true });
    expect(stub.calls.length).toBe(0);
  });

  test("completed but unpaid session → skipped ack, zero downstream calls", async () => {
    const payload = checkoutEvent(dropInSession({ payment_status: "unpaid" }));
    const res = await POST(webhookRequest(payload, signedHeader(payload)));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ skipped: "not_paid" });
    expect(stub.calls.length).toBe(0);
  });

  test("paid checkout WITHOUT drop-in metadata → acked as non-drop-in, no roster write", async () => {
    // Other payments on the NGA Stripe account (e.g. lesson-package Payment
    // Links) hit this endpoint too — they must never build a roster row.
    const payload = checkoutEvent(
      dropInSession({ metadata: { session_id: undefined } }),
    );
    const res = await POST(webhookRequest(payload, signedHeader(payload)));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ skipped: "not_a_dropin" });
    expect(stub.calls.length).toBe(0);
  });
});
