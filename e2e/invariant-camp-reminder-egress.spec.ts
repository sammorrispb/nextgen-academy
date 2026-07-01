import { test, expect } from "@playwright/test";
import type Stripe from "stripe";
import { FetchStub } from "./fixtures/fetch-stub";

// Env BEFORE the run module reads it (all reads are lazy/at-call, so this is
// enough). getStripe() is never called — we inject a Stripe stub.
process.env.NOTION_API_KEY = "ntn_test_camp";
process.env.NOTION_CAMP_ROSTER_DB_ID = "db-camp-roster-test";
process.env.RESEND_API_KEY = "re_test_camp";
process.env.CRON_SECRET = "cron-test";

import { runCampReminder } from "../src/lib/camp-reminder-run";
import type { CampSessionSource } from "../src/lib/notion-camp-roster";

// THE camp-reminder egress invariant: on the Friday-before-camp path, child PII
// (first name, birth year) may flow ONLY to Notion (the roster) and Resend
// (email to the PARENT). Recipient is always the parent contact, never a minor.
const ALLOWED_HOSTS = ["api.notion.com", "api.resend.com"];
const CHILD_NAME = "Egresstestkid";
const PARENT_EMAIL = "parent@example.com";

function campSession(
  overrides: Record<string, unknown> = {},
): Stripe.Checkout.Session {
  return {
    id: "cs_camp_egress_1",
    payment_status: "paid",
    created: 1_750_000_000,
    customer_email: PARENT_EMAIL,
    customer_details: { email: PARENT_EMAIL },
    metadata: {
      kind: "camp",
      camp_slug: "june-29",
      parent_name: "Test Parent",
      parent_phone: "3015550100",
      child_first_name: CHILD_NAME,
      child_birth_year: "2016",
      camp_title: "Summer Camp — Week 1",
      camp_week: "June 29 – July 2, 2026",
      option_label: "Full week (Mon–Thu)",
    },
    ...overrides,
  } as unknown as Stripe.Checkout.Session;
}

function stripeStub(sessions: Stripe.Checkout.Session[]): CampSessionSource {
  return {
    checkout: {
      sessions: {
        list: () =>
          (async function* () {
            for (const s of sessions) yield s;
          })(),
      },
    },
  };
}

// A roster row shaped so rosterRowExists sees a hit (skip create) AND
// fetchCampRosterForReminder can parse a reminder-ready recipient from it.
const rosterRow = {
  id: "roster-page-1",
  properties: {
    "Parent Email": { email: PARENT_EMAIL },
    "Parent Name": { rich_text: [{ plain_text: "Test Parent" }] },
    "Child First Name": { rich_text: [{ plain_text: CHILD_NAME }] },
    "Option Label": { rich_text: [{ plain_text: "Full week (Mon–Thu)" }] },
  },
};

const stub = new FetchStub();
test.beforeEach(() => stub.reset());
test.afterEach(() => stub.uninstall());

test.describe("camp reminder — child PII egress (Friday-before-camp path)", () => {
  test("child fields reach only Notion + Resend; recipient is the parent", async () => {
    stub
      .on("databases/db-camp-roster-test/query", {
        results: [rosterRow],
        has_more: false,
        next_cursor: null,
      })
      .on("api.notion.com/v1/pages", { id: "notion-ok" })
      .on("api.resend.com", { id: "email_test" })
      .install();

    const result = await runCampReminder({
      slug: "june-29",
      stripe: stripeStub([campSession()]),
    });

    // No host outside Notion + Resend was contacted (the stub throws on any
    // unstubbed URL; this is belt-and-braces).
    expect(stub.calls.length).toBeGreaterThan(0);
    for (const call of stub.calls) {
      const host = new URL(call.url).host;
      expect(ALLOWED_HOSTS, `unexpected egress to ${call.url}`).toContain(host);
    }

    // The reminder email is addressed to the PARENT, never to a minor.
    const sends = stub.callsTo("api.resend.com");
    expect(sends.length).toBeGreaterThan(0);
    expect(sends[0].body).toContain(`"to":"${PARENT_EMAIL}"`);
    // It references the camper by first name — allowed, because it goes to the parent.
    expect(sends[0].body).toContain(CHILD_NAME);

    expect(result.ok).toBe(true);
    if (result.ok && "sent" in result) {
      expect(result.sent).toBe(1);
    }
  });

  test("the roster backstop syncs a camp mid-week even when it's not the exact Friday reminder day (regression: paid checkouts after the one-shot Friday sync never reached the roster)", async () => {
    // 2026-06-30 is inside june-29's [startDate-7, endDate] window but is NOT
    // startDate-3 for any camp, so upcomingCampForReminder finds no match and
    // the reminder email is skipped — the backstop must still write the roster
    // row. Mirrors the real gap: Logan/Louis paid after the one-time Friday
    // sync and got no roster row until this fix.
    stub
      .on("databases/db-camp-roster-test/query", { results: [] })
      .on("api.notion.com/v1/pages", { id: "roster-row-created" })
      .install();

    const result = await runCampReminder({
      today: "2026-06-30",
      stripe: stripeStub([campSession({ id: "cs_camp_backstop_1" })]),
    });

    expect(result.ok).toBe(true);
    if (result.ok && "skipped" in result) {
      expect(result.skipped).toBe(true); // no exact-day reminder match today
    }
    const created = stub
      .callsTo("api.notion.com/v1/pages")
      .filter((c) => c.body.includes("cs_camp_backstop_1"));
    expect(created, "roster row created by the backstop despite no reminder match").toHaveLength(1);
    // Not the reminder day — no email fires, regardless of the backstop.
    expect(stub.callsTo("api.resend.com")).toHaveLength(0);
  });

  test("dry run previews without any network egress (no Notion, no Resend)", async () => {
    stub.install(); // any fetch at all would throw — proves dryRun is offline
    const result = await runCampReminder({
      slug: "june-29",
      dryRun: true,
      stripe: stripeStub([campSession()]),
    });
    expect(stub.calls).toHaveLength(0);
    expect(result.ok).toBe(true);
    if (result.ok && "dryRun" in result) {
      expect(result.recipientCount).toBe(1);
      expect(result.recipients[0].parentEmail).toBe(PARENT_EMAIL);
      expect(result.preview.text).toContain("$25 administrative fee");
    }
  });

  test("a live run refuses to email when RESEND is unconfigured, but the roster backstop still syncs (no silent half-send of EMAIL)", async () => {
    // The backstop roster sync (campsNeedingRosterSync) is deliberately
    // decoupled from RESEND_API_KEY — roster sync has nothing to do with
    // email, and a misconfigured Resend key must not also stop Notion sync.
    // today is pinned inside june-29's [startDate-7, endDate] window so this
    // test doesn't drift once the real calendar date moves past the camp.
    const saved = process.env.RESEND_API_KEY;
    delete process.env.RESEND_API_KEY;
    stub
      .on("databases/db-camp-roster-test/query", { results: [] })
      .on("api.notion.com/v1/pages", { id: "notion-ok" })
      .install();
    try {
      const result = await runCampReminder({
        slug: "june-29",
        today: "2026-06-26",
        stripe: stripeStub([campSession()]),
      });
      expect(result.ok).toBe(false);
      // Refused before ever contacting Resend.
      expect(stub.callsTo("api.resend.com")).toHaveLength(0);
      // But the backstop DID reach Notion to sync the roster.
      expect(stub.callsTo("api.notion.com")).not.toHaveLength(0);
    } finally {
      process.env.RESEND_API_KEY = saved;
    }
  });
});
