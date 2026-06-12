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

// The routing invariant the webhook's comments promise: camp/league/cluster
// checkouts run their own handlers and NEVER touch the drop-in roster DB —
// no query against it, no row created in it.
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

for (const kind of ["camp", "league", "cluster"] as const) {
  test(`kind=${kind} checkout never touches the drop-in roster DB`, async () => {
    // Catch-alls only — each handler's own DB envs are unset, so they
    // env-gracefully skip their writes; what matters is the dropins DB.
    stub
      .on("api.notion.com", { results: [] })
      .on("api.resend.com", { id: "email_test" })
      .install();

    const payload = checkoutEvent(
      dropInSession({
        id: `cs_${kind}_routing`,
        metadata: { kind, [`${kind}_title`]: `Test ${kind}` },
      }),
    );
    // Handlers may register after() work that throws outside a request scope —
    // the routing decision happens first either way.
    await POST(webhookRequest(payload)).catch(() => undefined);

    expect(stub.callsTo(TEST_DROPINS_DB)).toHaveLength(0);
  });
}

test("a plain drop-in (no kind) DOES use the drop-in roster DB — routing is two-sided", async () => {
  stub
    .on(`databases/${TEST_DROPINS_DB}/query`, { results: [] })
    .on("api.notion.com/v1/pages", { id: "notion-page-created" })
    .on("api.notion.com", { results: [] })
    .on("api.resend.com", { id: "email_test" })
    .install();

  const payload = checkoutEvent(dropInSession({ id: "cs_plain_dropin" }));
  await POST(webhookRequest(payload)).catch(() => undefined);
  expect(stub.callsTo(TEST_DROPINS_DB).length).toBeGreaterThan(0);
});
