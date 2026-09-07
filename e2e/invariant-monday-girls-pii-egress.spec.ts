import { test, expect } from "@playwright/test";
import { NextRequest } from "next/server";
import { FetchStub, type RecordedFetch } from "./fixtures/fetch-stub";

// Env BEFORE importing the route — the route + its libs read these at call
// time. Open Brain env is deliberately SET rather than deleted: deleting it
// would make ingestToOpenBrain self-skip, which proves only that the call
// didn't happen, not that the route declines to make it. Same lesson as
// invariant-waitlist-pii-egress and invariant-picklpark-registration-pii-egress.
process.env.NOTION_API_KEY = "ntn_test_mondaygirls_egress";
process.env.NOTION_MONDAY_GIRLS_REGS_DB_ID = "monday-girls-regs-db-egress";
process.env.NOTION_WAIVERS_DB_ID = "waivers-db-egress";
process.env.STRIPE_SECRET_KEY = "sk_test_dummy_offline";
process.env.STRIPE_MONDAY_GIRLS_PRICE_ID = "price_monday_girls_egress";
process.env.OPEN_BRAIN_INGEST_URL = "https://open-brain.example.com/ingest";
process.env.LEAD_INGEST_TOKEN = "ob-token-egress";

import { POST } from "../src/app/api/checkout-monday-girls/route";
import { MONDAY_GIRLS_GROUP } from "../src/data/monday-girls-2026";

// The NGA Monday Girls Registrations DB is a NEW egress destination for child
// fields — child first name, birth year, allergies and emergency contact — and
// under the minor-data governance rules that makes it a hostile-review trigger.
//
// The sanctioned path is the same single one every NGA registration takes:
//   Stripe checkout metadata → /api/stripe/webhook → Notion roster + emails
// The WEBHOOK half of that is pinned by invariant-child-pii-egress; this spec
// covers the checkout route itself.
//
// Scope note: these stop at the Stripe call. The Stripe SDK talks over node's
// http layer rather than global fetch, so FetchStub cannot answer it and the
// call rejects on the dummy key — which is fine, because everything worth
// asserting here has already happened by then. What matters is that between
// the parent pressing submit and Stripe being reached, this route touches
// Notion and nothing else, and hands Notion no child field at all.

const ALLOWED_HOSTS = ["api.notion.com"];
const CHILD_NAME = "Egressmondaykid";
const ALLERGY_TEXT = "Bee stings — carries an EpiPen";
const EMERGENCY_NAME = "Egressemergencyperson";
const PARENT_EMAIL = "egress-monday-girls@example.com";

function body(over: Record<string, unknown> = {}): string {
  return JSON.stringify({
    group: MONDAY_GIRLS_GROUP,
    parentName: "Egress Parent",
    email: PARENT_EMAIL,
    phone: "3015550142",
    childFirstName: CHILD_NAME,
    childBirthYear: String(new Date().getFullYear() - 9),
    emergencyName: EMERGENCY_NAME,
    emergencyPhone: "3015550143",
    allergies: ALLERGY_TEXT,
    smsConsent: false,
    ...over,
  });
}

function req(payload: string): NextRequest {
  return new NextRequest("http://localhost/api/checkout-monday-girls", {
    method: "POST",
    body: payload,
    headers: { "content-type": "application/json" },
  });
}

const stub = new FetchStub();

/** Roster empty, waiver on file — the path that runs all the way to Stripe. */
function installHappyPath() {
  stub
    .on(/api\.notion\.com\/v1\/databases\/.*\/query/, (call: RecordedFetch) => {
      // Only the roster query filters on Group; anything else is the waiver
      // lookup, which must return a row so the gate opens.
      const isRoster = /"property":"Group"/.test(call.body);
      return isRoster
        ? { results: [] }
        : { results: [{ id: "waiver-row", properties: {} }] };
    })
    .install();
}

async function runToStripe(payload: string) {
  await POST(req(payload)).catch(() => undefined);
}

test.beforeEach(() => stub.reset());
test.afterEach(() => stub.uninstall());

