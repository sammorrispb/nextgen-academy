import { test, expect } from "@playwright/test";
import { NextRequest } from "next/server";
import { FetchStub } from "./fixtures/fetch-stub";
import {
  setWebhookTestEnv,
  dropInSession,
  checkoutEvent,
  signedHeader,
  TEST_DROPINS_DB,
} from "./fixtures/stripe-sessions";

setWebhookTestEnv();

import { POST } from "../src/app/api/stripe/webhook/route";
import { sendSms } from "../src/lib/sms";

// Consent is COPPA/TCPA-adjacent: SMS and public-display flags must only flip
// on the exact string "true" from checkout metadata, and sendSms() itself must
// refuse without consent regardless of caller.
const stub = new FetchStub();
test.beforeEach(() => stub.reset());
test.afterEach(() => stub.uninstall());

function webhookRequest(payload: string): NextRequest {
  return new NextRequest("http://localhost/api/stripe/webhook", {
    method: "POST",
    body: payload,
    headers: { "stripe-signature": signedHeader(payload) },
  });
}

/** Deliver a paid drop-in with given consent metadata; return the Notion
 * create payload's properties. after() comms may throw outside a request
 * scope — the row create (the consent record of truth) lands first. */
async function consentPropsFor(
  meta: Record<string, string | undefined>,
  id: string,
): Promise<Record<string, { checkbox?: boolean }>> {
  stub
    .on(`databases/${TEST_DROPINS_DB}/query`, { results: [] })
    .on("api.notion.com/v1/pages", { id: "notion-page-created" })
    .on("api.notion.com", { results: [] })
    .on("api.resend.com", { id: "email_test" })
    .install();
  const payload = checkoutEvent(dropInSession({ id, metadata: meta }));
  await POST(webhookRequest(payload)).catch(() => undefined);
  const creates = stub.callsTo("/v1/pages");
  expect(creates).toHaveLength(1);
  return JSON.parse(creates[0].body).properties;
}

test.describe("sendSms consent hard-gate (TCPA)", () => {
  test("consent:false is refused, not silently dropped", async () => {
    const result = await sendSms({
      to: "3015550100",
      body: "hi",
      consent: false,
    });
    expect(result).toEqual({ ok: false, skipped: "no_consent" });
  });

  test("consent:true without Twilio env self-skips as not_configured (env-graceful, no throw)", async () => {
    const result = await sendSms({
      to: "3015550100",
      body: "hi",
      consent: true,
    });
    expect(result).toEqual({ ok: false, skipped: "not_configured" });
  });
});

test.describe("webhook consent-flag mapping (exact-string 'true' only)", () => {
  test("sms_consent 'true' + display_consent 'true' → both checkboxes true", async () => {
    const props = await consentPropsFor(
      { sms_consent: "true", display_consent: "true" },
      "cs_consent_both",
    );
    expect(props["SMS Consent"].checkbox).toBe(true);
    expect(props["Display Consent"].checkbox).toBe(true);
  });

  test("'TRUE' / 'yes' / '1' do NOT count as consent", async () => {
    const props = await consentPropsFor(
      { sms_consent: "TRUE", display_consent: "yes" },
      "cs_consent_loose",
    );
    expect(props["SMS Consent"].checkbox).toBe(false);
    expect(props["Display Consent"].checkbox).toBe(false);

    stub.reset();
    const props2 = await consentPropsFor(
      { sms_consent: "1", display_consent: "" },
      "cs_consent_numeric",
    );
    expect(props2["SMS Consent"].checkbox).toBe(false);
    expect(props2["Display Consent"].checkbox).toBe(false);
  });

  test("absent consent keys default to false", async () => {
    const props = await consentPropsFor(
      { sms_consent: undefined, display_consent: undefined, sms_consent_text: undefined },
      "cs_consent_absent",
    );
    expect(props["SMS Consent"].checkbox).toBe(false);
    expect(props["Display Consent"].checkbox).toBe(false);
  });

  test("the verbatim opt-in language is preserved on the row (audit defense)", async () => {
    const props = await consentPropsFor(
      { sms_consent: "true", sms_consent_text: "I agree to SMS reminders." },
      "cs_consent_text",
    );
    const rich = props["SMS Consent Text"] as unknown as {
      rich_text: Array<{ text: { content: string } }>;
    };
    expect(rich.rich_text[0].text.content).toBe("I agree to SMS reminders.");
  });
});
