import { test, expect } from "@playwright/test";
import {
  resolveRefundCents,
  isAlreadyRefundedError,
} from "../src/lib/refund-amount";

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

test.describe("isAlreadyRefundedError", () => {
  test("matches Stripe's charge_already_refunded code", () => {
    expect(
      isAlreadyRefundedError({ code: "charge_already_refunded", message: "x" }),
    ).toBe(true);
  });

  test('matches "has already been refunded" message', () => {
    expect(
      isAlreadyRefundedError({ message: "Charge ch_1 has already been refunded." }),
    ).toBe(true);
  });

  test('matches the over-refund "unrefunded amount" message (the case the old regex missed)', () => {
    expect(
      isAlreadyRefundedError({
        message:
          "Refund amount ($20.00) is greater than unrefunded amount on charge ($0.00)",
      }),
    ).toBe(true);
  });

  test('matches "minus refunds already issued" phrasing', () => {
    expect(
      isAlreadyRefundedError({
        message:
          "Amount must be no more than the charge amount minus refunds already issued.",
      }),
    ).toBe(true);
  });

  test("does NOT match an unrelated Stripe failure (card error, network, etc.)", () => {
    expect(
      isAlreadyRefundedError({ code: "card_declined", message: "Your card was declined." }),
    ).toBe(false);
    expect(isAlreadyRefundedError({ message: "Something went wrong" })).toBe(false);
  });

  test("safe on null / undefined / shapeless errors", () => {
    expect(isAlreadyRefundedError(null)).toBe(false);
    expect(isAlreadyRefundedError(undefined)).toBe(false);
    expect(isAlreadyRefundedError({})).toBe(false);
  });
});
