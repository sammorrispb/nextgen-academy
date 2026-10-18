import { test, expect } from "@playwright/test";
import { FakeStripeInvoicing } from "./fixtures/fake-stripe-invoices";
import { getStripe } from "../src/lib/stripe";
import { createAndSendSignupInvoice } from "../src/lib/stripe-invoices";

const key = process.env.STRIPE_SECRET_KEY;
let fake: FakeStripeInvoicing;
let restore: () => void;
test.beforeEach(() => {
  process.env.STRIPE_SECRET_KEY = "sk_test_invoice_owner_offline";
  fake = new FakeStripeInvoicing();
  restore = fake.install(getStripe());
});
test.afterEach(() => restore());
test.afterAll(() => { if (key === undefined) delete process.env.STRIPE_SECRET_KEY; else process.env.STRIPE_SECRET_KEY = key; });

const args = { customerEmail: "synthetic@example.com", items: [{ description: "Synthetic lesson", amountCents: 8000 }], metadata: { kind: "lesson" } };

test("new signup invoices explicitly belong to NGA without changing their product metadata", async () => {
  await createAndSendSignupInvoice(args);
  expect(fake.all()[0].metadata).toEqual({ kind: "lesson", payment_owner: "nga_site" });
});

test("a caller cannot relabel another app's invoice as a native sale", async () => {
  await expect(createAndSendSignupInvoice({ ...args, metadata: { kind: "lesson", payment_owner: "coach_os" } })).rejects.toThrow("payment owner");
  expect(fake.all()).toHaveLength(0);
});

test("a resumed invoice from another owner is never finalized or sent", async () => {
  const customer = await getStripe().customers.create({ email: "synthetic@example.com" });
  const invoice = await getStripe().invoices.create({ customer: customer.id, metadata: { kind: "lesson", payment_owner: "coach_os" } });
  await expect(createAndSendSignupInvoice({ ...args, existingInvoiceId: invoice.id })).rejects.toThrow("payment owner");
  expect(fake.all()[0].status).toBe("draft");
  expect(fake.all()[0].sends).toBe(0);
});
