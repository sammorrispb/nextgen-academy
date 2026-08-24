import { test, expect } from "@playwright/test";
import {
  FALL_SEASON_START,
  FALL_NO_REFUND_EFFECTIVE_FROM,
  fallRefundPolicyFor,
  fallSessionsRemaining,
  fallProratedRefundCents,
} from "../src/lib/fall-refund-policy";
import { FALL_SUNDAYS } from "../src/data/fall-2026";

// Pure spec — no dev server.
//   npx playwright test e2e/fall-refund-policy.spec.ts --project=desktop
//
// Policy (Sam, 2026-08-24) — two axes, because one boolean could not express it:
//
//   WHO cancelled:
//     parent withdrawal → no refund (the seat was held all season)
//     NGA cancelled     → prorate the sessions we did not deliver
//
//   WHEN they registered:
//     before FALL_NO_REFUND_EFFECTIVE_FROM → the old rule (full refund until
//       the season starts). These families bought before the no-refund terms
//       were ever shown at checkout, so their terms do not change retroactively.
//     on/after it → no-refund terms were on the page and in the confirmation.
//
// An unknown registration date falls back to the OLD, more generous rule on
// purpose: never apply stricter terms to a row we cannot date.

test("season start is derived from the schedule, never re-typed", () => {
  expect(FALL_SEASON_START).toBe(FALL_SUNDAYS[0]);
});

test("the no-refund cutoff is on/after the day the terms went live", () => {
  // Terms ship 2026-08-24; the cutoff must never predate them, or we would be
  // enforcing terms against families who were never shown them.
  expect(FALL_NO_REFUND_EFFECTIVE_FROM >= "2026-08-24").toBe(true);
});

// ─── Legacy registrations (the 7 families who paid Aug 16–23) ───────────────

test("legacy registration, parent withdraws before the season → full refund", () => {
  expect(
    fallRefundPolicyFor("2026-09-19", { registeredOnIso: "2026-08-21" }),
  ).toBe("full");
});

test("legacy registration, parent withdraws after the season starts → none", () => {
  expect(
    fallRefundPolicyFor("2026-09-20", { registeredOnIso: "2026-08-21" }),
  ).toBe("none");
});

test("an undated registration keeps the old, more generous rule", () => {
  expect(fallRefundPolicyFor("2026-09-19")).toBe("full");
  expect(fallRefundPolicyFor("2026-09-20")).toBe("none");
});

// ─── Registrations sold under the new terms ─────────────────────────────────

test("new registration, parent withdraws → no refund, before or after start", () => {
  const registeredOnIso = FALL_NO_REFUND_EFFECTIVE_FROM;
  expect(fallRefundPolicyFor("2026-09-01", { registeredOnIso })).toBe("none");
  expect(fallRefundPolicyFor("2026-09-19", { registeredOnIso })).toBe("none");
  expect(fallRefundPolicyFor("2026-10-25", { registeredOnIso })).toBe("none");
});

// ─── NGA cancels — always prorated, whatever the terms ──────────────────────

test("NGA cancelling prorates regardless of when they registered", () => {
  const reason = "nga_cancelled" as const;
  expect(fallRefundPolicyFor("2026-10-11", { reason })).toBe("prorated");
  expect(
    fallRefundPolicyFor("2026-10-11", {
      reason,
      registeredOnIso: FALL_NO_REFUND_EFFECTIVE_FROM,
    }),
  ).toBe("prorated");
  expect(
    fallRefundPolicyFor("2026-10-11", { reason, registeredOnIso: "2026-08-21" }),
  ).toBe("prorated");
});

// ─── Proration maths ────────────────────────────────────────────────────────

test("sessions remaining counts Sundays not yet played, today inclusive", () => {
  expect(fallSessionsRemaining("2026-09-01")).toBe(FALL_SUNDAYS.length);
  // On a session day that session still counts — it has not been delivered yet.
  expect(fallSessionsRemaining("2026-09-20")).toBe(6);
  expect(fallSessionsRemaining("2026-09-21")).toBe(5);
  expect(fallSessionsRemaining("2026-10-25")).toBe(1);
  expect(fallSessionsRemaining("2026-11-30")).toBe(0);
});

test("NGA cancelling before the season returns the whole fee", () => {
  expect(fallProratedRefundCents("2026-09-01", 22500)).toBe(22500);
});

test("NGA cancelling mid-season returns only the undelivered sessions", () => {
  // 3 of 6 left on Oct 11 (Oct 11, 18, 25) → half back.
  expect(fallSessionsRemaining("2026-10-11")).toBe(3);
  expect(fallProratedRefundCents("2026-10-11", 22500)).toBe(11250);
});

test("proration rounds in the parent's favour and never exceeds what they paid", () => {
  // 5/6 of 22500 = 18750 exactly; use an awkward figure to prove the rounding.
  const owed = fallProratedRefundCents("2026-09-21", 20000);
  expect(owed).toBe(Math.ceil((20000 * 5) / 6));
  expect(owed).toBeLessThanOrEqual(20000);
  expect(fallProratedRefundCents("2026-11-30", 22500)).toBe(0);
});

// Guards the repo's date rule: these are ISO date-only strings compared
// lexicographically. If anyone swaps in `new Date(y, m, d)` this catches the
// UTC-build-server off-by-one, because a Sept 19 ET "today" must still be full.
test("comparison is ISO-string based, so it is timezone-stable", () => {
  const dayBefore = "2026-09-19";
  expect(dayBefore < FALL_SEASON_START).toBe(true);
  expect(fallRefundPolicyFor(dayBefore, { registeredOnIso: "2026-08-21" })).toBe(
    "full",
  );
});
