import { NextRequest } from "next/server";
import assert from "node:assert/strict";
import { FetchStub, type RecordedFetch } from "./fetch-stub";
import { signedHeader, TEST_WEBHOOK_SECRET } from "./stripe-sessions";
import { POST as webhook } from "../../src/app/api/stripe/webhook/route";
import { DenyProviderNetwork } from "./deny-provider-network";

// Synthetic signed callbacks exercise the real route and Resend serializer.
// Stripe signature verification is offline; no Stripe SDK request is needed on
// this MVF branch. All fetches must match these exact test-provider endpoints.
export const MVF_NOTIFICATION_ENV = [
  "STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "NOTION_API_KEY",
  "NOTION_MVF_TOURNAMENT_REGS_DB_ID", "NOTION_WAIVERS_DB_ID", "RESEND_API_KEY",
  "VERCEL_ENV", "LINKDINK_BASE_URL", "NGA_SYNC_SECRET", "OPEN_BRAIN_INGEST_URL",
  "OPEN_BRAIN_INGEST_SECRET", "LEAD_INGEST_TOKEN", "TWILIO_ACCOUNT_SID",
  "TWILIO_AUTH_TOKEN", "TWILIO_FROM_NUMBER",
] as const;

export const MVF_NOTIFICATION_INVOICE = "in_SyntheticNotificationOutput";
const eventKey = "mvf-junior-tournament-10u-2026-10-24";

// Do not let an over-permissive ledger fake make a wrong invoice, event, or
// recipient look like a successful delivery acknowledgement.
export function assertMvfNotificationCommand(call: RecordedFetch) {
  assert.equal(call.method, "POST");
  const body = JSON.parse(call.body);
  assert.ok(body.action === "paid" || body.action === "notified");
  if (body.action === "notified") assert.ok(body.recipient === "admin" || body.recipient === "parent");
  assert.deepEqual(body, {
    action: body.action, event_key: eventKey, invoice_id: MVF_NOTIFICATION_INVOICE,
    ...(body.action === "notified" ? { recipient: body.recipient } : {}),
  });
  return body as { action: "paid" | "notified"; recipient?: "admin" | "parent" };
}
export const MVF_NOTIFICATION_METADATA = {
  kind: "mvf-junior-tournament", event_date: "2026-10-24", division: "10u",
  division_label: "10U", resident: "true", parent_name: "Synthetic Parent",
  parent_email: "synthetic.parent@example.invalid", parent_phone: "3015550101",
  child_first_name: "Synthetic", child_last_name: "Junior", child_dob: "2017-05-01",
  emergency_name: "Synthetic Contact", emergency_phone: "3015550102",
  allergies: "Synthetic medical note", nga_share_usd: "40.00", mvf_share_usd: "10.00",
  // Unknown metadata must never hitchhike into the approved email envelope.
  child_school: "UNAPPROVED_SCHOOL_SENTINEL", internal_notes: "INTERNAL_ONLY_SENTINEL",
};

export interface CapturedMvfMail {
  payload: Record<string, unknown>;
  idempotencyKey: string | null;
}

export function mvfNotificationProbe() {
  const stub = new FetchStub();
  const mail: CapturedMvfMail[] = [];
  const acknowledged = new Set<string>();
  const unexpected: string[] = [];
  const network = new DenyProviderNetwork();
  let providerFetch: typeof fetch | undefined;
  const capacity = "https://capacity.example.invalid/play/api/internal/nga-tournament-capacity";
  const notion = "https://api.notion.com/v1/databases/mvf_notification_output/query";
  const resend = "https://api.resend.com/emails";

  return {
    stub, mail, unexpected,
    install() {
      network.install();
      for (const key of MVF_NOTIFICATION_ENV) delete process.env[key];
      Object.assign(process.env, {
        STRIPE_SECRET_KEY: "sk_test_offline_mvf_notification_output",
        STRIPE_WEBHOOK_SECRET: TEST_WEBHOOK_SECRET,
        NOTION_API_KEY: "ntn_offline_mvf_notification_output",
        NOTION_MVF_TOURNAMENT_REGS_DB_ID: "mvf_notification_output",
        RESEND_API_KEY: "re_test_mvf_notification_output",
        NGA_SYNC_SECRET: "synthetic-notification-capacity",
        LINKDINK_BASE_URL: "https://capacity.example.invalid",
      });
      stub.reset(); mail.length = 0; unexpected.length = 0; acknowledged.clear();
      stub.onDynamic(capacity, call => {
        let body: ReturnType<typeof assertMvfNotificationCommand>;
        try { body = assertMvfNotificationCommand(call); }
        catch (error) { unexpected.push("invalid capacity command"); throw error; }
        if (body.action === "notified") {
          acknowledged.add(body.recipient!);
          return { status: 200, json: { ok: true, recorded: true } };
        }
        return { status: 200, json: {
          ok: true, already_paid: true, admin_notified: acknowledged.has("admin"),
          parent_notified: acknowledged.has("parent"), notification_retry_allowed: true,
          legacy_callback_deferred: false,
        } };
      });
      // Existing paid roster: isolate notification behavior from backfill;
      // invariant-mvf-tournament-payloads owns actual Notion writes.
      stub.on(notion, { results: [{ id: "synthetic-paid-row", properties: { Paid: { checkbox: true } } }] });
      stub.on(resend, { id: "synthetic-provider-mail" });
      stub.install();
      providerFetch = globalThis.fetch;
      globalThis.fetch = async (input, init) => {
        const url = input instanceof Request ? input.url : String(input);
        if (![capacity, notion, resend].includes(url)) unexpected.push(url);
        const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
        if ([capacity, notion, resend].includes(url) && method !== "POST") {
          unexpected.push("invalid provider method");
          throw new Error("MVF notification probe expected POST");
        }
        if (url === resend) mail.push({
          payload: JSON.parse(String(init?.body)),
          idempotencyKey: new Headers(init?.headers).get("idempotency-key"),
        });
        return providerFetch!(input, init);
      };
    },
    uninstall() {
      if (providerFetch) globalThis.fetch = providerFetch;
      stub.uninstall(); providerFetch = undefined;
      network.uninstall();
      // A provider SDK can bypass fetch. Preserve the denied attempt even if
      // fail-soft application code catches the transport exception.
      unexpected.push(...network.attempts.map(() => "denied provider transport"));
    },
    async paid(type: "invoice.paid" | "invoice.payment_succeeded" = "invoice.paid", overrides: Record<string, string> = {}) {
      const payload = JSON.stringify({ id: `evt_Synthetic_${type}`, object: "event", livemode: true, type,
        data: { object: { id: MVF_NOTIFICATION_INVOICE, object: "invoice", amount_paid: 5000,
          customer_email: MVF_NOTIFICATION_METADATA.parent_email,
          metadata: { ...MVF_NOTIFICATION_METADATA, ...overrides } } } });
      return webhook(new NextRequest("http://localhost/api/stripe/webhook", {
        method: "POST", body: payload, headers: { "stripe-signature": signedHeader(payload) },
      }));
    },
  };
}
