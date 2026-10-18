import { test, expect } from "@playwright/test";
import { ownedCheckoutParams, nativePaymentOwned } from "../src/lib/payment-ownership";

test("checkout ownership follows the payment without copying child metadata to the payment intent", () => {
  const result = ownedCheckoutParams({ mode: "payment", metadata: { kind: "camp", child_first_name: "Synthetic" }, payment_intent_data: { description: "Test camp", metadata: { existing: "kept" } } });
  expect(result.metadata).toEqual({ kind: "camp", child_first_name: "Synthetic", payment_owner: "nga_site" });
  expect(result.payment_intent_data).toEqual({ description: "Test camp", metadata: { existing: "kept", payment_owner: "nga_site" } });
});

test("setup checkout carries owner on the setup intent and creates no payment intent params", () => {
  const result = ownedCheckoutParams({ mode: "setup", metadata: { nga_crew_id: "synthetic-crew" } });
  expect(result.metadata?.payment_owner).toBe("nga_site");
  expect(result.setup_intent_data?.metadata?.payment_owner).toBe("nga_site");
  expect(result.payment_intent_data).toBeUndefined();
});

for (const kind of ["camp", "league", "cluster", "fall", "picklpark", "monday-girls", "monday-girls-dropin", "lesson", "mvf-junior-tournament"]) {
  test(`known legacy kind ${kind} keeps its native owner`, () => {
    expect(nativePaymentOwned({ kind }, "checkout")).toBe(true);
    expect(nativePaymentOwned({ kind, payment_owner: "coach_os" }, "checkout")).toBe(false);
  });
}

test("invoice ownership requires a supported invoice product", () => {
  expect(nativePaymentOwned({ payment_owner: "nga_site", kind: "camp" }, "invoice")).toBe(false);
  expect(nativePaymentOwned({ kind: "lesson", booking_request_id: "native-request" }, "invoice")).toBe(true);
  expect(nativePaymentOwned({ booking_request_id: "native-request" }, "invoice")).toBe(false);
  expect(nativePaymentOwned(null, "invoice")).toBe(false);
});
