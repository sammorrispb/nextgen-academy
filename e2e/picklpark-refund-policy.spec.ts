import { test, expect } from "@playwright/test";
import {
  PICKLPARK_SEASON_START,
  picklParkRefundPolicyFor,
  picklParkSessionsRemaining,
  picklParkProratedRefundCents,
} from "../src/lib/picklpark-refund-policy";
import { PICKLPARK_SATURDAYS } from "../src/data/picklpark-2026";

// Pure spec — no dev server.
//   npx playwright test e2e/picklpark-refund-policy.spec.ts --project=desktop
//
// Policy (Sam, 2026-08-25) — one axis, WHO cancelled, because the no-refund
// terms are stated at the point of sale from the first registration (no
// grandfathered population, unlike the Wood MS fall season):
//
//   parent withdrawal → no refund (the seat was held all season)
//   NGA cancelled     → prorate the sessions we did not deliver

const PAID_CENTS = 17500;

test("season start is derived from the schedule, never re-typed", () => {
  expect(PICKLPARK_SEASON_START).toBe(PICKLPARK_SATURDAYS[0]);
});

test("parent withdrawal → no refund, before or after the season starts", () => {
  expect(picklParkRefundPolicyFor("2026-09-01")).toBe("none");
  expect(picklParkRefundPolicyFor("2026-10-02")).toBe("none");
  expect(picklParkRefundPolicyFor("2026-10-03")).toBe("none");
  expect(
    picklParkRefundPolicyFor("2026-10-20", { reason: "parent_withdrawal" }),
  ).toBe("none");
});

test("NGA cancelling is never the family's loss → prorated", () => {
  expect(
    picklParkRefundPolicyFor("2026-09-01", { reason: "nga_cancelled" }),
  ).toBe("prorated");
  expect(
    picklParkRefundPolicyFor("2026-11-01", { reason: "nga_cancelled" }),
  ).toBe("prorated");
});

test("sessions remaining counts today INCLUSIVE (a morning-of cancel is owed)", () => {
  expect(picklParkSessionsRemaining("2026-09-01")).toBe(6);
  expect(picklParkSessionsRemaining("2026-10-03")).toBe(6);
  expect(picklParkSessionsRemaining("2026-10-04")).toBe(5);
  expect(picklParkSessionsRemaining("2026-10-31")).toBe(2);
  expect(picklParkSessionsRemaining("2026-11-08")).toBe(0);
});

test("proration before the season = the full amount", () => {
  expect(picklParkProratedRefundCents("2026-09-15", PAID_CENTS)).toBe(
    PAID_CENTS,
  );
});

test("mid-season proration rounds UP in the parent's favour", () => {
  // 2 of 6 Saturdays undelivered → ceil(17500 × 2 / 6) = 5834, not 5833.
  expect(picklParkProratedRefundCents("2026-10-31", PAID_CENTS)).toBe(5834);
});

test("after the last Saturday there is nothing left to prorate", () => {
  expect(picklParkProratedRefundCents("2026-11-08", PAID_CENTS)).toBe(0);
});

test("proration never exceeds what was paid", () => {
  for (const day of ["2026-09-01", "2026-10-10", "2026-11-07"]) {
    expect(
      picklParkProratedRefundCents(day, PAID_CENTS),
    ).toBeLessThanOrEqual(PAID_CENTS);
  }
});
