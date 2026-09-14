import { test, expect } from "@playwright/test";
import {
  MONDAY_GIRLS_MONDAYS,
  MONDAY_GIRLS_SKIPPED_DATE,
} from "../src/data/monday-girls-2026";
import { MONDAY_GIRLS_SEASON_PRICE_USD } from "../src/data/monday-girls-season-2026";
import {
  MONDAY_GIRLS_MIN_SESSIONS_SOLD,
  mondayGirlsJoinPriceCents,
  mondayGirlsRemainingMondays,
  mondayGirlsSellableOn,
} from "../src/lib/monday-girls-proration";
import {
  mondayGirlsProratedRefundCents,
  mondayGirlsSessionsRemaining,
} from "../src/lib/monday-girls-refund-policy";
import {
  MONDAY_GIRLS_REGISTRATION_CLOSES,
  mondayGirlsRegistrationState,
} from "../src/lib/monday-girls-registration-window";

// Mid-season prorated joining for the Monday Girls block (Sam, 2026-09-14:
// "allow registrations prorated so others can join during the season").
//
// Before this, registration closed the day after session 1 and the block only
// ever sold at the flat $225. Money now moves on a number this code computes,
// so these are invariants, not unit tests: every one of them pins a way a
// family could be overcharged, undercharged, or refunded the wrong amount.
//
// Pure — no dev server, no Stripe, no Notion:
//   npx playwright test e2e/invariant-monday-girls-proration.spec.ts --project=desktop

const FULL_CENTS = MONDAY_GIRLS_SEASON_PRICE_USD * 100;
const TOTAL = MONDAY_GIRLS_MONDAYS.length;

const CONFIGURED = {
  flag: undefined,
  priceConfigured: true,
  rosterConfigured: true,
};

test.describe("Monday Girls proration — a joiner is never overcharged", () => {
  test("pays for the sessions they will actually attend, never the whole block", () => {
    // The rule the old close-after-session-1 gate existed to enforce, now
    // enforced by the price instead of by a locked door.
    for (const [index, monday] of MONDAY_GIRLS_MONDAYS.entries()) {
      const remaining = TOTAL - index;
      expect(
        mondayGirlsSessionsRemaining(monday),
        `${monday} should have ${remaining} sessions left (today inclusive)`,
      ).toBe(remaining);
      expect(mondayGirlsJoinPriceCents(monday, FULL_CENTS)).toBe(
        Math.floor((FULL_CENTS * remaining) / TOTAL),
      );
    }
  });

  test("never charges MORE than the full block, on any day of the year", () => {
    // A joiner paying above sticker is the one outcome with no honest excuse.
    for (const today of [
      "2026-01-01",
      "2026-09-01",
      "2026-09-13",
      "2026-09-14",
      "2026-09-21",
      "2026-10-26",
      "2026-12-31",
    ]) {
      const cents = mondayGirlsJoinPriceCents(today, FULL_CENTS);
      expect(cents, `${today} charged more than the full block`).toBeLessThanOrEqual(
        FULL_CENTS,
      );
      expect(cents, `${today} charged a negative amount`).toBeGreaterThanOrEqual(0);
    }
  });

  test("rounds DOWN — rounding lands in the parent's favour (Sam, 2026-09-14)", () => {
    // 3 of 6 sessions at $225 is $112.50 exactly; 4 of 6 is $150 exactly. Pick
    // a full price that does NOT divide evenly so the direction is observable.
    const awkward = 22501; // $225.01
    const threeLeft = mondayGirlsJoinPriceCents("2026-10-12", awkward);
    expect(mondayGirlsSessionsRemaining("2026-10-12")).toBe(3);
    expect(threeLeft).toBe(Math.floor((awkward * 3) / TOTAL));
    // Down, not up: the exact quotient is 11250.5.
    expect(threeLeft).toBe(11250);
  });

  test("before the block starts, a joiner pays the flat price EXACTLY", () => {
    // No off-by-one drift on the common path. A family buying on 2026-09-08
    // must pay 22500, not 22499 from a stray floor().
    for (const today of ["2026-08-01", "2026-09-08", "2026-09-13", "2026-09-14"]) {
      expect(
        mondayGirlsJoinPriceCents(today, FULL_CENTS),
        `${today} should be full price`,
      ).toBe(FULL_CENTS);
    }
  });

  test("the skipped Monday is never sold", () => {
    // 2026-09-21 is Yom Kippur + an MCPS closure and is not a session at all,
    // so it can never be counted into a price or a remaining-dates list.
    expect(mondayGirlsRemainingMondays("2026-09-15")).not.toContain(
      MONDAY_GIRLS_SKIPPED_DATE,
    );
    // Sep 15 and Sep 22 both look forward onto the same 5 real sessions.
    expect(mondayGirlsSessionsRemaining("2026-09-15")).toBe(5);
    expect(mondayGirlsSessionsRemaining("2026-09-22")).toBe(5);
    expect(mondayGirlsJoinPriceCents("2026-09-15", FULL_CENTS)).toBe(
      mondayGirlsJoinPriceCents("2026-09-22", FULL_CENTS),
    );
  });

  test("the dates quoted are exactly the dates paid for", () => {
    // The list a joiner reads and the count their price is built from must be
    // the same number, or the confirmation email promises a session they did
    // not buy.
    for (const today of MONDAY_GIRLS_MONDAYS) {
      expect(mondayGirlsRemainingMondays(today)).toHaveLength(
        mondayGirlsSessionsRemaining(today),
      );
      expect(mondayGirlsRemainingMondays(today)[0]).toBe(today);
    }
  });
});

