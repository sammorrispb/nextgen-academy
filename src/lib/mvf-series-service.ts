import { createHmac, timingSafeEqual } from "node:crypto";
import type Stripe from "stripe";
import { activeSeriesRelease, findSeriesRelease, releaseProblems, seriesEventKey, validateSeriesRegistration, MVF_SERIES_ACCOUNT, MVF_SERIES_KIND, type SeriesRegistration, type SeriesRelease } from "@/data/mvf-series-registration";
import { findMvfJuniorSeriesEvent, mvfJuniorSeriesUrl } from "@/data/mvf-junior-series";
import { SMS_CONSENT_TEXT } from "@/data/sms-consent";
import { getStripe } from "./stripe";
import { createAndSendSignupInvoice, type CreateSignupInvoiceArgs, type SignupInvoiceResult } from "./stripe-invoices";
import { PAYMENT_OWNER, hasForeignPaymentOwner } from "./payment-ownership";
import { normalizeEmailTypos } from "./email-typo";
import { invoiceSafeName } from "./invoice-text";
import { baseSeriesMetadata, checkSeriesRosterSchema, ensureSeriesRoster, updateSeriesRoster, strictSeriesWaiver, seriesCommand, seriesIdentity, seriesSecret, sendSeriesNotice, SeriesError } from "./mvf-series-store";

const INVOICE = /^in_[A-Za-z0-9]{1,250}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DAY = 86400000;
type Scope = { event: string; invoice: string; submission: string; revision: string; purpose: "receipt" | "cancel"; expires: number };

export function seriesToken(scope: Omit<Scope, "expires">, now = Date.now()): string {
  const data = Buffer.from(JSON.stringify({ ...scope, expires: now + 180 * DAY })).toString("base64url");
  return data + "." + createHmac("sha256", seriesSecret()).update("nga-series-capability-v1\0" + data).digest("base64url");
}
export function readSeriesToken(token: unknown, event: string, purpose: Scope["purpose"], now = Date.now()): Scope {
  if (typeof token !== "string" || token.length > 1500 || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token)) throw new SeriesError("invalid_receipt", 403);
  const [body, signature] = token.split(".");
  const expected = createHmac("sha256", seriesSecret()).update("nga-series-capability-v1\0" + body).digest();
  const actual = Buffer.from(signature, "base64url");
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) throw new SeriesError("invalid_receipt", 403);
  let value: Scope;
  try { value = JSON.parse(Buffer.from(body, "base64url").toString()); } catch { throw new SeriesError("invalid_receipt", 403); }
  if (!value || value.event !== event || value.purpose !== purpose || !INVOICE.test(value.invoice ?? "") || !UUID.test(value.submission ?? "") ||
    typeof value.revision !== "string" || !Number.isSafeInteger(value.expires) || !Number.isFinite(now) || value.expires <= now || value.expires > now + 181 * DAY) throw new SeriesError("invalid_receipt", 403);
  return value;
}

export function seriesPayUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try { const url = new URL(value); return url.protocol === "https:" && !url.username && !url.password && !url.port && ["invoice.stripe.com", "pay.stripe.com"].includes(url.hostname) ? value : null; } catch { return null; }
}

export interface SeriesServices {
  stripe: () => Stripe;
  active: (event: string) => SeriesRelease | undefined;
  release: (event: string, revision: string) => SeriesRelease | undefined;
  now: () => number;
  command: typeof seriesCommand;
  schema: typeof checkSeriesRosterSchema;
  waiver: typeof strictSeriesWaiver;
  roster: typeof ensureSeriesRoster;
  updateRoster: typeof updateSeriesRoster;
  invoice: (args: CreateSignupInvoiceArgs) => Promise<SignupInvoiceResult>;
  notice: typeof sendSeriesNotice;
  financialWritesAllowed: () => boolean;
}
export class SeriesInputError extends SeriesError {
  constructor(readonly errors: Record<string, string>) { super("invalid_registration", 400); }
}
const defaults: SeriesServices = { stripe: getStripe, active: activeSeriesRelease, release: findSeriesRelease, now: Date.now, command: seriesCommand, schema: checkSeriesRosterSchema, waiver: strictSeriesWaiver, roster: ensureSeriesRoster, updateRoster: updateSeriesRoster, invoice: createAndSendSignupInvoice, notice: sendSeriesNotice, financialWritesAllowed: () => process.env.VERCEL_ENV === "production" && /^(sk|rk)_live_/.test(process.env.STRIPE_SECRET_KEY ?? "") };

