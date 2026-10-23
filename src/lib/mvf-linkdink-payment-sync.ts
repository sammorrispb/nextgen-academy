import { createHmac } from "node:crypto";
import type Stripe from "stripe";
import { MVF_JUNIOR_TOURNAMENT_DATE_ISO, MVF_JUNIOR_TOURNAMENT_KIND, isCalendarDob, resolveTournamentPriceUsd } from "@/data/mvf-junior-tournament-2026";
import { buildMvfRosterSyncBody, LD_TIMEOUT_MS, mvfTournamentLdEventKey } from "@/lib/linkdink-roster-sync";
import { mvfAttendeeKey } from "@/lib/mvf-capacity";
import { EMAIL_RE, NOTION_API, NOTION_VERSION, readPlainText } from "@/lib/notion-utils";
import { hasForeignPaymentOwner, PAYMENT_OWNER } from "@/lib/payment-ownership";
import { getStripe } from "@/lib/stripe";

const ACCOUNT = "acct_1TU4iSBpXOfTC961";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export class MvfPaymentSyncRefusal extends Error {
  constructor(readonly code: string = "payment_verification_required", readonly status = 409) { super(code); }
}
export interface MvfLinkDinkPaymentBody {
  event_key: string; account_id: string; invoice_id: string; submission_id: string;
  attendee_key: string; roster_key: string; amount_paid_cents: number; currency: "usd";
  paid_at: string; resident: boolean; payment_intent_id: string;
}
export interface MvfLinkDinkPaymentProof { body: MvfLinkDinkPaymentBody; sourceRevision: string }
type Property = { rich_text?: { plain_text?: string }[]; email?: string | null; select?: { name?: string } | null; date?: { start?: string } | null; checkbox?: boolean };
type Page = { id?: string; archived?: boolean; in_trash?: boolean; last_edited_time?: string; parent?: { database_id?: string }; properties?: Record<string, Property> };
function refuse(): never { throw new MvfPaymentSyncRefusal(); }
function configured() {
  const secret = process.env.NGA_SYNC_SECRET;
  const notionKey = process.env.NOTION_API_KEY;
  const db = process.env.NOTION_MVF_TOURNAMENT_REGS_DB_ID;
  const override = process.env.LINKDINK_BASE_URL;
  if (process.env.VERCEL_ENV === "production" && override && override !== "https://www.linkanddink.com") {
    throw new MvfPaymentSyncRefusal("not_configured", 503);
  }
  if (!secret || !notionKey || !db || !process.env.STRIPE_SECRET_KEY ||
      (!process.env.LINKDINK_BASE_URL && process.env.VERCEL_ENV !== "production")) {
    throw new MvfPaymentSyncRefusal("not_configured", 503);
  }
  return { secret, notionKey, db };
}
function id(value: string | { id: string } | null | undefined) { return typeof value === "string" ? value : value?.id; }
const normalizeEmail = (s: string) => s.trim().toLowerCase();

/** Fresh provider truth plus an exact single native registration. Never a
 * Notion paid checkbox, webhook snapshot, client identity or client paid flag.
 * No admission/age validation: this reconciles an existing approved entry. */
