import { test, expect } from "@playwright/test";
import type Stripe from "stripe";
import { FetchStub } from "./fixtures/fetch-stub";

// Env BEFORE the run module reads it (all reads are lazy/at-call, so this is
// enough). getStripe() is never called — we inject a Stripe stub.
process.env.RESEND_API_KEY = "re_test_camp_followup";
process.env.NGA_GOOGLE_REVIEW_URL = "https://g.page/r/egress-test/review";

import { runCampFollowup } from "../src/lib/camp-followup-run";
import type { CampSessionSource } from "../src/lib/notion-camp-roster";

// THE camp-followup egress invariant: on the post-camp thank-you path, child
// PII (first name) may flow ONLY to Resend, addressed to the PARENT — there
// are no Notion writes on this surface at all. Recipient is always the parent
// contact, never a minor.
const ALLOWED_HOSTS = ["api.resend.com"];
const CHILD_NAME = "Egresstestkid";
const PARENT_EMAIL = "parent@example.com";

function campSession(
  overrides: Record<string, unknown> = {},
): Stripe.Checkout.Session {
  return {
    id: "cs_camp_followup_1",
    payment_status: "paid",
    created: 1_750_000_000,
    customer_email: PARENT_EMAIL,
    customer_details: { email: PARENT_EMAIL },
    metadata: {
      kind: "camp",
      camp_slug: "july-20",
      parent_name: "Test Parent",
      parent_phone: "3015550100",
      child_first_name: CHILD_NAME,
      child_birth_year: "2016",
      camp_title: "Summer Camp — Week 2",
      camp_week: "July 20 – July 23, 2026",
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

const stub = new FetchStub();
test.beforeEach(() => stub.reset());
test.afterEach(() => stub.uninstall());

test.describe("camp follow-up — child PII egress (post-camp thank-you path)", () => {
  test("child first name reaches only Resend; recipient is the parent; blurb has no exact venue", async () => {
    stub.on("api.resend.com", { id: "email_test" }).install();

    const result = await runCampFollowup({
      slug: "july-20",
      stripe: stripeStub([campSession()]),
    });

    expect(stub.calls.length).toBeGreaterThan(0);
    for (const call of stub.calls) {
      const host = new URL(call.url).host;
      expect(ALLOWED_HOSTS, `unexpected egress to ${call.url}`).toContain(host);
    }

    const sends = stub.callsTo("api.resend.com");
    // Parent email + admin QA copy.
    expect(sends).toHaveLength(2);
    expect(sends[0].body).toContain(`"to":"${PARENT_EMAIL}"`);
    // References the camper by first name — allowed, it goes to the parent.
    expect(sends[0].body).toContain(CHILD_NAME);
    // The review link + next-camp register link made it into the send.
    expect(sends[0].body).toContain("https://g.page/r/egress-test/review");
    expect(sends[0].body).toContain("/camp/august-17");
    // The paste-anywhere blurb never carries the exact venue.
    expect(sends[0].body).not.toContain("Earle B. Wood");
    // The admin QA copy is counts-only — no child PII.
    expect(sends[1].body).toContain(`"to":"nextgenacademypb@gmail.com"`);
    expect(sends[1].body).not.toContain(CHILD_NAME);

    expect(result.ok).toBe(true);
    if (result.ok && "sent" in result) {
      expect(result.sent).toBe(1);
    }
  });

  test("one family, two campers → ONE email naming both kids (dedup by parent email)", async () => {
    stub.on("api.resend.com", { id: "email_test" }).install();

    const result = await runCampFollowup({
      slug: "july-20",
      stripe: stripeStub([
        campSession(),
        campSession({
          id: "cs_camp_followup_2",
          metadata: {
            ...campSession().metadata,
            child_first_name: "Secondkid",
            option_label: "Single morning",
          },
        }),
      ]),
    });

    const sends = stub.callsTo("api.resend.com");
    // One parent send + one admin QA copy — never two parent emails.
    expect(sends).toHaveLength(2);
    expect(sends[0].body).toContain(`${CHILD_NAME} &amp; Secondkid`);
    expect(result.ok).toBe(true);
    if (result.ok && "sent" in result) {
      expect(result.sent).toBe(1);
    }
  });

  test("dry run previews without any network egress", async () => {
    stub.install(); // any fetch at all would throw — proves dryRun is offline
    const result = await runCampFollowup({
      slug: "july-20",
      dryRun: true,
      stripe: stripeStub([campSession()]),
    });
    expect(stub.calls).toHaveLength(0);
    expect(result.ok).toBe(true);
    if (result.ok && "dryRun" in result) {
      expect(result.recipientCount).toBe(1);
      expect(result.recipients[0].parentEmail).toBe(PARENT_EMAIL);
      expect(result.nextCampSlug).toBe("august-17");
      expect(result.preview.text).toContain("Leave a Google review");
    }
  });

  test("a live run refuses when the review URL is unconfigured (never ship a broken review button)", async () => {
    const saved = process.env.NGA_GOOGLE_REVIEW_URL;
    delete process.env.NGA_GOOGLE_REVIEW_URL;
    stub.install();
    try {
      const result = await runCampFollowup({
        slug: "july-20",
        stripe: stripeStub([campSession()]),
      });
      expect(result).toMatchObject({ ok: false, reason: "review_url_unconfigured" });
      expect(stub.calls).toHaveLength(0);
    } finally {
      process.env.NGA_GOOGLE_REVIEW_URL = saved;
    }
  });

  test("a live run refuses when RESEND is unconfigured", async () => {
    const saved = process.env.RESEND_API_KEY;
    delete process.env.RESEND_API_KEY;
    stub.install();
    try {
      const result = await runCampFollowup({
        slug: "july-20",
        stripe: stripeStub([campSession()]),
      });
      expect(result).toMatchObject({ ok: false, reason: "resend_unconfigured" });
      expect(stub.calls).toHaveLength(0);
    } finally {
      process.env.RESEND_API_KEY = saved;
    }
  });

  test("`only` restricts a live re-run to the listed parents", async () => {
    stub.on("api.resend.com", { id: "email_test" }).install();
    const result = await runCampFollowup({
      slug: "july-20",
      only: ["someoneelse@example.com"],
      stripe: stripeStub([campSession()]),
    });
    expect(stub.callsTo("api.resend.com")).toHaveLength(0);
    expect(result.ok).toBe(true);
    if (result.ok && "sent" in result) {
      expect(result.sent).toBe(0);
      expect(result.recipientCount).toBe(0);
    }
  });
});