test.describe("Monday Girls registration — child-PII egress", () => {
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
      notionCalls.filter(
        (c) => /\/v1\/pages/.test(c.url) && c.method === "POST",
      ),
    ).toHaveLength(0);
  });

  test("the sold-out refusal carries no child PII", async () => {
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
    const json = await res.json();
    expect(json.code).toBe("sold_out");
    const rendered = JSON.stringify(json);
    expect(rendered).not.toContain(CHILD_NAME);
    expect(rendered).not.toContain(EMERGENCY_NAME);
    expect(rendered).not.toContain(ALLERGY_TEXT);
  });

  test("the duplicate refusal echoes ONLY the name this parent just typed", async () => {
    // This branch was unexercised. It is the one refusal that deliberately
    // names a child — the parent's own input, read back to that same parent so
    // "already registered" is intelligible. What must never leak is ANOTHER
    // family's child, which the roster query returns in full.
    stub
      .on(/api\.notion\.com\/v1\/databases\/.*\/query/, {
        results: [
          {
            id: "row-self",
            properties: {
              "Child First Name": { rich_text: [{ plain_text: CHILD_NAME }] },
              "Parent Email": { email: PARENT_EMAIL },
            },
          },
          {
            id: "row-other",
            properties: {
              "Child First Name": {
                rich_text: [{ plain_text: "Someoneelseskid" }],
              },
              "Parent Email": { email: "another-family@example.com" },
            },
          },
        ],
      })
      .install();

    const res = await POST(req(body()));
    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.code).toBe("duplicate_registration");
    const rendered = JSON.stringify(json);
    // The asker's own child, echoed back to the asker.
    expect(rendered).toContain(CHILD_NAME);
    // Never another family's child, nor their email.
    expect(rendered).not.toContain("Someoneelseskid");
    expect(rendered).not.toContain("another-family@example.com");
    expect(rendered).not.toContain(ALLERGY_TEXT);
    expect(rendered).not.toContain(EMERGENCY_NAME);
  });

  test("the waiver refusal carries no child PII", async () => {
    stub
      .on(/api\.notion\.com\/v1\/databases\/.*\/query/, (call: RecordedFetch) =>
        // Roster empty; waiver lookup finds nothing → gate closes.
        /"property":"Group"/.test(call.body)
          ? { results: [] }
          : { results: [] },
      )
      .install();

    const res = await POST(req(body()));
    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.code).toBe("waiver_required");
    const rendered = JSON.stringify(json);
    expect(rendered).not.toContain(CHILD_NAME);
    expect(rendered).not.toContain(EMERGENCY_NAME);
    expect(rendered).not.toContain(ALLERGY_TEXT);
  });

  test("a validation refusal never echoes the child's data back", async () => {
    stub.install();
    const res = await POST(req(body({ email: "not-an-email" })));
    expect(res.status).toBe(400);
    const rendered = JSON.stringify(await res.json());
    expect(rendered).not.toContain(CHILD_NAME);
    expect(rendered).not.toContain(ALLERGY_TEXT);
    // And nothing left the process at all on a rejected payload.
    expect(stub.calls).toHaveLength(0);
  });
});

test.describe("Monday Girls registration — ships dark until BOTH envs are set", () => {
  test("no Stripe price ⇒ 503 and ZERO egress", async () => {
    const saved = process.env.STRIPE_MONDAY_GIRLS_PRICE_ID;
    delete process.env.STRIPE_MONDAY_GIRLS_PRICE_ID;
    stub.install();
    try {
      const res = await POST(req(body()));
      expect(res.status).toBe(503);
      // The config check runs BEFORE the roster read, so a block with no
      // product never touches Notion or reveals a roster.
      expect(stub.calls).toHaveLength(0);
    } finally {
      process.env.STRIPE_MONDAY_GIRLS_PRICE_ID = saved;
    }
  });

  test("no Notion roster DB ⇒ 503, even with a Stripe price set", async () => {
    // Without this leg the sale completes and leaves nothing behind: the
    // capacity gate reads empty, the duplicate guard never fires, and the
    // webhook's row create fail-softs to "ok" with rosterFailed=false, so not
    // even the admin email flags it. Refusing the sale is the safer failure.
    const saved = process.env.NOTION_MONDAY_GIRLS_REGS_DB_ID;
    delete process.env.NOTION_MONDAY_GIRLS_REGS_DB_ID;
    stub.install();
    try {
      const res = await POST(req(body()));
      expect(res.status).toBe(503);
      expect(stub.calls).toHaveLength(0);
    } finally {
      process.env.NOTION_MONDAY_GIRLS_REGS_DB_ID = saved;
    }
  });
});
