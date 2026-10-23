import { test, expect } from "@playwright/test";
import { NextRequest } from "next/server";
import { createAdminSessionValue } from "../src/lib/admin-auth";
import { POST as adminSync } from "../src/app/api/admin/mvf-roster-sync/route";
import { FetchStub } from "./fixtures/fetch-stub";
import { getStripe } from "../src/lib/stripe";
import { prepareMvfLinkDinkPayment, sendMvfLinkDinkPayment } from "../src/lib/mvf-linkdink-payment-sync";

const KEYS = ["STRIPE_SECRET_KEY", "NGA_SYNC_SECRET", "NOTION_API_KEY", "NOTION_MVF_TOURNAMENT_REGS_DB_ID", "VERCEL_ENV", "LINKDINK_BASE_URL", "COACH_SIGNING_SECRET", "ADMIN_ALLOWLIST", "NEXT_PUBLIC_SITE_URL", "VERCEL_URL"] as const;
const saved = Object.fromEntries(KEYS.map(k => [k, process.env[k]]));
const ACCOUNT = "acct_1TU4iSBpXOfTC961";
const DB = "11111111222233334444555555555555";
const INV = "in_syntheticPayment";
const PI = "pi_syntheticPayment";
const SUBMISSION = "11111111-2222-4333-8444-555555555555";
const EVENT = "mvf-junior-tournament-14u-2026-10-24";
const stub = new FetchStub();
let invoice: Record<string, unknown>;
let payment: Record<string, unknown>;
let intent: Record<string, unknown>;
let charge: Record<string, unknown>;
let page: Record<string, unknown>;
let account: string;
let pages: Record<string, unknown>[];
let refunds: unknown[];
let hasMore: boolean;
let destinationFails: boolean;
let undo: () => void;
let cookie: string;
let pendingRoster: boolean;
function text(value: string) { return { rich_text: [{ plain_text: value }] }; }
function fixtures() {
  const metadata = { kind: "mvf-junior-tournament", payment_owner: "nga_site", event_date: "2026-10-24", division: "14u", resident: "false", amount_usd: "60.00", nga_capacity_submission_id: SUBMISSION, parent_email: "parent@example.com", child_first_name: "Synthetic", child_last_name: "Player", child_dob: "2010-03-15" };
  invoice = { id: INV, livemode: true, status: "paid", currency: "usd", amount_paid: 6000, amount_due: 6000, total: 6000, amount_remaining: 0, pre_payment_credit_notes_amount: 0, post_payment_credit_notes_amount: 0, customer: "cus_synthetic", customer_email: "parent@example.com", on_behalf_of: null, metadata, status_transitions: { paid_at: 1792770000 } };
  payment = { id: "inpay_synthetic", invoice: INV, livemode: true, status: "paid", amount_paid: 6000, amount_requested: 6000, currency: "usd", payment: { type: "payment_intent", payment_intent: PI }, status_transitions: { paid_at: 1792770000, canceled_at: null } };
  intent = { id: PI, livemode: true, status: "succeeded", currency: "usd", amount: 6000, amount_received: 6000, customer: "cus_synthetic", latest_charge: "ch_synthetic", metadata: {}, on_behalf_of: null, transfer_data: null };
  charge = { id: "ch_synthetic", livemode: true, status: "succeeded", paid: true, captured: true, currency: "usd", amount: 6000, amount_captured: 6000, amount_refunded: 0, refunded: false, disputed: false, payment_intent: PI, metadata: {}, on_behalf_of: null, transfer_data: null };
  page = { id: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee", last_edited_time: "2026-10-23T19:00:00Z", archived: false, in_trash: false, parent: { database_id: DB }, properties: { "Stripe Invoice ID": text(INV), "Parent Email": { email: "parent@example.com" }, "Child First Name": text("Synthetic"), "Child Last Name": text("Player"), "Child DOB": { date: { start: "2010-03-15" } }, Division: { select: { name: "14U" } }, Status: { select: { name: "Confirmed" } }, Resident: { checkbox: false }, Paid: { checkbox: true }, Allergies: text("NEVER_SEND"), "Parent Phone": { phone_number: "NEVER_SEND" } } };
  pages = [page]; account = ACCOUNT; refunds = []; hasMore = false; destinationFails = false; pendingRoster = false;
}
test.beforeEach(() => {
  for (const k of KEYS) delete process.env[k];
  Object.assign(process.env, { STRIPE_SECRET_KEY: "sk_live_synthetic_only", NGA_SYNC_SECRET: "synthetic-sync", NOTION_API_KEY: "synthetic-notion", NOTION_MVF_TOURNAMENT_REGS_DB_ID: DB, VERCEL_ENV: "production", COACH_SIGNING_SECRET: "synthetic-signing", ADMIN_ALLOWLIST: "admin@example.com" });
  cookie = createAdminSessionValue("admin@example.com");
  fixtures(); stub.reset(); stub.install();
  stub.on("api.notion.com", () => ({ results: pages, has_more: hasMore }));
  stub.onDynamic("/nga-roster-payment", c => { const b = JSON.parse(c.body); return { status: destinationFails ? 503 : 200, json: { ok: !destinationFails, status: pendingRoster ? "pending_roster" : "paid", event_key: b.event_key, invoice_id: b.invoice_id, rsvp_id: pendingRoster ? null : "12345678-1234-4234-8234-123456789012", dry_run: b.dry_run } }; });
  const stripe = getStripe();
  const old = { account: stripe.accounts.retrieve, invoice: stripe.invoices.retrieve, payments: stripe.invoicePayments.list, intent: stripe.paymentIntents.retrieve, charge: stripe.charges.retrieve, refunds: stripe.refunds.list };
  stripe.accounts.retrieve = (async () => ({ id: account })) as unknown as typeof old.account;
  stripe.invoices.retrieve = (async () => invoice) as unknown as typeof old.invoice;
  stripe.invoicePayments.list = (() => Promise.resolve({ data: [payment], has_more: false })) as unknown as typeof old.payments;
  stripe.paymentIntents.retrieve = (async () => intent) as unknown as typeof old.intent;
  stripe.charges.retrieve = (async () => charge) as unknown as typeof old.charge;
  stripe.refunds.list = (() => Promise.resolve({ data: refunds, has_more: false })) as unknown as typeof old.refunds;
  undo = () => { stripe.accounts.retrieve = old.account; stripe.invoices.retrieve = old.invoice; stripe.invoicePayments.list = old.payments; stripe.paymentIntents.retrieve = old.intent; stripe.charges.retrieve = old.charge; stripe.refunds.list = old.refunds; };
});
test.afterEach(() => { undo(); stub.uninstall(); });
test.afterAll(() => { for (const k of KEYS) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; } });

