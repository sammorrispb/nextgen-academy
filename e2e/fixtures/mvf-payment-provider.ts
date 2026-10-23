import assert from "node:assert/strict";
import type Stripe from "stripe";
import { getStripe } from "../../src/lib/stripe";
import type { RecordedFetch } from "./fetch-stub";

// Offline provider evidence for existing signed-webhook regression fixtures.
// Every SDK operation the paid-proof reader can make is replaced and restored.
// Keep DenyProviderNetwork installed at the caller as a second boundary.
export function installMvfPaymentProvider(input: () => {
  invoiceId: string; metadata: Record<string, string>; amount: number;
}) {
  const stripe = getStripe();
  const old = { account: stripe.accounts.retrieve, invoice: stripe.invoices.retrieve,
    payments: stripe.invoicePayments.list, intent: stripe.paymentIntents.retrieve,
    charge: stripe.charges.retrieve, refunds: stripe.refunds.list };
  const paidAt = Date.UTC(2026, 9, 22, 12) / 1000;
  const ids = () => ({ intent: "pi_SyntheticMvfFixture", charge: "ch_SyntheticMvfFixture" });
  stripe.accounts.retrieve = (async () => ({ id: "acct_1TU4iSBpXOfTC961" })) as unknown as typeof old.account;
  stripe.invoices.retrieve = (async (invoiceId: string) => {
    const f = input(); assert.equal(invoiceId, f.invoiceId);
    return { id: f.invoiceId, livemode: true, status: "paid", currency: "usd",
      amount_paid: f.amount, amount_due: f.amount, total: f.amount, amount_remaining: 0,
      pre_payment_credit_notes_amount: 0, post_payment_credit_notes_amount: 0,
      customer: "cus_SyntheticMvfFixture", customer_email: f.metadata.parent_email,
      on_behalf_of: null, metadata: f.metadata, status_transitions: { paid_at: paidAt } };
  }) as unknown as typeof old.invoice;
  stripe.invoicePayments.list = ((params: Stripe.InvoicePaymentListParams) => {
    const f = input(); assert.equal(params.invoice, f.invoiceId);
    return Promise.resolve({ data: [{ id: "inpay_SyntheticMvfFixture", invoice: f.invoiceId,
      livemode: true, status: "paid", amount_paid: f.amount, amount_requested: f.amount,
      currency: "usd", payment: { type: "payment_intent", payment_intent: ids().intent },
      status_transitions: { paid_at: paidAt, canceled_at: null } }], has_more: false });
  }) as unknown as typeof old.payments;
  stripe.paymentIntents.retrieve = (async (paymentIntentId: string) => {
    assert.equal(paymentIntentId, ids().intent); const f = input();
    return { id: ids().intent, livemode: true, status: "succeeded", currency: "usd",
      amount: f.amount, amount_received: f.amount, customer: "cus_SyntheticMvfFixture",
      latest_charge: ids().charge, metadata: {}, on_behalf_of: null, transfer_data: null };
  }) as unknown as typeof old.intent;
  stripe.charges.retrieve = (async (chargeId: string) => {
    assert.equal(chargeId, ids().charge); const f = input();
    return { id: ids().charge, livemode: true, status: "succeeded", paid: true, captured: true,
      currency: "usd", amount: f.amount, amount_captured: f.amount, amount_refunded: 0,
      refunded: false, disputed: false, payment_intent: ids().intent, metadata: {},
      on_behalf_of: null, transfer_data: null };
  }) as unknown as typeof old.charge;
  stripe.refunds.list = ((params: Stripe.RefundListParams) => {
    assert.equal(params.charge, ids().charge);
    return Promise.resolve({ data: [], has_more: false });
  }) as unknown as typeof old.refunds;
  return () => {
    stripe.accounts.retrieve = old.account; stripe.invoices.retrieve = old.invoice;
    stripe.invoicePayments.list = old.payments; stripe.paymentIntents.retrieve = old.intent;
    stripe.charges.retrieve = old.charge; stripe.refunds.list = old.refunds;
  };
}

export function mvfPaymentNotionPage(input: {
  id: string; databaseId: string; invoiceId: string; metadata: Record<string, string>; paid: boolean;
}) {
  const m = input.metadata;
  const richText = (value: string) => ({ rich_text: [{ plain_text: value }] });
  return { id: input.id, archived: false, in_trash: false,
    last_edited_time: "2026-10-23T12:00:00.000Z", parent: { database_id: input.databaseId },
    properties: { Paid: { checkbox: input.paid }, Status: { select: { name: input.paid ? "Confirmed" : "Pending" } },
      "Stripe Invoice ID": richText(input.invoiceId), "Parent Email": { email: m.parent_email },
      "Child First Name": richText(m.child_first_name), "Child Last Name": richText(m.child_last_name),
      "Child DOB": { date: { start: m.child_dob } }, Division: { select: { name: m.division.toUpperCase() } },
      Resident: { checkbox: m.resident === "true" } } };
}

export function mvfPaymentAcknowledgement(call: RecordedFetch, invoiceId: string, eventKey: string) {
  assert.equal(call.method, "POST"); const body = JSON.parse(call.body);
  assert.deepEqual(Object.keys(body).sort(), ["event_key", "account_id", "invoice_id", "submission_id",
    "attendee_key", "roster_key", "amount_paid_cents", "currency", "paid_at", "resident",
    "payment_intent_id", "dry_run"].sort());
  assert.equal(body.invoice_id, invoiceId); assert.equal(body.event_key, eventKey);
  assert.equal(body.dry_run, false);
  return { status: 200, json: { ok: true, status: "paid", event_key: eventKey,
    invoice_id: invoiceId, rsvp_id: "ffffffff-eeee-4ddd-8ccc-bbbbbbbbbbbb", dry_run: false } };
}
