import Stripe from "stripe";
import { getStripe } from "./stripe";

// Invoice-from-signup helper. Replaces fixed Stripe Price IDs: the caller
// passes line items built from the sign-up form (description + amount in
// cents), and this module turns them into a finalized, emailed Stripe invoice.
//
// Flow: find-or-create Customer by email -> create draft invoice
// (collection_method=send_invoice, auto_advance) -> add invoice items with
// ad-hoc price_data -> finalize -> send. Stripe emails the parent the invoice
// with a hosted pay link; the parent lands back on our success page from that
// hosted page via the invoice description/footer URL.

export interface InvoiceLineItem {
  /** Line description shown on the invoice, e.g. "Group lesson — Mia (4 players, $60 total split)". */
  description: string;
  /** Unit amount in cents. */
  amountCents: number;
  /** Quantity. Defaults to 1. */
  quantity?: number;
}

export interface CreateSignupInvoiceArgs {
  customerEmail: string;
  customerName?: string;
  items: InvoiceLineItem[];
  /** Metadata stamped on the invoice — drives webhook dispatch (kind=...). */
  metadata: Record<string, string>;
  /** Line shown near the top of the invoice. */
  memo?: string;
  /** Footer text on the invoice. */
  footer?: string;
  /** Days until the invoice is due. Defaults to 7. */
  daysUntilDue?: number;
  /** Stable per-submission id for Stripe's Idempotency-Key (safe retries). */
  idempotencyKey?: string;
}

export async function findOrCreateCustomer(
  stripe: Stripe,
  email: string,
  name?: string,
): Promise<Stripe.Customer> {
  const existing = await stripe.customers.list({ email, limit: 1 });
  if (existing.data.length > 0) return existing.data[0];
  return stripe.customers.create({ email, name: name || undefined });
}

/**
 * Build, finalize, and email an invoice from sign-up form data.
 * Throws if any Stripe call fails; the invoice is only finalized after all
 * items are attached, so a failure leaves a draft (never a sent invoice).
 */
export async function createAndSendSignupInvoice(
  args: CreateSignupInvoiceArgs,
): Promise<Stripe.Invoice> {
  const stripe = getStripe();
  const {
    customerEmail,
    customerName,
    items,
    metadata,
    memo,
    footer,
    daysUntilDue = 7,
    idempotencyKey,
  } = args;

  if (items.length === 0) {
    throw new Error("createAndSendSignupInvoice needs at least one line item");
  }
  for (const item of items) {
    if (item.amountCents <= 0 || (item.quantity ?? 1) <= 0) {
      throw new Error(`Invalid line item amounts: ${item.description}`);
    }
  }

  const customer = await findOrCreateCustomer(
    stripe,
    customerEmail,
    customerName,
  );

  const requestOptions = idempotencyKey
    ? { idempotencyKey }
    : undefined;

  const invoice = await stripe.invoices.create(
    {
      customer: customer.id,
      collection_method: "send_invoice",
      days_until_due: daysUntilDue,
      auto_advance: true,
      description: memo || undefined,
      footer: footer || undefined,
      metadata,
    },
    requestOptions,
  );

  for (const item of items) {
    // Legacy-style amount + description: no Product catalog entries needed,
    // the per-signup description (child name, Monday, split) goes straight on
    // the line item. `amount` is the line TOTAL — the API rejects amount +
    // quantity together, so quantity is folded into the amount (always 1x).
    await stripe.invoiceItems.create({
      customer: customer.id,
      invoice: invoice.id,
      amount: item.amountCents * (item.quantity ?? 1),
      currency: "usd",
      description: item.description,
    });
  }

  const finalized = await stripe.invoices.finalizeInvoice(invoice.id);
  await stripe.invoices.sendInvoice(finalized.id);
  return stripe.invoices.retrieve(finalized.id);
}