test.describe("Monday Girls proration — the selling floor", () => {
  test("stops selling with 2 sessions left (Sam, 2026-09-14)", () => {
    // Below the floor this is drop-in territory, not a peer block, and there
    // is a drop-in product for that.
    expect(MONDAY_GIRLS_MIN_SESSIONS_SOLD).toBe(3);
    expect(mondayGirlsSellableOn("2026-10-12")).toBe(true); // 3 left
    expect(mondayGirlsSellableOn("2026-10-13")).toBe(false); // 2 left
    expect(mondayGirlsSellableOn("2026-10-19")).toBe(false);
    expect(mondayGirlsSellableOn("2026-10-26")).toBe(false);
  });

  test("the close date is DERIVED from the floor, never typed", () => {
    // Re-date the block or move the floor and this follows; a hand-typed date
    // is how the fall season's copy drifted from its own config.
    expect(MONDAY_GIRLS_REGISTRATION_CLOSES).toBe(
      MONDAY_GIRLS_MONDAYS[TOTAL - MONDAY_GIRLS_MIN_SESSIONS_SOLD],
    );
    expect(mondayGirlsSessionsRemaining(MONDAY_GIRLS_REGISTRATION_CLOSES)).toBe(
      MONDAY_GIRLS_MIN_SESSIONS_SOLD,
    );
  });

  test("the window reports too_few_sessions, NOT season_started", () => {
    // The season starting no longer closes anything — the floor does. A state
    // named for the old rule would send a mid-season joiner the old copy
    // ("we stop selling once it's under way") while the form is still open.
    expect(
      mondayGirlsRegistrationState({ ...CONFIGURED, todayIso: "2026-09-15" }),
    ).toBe("open");
    expect(
      mondayGirlsRegistrationState({ ...CONFIGURED, todayIso: "2026-10-12" }),
    ).toBe("open");
    expect(
      mondayGirlsRegistrationState({ ...CONFIGURED, todayIso: "2026-10-13" }),
    ).toBe("too_few_sessions");
  });

  test("config and the kill switch still outrank the calendar", () => {
    // Ordering regression guard: proration must not have promoted the calendar
    // above the two legs that protect against taking money we cannot service.
    expect(
      mondayGirlsRegistrationState({
        ...CONFIGURED,
        priceConfigured: false,
        todayIso: "2026-09-28",
      }),
    ).toBe("not_configured");
    expect(
      mondayGirlsRegistrationState({
        ...CONFIGURED,
        rosterConfigured: false,
        todayIso: "2026-09-28",
      }),
    ).toBe("not_configured");
    expect(
      mondayGirlsRegistrationState({
        ...CONFIGURED,
        flag: "false",
        todayIso: "2026-09-28",
      }),
    ).toBe("closed_by_flag");
  });
});

test.describe("Monday Girls proration — refunds follow what was BOUGHT", () => {
  test("a mid-season joiner is refunded against their own block, not the season", () => {
    // THE BUG THIS SUITE EXISTS FOR. mondayGirlsProratedRefundCents divided by
    // the season's 6 sessions regardless of what the family bought. A parent
    // who joined with 3 left for $112.50 and then lost 2 to an NGA cancellation
    // was owed $75.00 but would have been refunded ceil(11250 * 2/6) = $37.50 —
    // barely half, silently, and only for prorated joiners.
    const paid = mondayGirlsJoinPriceCents("2026-10-12", FULL_CENTS); // 3 sessions
    expect(paid).toBe(11250);

    const owed = mondayGirlsProratedRefundCents("2026-10-19", paid, 3);
    expect(mondayGirlsSessionsRemaining("2026-10-19")).toBe(2);
    expect(owed).toBe(7500);

    // And explicitly NOT the season-denominator answer.
    expect(owed).not.toBe(Math.ceil((paid * 2) / TOTAL));
  });

  test("a full-season family is unaffected — the old behaviour is preserved", () => {
    // Every row sold before today bought all 6. Their refunds must not move.
    for (const today of MONDAY_GIRLS_MONDAYS) {
      const remaining = mondayGirlsSessionsRemaining(today);
      expect(mondayGirlsProratedRefundCents(today, FULL_CENTS, TOTAL)).toBe(
        Math.ceil((FULL_CENTS * remaining) / TOTAL),
      );
      // Omitting the argument must mean "they bought the whole block".
      expect(mondayGirlsProratedRefundCents(today, FULL_CENTS)).toBe(
        mondayGirlsProratedRefundCents(today, FULL_CENTS, TOTAL),
      );
    }
  });

  test("a refund never exceeds what the family actually paid", () => {
    // Rounds UP in the parent's favour, so the clamp is load-bearing.
    for (const today of ["2026-08-01", ...MONDAY_GIRLS_MONDAYS]) {
      for (const purchased of [1, 2, 3, 4, 5, 6]) {
        const paid = 11250;
        const refund = mondayGirlsProratedRefundCents(today, paid, purchased);
        expect(
          refund,
          `${today} / bought ${purchased} refunded more than paid`,
        ).toBeLessThanOrEqual(paid);
        expect(refund).toBeGreaterThanOrEqual(0);
      }
    }
  });

  test("after the last session there is nothing left to give back", () => {
    expect(mondayGirlsProratedRefundCents("2026-10-27", 11250, 3)).toBe(0);
    expect(mondayGirlsProratedRefundCents("2026-12-01", FULL_CENTS)).toBe(0);
  });
});