test("verified payment sends only opaque exact invoice/identity bindings, retaining real DOB privately", async () => {
  const proof = await prepareMvfLinkDinkPayment(INV);
  expect(proof.body).toMatchObject({ event_key: EVENT, account_id: ACCOUNT, invoice_id: INV, submission_id: SUBMISSION, amount_paid_cents: 6000, currency: "usd", resident: false, payment_intent_id: PI });
  expect(proof.body.attendee_key).toMatch(/^[0-9a-f]{64}$/);
  expect(proof.body.roster_key).toMatch(/^nga:[A-Za-z0-9_-]{22}$/);
  expect(JSON.stringify(proof)).not.toMatch(/parent@|Synthetic|Player|2010-|NEVER_SEND/);
  expect(await sendMvfLinkDinkPayment(proof, false)).toBe("paid");
  expect(stub.callsTo("linkanddink")).toHaveLength(1);
  expect(stub.callsTo("api.notion.com").every(c => c.method === "POST" && c.url.endsWith("/query"))).toBe(true);
});
for (const fault of ["wrong account", "unpaid", "out of band", "partial amount", "credit note", "wrong owner", "wrong kind", "wrong date", "amount metadata", "bad submission", "foreign invoice", "different parent", "different child", "different DOB", "wrong residency", "duplicate rows", "incomplete query", "archived", "cancelled", "pending PI", "wrong PI", "missing customer", "cancelled invoice", "cancelled PI", "wrong invoice payment", "not live", "refunded", "disputed", "pending refund", "transfer"]) {
  test(`${fault} refuses before any destination call`, async () => {
    const m = invoice.metadata as Record<string, string>; const p = page.properties as Record<string, unknown>;
    if (fault === "wrong account") account = "acct_other";
    if (fault === "unpaid") invoice.status = "open";
    if (fault === "out of band") invoice.paid_out_of_band = true;
    if (fault === "partial amount") invoice.amount_paid = 5000;
    if (fault === "credit note") invoice.post_payment_credit_notes_amount = 100;
    if (fault === "wrong owner") m.payment_owner = "coach_os";
    if (fault === "wrong kind") m.kind = "lesson";
    if (fault === "wrong date") m.event_date = "2026-10-25";
    if (fault === "amount metadata") m.amount_usd = "50.00";
    if (fault === "bad submission") m.nga_capacity_submission_id = "invalid";
    if (fault === "foreign invoice") invoice.id = "in_other";
    if (fault === "different parent") p["Parent Email"] = { email: "other@example.com" };
    if (fault === "different child") p["Child First Name"] = text("Other");
    if (fault === "different DOB") p["Child DOB"] = { date: { start: "2012-01-01" } };
    if (fault === "wrong residency") p.Resident = { checkbox: true };
    if (fault === "duplicate rows") pages = [page, page];
    if (fault === "incomplete query") hasMore = true;
    if (fault === "archived") page.archived = true;
    if (fault === "cancelled") p.Status = { select: { name: "Cancelled" } };
    if (fault === "pending PI") intent.status = "processing";
    if (fault === "wrong PI") intent.id = "pi_other";
    if (fault === "missing customer") { invoice.customer = null; intent.customer = null; }
    if (fault === "cancelled invoice") (invoice.status_transitions as Record<string, unknown>).voided_at = 1792770000;
    if (fault === "cancelled PI") intent.canceled_at = 1792770000;
    if (fault === "wrong invoice payment") payment.invoice = "in_other";
    if (fault === "not live") charge.livemode = false;
    if (fault === "refunded") charge.amount_refunded = 100;
    if (fault === "disputed") charge.disputed = true;
    if (fault === "pending refund") refunds = [{ status: "pending" }];
    if (fault === "transfer") intent.transfer_data = { destination: "acct_other" };
    await expect(prepareMvfLinkDinkPayment(INV)).rejects.toThrow(); expect(stub.callsTo("linkanddink")).toHaveLength(0);
  });
}
test("destination rejection stays retryable, never swallowed as completed", async () => {
  const proof = await prepareMvfLinkDinkPayment(INV); destinationFails = true;
  await expect(sendMvfLinkDinkPayment(proof, false)).rejects.toThrow();
});

