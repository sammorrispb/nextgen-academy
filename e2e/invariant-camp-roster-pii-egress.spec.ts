import { test, expect } from "@playwright/test";
import type Stripe from "stripe";
import { FetchStub } from "./fixtures/fetch-stub";
import {
  collectPaidCampSessions,
  type CampSessionSource,
} from "../src/lib/notion-camp-roster";
import { toRosterView } from "../src/lib/camp-roster-view";
import { CAMPS } from "../src/data/camps";

const CAMP = CAMPS[0]; // june-29

// THE coach-roster-view egress invariant: assembling the roster view for the
// auth-gated coach page reads camp registrations from the injected Stripe
// client and renders them through pure helpers. It must contact NO host
// (Stripe rides its own SDK transport, not globalThis.fetch) — and child PII
// must never leak into any fetch body. The Stripe stub here is in-memory, so
// the correct behavior is ZERO globalThis.fetch calls. FetchStub.install()
// throws on any unstubbed fetch, so this test fails loudly if a disallowed
// egress is ever added (mutation-proof).
const ALLOWED_HOSTS: string[] = []; // nothing should be contacted on this path
const CHILD_NAME = "Rosterviewkid ZZ9";
const ALLERGY_SENTINEL = "Tree nuts — carries EpiPen QX7";
const BIRTH_YEAR = "2015";

function campSession(
  overrides: Record<string, unknown> = {},
): Stripe.Checkout.Session {
  return {
    id: "cs_roster_egress_1",
    payment_status: "paid",
    created: 1_750_000_000,
    customer_email: "parent@example.com",
    customer_details: { email: "parent@example.com" },
    metadata: {
      kind: "camp",
      camp_slug: CAMP.slug,
      parent_name: "Test Parent",
      parent_phone: "3015550100",
      child_first_name: CHILD_NAME,
      child_birth_year: BIRTH_YEAR,
      camp_title: CAMP.title,
      camp_week: CAMP.weekLabel,
      option_key: "week",
      option_label: "Full week (Mon–Thu)",
      selected_day: "",
      emergency_name: "Emergency Contact",
      emergency_phone: "2405550042",
      allergies: ALLERGY_SENTINEL,
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

test.describe("camp roster view — child PII egress (coach read path)", () => {
  test("assembling the roster contacts no host and leaks no child PII", async () => {
    stub.install(); // any fetch at all throws — proves the path is offline

    const { entries } = await collectPaidCampSessions(
      CAMP.slug,
      stripeStub([campSession()]),
    );
    const rows = toRosterView(entries, CAMP, 2026);

    // The view actually carries the child data (so the assertions below aren't
    // vacuous on an empty result).
    expect(rows).toHaveLength(1);
    expect(rows[0].childFirstName).toBe(CHILD_NAME);
    expect(rows[0].allergies).toBe(ALLERGY_SENTINEL);

    // No network egress on this read path.
    expect(stub.calls).toHaveLength(0);

    // Belt-and-braces: if a fetch were ever added, its host must be allowed and
    // no sentinel may appear in the body.
    for (const call of stub.calls) {
      const host = new URL(call.url).host;
      expect(ALLOWED_HOSTS, `unexpected egress to ${call.url}`).toContain(host);
      expect(call.body).not.toContain(CHILD_NAME);
      expect(call.body).not.toContain(ALLERGY_SENTINEL);
      expect(call.body).not.toContain(BIRTH_YEAR);
    }
  });
});
