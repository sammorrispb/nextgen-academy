import { test, expect } from "@playwright/test";
import type Stripe from "stripe";
import {
  collectPaidCampSessions,
  type CampSessionSource,
} from "../src/lib/notion-camp-roster";
import { campAttendingDays } from "../src/lib/camp-roster-view";
import { CAMPS } from "../src/data/camps";

const CAMP = CAMPS[0]; // june-29

// Unique non-empty PII sentinels so a missed field shows as a clear mismatch.
const ALLERGY_SENTINEL = "Bee stings — EpiPen in backpack ZZ9";
const EMERGENCY_NAME_SENTINEL = "Aunt Sentinel QX7";
const EMERGENCY_PHONE_SENTINEL = "2405550042";

function campSession(
  overrides: Record<string, unknown> = {},
  metaOverrides: Record<string, string> = {},
): Stripe.Checkout.Session {
  return {
    id: "cs_camp_1",
    payment_status: "paid",
    created: 1_750_000_000,
    customer_email: "parent@example.com",
    customer_details: { email: "parent@example.com" },
    metadata: {
      kind: "camp",
      camp_slug: CAMP.slug,
      parent_name: "Test Parent",
      parent_phone: "3015550100",
      child_first_name: "Camper",
      child_birth_year: "2016",
      camp_title: CAMP.title,
      camp_week: CAMP.weekLabel,
      option_key: "week",
      option_label: "Full week (Mon–Thu)",
      selected_day: "",
      emergency_name: EMERGENCY_NAME_SENTINEL,
      emergency_phone: EMERGENCY_PHONE_SENTINEL,
      allergies: ALLERGY_SENTINEL,
      ...metaOverrides,
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

test.describe("collectPaidCampSessions — new fields", () => {
  test("populates allergies, emergency name/phone, selectedDay, optionKey", async () => {
    const { entries } = await collectPaidCampSessions(
      CAMP.slug,
      stripeStub([campSession()]),
    );
    expect(entries).toHaveLength(1);
    const e = entries[0];
    expect(e.allergies).toBe(ALLERGY_SENTINEL);
    expect(e.emergencyName).toBe(EMERGENCY_NAME_SENTINEL);
    expect(e.emergencyPhone).toBe(EMERGENCY_PHONE_SENTINEL);
    expect(e.optionKey).toBe("week");
    expect(e.selectedDay).toBe("");
  });

  test("reads option_KEY, not option_label, for the canonical key", async () => {
    // option_key='week' while option_label is a custom string — the key wins.
    const { entries } = await collectPaidCampSessions(
      CAMP.slug,
      stripeStub([
        campSession(
          {},
          { option_key: "week", option_label: "Custom label that differs" },
        ),
      ]),
    );
    expect(entries[0].optionKey).toBe("week");
    expect(entries[0].optionLabel).toBe("Custom label that differs");
  });

  test("still drops a fully-refunded session", async () => {
    const refunded = campSession({
      id: "cs_refunded",
      payment_intent: { latest_charge: { refunded: true } },
    });
    const { entries } = await collectPaidCampSessions(
      CAMP.slug,
      stripeStub([refunded]),
    );
    expect(entries).toHaveLength(0);
  });

  test("a week session flows to all four attending days", async () => {
    const { entries } = await collectPaidCampSessions(
      CAMP.slug,
      stripeStub([campSession()]),
    );
    const attending = campAttendingDays(
      entries[0].optionKey,
      entries[0].selectedDay,
      CAMP,
    );
    expect(attending).toEqual({ indexes: [0, 1, 2, 3], offWeek: false });
  });

  test("a day session flows to its single correct index", async () => {
    const { entries } = await collectPaidCampSessions(
      CAMP.slug,
      stripeStub([
        campSession(
          { id: "cs_day" },
          { option_key: "day", selected_day: "2026-07-02" },
        ),
      ]),
    );
    const attending = campAttendingDays(
      entries[0].optionKey,
      entries[0].selectedDay,
      CAMP,
    );
    // 2026-07-02 is the 4th morning (index 3).
    expect(attending).toEqual({ indexes: [3], offWeek: false });
  });
});
