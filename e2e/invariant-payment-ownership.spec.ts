import { test, expect } from "@playwright/test";
import { NextRequest } from "next/server";
import { FetchStub } from "./fixtures/fetch-stub";
import { checkoutEvent, dropInSession, signedHeader, setWebhookTestEnv, TEST_DROPINS_DB } from "./fixtures/stripe-sessions";
import { POST } from "../src/app/api/stripe/webhook/route";

const ENV = ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "NOTION_API_KEY", "NOTION_DROPINS_DB_ID", "NGA_ADMIN_SECRET", "RESEND_API_KEY", "TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_FROM_NUMBER", "OPEN_BRAIN_INGEST_URL", "LEAD_INGEST_TOKEN"] as const;
const saved = Object.fromEntries(ENV.map(k => [k, process.env[k]]));
const stub = new FetchStub();
test.beforeEach(() => {
  for (const key of ENV) delete process.env[key];
  setWebhookTestEnv();
  process.env.RESEND_API_KEY = "re_test_ownership";
  stub.reset();
  stub.on("api.notion.com", { results: [] }).on("api.resend.com", { id: "email_fake" }).install();
});
test.afterEach(() => stub.uninstall());
test.afterAll(() => { for (const key of ENV) { if (saved[key] === undefined) delete process.env[key]; else process.env[key] = saved[key]; } });

function request(object: Record<string, unknown>, type = "checkout.session.completed") {
  const body = checkoutEvent(object, type);
  return new NextRequest("http://localhost/api/stripe/webhook", { method: "POST", body, headers: { "stripe-signature": signedHeader(body) } });
}

for (const owner of ["coach_os", "p3", "sam_website", "unknown", ""]) {
  for (const type of ["checkout.session.completed", "invoice.payment_succeeded", "invoice.paid", "charge.refunded"]) {
    test(`${type} owned by ${owner || "an invalid empty owner"} never reaches NGA writes or email`, async () => {
      const res = await POST(request({ ...dropInSession(), status: "paid", amount_paid: 2000, customer_email: "parent@example.com", payment_intent: "pi_foreign", metadata: { payment_owner: owner, kind: "lesson", session_id: "native-looking", child_first_name: "Synthetic" } }, type));
      expect(res.status).toBe(200);
      expect(await res.json()).toMatchObject({ skipped: "payment_not_owned" });
      expect(stub.calls).toHaveLength(0);
    });
  }
}

for (const marker of ["coach_os_billing_kind", "coach_os_attendee_id", "coach_os_session_id", "nga_request_id", "rsvp_id", "ladder_league_registration_id", "partner_league_pair_member_id", "participation_id"]) {
  test(`legacy foreign marker ${marker} wins over native-looking metadata`, async () => {
    const res = await POST(request(dropInSession({ metadata: { payment_owner: "nga_site", kind: "lesson", [marker]: "" } })));
    expect(await res.json()).toMatchObject({ skipped: "payment_not_owned" });
    expect(stub.calls).toHaveLength(0);
  });
}

test("an unknown native-tagged checkout does not fall through to a youth roster", async () => {
  const res = await POST(request(dropInSession({ metadata: { payment_owner: "nga_site", kind: "future_product" } })));
  expect(await res.json()).toMatchObject({ skipped: "payment_not_owned" });
  expect(stub.calls).toHaveLength(0);
});

test("session_id alone is not proof of a legacy youth purchase", async () => {
  const res = await POST(request({ ...dropInSession(), metadata: { session_id: "foreign-session" } }));
  expect(await res.json()).toMatchObject({ skipped: "payment_not_owned" });
  expect(stub.calls).toHaveLength(0);
});

test("a recognized legacy youth drop-in still looks up its own roster", async () => {
  const res = await POST(request(dropInSession())).catch(() => undefined);
  expect(stub.callsTo(TEST_DROPINS_DB).length).toBeGreaterThan(0);
  if (res) expect(res.status).toBe(200);
});

test("a native lesson invoice still reaches its parent confirmation", async () => {
  await POST(request({ id: "in_native", status: "paid", amount_paid: 8000, customer_email: "parent@example.com", metadata: { payment_owner: "nga_site", kind: "lesson", parent_name: "Test Parent", child_first_name: "Synthetic" } }, "invoice.payment_succeeded")).catch(() => undefined);
  expect(stub.callsTo("api.resend.com")).toHaveLength(2);
});

test("a legacy refund without ownership metadata is resolved only through native roster payment references", async () => {
  const res = await POST(request({ id: "ch_legacy", payment_intent: "pi_legacy", metadata: {} }, "charge.refunded"));
  expect(await res.json()).toMatchObject({ skipped: "not_found" });
  expect(stub.callsTo(TEST_DROPINS_DB).length).toBeGreaterThan(0);
  expect(stub.callsTo("api.resend.com")).toHaveLength(0);
  expect(stub.calls.filter(c => c.method === "PATCH")).toHaveLength(0);
});