export async function prepareMvfLinkDinkPayment(invoiceId: string, eventAccount?: string): Promise<MvfLinkDinkPaymentProof> {
  const { secret, notionKey, db } = configured();
  if (!/^in_[A-Za-z0-9]{1,250}$/.test(invoiceId) || (eventAccount && eventAccount !== ACCOUNT)) refuse();
  const stripe = getStripe();
  let invoice: Stripe.Invoice;
  try {
    if ((await stripe.accounts.retrieve(null)).id !== ACCOUNT) refuse();
    invoice = await stripe.invoices.retrieve(invoiceId);
  } catch (error) { if (error instanceof MvfPaymentSyncRefusal) throw error; throw new MvfPaymentSyncRefusal("payment_provider_unavailable", 502); }
  const m = invoice.metadata ?? {};
  const division = m.division;
  const eventKey = mvfTournamentLdEventKey(division);
  const resident = m.resident === "true";
  const amount = resolveTournamentPriceUsd(resident) * 100;
  const paid = invoice.status_transitions?.paid_at;
  const email = normalizeEmail(m.parent_email ?? "");
  if (invoice.id !== invoiceId || invoice.livemode !== true || invoice.status !== "paid" || invoice.currency !== "usd" ||
      !/^cus_[A-Za-z0-9]{1,250}$/.test(id(invoice.customer) ?? "") || invoice.status_transitions?.voided_at ||
      invoice.amount_paid !== amount || invoice.amount_due !== amount || invoice.total !== amount || invoice.amount_remaining !== 0 ||
      invoice.pre_payment_credit_notes_amount !== 0 || invoice.post_payment_credit_notes_amount !== 0 ||
      (invoice as Stripe.Invoice & { paid_out_of_band?: boolean }).paid_out_of_band === true ||
      invoice.on_behalf_of || (invoice as Stripe.Invoice & { transfer_data?: unknown }).transfer_data ||
      m.kind !== MVF_JUNIOR_TOURNAMENT_KIND || m.payment_owner !== PAYMENT_OWNER || hasForeignPaymentOwner(m) ||
      m.event_date !== MVF_JUNIOR_TOURNAMENT_DATE_ISO || !eventKey || !["true", "false"].includes(m.resident ?? "") ||
      m.amount_usd !== (amount / 100).toFixed(2) || !UUID.test(m.nga_capacity_submission_id ?? "") ||
      !EMAIL_RE.test(email) || normalizeEmail(invoice.customer_email ?? "") !== email ||
      !m.child_first_name?.trim() || !m.child_last_name?.trim() || !isCalendarDob(m.child_dob ?? "") ||
      !Number.isSafeInteger(paid) || !paid || paid <= 0 || paid * 1000 > Date.now()) refuse();
  let paymentIntentId: string;
  try {
    // One native per-player invoice has one complete successful invoice payment.
    // Ambiguous/multiple payments and manual payment records need review.
    const payments = await stripe.invoicePayments.list({ invoice: invoiceId, limit: 100 });
    const successful = payments.data.filter(p => p.status === "paid");
    if (payments.has_more || successful.length !== 1) refuse();
    const payment = successful[0];
    paymentIntentId = id(payment.payment.payment_intent) ?? "";
    if (id(payment.invoice) !== invoiceId || payment.livemode !== true || payment.currency !== "usd" ||
        payment.amount_paid !== amount || payment.amount_requested !== amount || payment.payment.type !== "payment_intent" ||
        !/^pi_[A-Za-z0-9]{1,250}$/.test(paymentIntentId) || !Number.isSafeInteger(payment.status_transitions.paid_at) ||
        !payment.status_transitions.paid_at || payment.status_transitions.paid_at <= 0 || payment.status_transitions.paid_at * 1000 > Date.now() || payment.status_transitions.canceled_at) refuse();
    const intent = await stripe.paymentIntents.retrieve(paymentIntentId);
    if (intent.id !== paymentIntentId || intent.livemode !== true || intent.status !== "succeeded" || intent.currency !== "usd" ||
        intent.canceled_at || intent.amount !== amount || intent.amount_received !== amount || id(intent.customer) !== id(invoice.customer) ||
        intent.on_behalf_of || intent.transfer_data || hasForeignPaymentOwner(intent.metadata)) refuse();
    const chargeId = id(intent.latest_charge);
    if (!chargeId || !/^ch_[A-Za-z0-9]{1,250}$/.test(chargeId)) refuse();
    const charge = await stripe.charges.retrieve(chargeId);
    if (charge.id !== chargeId || charge.livemode !== true || charge.status !== "succeeded" || charge.paid !== true ||
        charge.captured !== true || charge.currency !== "usd" || charge.amount !== amount || charge.amount_captured !== amount ||
        charge.amount_refunded !== 0 || charge.refunded !== false || charge.disputed !== false || id(charge.payment_intent) !== paymentIntentId ||
        charge.on_behalf_of || charge.transfer_data || hasForeignPaymentOwner(charge.metadata)) refuse();
    const refunds = await stripe.refunds.list({ charge: chargeId, limit: 100 });
    if (refunds.has_more || refunds.data.length) refuse();
  } catch (error) { if (error instanceof MvfPaymentSyncRefusal) throw error; throw new MvfPaymentSyncRefusal("payment_provider_unavailable", 502); }
  let rows: { results?: Page[]; has_more?: boolean };
  try {
    const response = await fetch(`${NOTION_API}/databases/${db}/query`, {
      method: "POST", headers: { Authorization: `Bearer ${notionKey}`, "Content-Type": "application/json", "Notion-Version": NOTION_VERSION },
      body: JSON.stringify({ filter: { property: "Stripe Invoice ID", rich_text: { equals: invoiceId } }, page_size: 2 }),
      cache: "no-store", redirect: "error", signal: AbortSignal.timeout(LD_TIMEOUT_MS),
    });
    if (!response.ok) throw new Error();
    rows = await response.json();
  } catch { throw new MvfPaymentSyncRefusal("registration_lookup_failed", 502); }
  if (!Array.isArray(rows.results) || rows.has_more !== false || rows.results.length !== 1) throw new MvfPaymentSyncRefusal("registration_ambiguous", 409);
  const row = rows.results[0]; const p = row.properties;
  if (!row.id || !UUID.test(row.id) || !row.last_edited_time || !Number.isFinite(Date.parse(row.last_edited_time)) || row.archived || row.in_trash ||
      row.parent?.database_id?.replaceAll("-", "") !== db.replaceAll("-", "") || readPlainText(p?.["Stripe Invoice ID"]) !== invoiceId ||
      normalizeEmail(p?.["Parent Email"]?.email ?? "") !== email || readPlainText(p?.["Child First Name"]) !== m.child_first_name ||
      readPlainText(p?.["Child Last Name"]) !== m.child_last_name || p?.["Child DOB"]?.date?.start !== m.child_dob ||
      p?.Division?.select?.name !== division.toUpperCase() || !["Pending", "Confirmed"].includes(p?.Status?.select?.name ?? "") ||
      p?.Resident?.checkbox !== resident) throw new MvfPaymentSyncRefusal("registration_ineligible", 409);
  const roster = buildMvfRosterSyncBody({ division, childFirstName: m.child_first_name, childLastName: m.child_last_name, parentEmail: email });
  if (!roster?.first_name || !roster.last_name) refuse();
  // Must remain byte-compatible with P3 ngaSyncKey on the cleaned roster wire.
  const material = [email, roster.first_name.trim().toLowerCase(), roster.last_name.trim().toLowerCase()].join("|");
  const rosterKey = "nga:" + createHmac("sha256", secret).update(`nga-roster-sync:${material}`).digest("base64url").slice(0, 22);
  const body: MvfLinkDinkPaymentBody = { event_key: eventKey, account_id: ACCOUNT, invoice_id: invoiceId,
    submission_id: m.nga_capacity_submission_id, attendee_key: mvfAttendeeKey({ division, email, childFirstName: m.child_first_name, childLastName: m.child_last_name, childDob: m.child_dob }),
    roster_key: rosterKey, amount_paid_cents: amount, currency: "usd", paid_at: new Date(paid * 1000).toISOString(), resident, payment_intent_id: paymentIntentId };
  return { body, sourceRevision: createHmac("sha256", secret).update(JSON.stringify(["nga-paid-proof-v1", row.id, row.last_edited_time, body])).digest("hex") };
}

