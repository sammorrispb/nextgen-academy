import type Stripe from "stripe";
import { createSeriesService } from "../../src/lib/mvf-series-service";
import { getStripe } from "../../src/lib/stripe";
import { FakeStripeInvoicing } from "./fake-stripe-invoices";
import { DenyProviderNetwork } from "./deny-provider-network";
import { FetchStub } from "./fetch-stub";
import { type SeriesRelease, type SeriesRegistration } from "../../src/data/mvf-series-registration";

// Synthetic policy values are fixtures, never the production release registry.
export const syntheticRelease = (event = "november-2026"): SeriesRelease => ({ event, revision: "synthetic-v1", date: "2027-02-20", startTime: "10:00 AM", endTime: "1:00 PM", registrationClosesAt: "2027-02-10T15:00:00Z", eligibility: { "12u": { minAge: 6, maxAge: 12 }, "16u": { minAge: 13, maxAge: 16 } }, multipleBrackets: false, eligibilityText: "Synthetic eligibility for offline tests only.", minimumEnrollmentPolicy: "Synthetic operator review.", cancellationPolicy: "Synthetic cancellation policy.", rainPolicy: "Synthetic indoor plan.", invoiceDueDays: 7, ngaRevenueShare: 0.8 });
export const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
export const registration = (n = 1, changes: Partial<SeriesRegistration> = {}): SeriesRegistration => ({ division: "12u", resident: true, parentName: "Synthetic Guardian", email: "guardian@example.invalid", phone: "2025550100", childFirstName: "Synthetic", childLastName: `Fixture ${n}`, childDob: "2016-02-20", emergencyName: "Synthetic Backup", emergencyPhone: "2025550101", allergies: "synthetic medical notes", smsConsent: false, policyAccepted: true, revision: "synthetic-v1", submissionId: uuid(n), ...changes });
type Seat = { event_key: string; submission_id: string; attendee_key: string; request_key: string; invoice_id: string | null; state: string; created_at: string; rosterClaimed?: boolean; invoiceSent?: boolean; review_required?: boolean; publication?: { token: string; phase: string } };
type Page = { id: string; parent: { database_id: string }; archived: boolean; properties: Record<string, unknown> };

