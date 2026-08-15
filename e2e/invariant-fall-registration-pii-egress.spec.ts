import { test, expect } from "@playwright/test";
import { NextRequest } from "next/server";
import { FetchStub } from "./fixtures/fetch-stub";
import {
  setWebhookTestEnv,
  checkoutEvent,
  signedHeader,
} from "./fixtures/stripe-sessions";

setWebhookTestEnv();
process.env.NOTION_FALL_REGS_DB_ID = "db-fall-regs-test";

import { POST } from "../src/app/api/stripe/webhook/route";

// The Fall Registrations DB is a NEW egress destination for child fields
// (first name + birth year — the roster is also the checkout's capacity
// count), so per the minor-data governance rules its egress surface is pinned:
// the fall webhook branch may reach Notion (and Resend when configured) and
// NOTHING else, the roster row is the idempotency key, and the webhook's JSON
// ack never echoes child data back to Stripe.
const FALL_DB = "db-fall-regs-test";
const ALLOWED_HOSTS = ["api.notion.com", "api.resend.com"];

function fallSession(id: string): Record<string, unknown> {
  return {
    id,
    object: "checkout.session",
    payment_status: "paid",
    amount_total: 22500,
    customer_email: "parent@example.com",
    customer_details: { email: "parent@example.com" },
    payment_intent: `pi_${id}`,
    metadata: {
      kind: "fall",
      season_slug: "fall-2026",
      season_title: "Next Gen Youth Fall Season",
      season_label: "September 20 – October 25, 2026",
      group: "Green",
      group_label: "Green Ball",
      group_time: "1:00–2:30 PM",
      venue:
        "Earle B. Wood Middle School Tennis Courts, 14615 Bauer Dr, Rockville, MD 20853",
      parent_name: "Test Parent",
      parent_email: "parent@example.com",
      parent_phone: "3015550100",
      child_first_name: "Testkid",
      child_birth_year: "2015",
      emergency_name: "Emergency Person",
      emergency_phone: "3015550101",
      allergies: "peanuts",
      waiver_accepted: "true",
      sms_consent: "false",
      sms_consent_text: "",
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

test.describe("stripe webhook fall branch — minor-PII egress", () => {
  test("first delivery writes the roster row (child fields land in Notion only) and the ack echoes no child data", async () => {
    stub
      .on(`/databases/${FALL_DB}/query`, { results: [] })
      .on("api.notion.com/v1/pages", { id: "fall-row-created" })
      .on("api.notion.com", { results: [] })
      .on("api.resend.com", { id: "email_test" })
      .install();

    const payload = checkoutEvent(fallSession("cs_fall_first"));
    // after() comms are registered but do not flush outside a real request
    // scope (it throws there); the invariants under test are the synchronous
    // roster write, the egress hosts, and — when the response materializes —
    // the PII-free ack.
    const settled = await POST(webhookRequest(payload)).then(
      (r) => ({ ok: true as const, res: r }),
      (e) => ({ ok: false as const, err: e as Error }),
    );

    for (const call of stub.calls) {
      const host = new URL(call.url).host;
      expect(
        ALLOWED_HOSTS.some((h) => host === h),
        `unexpected egress host: ${host}`,
      ).toBe(true);
    }

    const rosterWrites = stub
      .callsTo("/v1/pages")
      .filter((c) => c.body.includes(FALL_DB));
    expect(rosterWrites, "exactly one roster row").toHaveLength(1);
    expect(rosterWrites[0].body).toContain("Testkid");
    expect(rosterWrites[0].body).toContain('"Group"');
    expect(rosterWrites[0].body).toContain("cs_fall_first");

    if (settled.ok) {
      expect(settled.res.status).toBe(200);
      const ack = JSON.stringify(await settled.res.json());
      expect(ack).toContain("fall");
      expect(ack).not.toContain("Testkid");
      expect(ack).not.toContain("2015");
      expect(ack).not.toContain("parent@example.com");
    }
  });

  test("redelivered event → idempotent ack, NO second roster row, NO email", async () => {
    stub
      .on(`/databases/${FALL_DB}/query`, {
        results: [{ id: "fall-row-existing" }],
      })
      .on("api.notion.com/v1/pages", { id: "should-not-be-called" })
      .on("api.resend.com", { id: "email_test" })
      .install();

    const payload = checkoutEvent(fallSession("cs_fall_redeliver"));
    const res = await POST(webhookRequest(payload));

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ received: true, idempotent: true });
    expect(stub.callsTo("/v1/pages")).toHaveLength(0);
    expect(stub.callsTo("api.resend.com")).toHaveLength(0);
  });

  test("transient roster-write failure (429) → 500 so Stripe redelivers", async () => {
    stub
      .on(`/databases/${FALL_DB}/query`, { results: [] })
      .on("api.notion.com/v1/pages", { error: "rate_limited" }, 429)
      .on("api.resend.com", { id: "email_test" })
      .install();

    const payload = checkoutEvent(fallSession("cs_fall_transient"));
    const res = await POST(webhookRequest(payload));
    expect(res.status).toBe(500);
    expect(stub.callsTo("api.resend.com")).toHaveLength(0);
  });

  test("Open Brain is not reached when its env is unset", async () => {
    delete process.env.OPEN_BRAIN_INGEST_URL;
    stub
      .on(`/databases/${FALL_DB}/query`, { results: [] })
      .on("api.notion.com/v1/pages", { id: "fall-row-created" })
      .on("api.notion.com", { results: [] })
      .on("api.resend.com", { id: "email_test" })
      .install();

    const payload = checkoutEvent(fallSession("cs_fall_no_ob"));
    await POST(webhookRequest(payload)).catch(() => undefined);

    for (const call of stub.calls) {
      expect(call.url).not.toContain("open-brain");
      expect(new URL(call.url).host).not.toContain("supabase");
    }
  });
});
