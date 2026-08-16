import { test, expect } from "@playwright/test";
import {
  FALL_SEASON_START,
  fallRefundPolicyFor,
} from "../src/lib/fall-refund-policy";
import { FALL_SUNDAYS } from "../src/data/fall-2026";

// Pure spec — no dev server.
//   npx playwright test e2e/fall-refund-policy.spec.ts --project=desktop
//
// Policy (Sam, 2026-08-16): a fall season registration is fully refundable
// until the season starts, and non-refundable once it has. The switch is the
// first Sunday. Season-wide washouts are NOT refunded — the two rain dates are
// the stated remedy — so there is deliberately no prorating here.

test("season start is derived from the schedule, never re-typed", () => {
  expect(FALL_SEASON_START).toBe(FALL_SUNDAYS[0]);
});

test("before the first Sunday → full refund", () => {
  expect(fallRefundPolicyFor("2026-08-16")).toBe("full");
  expect(fallRefundPolicyFor("2026-09-19")).toBe("full");
});

test("on the first Sunday the season has begun → no refund", () => {
  expect(fallRefundPolicyFor("2026-09-20")).toBe("none");
});

test("after the season starts → no refund", () => {
  expect(fallRefundPolicyFor("2026-09-21")).toBe("none");
  expect(fallRefundPolicyFor("2026-10-25")).toBe("none");
  expect(fallRefundPolicyFor("2027-01-01")).toBe("none");
});

// Guards the repo's date rule: these are ISO date-only strings compared
// lexicographically. If anyone swaps in `new Date(y, m, d)` this catches the
// UTC-build-server off-by-one, because a Sept 19 ET "today" must still be full.
test("comparison is ISO-string based, so it is timezone-stable", () => {
  const dayBefore = "2026-09-19";
  expect(dayBefore < FALL_SEASON_START).toBe(true);
  expect(fallRefundPolicyFor(dayBefore)).toBe("full");
});