export class SeriesHarness {
  readonly stub = new FetchStub();
  readonly network = new DenyProviderNetwork();
  readonly fake = new FakeStripeInvoicing();
  readonly seats = new Map<string, Seat>();
  readonly pages: Page[] = [];
  readonly mails: Record<string, unknown>[] = [];
  readonly deliveries = new Map<string, { accepted: boolean; busy: boolean; hash: string; lease: string; provider: string }>();
  readonly statuses = new Map<string, "paid" | "void">();
  failNotionCreate = false;
  loseNotionResponse = false;
  waiver = true;
  merchantId = "acct_1TU4iSBpXOfTC961";
  refunded = false;
  disputed = false;
  creditCents = 0;
  refundEvidence = false;
  paymentEvidenceUnavailable = false;
  ready = true;
  admission = true;
  bindFailure = false;
  noticeFailure = false;
  voidLoss = false;
  voids = 0;
  sendExpired = false;
  accountReads = 0;
  readonly stripe = getStripe();
  private undo: Array<() => void> = [];
  readonly service = createSeriesService({ active: event => this.admission ? syntheticRelease(event) : undefined, release: (event, rev) => rev === "synthetic-v1" ? syntheticRelease(event) : undefined, now: () => Date.parse("2026-10-30T12:00:00Z"), financialWritesAllowed: () => true });
  install() {
    this.undo.push(this.fake.install(this.stripe));
    const patch = (object: object, key: string, value: unknown) => { const record = object as Record<string, unknown>; const old = record[key]; record[key] = value; this.undo.push(() => { record[key] = old; }); };
    patch(this.stripe.accounts, "retrieve", async () => { this.accountReads++; return { id: this.merchantId, charges_enabled: true }; });
    const read = this.stripe.invoices.retrieve.bind(this.stripe.invoices);
    patch(this.stripe.invoices, "retrieve", async (id: string) => {
      const invoice = await read(id); const amount = invoice.total;
      return { ...invoice, status: this.statuses.get(id) ?? invoice.status, livemode: true,
        amount_due: amount, amount_paid: this.statuses.get(id) === "paid" ? amount : 0, amount_remaining: this.statuses.get(id) ? 0 : amount,
        pre_payment_credit_notes_amount: 0, post_payment_credit_notes_amount: this.creditCents, on_behalf_of: null,
        hosted_invoice_url: `https://invoice.stripe.com/i/${id}` };
    });
    patch(this.stripe.invoices, "voidInvoice", async (id: string) => { this.voids++; this.statuses.set(id, "void"); if (this.voidLoss) { this.voidLoss = false; throw new Error("synthetic lost response"); } return this.stripe.invoices.retrieve(id); });
    patch(this.stripe.invoicePayments, "list", async ({ invoice, payment }: { invoice?: string; payment?: { payment_intent: string } }) => { if (this.paymentEvidenceUnavailable) throw new Error("synthetic provider unavailable"); const id = invoice ?? payment!.payment_intent.slice(3); const value = await this.stripe.invoices.retrieve(id); return { has_more: false, data: [{ invoice: id, livemode: true, status: "paid", currency: "usd", amount_paid: value.total, amount_requested: value.total, payment: { type: "payment_intent", payment_intent: `pi_${id}` } }] }; });
    patch(this.stripe.paymentIntents, "retrieve", async (id: string) => { const value = await this.stripe.invoices.retrieve(id.slice(3)); return { id, livemode: true, status: "succeeded", currency: "usd", amount: value.total, amount_received: value.total, customer: value.customer, latest_charge: `ch_${id}`, metadata: {}, on_behalf_of: null, transfer_data: null }; });
    patch(this.stripe.charges, "retrieve", async (id: string) => { const value = await this.stripe.invoices.retrieve(id.slice(6)); return { id, livemode: true, paid: true, captured: true, amount: value.total, amount_captured: value.total, amount_refunded: this.refunded ? value.total : 0, refunded: this.refunded, disputed: this.disputed, currency: "usd", payment_intent: id.slice(3), metadata: {}, on_behalf_of: null, transfer_data: null }; });
    patch(this.stripe.refunds, "list", async () => ({ data: this.refundEvidence ? [{ id: "re_synthetic", status: "pending" }] : [], has_more: false }));
    this.stub.onDynamic("/nga-series-registration", call => {
      const input = JSON.parse(call.body); const ok = (data: object) => ({ status: 200, json: { ok: true, event_key: input.event_key, ...data } });
      const bad = (error: string) => ({ status: 409, json: { error } });
      if (input.action === "reserve") {
        if (!this.ready) return bad("not_ready");
        const identity = `${input.event_key}:${input.submission_id}`; let seat = this.seats.get(identity);
        if (seat && (seat.request_key !== input.request_key || seat.attendee_key !== input.attendee_key)) return bad("request_conflict");
        if (seat?.state === "void") return bad("closed");
        if (!seat) {
          if ([...this.seats.values()].some(s => s.event_key.replace(/-(12u|16u)$/, "") === input.event_key.replace(/-(12u|16u)$/, "") && s.attendee_key === input.attendee_key && s.state !== "void")) return bad("duplicate");
          if ([...this.seats.values()].filter(s => s.event_key === input.event_key && s.state !== "void").length >= 10) return bad("full");
          seat = { ...input, invoice_id: null, state: "held", created_at: "2026-10-30T12:00:00Z" }; this.seats.set(identity, seat!);
        }
        return ok(seat!);
      }
      const seat = [...this.seats.values()].find(s => s.event_key === input.event_key && (input.action === "bind" ? s.submission_id === input.submission_id : s.invoice_id === input.invoice_id));
      if (!seat) return bad("missing");
      if (input.action === "bind") {
        if (this.bindFailure) return bad("request_conflict");
        if (seat.invoice_id && seat.invoice_id !== input.invoice_id) return bad("request_conflict");
        seat.invoice_id = input.invoice_id; if (seat.state !== "paid") seat.state = "payable";
      }
      if (input.action === "roster_claim") { const claimed = !seat.rosterClaimed; seat.rosterClaimed = true; return ok({ invoice_id: seat.invoice_id, claimed }); }
      if (input.action === "send_claim") { if (!seat.invoiceSent && this.sendExpired) return bad("delivery_uncertain"); return ok({ invoice_id: seat.invoice_id, state: seat.invoiceSent ? "sent" : "leased" }); }
      if (input.action === "send_done") { seat.invoiceSent = true; return ok({ invoice_id: seat.invoice_id, recorded: true }); }
      if (input.action === "paid") { if (seat.state === "void") return bad("closed"); seat.state = "paid"; }
      if (input.action === "void") { if (seat.state === "paid") return bad("paid"); seat.state = "void"; }
      if (input.action === "publication_claim") {
        if (seat.state !== "paid") return bad("closed");
        if (seat.publication && seat.publication.token !== input.publication_token) return bad("publication_busy");
        if (input.phase === "paid" && seat.review_required) return ok({ invoice_id: seat.invoice_id, claimed: false, review_required: true });
        if (seat.publication && seat.publication.phase !== input.phase) return bad("publication_mismatch");
        seat.publication = { token: input.publication_token, phase: input.phase };
        seat.review_required ||= input.phase === "review";
        return ok({ invoice_id: seat.invoice_id, claimed: true, review_required: !!seat.review_required, lease_token: input.publication_token });
      }
      if (["publication_check", "publication_review", "publication_done"].includes(input.action)) {
        if (!seat.publication || seat.publication.token !== input.publication_token) return bad("publication_mismatch");
        if (input.action === "publication_check" && (seat.publication.phase !== input.phase || (input.phase === "paid" && seat.review_required))) return bad("publication_mismatch");
        if (input.action === "publication_review") { seat.review_required = true; seat.publication.phase = "review"; }
        if (input.action === "publication_done") delete seat.publication;
        return ok({ invoice_id: seat.invoice_id, recorded: true });
      }
      if (input.action.startsWith("notify_")) {
        if (input.phase === "paid" && (!seat.publication || seat.publication.token !== input.publication_token || seat.publication.phase !== "paid" || seat.review_required)) return bad("publication_mismatch");
        const key = `${input.invoice_id}:${input.phase}:${input.recipient}`;
        let delivery = this.deliveries.get(key);
        if (input.action === "notify_done") { if (!delivery || delivery.lease !== input.lease_token) return bad("request_conflict"); delivery.accepted = true; return ok({ invoice_id: seat.invoice_id, recorded: true }); }
        if (delivery && delivery.hash !== input.payload_sha256) return bad("payload_conflict");
        if (delivery?.accepted) return ok({ invoice_id: seat.invoice_id, state: "accepted" });
        if (delivery?.busy) return bad("delivery_busy");
        delivery ??= { accepted: false, busy: false, hash: input.payload_sha256, lease: uuid(500 + this.deliveries.size), provider: `nga-series-${uuid(900 + this.deliveries.size)}` };
        delivery.busy = true; this.deliveries.set(key, delivery);
        return ok({ invoice_id: seat.invoice_id, state: "leased", lease_token: delivery.lease, provider_key: delivery.provider });
      }
      return ok({ ...seat, review_required: !!seat.review_required, publication_pending: !!seat.publication });
    });
    this.stub.onDynamic("api.notion.com", call => {
      const body = call.body ? JSON.parse(call.body) : undefined;
      if (call.url.includes("/waiver") || call.url.includes(process.env.NOTION_WAIVERS_DB_ID!)) return { status: 200, json: { results: this.waiver ? [{}] : [] } };
      if (call.method === "GET") {
        const types: Record<string, string> = { "Parent Name": "title", "Parent Email": "email", "Parent Phone": "phone_number", "Child First Name": "rich_text", "Child Last Name": "rich_text", "Child DOB": "date", "Event Key": "rich_text", "Policy Revision": "rich_text", Division: "select", Resident: "checkbox", Status: "select", Paid: "checkbox", "Amount Due": "number", "Amount Paid": "number", "Stripe Invoice ID": "rich_text", "Emergency Name": "rich_text", "Emergency Phone": "phone_number", Allergies: "rich_text", "SMS Consent": "checkbox", "SMS Consent Text": "rich_text" };
        return { status: 200, json: { properties: Object.fromEntries(Object.entries(types).map(([key, type]) => [key, { type, ...(type === "select" ? { select: { options: (key === "Division" ? ["12U", "16U"] : ["Pending", "Confirmed", "Cancelled", "Review required"]).map(name => ({ name })) } } : {}) }])) } };
      }
      if (call.url.endsWith("/query")) { const id = body.filter.rich_text.equals; return { status: 200, json: { results: this.pages.filter(p => (p.properties["Stripe Invoice ID"] as { rich_text: { plain_text: string }[] }).rich_text[0].plain_text === id), has_more: false } }; }
      const normalize = (properties: Record<string, unknown>) => Object.fromEntries(Object.entries(properties).map(([key, value]) => {
        const p = value as { rich_text?: { text: { content: string } }[]; title?: { text: { content: string } }[] };
        return [key, p.rich_text ? { rich_text: p.rich_text.map(t => ({ plain_text: t.text.content })) } : p.title ? { title: p.title.map(t => ({ plain_text: t.text.content })) } : p];
      }));
      if (call.method === "POST" && call.url.endsWith("/pages")) {
        if (this.failNotionCreate) return { status: 500, json: {} };
        const page = { id: uuid(200 + this.pages.length), archived: false, parent: body.parent, properties: normalize(body.properties) }; this.pages.push(page);
        if (this.loseNotionResponse) { this.loseNotionResponse = false; return { status: 503, json: {} }; }
        return { status: 200, json: page };
      }
      const page = this.pages.find(p => call.url.endsWith(p.id)); if (!page) return { status: 404, json: {} };
      Object.assign(page.properties, normalize(body.properties)); return { status: 200, json: page };
    });
    this.stub.onDynamic("api.resend.com", call => { if (this.noticeFailure) return { status: 503, json: {} }; this.mails.push(JSON.parse(call.body)); return { status: 200, json: { id: uuid(700 + this.mails.length) } }; });
    this.stub.install(); this.network.install();
    return this;
  }
  event(invoiceId: string, type: "invoice.paid" | "invoice.payment_succeeded" | "invoice.voided" = "invoice.paid"): Stripe.Event {
    return { id: `evt_${invoiceId}`, type, livemode: true, created: 1793361600, data: { object: { id: invoiceId } } } as Stripe.Event;
  }
  token(result: { receiptUrl: string }) { return result.receiptUrl.split("#receipt=")[1]; }
  close() { this.network.uninstall(); this.stub.uninstall(); for (const undo of this.undo.reverse()) undo(); }
}
