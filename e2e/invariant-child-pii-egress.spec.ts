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
// The Pickl Park season roster is a sanctioned NEW egress destination for
// child fields (hostile-review pass 2026-08-25): same Notion+Resend-only path
// as the fall roster, different DB. Set its env so the kind=picklpark branch
// below actually writes — an unset env would fail-soft and prove nothing.
const TEST_PICKLPARK_DB = "db-picklpark-test";
process.env.NOTION_PICKLPARK_REGS_DB_ID = TEST_PICKLPARK_DB;

import { POST } from "../src/app/api/stripe/webhook/route";

// THE child-data egress invariant: on the registration path, child PII
// (name, birth year) may flow ONLY to Notion (the CRM) and Resend (email to
// parent/admin). Coverage note: this pins fetch-based egress — Twilio SMS uses
// its own SDK transport, but sendSms() is consent-hard-gated and Twilio env is
// absent here (it self-skips); see invariant-consent-gating.spec.ts.
const ALLOWED_HOSTS = ["api.notion.com", "api.resend.com"];
const CHILD_NAME = "Egresstestkid";
const CHILD_YEAR = "2016";

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

test.describe("child PII egress (registration path)", () => {
  test("child fields reach only Notion + Resend; any other host throws loudly", async () => {
    stub
      .on(`databases/${TEST_DROPINS_DB}/query`, { results: [] })
      .on("api.notion.com/v1/pages", { id: "notion-page-created" })
      .on("api.notion.com", { results: [] })
      .on("api.resend.com", { id: "email_test" })
      .install();

    const payload = checkoutEvent(
      dropInSession({
        id: "cs_egress_test",
        metadata: { child_first_name: CHILD_NAME, child_birth_year: CHILD_YEAR },
      }),
    );
    await POST(webhookRequest(payload)).catch(() => undefined);

    // The stub throws on any unstubbed URL, so reaching here already proves no
    // third host was contacted. Belt-and-braces: verify every recorded call.
    expect(stub.calls.length).toBeGreaterThan(0);
    for (const call of stub.calls) {
      const host = new URL(call.url).host;
      expect(ALLOWED_HOSTS, `unexpected egress to ${call.url}`).toContain(host);
    }

    // And the roster row (the intended destination) did receive the child.
    const creates = stub.callsTo("/v1/pages");
    expect(creates).toHaveLength(1);
    expect(creates[0].body).toContain(CHILD_NAME);
  });

  test("webhook RESPONSE body never echoes child PII back to the caller", async () => {
    // Stripe (the caller) needs an ack, not a child record. Check the two
    // response-producing paths that include row data in scope.
    stub
      .on(`databases/${TEST_DROPINS_DB}/query`, {
        results: [
          {
            id: "notion-page-existing",
            properties: {
              "Child First Name": {
                rich_text: [{ plain_text: CHILD_NAME, text: { content: CHILD_NAME } }],
              },
            },
          },
        ],
      })
      .on("api.notion.com", { results: [] })
      .install();

    const payload = checkoutEvent(
      dropInSession({
        id: "cs_egress_idem",
        metadata: { child_first_name: CHILD_NAME },
      }),
    );
    const res = await POST(webhookRequest(payload));
    const text = JSON.stringify(await res.json());
    expect(text).not.toContain(CHILD_NAME);
    expect(text).not.toContain(CHILD_YEAR);
  });

  test("picklpark season path: child fields reach only Notion + Resend, roster row lands in the Pickl Park DB", async () => {
    stub
      .on(`databases/${TEST_PICKLPARK_DB}/query`, { results: [] })
      .on("api.notion.com/v1/pages", { id: "notion-page-created" })
      .on("api.notion.com", { results: [] })
      .on("api.resend.com", { id: "email_test" })
      .install();

    const payload = checkoutEvent(
      dropInSession({
        id: "cs_egress_picklpark",
        metadata: {
          // kind=picklpark routes to the Pickl Park roster branch; the drop-in
          // session_id key must not be read there.
          kind: "picklpark",
          group: "Red/Orange",
          group_label: "Red & Orange Ball",
          group_time: "3:00–4:00 PM",
          season_title: "Next Gen Pickl Park Saturday Season",
          season_label: "September 19 – October 24, 2026",
          venue: "The Pickl Park, 355 Ballenger Center Dr, Frederick, MD 21703",
          parent_email: "parent@example.com",
          emergency_name: "Emergency Person",
          emergency_phone: "3015550143",
          allergies: "",
          child_first_name: CHILD_NAME,
          child_birth_year: CHILD_YEAR,
        },
      }),
    );
    await POST(webhookRequest(payload)).catch(() => undefined);

    expect(stub.calls.length).toBeGreaterThan(0);
    for (const call of stub.calls) {
      const host = new URL(call.url).host;
      expect(ALLOWED_HOSTS, `unexpected egress to ${call.url}`).toContain(host);
    }

    // The Pickl Park roster (the sanctioned destination) received the child…
    const creates = stub.callsTo("/v1/pages");
    expect(creates.length).toBeGreaterThanOrEqual(1);
    const rosterCreate = creates.find((c) =>
      c.body?.includes(TEST_PICKLPARK_DB),
    );
    expect(rosterCreate, "roster create must target the Pickl Park DB").toBeTruthy();
    expect(rosterCreate?.body).toContain(CHILD_NAME);
  });

  test("open-brain ingest is not reached when its env is unset (no shadow egress)", async () => {
    // OPEN_BRAIN_INGEST_URL is deliberately absent from test env — the ingest
    // helper must self-skip rather than POST child activity to a default URL.
    stub
      .on(`databases/${TEST_DROPINS_DB}/query`, { results: [] })
      .on("api.notion.com/v1/pages", { id: "notion-page-created" })
      .on("api.notion.com", { results: [] })
      .on("api.resend.com", { id: "email_test" })
      .install();

    const payload = checkoutEvent(dropInSession({ id: "cs_egress_ob" }));
    await POST(webhookRequest(payload)).catch(() => undefined);
    for (const call of stub.calls) {
      expect(call.url).not.toContain("open-brain");
      expect(call.url).not.toContain("railway");
    }
  });
});
