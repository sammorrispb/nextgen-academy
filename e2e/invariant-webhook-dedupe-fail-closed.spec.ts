import { test, expect } from "@playwright/test";
import { NextRequest } from "next/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { FetchStub } from "./fixtures/fetch-stub";
import {
  setWebhookTestEnv,
  dropInSession,
  checkoutEvent,
  signedHeader,
  TEST_DROPINS_DB,
} from "./fixtures/stripe-sessions";

setWebhookTestEnv();
// The permanent-failure alert is emailed; capture it through the stub.
process.env.RESEND_API_KEY = "re_test_dedupe";
delete process.env.TWILIO_ACCOUNT_SID;
delete process.env.TWILIO_AUTH_TOKEN;
process.env.NOTION_FALL_REGS_DB_ID = "db-fall-dedupe";
process.env.NOTION_PICKLPARK_REGS_DB_ID = "db-picklpark-dedupe";
process.env.NOTION_MONDAY_GIRLS_REGS_DB_ID = "db-mg-dedupe";
process.env.NOTION_CLUSTER_REGS_DB_ID = "db-cluster-dedupe";

import { POST } from "../src/app/api/stripe/webhook/route";
import { findDropInByCheckoutId } from "../src/lib/notion-dropins";
import { findFallRegByCheckoutId } from "../src/lib/notion-fall-registrations";
import { findPicklParkRegByCheckoutId } from "../src/lib/notion-picklpark-registrations";
import { findMondayGirlsRegByCheckoutId } from "../src/lib/notion-monday-girls-registrations";
import { findClusterRegByCheckoutId } from "../src/lib/notion-clusters";
import { DedupeLookupError } from "../src/lib/dedupe-lookup";

// Security review 2026-09-28, M7. The Stripe webhook's "have we already
// recorded this checkout?" guards returned "no" on ANY Notion failure. A 429
// during a Stripe redelivery therefore created a second roster row — a doubled
// seat (which blocks a real sale), a doubled Registered count, and a second
// confirmation email + SMS to the parent.

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

const LOOKUPS = [
  ["drop-in", findDropInByCheckoutId, TEST_DROPINS_DB],
  ["fall", findFallRegByCheckoutId, "db-fall-dedupe"],
  ["picklpark", findPicklParkRegByCheckoutId, "db-picklpark-dedupe"],
  ["monday-girls", findMondayGirlsRegByCheckoutId, "db-mg-dedupe"],
  ["cluster", findClusterRegByCheckoutId, "db-cluster-dedupe"],
] as const;

test.describe("dedupe lookups say 'I don't know' instead of 'not recorded'", () => {
  for (const [kind, lookup, db] of LOOKUPS) {
    test(`${kind}: found / absent / 429 / 503 / 400 / network`, async () => {
      stub.reset();
      stub.on(`databases/${db}/query`, { results: [{ id: "row" }] }).install();
      expect(await lookup("cs_1")).toBe(true);

      stub.reset();
      stub.on(`databases/${db}/query`, { results: [] }).install();
      expect(await lookup("cs_1")).toBe(false);

      for (const [status, expected] of [
        [429, "transient"],
        [503, "transient"],
        [400, "permanent"],
      ] as const) {
        stub.reset();
        stub.on(`databases/${db}/query`, { object: "error" }, status).install();
        const err = await lookup("cs_1").then(
          () => null,
          (e: unknown) => e,
        );
        expect(err, `${kind} ${status} must throw`).toBeInstanceOf(DedupeLookupError);
        expect((err as DedupeLookupError).kind).toBe(expected);
      }

      stub.reset(); // no rule → the stub throws, like a dropped connection
      stub.install();
      const net = await lookup("cs_1").then(
        () => null,
        (e: unknown) => e,
      );
      expect((net as DedupeLookupError)?.kind).toBe("transient");
    });
  }
});

test.describe("webhook: a transient dedupe failure is a retry, never a second row", () => {
  test("drop-in: dedupe 429 → 500 and ZERO roster creates", async () => {
    stub
      .on(`databases/${TEST_DROPINS_DB}/query`, { error: "rate_limited" }, 429)
      .on("api.notion.com/v1/pages", { id: "should-not-be-created" })
      .on("api.notion.com", { results: [] })
      .on("api.resend.com", { id: "email_test" })
      .install();
    const res = await POST(webhookRequest(checkoutEvent(dropInSession({ id: "cs_dedupe_429" }))));
    expect(res.status).toBe(500);
    expect(stub.callsTo("/v1/pages")).toHaveLength(0);
  });

  test("drop-in: dedupe 400 → the family is still recorded AND Sam is alerted once", async () => {
    stub
      .on(`databases/${TEST_DROPINS_DB}/query`, { error: "validation_error" }, 400)
      .on("api.notion.com/v1/pages", { id: "notion-page-created" })
      .on("api.notion.com", { results: [] })
      .on("api.resend.com", { id: "email_test" })
      .install();
    await POST(webhookRequest(checkoutEvent(dropInSession({ id: "cs_dedupe_400" })))).catch(
      () => undefined, // after() comms may throw outside a request scope
    );
    const creates = stub.callsTo("/v1/pages").filter((c) => c.method === "POST");
    expect(creates.length).toBeGreaterThanOrEqual(1);
    expect(creates[0].body).toContain("cs_dedupe_400");
    const alerts = stub
      .callsTo("api.resend.com")
      .map((c) => JSON.parse(c.body) as { subject: string; text?: string })
      .filter((m) => m.subject.includes("[cron-alert]"));
    expect(alerts).toHaveLength(1);
    expect(alerts[0].subject).toContain("dedupe_lookup_rejected");
    expect(JSON.stringify(alerts[0])).not.toContain("Testkid");
  });
});

test("every webhook dedupe call goes through the classifying guard", () => {
  const src = readFileSync(
    join(__dirname, "..", "src", "app", "api", "stripe", "webhook", "route.ts"),
    "utf8",
  );
  for (const [, lookup] of LOOKUPS) {
    const calls = src.match(new RegExp(`\\b${lookup.name}\\(`, "g")) ?? [];
    expect(calls, `${lookup.name} must not be called directly`).toHaveLength(0);
    expect(src).toContain(`alreadyRecorded(session, "`);
    expect(src).toMatch(new RegExp(`alreadyRecorded\\(session, "[^"]+", ${lookup.name}\\)`));
  }
});