async function admin(action: string, previewToken?: string, session = cookie) {
  const response = await adminSync(new NextRequest("https://nextgenpbacademy.com/api/admin/mvf-roster-sync", {
    method: "POST", headers: { origin: "https://nextgenpbacademy.com", "content-type": "application/json", cookie: `nga_admin=${session}` },
    body: JSON.stringify({ invoiceId: INV, action, ...(previewToken ? { previewToken } : {}) }),
  }));
  return { response, json: await response.json() };
}
test("admin payment-only preview/sync accepts a truthful overage existing registration without admission, invoice, roster add or mail", async () => {
  const preview = await admin("payment_preview");
  expect(preview.response.status).toBe(200); expect(preview.json.outcome).toBe("would_sync_payment");
  expect(preview.json.previewToken).toBeTruthy();
  expect(stub.callsTo("linkanddink").map(c => JSON.parse(c.body).dry_run)).toEqual([true]);
  const applied = await admin("payment_sync", preview.json.previewToken);
  expect(applied.response.status).toBe(200); expect(applied.json.outcome).toBe("payment_synced");
  expect(stub.callsTo("linkanddink").map(c => JSON.parse(c.body).dry_run)).toEqual([true, false]);
  expect(stub.callsTo("nga-roster-add")).toHaveLength(0); expect(stub.callsTo("resend")).toHaveLength(0);
  expect(stub.callsTo("api.notion.com").every(c => c.method === "POST" && c.url.endsWith("/query"))).toBe(true);
});
for (const fault of ["session", "source", "proof", "expired", "missing", "tampered"]) {
  test(`admin payment capability rejects ${fault} before destination writes`, async () => {
    const preview = await admin("payment_preview"); const now = Date.now; let session = cookie; let token = preview.json.previewToken;
    if (fault === "session") { process.env.ADMIN_ALLOWLIST += ",other@example.com"; session = createAdminSessionValue("other@example.com"); }
    if (fault === "source") page.last_edited_time = "2026-10-23T19:01:00Z";
    if (fault === "proof") (invoice.status_transitions as Record<string, unknown>).paid_at = 1792769000;
    if (fault === "expired") Date.now = () => now() + 601000;
    if (fault === "missing") token = undefined;
    if (fault === "tampered") token += "x";
    try { expect((await admin("payment_sync", token, session)).response.status).toBeGreaterThanOrEqual(400); }
    finally { Date.now = now; }
    expect(stub.callsTo("linkanddink").every(c => JSON.parse(c.body).dry_run === true)).toBe(true);
  });
}
test("pending payment receipt is reported separately from an existing paid roster entry", async () => {
  pendingRoster = true;
  const preview = await admin("payment_preview"); expect(preview.json.outcome).toBe("would_record_payment");
  const applied = await admin("payment_sync", preview.json.previewToken); expect(applied.json.outcome).toBe("payment_pending_roster");
});
test("admin payment actions reject unsafe deployment override and missing authentication", async () => {
  expect((await admin("payment_preview", undefined, "")).response.status).toBe(401); expect(stub.calls).toHaveLength(0);
  process.env.LINKDINK_BASE_URL = "https://attacker.example";
  expect((await admin("payment_preview")).response.status).toBe(503); expect(stub.calls).toHaveLength(0);
});

for (const key of ["STRIPE_SECRET_KEY", "NGA_SYNC_SECRET", "NOTION_API_KEY", "NOTION_MVF_TOURNAMENT_REGS_DB_ID"]) {
  test(`missing ${key} denies payment proof without destination calls`, async () => {
    delete process.env[key]; await expect(prepareMvfLinkDinkPayment(INV)).rejects.toThrow(); expect(stub.calls).toHaveLength(0);
  });
}
test("foreign webhook account cannot borrow current-account payment proof", async () => {
  await expect(prepareMvfLinkDinkPayment(INV, "acct_other")).rejects.toThrow(); expect(stub.calls).toHaveLength(0);
});

test("production payment projection cannot send its secret or receipt to an override", async () => {
  process.env.LINKDINK_BASE_URL = "https://attacker.example";
  await expect(prepareMvfLinkDinkPayment(INV)).rejects.toThrow(); expect(stub.calls).toHaveLength(0);
});
