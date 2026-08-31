import { test, expect } from "@playwright/test";
import { NextRequest } from "next/server";
import { FetchStub } from "./fixtures/fetch-stub";

// Env BEFORE importing the route — the route + its libs read these at call
// time. Open Brain env is deliberately SET rather than deleted: deleting it
// would make ingestToOpenBrain self-skip, which proves only that the call
// didn't happen, not that the route declines to make it. Same lesson as
// invariant-waitlist-pii-egress.
process.env.NOTION_API_KEY = "ntn_test_picklpark_egress";
process.env.NOTION_PICKLPARK_REGS_DB_ID = "picklpark-regs-db-egress";
process.env.NOTION_WAIVERS_DB_ID = "waivers-db-egress";
process.env.STRIPE_SECRET_KEY = "sk_test_dummy_offline";
process.env.STRIPE_PICKLPARK_SEASON_PRICE_ID = "price_picklpark_egress";
process.env.OPEN_BRAIN_INGEST_URL = "https://open-brain.example.com/ingest";
process.env.LEAD_INGEST_TOKEN = "ob-token-egress";

import { POST } from "../src/app/api/checkout-picklpark/route";

// The NGA Pickl Park Registrations DB is a NEW egress destination for child
// fields — child first name, birth year, allergies and emergency contact — and
// under the minor-data governance rules that makes it a hostile-review
// trigger. The fall season carries a dedicated spec for exactly this; Pickl
// Park shipped without one.
//
// The sanctioned path is the same single one every NGA registration takes:
//   Stripe checkout metadata → /api/stripe/webhook → Notion roster + emails
// The WEBHOOK half of that is pinned by invariant-child-pii-egress; this spec
// covers the half that was missing — the checkout route itself.
//
// Scope note: these stop at the Stripe call. The Stripe SDK talks over node's
// http layer rather than global fetch, so FetchStub cannot answer it and the
// call rejects on the dummy key — which is fine, because everything worth
// asserting here has already happened by then. What matters is that between
// the parent pressing submit and Stripe being reached, this route touches
// Notion and nothing else, and hands Notion no child field at all: the roster
// row is the webhook's job, and a child's name appearing in a Notion body from
// HERE would mean a second, unsanctioned write.

const ALLOWED_HOSTS = ["api.notion.com"];
const CHILD_NAME = "Egresspicklkid";
const ALLERGY_TEXT = "Peanut allergy — carries an EpiPen";
const EMERGENCY_NAME = "Egressemergencyperson";
const PARENT_EMAIL = "egress-picklpark@example.com";

function body(over: Record<string, unknown> = {}): string {
  return JSON.stringify({
    group: "Red/Orange",
    parentName: "Egress Parent",
    email: PARENT_EMAIL,
    phone: "3015550142",
    childFirstName: CHILD_NAME,
    childBirthYear: String(new Date().getFullYear() - 10),
    emergencyName: EMERGENCY_NAME,
    emergencyPhone: "3015550143",
    allergies: ALLERGY_TEXT,
    smsConsent: false,
    ...over,
  });
}

function req(payload: string): NextRequest {
  return new NextRequest("http://localhost/api/checkout-picklpark", {
    method: "POST",
    body: payload,
    headers: { "content-type": "application/json" },
  });
}

const stub = new FetchStub();

/** Roster empty, waiver on file — the path that runs all the way to Stripe. */
function installHappyPath() {
  stub
    .on(/api\.notion\.com\/v1\/databases\/.*\/query/, (call) => {
      // Only the roster query filters on Group; anything else is the waiver
      // lookup, which must return a row so the gate opens.
      const isRoster = /"property":"Group"/.test(call.body);
      return isRoster
        ? { results: [] }
        : { results: [{ id: "waiver-row", properties: {} }] };
    })
    .install();
}

/**
 * Run the route to completion, swallowing the expected Stripe rejection. The
 * assertions that follow read `stub.calls`, which is fully populated by then.
 */
async function runToStripe(payload: string) {
  await POST(req(payload)).catch(() => undefined);
}

test.beforeEach(() => stub.reset());
test.afterEach(() => stub.uninstall());

test.describe("Pickl Park registration — child-PII egress", () => {
  test("reaches ONLY Notion, even with Open Brain configured", async () => {
    installHappyPath();
    await runToStripe(body());
    expect(stub.calls.length).toBeGreaterThan(0);

    for (const call of stub.calls) {
      const host = new URL(call.url).host;
      expect(ALLOWED_HOSTS, `unexpected egress host: ${host}`).toContain(host);
    }
    // Named explicitly: the env is set, so a silent ingest would have fired.
    expect(stub.callsTo(/open-brain/)).toHaveLength(0);
    expect(stub.callsTo(/analytics/)).toHaveLength(0);
  });

  test("hands Notion no child field — the roster row is the webhook's job", async () => {
    installHappyPath();
    await runToStripe(body());

    const notionCalls = stub.callsTo(/api\.notion\.com/);
    expect(notionCalls.length).toBeGreaterThan(0);
    // Notion legitimately sees the parent's email (both the roster count and
    // the waiver lookup key on it). A child field here would be a second,
    // unsanctioned write of minor PII.
    for (const call of notionCalls) {
      expect(call.body).not.toContain(CHILD_NAME);
      expect(call.body).not.toContain(EMERGENCY_NAME);
      expect(call.body).not.toContain(ALLERGY_TEXT);
    }
    // And no page create at all — this route only ever reads.
    expect(
      notionCalls.filter((c) => /\/v1\/pages/.test(c.url) && c.method === "POST"),
    ).toHaveLength(0);
  });

  test("the sold-out and waiver refusals carry no child PII", async () => {
    // Refusal bodies are rendered to the browser and logged upstream; a
    // child's name has no business in either.
    stub
      .on(/api\.notion\.com\/v1\/databases\/.*\/query/, {
        results: Array.from({ length: 50 }, (_, i) => ({
          id: `row-${i}`,
          properties: {
            "Child First Name": { rich_text: [{ plain_text: `Other${i}` }] },
            "Parent Email": { email: `other${i}@example.com` },
          },
        })),
      })
      .install();

    const res = await POST(req(body()));
    expect(res.status).toBe(409);
    const text = JSON.stringify(await res.json());
    expect(text).not.toContain(CHILD_NAME);
    expect(text).not.toContain(ALLERGY_TEXT);
    expect(text).not.toContain(EMERGENCY_NAME);
    // No other family's child leaks out of the roster read either.
    expect(text).not.toContain("Other0");
  });

  test("a validation refusal egresses nothing at all", async () => {
    stub.install();
    const res = await POST(req(body({ email: "not-an-email" })));
    expect(res.status).toBe(400);
    expect(stub.calls).toHaveLength(0);
  });

  test("an over-long allergy note still egresses nothing to Notion", async () => {
    // Allergies are the most sensitive field the season collects. Whatever the
    // route does with the length on the way to Stripe (it trims to Stripe's
    // 500-char metadata cap), none of it may reach Notion from here.
    installHappyPath();
    await runToStripe(body({ allergies: "A".repeat(900) }));
    for (const call of stub.callsTo(/api\.notion\.com/)) {
      expect(call.body).not.toContain("AAAAAAAAAA");
    }
  });
});
