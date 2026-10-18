import { createHash } from "node:crypto";
import type Stripe from "stripe";
import { findLessonProduct, lessonTotalUsd } from "../data/lessons";
import { MONDAY_GIRLS_DROPIN_PRICE_USD } from "../data/monday-girls-dropin-2026";

const ACCOUNT = "acct_1TU4iSBpXOfTC961";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export class NativeDeliveryPending extends Error { constructor() { super("Native invoice notification pending review or retry"); } }
export type NativeInvoiceDeliveryContext = { accountId: string; invoiceId: string; kind: "lesson" | "monday-girls-dropin"; paidAt: string; eventCreatedAt: string };
export type NativeInvoiceEmail = { from: string; to: string | string[]; bcc?: string; replyTo?: string; subject: string; text: string };
type DeliveryResult = { state: "accepted" | "suppressed" | "uncertain"; fresh: boolean };

/** The signing secret authenticates the event; merchant identity comes from Stripe self. */
export async function verifiedNativeInvoiceContext(invoice: Stripe.Invoice, event: Stripe.Event, stripe: Stripe): Promise<NativeInvoiceDeliveryContext | null> {
  const paid = invoice.status_transitions?.paid_at;
  const kind = invoice.metadata?.kind;
  if (event.livemode !== true || invoice.livemode !== true || invoice.status !== "paid" || invoice.currency !== "usd"
    || !Number.isSafeInteger(invoice.amount_paid) || invoice.amount_paid <= 0 || invoice.amount_remaining !== 0
    || invoice.amount_due !== invoice.amount_paid || invoice.total !== invoice.amount_paid
    || invoice.pre_payment_credit_notes_amount !== 0 || invoice.post_payment_credit_notes_amount !== 0
    || (invoice as Stripe.Invoice & { paid_out_of_band?: boolean }).paid_out_of_band === true) return null;
  let expectedCents: number;
  if (kind === "lesson") {
    const product = findLessonProduct(invoice.metadata?.lesson_type);
    if (!product || invoice.metadata?.lesson_slug !== product.slug) return null;
    try { expectedCents = lessonTotalUsd(product.type, product.type === "group" ? Number(invoice.metadata?.group_players) : undefined) * 100; }
    catch { return null; }
  } else if (kind === "monday-girls-dropin") expectedCents = MONDAY_GIRLS_DROPIN_PRICE_USD * 100;
  else return null;
  if (invoice.amount_paid !== expectedCents) return null;
  if (!/^in_[A-Za-z0-9]{1,250}$/.test(invoice.id) || !["lesson", "monday-girls-dropin"].includes(kind ?? "")
    || !Number.isSafeInteger(paid) || !paid || paid <= 0 || !Number.isSafeInteger(event.created) || event.created <= 0) return null;
  const paidAt = new Date(paid * 1000);
  const eventAt = new Date(event.created * 1000);
  if (!Number.isFinite(paidAt.getTime()) || !Number.isFinite(eventAt.getTime())) return null;
  // Older event versions may still include transfer_data; Stripe 22 omits it
  // from the returned Invoice type. Either shape remains outside this lane.
  if (invoice.on_behalf_of || (invoice as unknown as { transfer_data?: unknown }).transfer_data) throw new NativeDeliveryPending();
  let account: Stripe.Account;
  // Stripe 22 uses null to request GET /v1/account (the authenticated self).
  try { account = await stripe.accounts.retrieve(null); } catch { throw new NativeDeliveryPending(); }
  if (account.id !== ACCOUNT || (event.account && event.account !== account.id)) throw new NativeDeliveryPending();
  return { accountId: account.id, invoiceId: invoice.id, kind: kind as NativeInvoiceDeliveryContext["kind"], paidAt: paidAt.toISOString(), eventCreatedAt: eventAt.toISOString() };
}

async function command(body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const secret = process.env.NGA_SYNC_SECRET;
  const origin = process.env.LINKDINK_BASE_URL || (process.env.VERCEL_ENV === "production" ? "https://www.linkanddink.com" : "");
  if (!secret || !origin) throw new NativeDeliveryPending();
  try {
    const url = new URL(origin);
    if (url.username || url.password || (url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname)))) throw new NativeDeliveryPending();
    const response = await fetch(new URL("/play/api/internal/nga-invoice-deliveries", url), {
      method: "POST", redirect: "error", signal: AbortSignal.timeout(8000),
      headers: { "content-type": "application/json", "x-nga-sync-secret": secret }, body: JSON.stringify(body),
    });
    const result: unknown = await response.json();
    if (!response.ok || !result || typeof result !== "object" || Array.isArray(result) || (result as Record<string, unknown>).ok !== true) throw new NativeDeliveryPending();
    return result as Record<string, unknown>;
  } catch { throw new NativeDeliveryPending(); }
}

/** The frozen wire payload is hashed locally; only its digest reaches the ledger. */
export async function deliverNativeInvoiceEmail(context: NativeInvoiceDeliveryContext, recipient: "admin" | "parent", payload: NativeInvoiceEmail): Promise<DeliveryResult> {
  if (context.accountId !== ACCOUNT) throw new NativeDeliveryPending();
  const wire = JSON.stringify({ from: payload.from, to: payload.to, bcc: payload.bcc, reply_to: payload.replyTo, subject: payload.subject, text: payload.text });
  const claim = await command({ action: "claim", account_id: context.accountId, invoice_id: context.invoiceId, kind: context.kind, recipient,
    payload_sha256: createHash("sha256").update(wire).digest("hex"), paid_at: context.paidAt, event_created_at: context.eventCreatedAt });
  if (["accepted", "suppressed", "uncertain"].includes(String(claim.state))) return { state: claim.state as DeliveryResult["state"], fresh: false };
  if (claim.state !== "leased" || typeof claim.delivery_id !== "string" || !UUID.test(claim.delivery_id)
    || typeof claim.lease_token !== "string" || !UUID.test(claim.lease_token) || claim.provider_key !== "nga-native-v1-" + claim.delivery_id) throw new NativeDeliveryPending();
  const finish = async (outcome: "accepted" | "retry", providerId: string | null) => {
    const result = await command({ action: "finish", delivery_id: claim.delivery_id, lease_token: claim.lease_token, outcome, provider_id: providerId });
    if (result.recorded !== true) throw new NativeDeliveryPending();
  };
  try {
    const key = process.env.RESEND_API_KEY;
    if (!key) throw new NativeDeliveryPending();
    const response = await fetch("https://api.resend.com/emails", { method: "POST", redirect: "error", signal: AbortSignal.timeout(8000),
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json", "idempotency-key": String(claim.provider_key) }, body: wire });
    const result: unknown = await response.json();
    const providerId = result && typeof result === "object" && !Array.isArray(result) ? (result as Record<string, unknown>).id : null;
    if (!response.ok || typeof providerId !== "string" || !/^[A-Za-z0-9_-]{1,200}$/.test(providerId)) throw new NativeDeliveryPending();
    await finish("accepted", providerId);
    return { state: "accepted", fresh: true };
  } catch {
    // A lost provider response may hide an accepted message. A retry reuses the
    // same key and exact bytes; the database refuses retries after 23 hours.
    try { await finish("retry", null); } catch { /* Retain the lease if the acknowledgment is unavailable. */ }
    throw new NativeDeliveryPending();
  }
}
