/**
 * Typed Stripe Checkout Session + signed-event factories for webhook specs.
 *
 * Metadata keys mirror exactly what /api/checkout stamps and what
 * src/app/api/stripe/webhook/route.ts reads (metaString calls around lines
 * 325-391). Signatures are generated OFFLINE with Stripe's own test helper, so
 * constructEvent() verifies them for real — no network, no mocking of the
 * signature path itself.
 */
import Stripe from "stripe";

export const TEST_WEBHOOK_SECRET = "whsec_test_invariants";
export const TEST_NOTION_KEY = "ntn_test_key";
export const TEST_DROPINS_DB = "db-dropins-test";

/** Env every webhook spec needs BEFORE importing the route module. */
export function setWebhookTestEnv(): void {
  process.env.STRIPE_WEBHOOK_SECRET = TEST_WEBHOOK_SECRET;
  process.env.STRIPE_SECRET_KEY = "sk_test_dummy_offline";
  process.env.NOTION_API_KEY = TEST_NOTION_KEY;
  process.env.NOTION_DROPINS_DB_ID = TEST_DROPINS_DB;
  process.env.NGA_ADMIN_SECRET = "test-admin-secret";
  // Twilio env intentionally absent: sendSms() self-skips as not_configured.
  // RESEND_API_KEY intentionally absent: email helpers warn + skip.
}

const DROPIN_METADATA = {
  session_id: "notion-session-row-1",
  parent_name: "Test Parent",
  parent_phone: "3015550100",
  child_first_name: "Testkid",
  child_birth_year: "2015",
  session_title: "Green Ball Tuesday",
  session_date: "2026-07-01",
  session_start: "6:00 PM",
  session_end: "7:00 PM",
  session_location: "Redland Middle School tennis courts",
  session_public_area: "Derwood, MD",
  display_consent: "true",
  sms_consent: "true",
  sms_consent_text: "I agree to receive SMS reminders about my registration.",
};

export function dropInSession(
  overrides: {
    id?: string;
    payment_status?: string;
    customer_email?: string | null;
    metadata?: Record<string, string | undefined>;
  } = {},
): Record<string, unknown> {
  const metadata: Record<string, string> = {};
  const merged = { ...DROPIN_METADATA, ...(overrides.metadata ?? {}) };
  for (const [k, v] of Object.entries(merged)) {
    if (typeof v === "string") metadata[k] = v; // undefined = drop the key
  }
  return {
    id: overrides.id ?? "cs_test_dropin_a",
    object: "checkout.session",
    payment_status: overrides.payment_status ?? "paid",
    amount_total: 2000,
    customer_email:
      overrides.customer_email === undefined
        ? "parent@example.com"
        : overrides.customer_email,
    customer_details: { email: "parent@example.com" },
    payment_intent: "pi_test_dropin_a",
    metadata,
  };
}

export function checkoutEvent(
  session: Record<string, unknown>,
  type = "checkout.session.completed",
): string {
  return JSON.stringify({
    id: "evt_test_invariants",
    object: "event",
    type,
    data: { object: session },
  });
}

const offlineStripe = new Stripe("sk_test_dummy_offline");

/** Real Stripe test-helper signature over the payload — verifies offline. */
export function signedHeader(payload: string, secret = TEST_WEBHOOK_SECRET): string {
  return offlineStripe.webhooks.generateTestHeaderString({ payload, secret });
}

/** Minimal Notion page the dropins query returns for "row already exists". */
export function existingDropInPage(checkoutSessionId: string): Record<string, unknown> {
  return {
    id: "notion-page-existing",
    properties: {
      "Stripe Checkout Session ID": {
        rich_text: [{ plain_text: checkoutSessionId }],
      },
      Status: { select: { name: "Confirmed" } },
    },
  };
}