/** Durable pending_roster is success; L&D consumes it on protected import.
 * An unverified response or lost connection MUST request a retry. */
export async function sendMvfLinkDinkPayment(proof: MvfLinkDinkPaymentProof, dryRun: boolean): Promise<"paid" | "pending_roster"> {
  const { secret } = configured();
  // Production uses the fixed origin. Explicit non-production overrides
  // support synthetic integration, as in the existing roster/capacity lane.
  const origin = process.env.LINKDINK_BASE_URL || "https://www.linkanddink.com";
  try {
    const url = new URL(origin);
    if (url.username || url.password || (url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname)))) throw new Error();
    const response = await fetch(new URL("/play/api/internal/nga-roster-payment", url), {
      method: "POST", redirect: "error", cache: "no-store", signal: AbortSignal.timeout(LD_TIMEOUT_MS),
      headers: { "content-type": "application/json", "x-nga-sync-secret": secret }, body: JSON.stringify({ ...proof.body, dry_run: dryRun }),
    });
    const result = await response.json() as Record<string, unknown>;
    if (!response.ok || result.ok !== true || result.dry_run !== dryRun || result.event_key !== proof.body.event_key ||
        result.invoice_id !== proof.body.invoice_id || !["paid", "pending_roster"].includes(String(result.status)) ||
        (result.status === "paid" ? typeof result.rsvp_id !== "string" || !UUID.test(result.rsvp_id) : result.rsvp_id !== null)) throw new Error();
    return result.status as "paid" | "pending_roster";
  } catch { throw new MvfPaymentSyncRefusal("payment_sync_unavailable", 502); }
}
export async function syncMvfPaymentToLinkDink(invoiceId: string, eventAccount?: string) {
  return sendMvfLinkDinkPayment(await prepareMvfLinkDinkPayment(invoiceId, eventAccount), false);
}
