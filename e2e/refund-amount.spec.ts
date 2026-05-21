import { test, expect } from "@playwright/test";
import { resolveRefundCents } from "../src/lib/refund-amount";

test.describe("resolveRefundCents", () => {
  test("full refund omits amount so Stripe returns the whole charge", () => {
    expect(resolveRefundCents("full", 40)).toEqual({ ok: true });
  });

  test("valid partial refund passes the requested cents through", () => {
    expect(resolveRefundCents("partial", 40, 2000)).toEqual({
      ok: true,
      amountCents: 2000,
    });
  });

  test("partial refund equal to the full charge is allowed", () => {
    expect(resolveRefundCents("partial", 40, 4000)).toEqual({
      ok: true,
      amountCents: 4000,
    });
  });

  test("partial refund above the amount paid is rejected", () => {
    const r = resolveRefundCents("partial", 40, 5000);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toContain("40.00");
  });

  test("partial refund with no amount is rejected", () => {
    expect(resolveRefundCents("partial", 40).ok).toBe(false);
  });

  test("zero or negative partial amount is rejected", () => {
    expect(resolveRefundCents("partial", 40, 0).ok).toBe(false);
    expect(resolveRefundCents("partial", 40, -100).ok).toBe(false);
  });

  test("non-integer cents is rejected (guards float drift)", () => {
    expect(resolveRefundCents("partial", 40, 1999.5).ok).toBe(false);
  });

  test("a row with no charge on file cannot be refunded", () => {
    expect(resolveRefundCents("full", 0).ok).toBe(false);
  });
});