export function createSeriesService(overrides: Partial<SeriesServices> = {}) {
  const deps = { ...defaults, ...overrides };
  const releaseFor = (event: string, revision: string) => {
    const release = deps.release(event, revision);
    if (!release || releaseProblems(release).length) throw new SeriesError("event_configuration_unavailable");
    return release;
  };
  async function merchant(eventAccount?: string, admission = false) {
    const stripe = deps.stripe();
    const account = await stripe.accounts.retrieve(null);
    if (account.id !== MVF_SERIES_ACCOUNT || (admission && account.charges_enabled !== true) || (eventAccount && eventAccount !== account.id)) throw new SeriesError("merchant_unverified");
    return stripe;
  }
  function invoiceRelease(invoice: Stripe.Invoice, scope?: Scope) {
    const m = invoice.metadata ?? {};
    const release = releaseFor(m.event_slug, m.policy_revision);
    const event = findMvfJuniorSeriesEvent(release.event)!;
    const amount = (m.resident === "true" ? event.prices.residentUsd : event.prices.nonresidentUsd) * 100;
    if (!INVOICE.test(invoice.id) || invoice.livemode !== true || hasForeignPaymentOwner(m) || m.payment_owner !== PAYMENT_OWNER || m.kind !== MVF_SERIES_KIND || m.nga_account !== MVF_SERIES_ACCOUNT ||
      !["12u", "16u"].includes(m.division) || m.event_key !== seriesEventKey(release.event, m.division as "12u" | "16u") || !["true", "false"].includes(m.resident) ||
      m.event_date !== release.date || m.event_start !== release.startTime || m.event_end !== release.endTime || m.amount_usd !== (amount / 100).toFixed(2) ||
      !UUID.test(m.nga_capacity_submission_id ?? "") || invoice.currency !== "usd" || invoice.total !== amount || invoice.on_behalf_of ||
      (invoice as Stripe.Invoice & { transfer_data?: unknown }).transfer_data ||
      (scope && (scope.invoice !== invoice.id || scope.event !== release.event || scope.revision !== release.revision || scope.submission !== m.nga_capacity_submission_id))) throw new SeriesError("invoice_mismatch", 409);
    return { release, event, m, amount };
  }
  async function reservation(invoice: Stripe.Invoice) {
    const m = invoice.metadata ?? {};
    const seat = await deps.command(m.event_key, "lookup", { invoice_id: invoice.id });
    if (seat.submission_id !== m.nga_capacity_submission_id || !["payable", "paid", "void"].includes(String(seat.state))) throw new SeriesError("invoice_mismatch", 409);
    return seat;
  }
  async function notices(invoice: Stripe.Invoice, phase: "pending" | "paid" | "void") {
    const { release, event, m, amount } = invoiceRelease(invoice);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(m.parent_email ?? "") || m.parent_email !== invoice.customer_email?.trim().toLowerCase()) throw new SeriesError("recipient_unverified");
    const when = `${release.date}, ${release.startTime}–${release.endTime} ET`;
    const title = phase === "paid" ? "Payment received" : phase === "void" ? "Unpaid registration cancelled" : "Your invoice is ready";
    const text = [title, `MVF Junior Tournament — ${event.monthLabel} — ${m.division.toUpperCase()}`,
      `Player: ${invoiceSafeName(m.child_first_name)}`, `When: ${when}`, `Where: ${event.venue.name}, ${event.venue.address}`,
      phase === "paid" ? `Paid: $${(amount / 100).toFixed(2)}. Your registration is confirmed.` : phase === "void" ? "Your unpaid invoice is void and its seat has been released. No payment or refund was made by this cancellation." : `Entry fee: $${(amount / 100).toFixed(2)}. Payment is pending. Your invoice is due in ${release.invoiceDueDays} days; becoming overdue does not automatically cancel it.`,
      ...(phase === "pending" && seriesPayUrl(invoice.hosted_invoice_url) ? [`Pay your invoice: ${seriesPayUrl(invoice.hosted_invoice_url)}`] : []),
      `Cancellation policy: ${release.cancellationPolicy}`, `Weather policy: ${release.rainPolicy}`, `Minimum enrollment: ${release.minimumEnrollmentPolicy}`,
      mvfJuniorSeriesUrl(event), "Questions: nextgenacademypb@gmail.com · 301-325-4731"].join("\n\n");
    const base = { from: "Next Gen PB Academy <noreply@nextgenpbacademy.com>", reply_to: "nextgenacademypb@gmail.com", subject: `${title} — MVF Junior Tournament — ${event.monthLabel}`, text };
    await deps.notice(m.event_key, invoice.id, phase, "parent", { ...base, to: [m.parent_email] });
    await deps.notice(m.event_key, invoice.id, phase, "admin", { ...base, to: ["sam.morris2131@gmail.com", "nextgenacademypb@gmail.com"], text: `${text}\n\nParent: ${invoiceSafeName(m.parent_name)}\nEmail: ${m.parent_email}\nInvoice: ${invoice.id}` });
  }

  return {
    async register(eventSlug: string, input: unknown) {
      const release = deps.active(eventSlug);
      if (!release || releaseProblems(release).length || deps.now() >= Date.parse(release.registrationClosesAt)) throw new SeriesError("registration_closed", 409);
      if (!deps.financialWritesAllowed()) throw new SeriesError("production_only", 409);
      const errors = validateSeriesRegistration(input, release);
      if (Object.keys(errors).length) throw new SeriesInputError(errors);
      const raw = input as SeriesRegistration;
      const data: SeriesRegistration = {
        division: raw.division, resident: raw.resident, parentName: raw.parentName.trim(), email: normalizeEmailTypos(raw.email.trim()).toLowerCase(), phone: raw.phone.trim(),
        childFirstName: raw.childFirstName.trim(), childLastName: raw.childLastName.trim(), childDob: raw.childDob.trim(),
        emergencyName: raw.emergencyName.trim(), emergencyPhone: raw.emergencyPhone.trim(), allergies: raw.allergies,
        smsConsent: raw.smsConsent, policyAccepted: true, revision: raw.revision.trim(), submissionId: raw.submissionId.trim(),
      };
      seriesSecret();
      if (!process.env.RESEND_API_KEY) throw new SeriesError("notifications_not_configured");
      await deps.schema();
      if (!(await deps.waiver(data.email))) throw new SeriesError("waiver_required", 409);
      const stripe = await merchant(undefined, true);
      const event = findMvfJuniorSeriesEvent(eventSlug)!;
      const eventKey = seriesEventKey(eventSlug, data.division);
      const identity = seriesIdentity(eventSlug, data, release.multipleBrackets);
      const held = await deps.command(eventKey, "reserve", { submission_id: data.submissionId, ...identity });
      if (held.submission_id !== data.submissionId || !["held", "payable", "paid"].includes(String(held.state)) || (held.invoice_id !== null && (typeof held.invoice_id !== "string" || !INVOICE.test(held.invoice_id)))) throw new SeriesError("ledger_unavailable");
      const amount = data.resident ? event.prices.residentUsd : event.prices.nonresidentUsd;
      const ngaCents = Math.round(amount * 100 * release.ngaRevenueShare);
      const metadata = { ...baseSeriesMetadata(release), event_key: eventKey, division: data.division, resident: String(data.resident), amount_usd: amount.toFixed(2),
        nga_revenue_share: String(release.ngaRevenueShare), nga_share_usd: (ngaCents / 100).toFixed(2), mvf_share_usd: ((amount * 100 - ngaCents) / 100).toFixed(2),
        nga_capacity_submission_id: data.submissionId, parent_name: data.parentName, parent_email: data.email, parent_phone: data.phone,
        child_first_name: data.childFirstName, child_last_name: data.childLastName, child_dob: data.childDob,
        emergency_name: data.emergencyName, emergency_phone: data.emergencyPhone, allergies: data.allergies,
        sms_consent: String(data.smsConsent), sms_consent_text: data.smsConsent ? SMS_CONSENT_TEXT : "", waiver_accepted: "true", policy_accepted: "true" };
      if (held.invoice_id) {
        const existing = await stripe.invoices.retrieve(String(held.invoice_id));
        invoiceRelease(existing, { event: eventSlug, revision: release.revision, invoice: existing.id, submission: data.submissionId, purpose: "receipt", expires: 0 });
      }
      const { invoice } = await deps.invoice({ customerEmail: data.email, customerName: invoiceSafeName(data.parentName, "Parent"),
        items: [{ description: `MVF Junior Tournament — ${event.monthLabel} — ${data.division.toUpperCase()} — ${invoiceSafeName(data.childFirstName)}`, amountCents: amount * 100 }],
        metadata, memo: `MVF Junior Tournament — ${release.date} — ${data.division.toUpperCase()}`,
        footer: `${release.cancellationPolicy} ${release.rainPolicy}`, daysUntilDue: release.invoiceDueDays,
        idempotencyKey: `nga-series-${eventSlug}-${data.submissionId}`, existingInvoiceId: held.invoice_id ? String(held.invoice_id) : undefined,
        beforeFinalize: async invoiceId => { await deps.command(eventKey, "bind", { submission_id: data.submissionId, invoice_id: invoiceId }); await deps.roster(invoiceId, metadata); },
        beforeSend: async payable => {
          invoiceRelease(payable, { event: eventSlug, revision: release.revision, invoice: payable.id, submission: data.submissionId, purpose: "receipt", expires: 0 });
          if (payable.status !== "open" || payable.amount_due !== amount * 100 || payable.amount_paid !== 0 || payable.amount_remaining !== amount * 100) throw new SeriesError("invoice_amount_unverified");
        },
      });
      invoiceRelease(invoice);
      let notificationPending = false;
      if (invoice.status === "open") { try { await notices(invoice, "pending"); } catch { notificationPending = true; } }
      const token = seriesToken({ event: eventSlug, revision: release.revision, invoice: invoice.id, submission: data.submissionId, purpose: "receipt" }, deps.now());
      return { invoiceId: invoice.id, status: invoice.status === "paid" ? "paid" : "pending", receiptUrl: `/mvf-junior-tournament/${eventSlug}/status#receipt=${token}`, notificationPending };
    },

    async receipt(event: string, token: unknown) {
      const scope = readSeriesToken(token, event, "receipt", deps.now());
      const stripe = await merchant();
      const invoice = await stripe.invoices.retrieve(scope.invoice);
      const { m, amount } = invoiceRelease(invoice, scope);
      const seat = await reservation(invoice);
      const paid = invoice.status === "paid" && invoice.amount_paid === amount && invoice.amount_remaining === 0;
      const state = paid && seat.state === "paid" ? "paid" : invoice.status === "void" && seat.state === "void" ? "cancelled" : invoice.status === "open" && seat.state === "payable" && invoice.amount_due === amount && invoice.amount_paid === 0 ? "pending" : "reconciliation_pending";
      return { status: state, amountUsd: amount / 100, division: m.division.toUpperCase(),
        payUrl: state === "pending" ? seriesPayUrl(invoice.hosted_invoice_url) : null,
        cancelToken: state === "pending" ? seriesToken({ ...scope, purpose: "cancel" }, deps.now()) : null };
    },

    async cancel(event: string, token: unknown) {
      const scope = readSeriesToken(token, event, "cancel", deps.now());
      if (!deps.financialWritesAllowed()) throw new SeriesError("production_only", 409);
      const stripe = await merchant();
      let invoice = await stripe.invoices.retrieve(scope.invoice);
      const { m } = invoiceRelease(invoice, scope);
      const seat = await reservation(invoice);
      if (invoice.status === "paid" || invoice.amount_paid !== 0 || seat.state === "paid") throw new SeriesError("paid_cancellation_requires_review", 409);
      if (invoice.status !== "open" && invoice.status !== "void") throw new SeriesError("invoice_requires_review", 409);
      if (invoice.status !== "void") await stripe.invoices.voidInvoice(invoice.id, {}, { idempotencyKey: `nga-series-void-${invoice.id}` });
      invoice = await stripe.invoices.retrieve(invoice.id);
      invoiceRelease(invoice, scope);
      if (invoice.status !== "void" || invoice.amount_paid !== 0) throw new SeriesError("provider_void_unconfirmed");
      await deps.command(m.event_key, "void", { invoice_id: invoice.id });
      await deps.updateRoster(invoice.id, m, "void");
      await notices(invoice, "void");
      return { status: "cancelled", refundInitiated: false };
    },

    async webhook(event: Stripe.Event) {
      if (!["invoice.paid", "invoice.payment_succeeded", "invoice.voided"].includes(event.type)) return { received: true, skipped: "unsupported_series_event" };
      if (!deps.financialWritesAllowed()) throw new SeriesError("production_only", 409);
      const input = event.data.object as Stripe.Invoice;
      if (event.livemode !== true || !INVOICE.test(input.id)) throw new SeriesError("invoice_unverified");
      const stripe = await merchant(event.account);
      const invoice = await stripe.invoices.retrieve(input.id);
      const { m, amount } = invoiceRelease(invoice);
      if (invoice.livemode !== true) throw new SeriesError("invoice_unverified");
      await reservation(invoice);
      if (event.type === "invoice.voided") {
        if (invoice.status !== "void" || invoice.amount_paid !== 0) throw new SeriesError("provider_void_unconfirmed");
        await deps.command(m.event_key, "void", { invoice_id: invoice.id });
        await deps.updateRoster(invoice.id, m, "void");
        await notices(invoice, "void");
      } else {
        if (invoice.status !== "paid" || invoice.amount_paid !== amount || invoice.amount_due !== amount || invoice.amount_remaining !== 0 ||
          invoice.pre_payment_credit_notes_amount !== 0 || invoice.post_payment_credit_notes_amount !== 0 || (invoice as Stripe.Invoice & { paid_out_of_band?: boolean }).paid_out_of_band === true) throw new SeriesError("payment_unverified");
        const payments = await stripe.invoicePayments.list({ invoice: invoice.id, limit: 100 });
        const paid = payments.data.filter(p => p.status === "paid");
        if (payments.has_more || paid.length !== 1 || paid[0].livemode !== true || paid[0].invoice !== invoice.id || paid[0].currency !== "usd" || paid[0].amount_paid !== amount || paid[0].amount_requested !== amount || paid[0].payment.type !== "payment_intent" || typeof paid[0].payment.payment_intent !== "string") throw new SeriesError("payment_unverified");
        const intent = await stripe.paymentIntents.retrieve(paid[0].payment.payment_intent);
        if (intent.id !== paid[0].payment.payment_intent || intent.livemode !== true || intent.status !== "succeeded" || intent.amount !== amount || intent.amount_received !== amount || intent.currency !== "usd" || intent.customer !== invoice.customer || intent.on_behalf_of || intent.transfer_data || hasForeignPaymentOwner(intent.metadata) || typeof intent.latest_charge !== "string") throw new SeriesError("payment_unverified");
        const charge = await stripe.charges.retrieve(intent.latest_charge);
        if (charge.id !== intent.latest_charge || charge.livemode !== true || charge.payment_intent !== intent.id || !charge.paid || !charge.captured || charge.amount !== amount || charge.amount_captured !== amount || charge.amount_refunded !== 0 || charge.refunded || charge.disputed || charge.currency !== "usd" || charge.on_behalf_of || charge.transfer_data || hasForeignPaymentOwner(charge.metadata)) throw new SeriesError("payment_unverified");
        const refunds = await stripe.refunds.list({ charge: charge.id, limit: 100 });
        if (refunds.has_more || refunds.data.length) throw new SeriesError("payment_unverified");
        await deps.command(m.event_key, "paid", { invoice_id: invoice.id });
        await deps.updateRoster(invoice.id, m, "paid");
        await notices(invoice, "paid");
      }
      return { received: true, mvfSeries: true };
    },
  };
}

export const mvfSeriesService = createSeriesService();
