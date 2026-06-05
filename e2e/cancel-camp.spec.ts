import { test, expect } from "@playwright/test";
import type Stripe from "stripe";
import { pickRefundableCampSession } from "../src/lib/cancel-camp";
import {
  campCancellationHtml,
  campCancellationText,
} from "../src/lib/email/camp-cancellation";

// Minimal Checkout Session factory — only the fields pickRefundableCampSession reads.
function session(
  over: Partial<Stripe.Checkout.Session> & { kind?: string },
): Stripe.Checkout.Session {
  const { kind = "camp", ...rest } = over;
  return {
    id: "cs_test",
    created: 1000,
    payment_status: "paid",
    metadata: kind ? { kind } : {},
    ...rest,
  } as unknown as Stripe.Checkout.Session;
}

test.describe("pickRefundableCampSession", () => {
  test("returns the most recent paid camp session", () => {
    const picked = pickRefundableCampSession([
      session({ id: "old", created: 100 }),
      session({ id: "new", created: 200 }),
    ]);
    expect(picked?.id).toBe("new");
  });

  test("ignores unpaid sessions", () => {
    const picked = pickRefundableCampSession([
      session({ id: "unpaid", created: 300, payment_status: "unpaid" }),
      session({ id: "paid", created: 200 }),
    ]);
    expect(picked?.id).toBe("paid");
  });

  test("ignores non-camp sessions (e.g. a $20 drop-in)", () => {
    const picked = pickRefundableCampSession([
      session({ id: "dropin", created: 400, kind: "" }),
    ]);
    expect(picked).toBeNull();
  });

  test("returns null when nothing matches", () => {
    expect(pickRefundableCampSession([])).toBeNull();
  });
});

test.describe("campCancellation template", () => {
  const base = {
    parentFirst: "Jamie",
    childFirst: "Bear",
    campTitle: "Summer Camp — Week 2",
    campWeek: "July 20 – July 23, 2026",
    optionLabel: "Full day",
    campsUrl: "https://nextgenpbacademy.com/schedule",
  };

  test("refund variant leads with the amount back", () => {
    const html = campCancellationHtml({ ...base, refundedUsd: "295.00" });
    expect(html).toContain("Bear");
    expect(html).toContain("$295.00");
    expect(html).toContain("on the way back");
    const text = campCancellationText({ ...base, refundedUsd: "295.00" });
    expect(text).toContain("$295.00");
  });

  test("no-refund withdrawal drops the refund line", () => {
    const html = campCancellationHtml({ ...base, refundedUsd: "0.00" });
    expect(html).not.toContain("Refund: $");
    expect(html).toContain("off the Summer Camp — Week 2 roster");
  });

  test("escapes child/camp names to guard injection", () => {
    const html = campCancellationHtml({
      ...base,
      childFirst: "<script>",
      refundedUsd: "0.00",
    });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });
});
