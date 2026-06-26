import { test, expect } from "@playwright/test";
import {
  normalizeCancelReason,
  rosterForSession,
  sessionNeedsCancelFanout,
} from "../src/lib/reconcile-cancelled";

// Pure helpers for the reconcile-cancelled-sessions cron, which refunds +
// notifies registrants of a session marked Cancelled by hand in Notion (the
// weather pull that currently fires no refunds). The act/skip decision and the
// reason mapping move money / drive parent copy, so they're pinned directly.

test.describe("normalizeCancelReason", () => {
  test("maps the known reasons, case/space-insensitively", () => {
    expect(normalizeCancelReason("weather")).toBe("weather");
    expect(normalizeCancelReason("  Weather ")).toBe("weather");
    expect(normalizeCancelReason("VENUE")).toBe("venue");
    expect(normalizeCancelReason("low-enrollment")).toBe("low-enrollment");
    expect(normalizeCancelReason("Low Enrollment")).toBe("low-enrollment");
  });

  test("defaults to 'other' for blank/unknown (the hand-cancel common case)", () => {
    expect(normalizeCancelReason("")).toBe("other");
    expect(normalizeCancelReason(null)).toBe("other");
    expect(normalizeCancelReason(undefined)).toBe("other");
    expect(normalizeCancelReason("snowpocalypse")).toBe("other");
  });
});

test.describe("rosterForSession", () => {
  const drops = [
    { sessionDate: "2026-06-27", sessionTitle: "Sherwood HS — Green", cancellationNotified: false },
    { sessionDate: "2026-06-27", sessionTitle: "Sherwood HS — Yellow", cancellationNotified: false },
    { sessionDate: "2026-06-28", sessionTitle: "Sherwood HS — Green", cancellationNotified: false },
  ];

  test("matches exact date + title only (per-level siblings stay separate)", () => {
    const r = rosterForSession(drops, { title: "Sherwood HS — Green", date: "2026-06-27" });
    expect(r).toHaveLength(1);
    expect(r[0].sessionTitle).toBe("Sherwood HS — Green");
  });

  test("does not match a different date or a different level title", () => {
    expect(rosterForSession(drops, { title: "Sherwood HS — Red", date: "2026-06-27" })).toHaveLength(0);
    expect(rosterForSession(drops, { title: "Sherwood HS — Green", date: "2026-06-29" })).toHaveLength(0);
  });
});

test.describe("sessionNeedsCancelFanout", () => {
  test("true when any confirmed row is not yet notified", () => {
    expect(
      sessionNeedsCancelFanout([
        { cancellationNotified: true },
        { cancellationNotified: false },
      ]),
    ).toBe(true);
  });

  test("false when every row is already notified (no re-hit on Stripe)", () => {
    expect(
      sessionNeedsCancelFanout([
        { cancellationNotified: true },
        { cancellationNotified: true },
      ]),
    ).toBe(false);
  });

  test("false for an empty roster (nothing to refund)", () => {
    expect(sessionNeedsCancelFanout([])).toBe(false);
  });
});
