import { test, expect } from "@playwright/test";
import { NextRequest } from "next/server";
import { SeriesHarness, registration, syntheticRelease } from "./fixtures/mvf-series";
import { activeSeriesRelease, findSeriesRelease, releaseProblems, validateSeriesRegistration, seriesEventKey } from "../src/data/mvf-series-registration";
import { POST } from "../src/app/api/mvf-series/[event]/register/route";
import { readSeriesToken, seriesPayUrl, seriesToken } from "../src/lib/mvf-series-service";
import { mvfSeriesService, createSeriesService } from "../src/lib/mvf-series-service";
import { mvfSeriesJsonLd } from "../src/lib/mvf-series-jsonld";
import { POST as signedWebhook } from "../src/app/api/stripe/webhook/route";

const keys = ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "NGA_SYNC_SECRET", "LINKDINK_BASE_URL", "VERCEL_ENV", "RESEND_API_KEY", "NOTION_API_KEY", "NOTION_MVF_SERIES_REGS_DB_ID", "NOTION_MVF_TOURNAMENT_REGS_DB_ID", "NOTION_WAIVERS_DB_ID"];
let saved: Record<string, string | undefined>, h: SeriesHarness;
test.beforeEach(() => {
  saved = Object.fromEntries(keys.map(key => [key, process.env[key]])); for (const key of keys) delete process.env[key];
  Object.assign(process.env, { STRIPE_SECRET_KEY: "sk_test_offline_synthetic", NGA_SYNC_SECRET: "synthetic-local-secret", LINKDINK_BASE_URL: "https://series.example.invalid", RESEND_API_KEY: "synthetic-local-key", NOTION_API_KEY: "synthetic-local-key", NOTION_MVF_SERIES_REGS_DB_ID: "11111111-2222-4333-8444-555555555555", NOTION_WAIVERS_DB_ID: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee" });
  h = new SeriesHarness().install();
});
test.afterEach(() => { const attempts = h.network.attempts.slice(); h.close(); for (const [key, value] of Object.entries(saved)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; } expect(attempts).toEqual([]); });

test("all production events remain closed before any body parsing or service call", async () => {
  for (const event of ["november-2026", "january-2027", "february-2027"]) {
    expect(activeSeriesRelease(event)).toBeUndefined(); expect(findSeriesRelease(event, "synthetic-v1")).toBeUndefined();
    const response = await POST(new NextRequest(`http://localhost/api/mvf-series/${event}/register`, { method: "POST", body: "{bad json" }), { params: Promise.resolve({ event }) });
    expect(response.status).toBe(409); expect((await response.json()).code).toBe("registration_closed");
  }
  expect(h.fake.all()).toHaveLength(0); expect(h.stub.calls).toEqual([]); expect(h.accountReads).toBe(0);
});
test("synthetic configuration validates explicit age, policy and payment windows", () => {
  expect(releaseProblems(syntheticRelease())).toEqual([]);
  for (const mutation of [{ rainPolicy: "TBD" }, { date: "2027-02-31" }, { minimumEnrollmentPolicy: "" }, { invoiceDueDays: 0 }, { endTime: "9:00 AM" }, { registrationClosesAt: "2027-02-20T15:00:00Z" }]) expect(releaseProblems({ ...syntheticRelease(), ...mutation }).length).toBeGreaterThan(0);
  expect(validateSeriesRegistration(registration(1, { childDob: "2015-02-20" }), syntheticRelease())).not.toHaveProperty("childDob");
  expect(validateSeriesRegistration(registration(1, { childDob: "2014-02-20" }), syntheticRelease())).toHaveProperty("childDob");
  for (const childDob of ["2019-02-30", "", "2000-01-01"]) expect(validateSeriesRegistration(registration(1, { childDob }), syntheticRelease())).toHaveProperty("childDob");
});

test("preview/default service cannot issue invoices even with complete synthetic policy", async () => {
  const service = createSeriesService({ active: () => syntheticRelease(), financialWritesAllowed: () => false });
  await expect(service.register("november-2026", registration())).rejects.toMatchObject({ code: "production_only" });
  expect(h.fake.all()).toHaveLength(0); expect(h.accountReads).toBe(0);
});

test("configured event schema uses Eastern time and distinct resident offers", () => {
  const schema = mvfSeriesJsonLd(syntheticRelease());
  expect(schema.startDate).toBe("2027-02-20T10:00:00-05:00");
  expect(schema.offers.map(o => o.price)).toEqual([50, 60]);
  expect(schema.url).toBe("https://nextgenpbacademy.com/mvf-junior-tournament/november-2026");
});

test("signed HTTP callback dispatches the new invoice kind and both paid aliases quietly", async () => {
  const result = await h.service.register("november-2026", registration());
  h.statuses.set(result.invoiceId, "paid"); process.env.STRIPE_WEBHOOK_SECRET = "whsec_offline_synthetic";
  const original = mvfSeriesService.webhook; mvfSeriesService.webhook = h.service.webhook;
  try {
    for (const type of ["invoice.paid", "invoice.payment_succeeded"] as const) {
      const event = { ...h.event(result.invoiceId, type), data: { object: { id: result.invoiceId, livemode: true, metadata: h.fake.invoices.get(result.invoiceId)!.metadata } } };
      const payload = JSON.stringify(event);
      const signature = h.stripe.webhooks.generateTestHeaderString({ payload, secret: process.env.STRIPE_WEBHOOK_SECRET });
      const response = await signedWebhook(new NextRequest("http://localhost/api/stripe/webhook", { method: "POST", body: payload, headers: { "stripe-signature": signature } }));
      expect(response.status).toBe(200); expect(await response.json()).toEqual({ received: true, mvfSeries: true });
    }
    expect(h.mails).toHaveLength(4); expect(h.pages).toHaveLength(1);
  } finally { mvfSeriesService.webhook = original; }
});
test("actual adapters create one pending roster/invoice and same-attempt retry reuses it", async () => {
  const result = await h.service.register("november-2026", registration());
  expect(result.status).toBe("pending"); expect(h.fake.all()).toHaveLength(1); expect(h.pages).toHaveLength(1); expect(h.mails).toHaveLength(2);
  const again = await h.service.register("november-2026", registration());
  expect(again.invoiceId).toBe(result.invoiceId); expect(h.fake.all()[0].lines[0].amount).toBe(5000); expect(h.fake.all()[0].sends).toBe(1); expect(h.pages).toHaveLength(1); expect(h.mails).toHaveLength(2);
  const receipt = await h.service.receipt("november-2026", h.token(result)); expect(receipt.status).toBe("pending"); expect(receipt.payUrl).toMatch(/^https:\/\/invoice.stripe.com\//);
  expect(JSON.stringify(receipt)).not.toMatch(/Synthetic|medical|guardian@example/);
});
test("events and brackets keep distinct invoices and capacity; one event's duplicate cannot restart", async () => {
  const first = await h.service.register("november-2026", registration());
  await expect(h.service.register("november-2026", registration(2, { childLastName: "Fixture 1" }))).rejects.toMatchObject({ code: "duplicate" });
  const january = await h.service.register("january-2027", registration()); expect(january.invoiceId).not.toBe(first.invoiceId);
  expect(h.fake.all().map(i => i.metadata.event_key)).toEqual([seriesEventKey("november-2026", "12u"), seriesEventKey("january-2027", "12u")]);
  await expect(h.service.receipt("january-2027", h.token(first))).rejects.toMatchObject({ code: "invalid_receipt" });
});
test("ten pending entries occupy a bracket, eleventh has no invoice", async () => {
  for (let n = 1; n <= 10; n++) await h.service.register("november-2026", registration(n));
  await expect(h.service.register("november-2026", registration(11))).rejects.toMatchObject({ code: "full" });
  expect(h.fake.all()).toHaveLength(10);
  await h.service.register("november-2026", registration(12, { division: "16u", childDob: "2012-02-20" })); expect(h.fake.all()).toHaveLength(11);
});
test("residency price is server-owned and altered retry cannot mutate invoice", async () => {
  const result = await h.service.register("november-2026", { ...registration(), amountUsd: 1 });
  await expect(h.service.register("november-2026", registration(1, { resident: false }))).rejects.toMatchObject({ code: "request_conflict" });
  await expect(h.service.register("november-2026", registration(2, { resident: "false" as never }))).rejects.toMatchObject({ status: 400 });
  const other = await h.service.register("january-2027", registration(2, { resident: false }));
  expect(h.fake.invoices.get(result.invoiceId)!.lines[0].amount).toBe(5000); expect(h.fake.invoices.get(other.invoiceId)!.lines[0].amount).toBe(6000);
});
test("wrong billing account, unavailable capacity and missing waiver fail before invoice writes", async () => {
  h.merchantId = "acct_Wrong"; await expect(h.service.register("november-2026", registration())).rejects.toMatchObject({ code: "merchant_unverified" });
  h.merchantId = "acct_1TU4iSBpXOfTC961"; h.ready = false; await expect(h.service.register("november-2026", registration())).rejects.toMatchObject({ code: "ledger_unavailable" });
  h.ready = true; h.waiver = false; await expect(h.service.register("november-2026", registration())).rejects.toMatchObject({ code: "waiver_required" });
  expect(h.fake.all()).toHaveLength(0);
});
test("binding or roster failures retain non-advancing drafts; ambiguous roster response never duplicates", async () => {
  h.bindFailure = true; await expect(h.service.register("november-2026", registration())).rejects.toBeTruthy();
  expect(h.fake.all()[0].status).toBe("draft"); expect(h.fake.all()[0].auto_advance).toBe(false); expect(h.fake.all()[0].sends).toBe(0);
  h.bindFailure = false; h.loseNotionResponse = true; await expect(h.service.register("november-2026", registration())).rejects.toBeTruthy(); expect(h.pages).toHaveLength(1);
  await h.service.register("november-2026", registration()); expect(h.fake.all()).toHaveLength(1); expect(h.pages).toHaveLength(1); expect(h.fake.all()[0].status).toBe("open");
});
test("lost Stripe send response is retryable without another invoice or charge", async () => {
  h.fake.loseResponseOf = "invoices.sendInvoice"; await expect(h.service.register("november-2026", registration())).rejects.toBeTruthy();
  await h.service.register("november-2026", registration()); expect(h.fake.all()).toHaveLength(1); expect(h.fake.all()[0].sends).toBe(1);
});

test("fixture preserves customer recipient changes instead of substituting guardian metadata", async () => {
  h.loseNotionResponse = true;
  await expect(h.service.register("november-2026", registration())).rejects.toBeTruthy();
  const invoice = h.fake.all()[0];
  h.fake.customers.get(invoice.customer)!.email = "changed@example.invalid";
  const draft = await h.stripe.invoices.retrieve(invoice.id);
  expect(draft.customer_email).toBe("changed@example.invalid");
  expect(draft.metadata!.parent_email).toBe("guardian@example.invalid");
});

test("changed guardian recipient on a bound draft fails before finalization or send; safe retry stays singular", async () => {
  h.loseNotionResponse = true;
  await expect(h.service.register("november-2026", registration())).rejects.toBeTruthy();
  const invoice = h.fake.all()[0], customer = h.fake.customers.get(invoice.customer)!;
  customer.email = "changed@example.invalid";
  await expect(h.service.register("november-2026", registration())).rejects.toMatchObject({ code: "recipient_unverified" });
  expect(h.fake.all()[0].status).toBe("draft"); expect(h.fake.all()[0].sends).toBe(0); expect(h.mails).toHaveLength(0);
  customer.email = "guardian@example.invalid";
  await h.service.register("november-2026", registration()); await h.service.register("november-2026", registration());
  expect(h.fake.all()).toHaveLength(1); expect(h.fake.all()[0].sends).toBe(1); expect(h.pages).toHaveLength(1);
});

test("a finalized invoice with mismatched recipient cannot send or reveal a payment link", async () => {
  h.sendExpired = true;
  await expect(h.service.register("november-2026", registration())).rejects.toBeTruthy();
  const invoice = h.fake.all()[0]; expect(invoice.status).toBe("open");
  invoice.customer_email = "changed@example.invalid"; h.sendExpired = false;
  await expect(h.service.register("november-2026", registration())).rejects.toMatchObject({ code: "recipient_unverified" });
  const token = seriesToken({ event: "november-2026", invoice: invoice.id, submission: registration().submissionId, revision: "synthetic-v1", purpose: "receipt" }, Number(invoice.metadata.receipt_issued_at));
  await expect(h.service.receipt("november-2026", token)).rejects.toMatchObject({ code: "recipient_unverified" });
  expect(h.fake.all()[0].sends).toBe(0); expect(h.mails).toHaveLength(0);
});

test("customer drift during finalization is rejected even when the invoice snapshot still names the guardian", async () => {
  const original = h.stripe.invoices.finalizeInvoice;
  h.stripe.invoices.finalizeInvoice = (async (...args: Parameters<typeof original>) => {
    const invoice = await original.apply(h.stripe.invoices, args);
    h.fake.customers.get(String(invoice.customer))!.email = "changed@example.invalid";
    return invoice;
  }) as typeof original;
  try {
    await expect(h.service.register("november-2026", registration())).rejects.toMatchObject({ code: "recipient_unverified" });
    const invoice = h.fake.all()[0]; expect(invoice.customer_email).toBe("guardian@example.invalid"); expect(invoice.sends).toBe(0);
    const token = seriesToken({ event: "november-2026", invoice: invoice.id, submission: registration().submissionId, revision: "synthetic-v1", purpose: "receipt" }, Number(invoice.metadata.receipt_issued_at));
    await expect(h.service.receipt("november-2026", token)).rejects.toMatchObject({ code: "recipient_unverified" });
    expect(h.mails).toHaveLength(0);
  } finally { h.stripe.invoices.finalizeInvoice = original; }
});

test("a recipient mismatch during notice verification cannot become notificationPending success", async () => {
  const original = h.stripe.customers.retrieve; let changed = false;
  h.stripe.customers.retrieve = (async (...args: Parameters<typeof original>) => {
    const customer = await original.apply(h.stripe.customers, args);
    if (!changed && h.fake.all()[0]?.sends === 1) { changed = true; h.fake.customers.get(customer.id)!.email = "changed@example.invalid"; }
    return customer;
  }) as typeof original;
  try {
    await expect(h.service.register("november-2026", registration())).rejects.toMatchObject({ code: "recipient_unverified" });
    expect(h.fake.all()[0].sends).toBe(1); expect(h.mails).toHaveLength(0);
    await expect(h.service.register("november-2026", registration())).rejects.toMatchObject({ code: "recipient_unverified" });
    expect(h.fake.all()).toHaveLength(1); expect(h.fake.all()[0].sends).toBe(1);
  } finally { h.stripe.customers.retrieve = original; }
});

test("acknowledged invoice emails do not call Stripe send again after its key window", async () => {
  const original = h.stripe.invoices.sendInvoice; let calls = 0;
  h.stripe.invoices.sendInvoice = (async (...args: Parameters<typeof original>) => { calls++; return original.apply(h.stripe.invoices, args); }) as typeof original;
  try { await h.service.register("november-2026", registration()); h.sendExpired = true; await h.service.register("november-2026", registration()); expect(calls).toBe(1); }
  finally { h.stripe.invoices.sendInvoice = original; }
});

test("uncertain invoice sends and unbound attempts beyond 23 hours require reconciliation", async () => {
  h.fake.loseResponseOf = "invoices.sendInvoice";
  await expect(h.service.register("november-2026", registration())).rejects.toBeTruthy();
  h.sendExpired = true;
  await expect(h.service.register("november-2026", registration())).rejects.toMatchObject({ code: "ledger_unavailable" });
  expect(h.fake.all()[0].sends).toBe(1);
  h.bindFailure = true; h.sendExpired = false;
  await expect(h.service.register("january-2027", registration(2))).rejects.toBeTruthy();
  const held = [...h.seats.values()].find(s => s.invoice_id === null)!; held.created_at = "2026-10-28T12:00:00Z";
  await expect(h.service.register("january-2027", registration(2))).rejects.toMatchObject({ code: "invoice_reconciliation_required" });
  expect(h.fake.all()).toHaveLength(2);
});

test("unexpected provider discounts or balances halt before any invoice email", async () => {
  const original = h.stripe.invoices.retrieve;
  h.stripe.invoices.retrieve = (async (...args: Parameters<typeof original>) => {
    const invoice = await original.apply(h.stripe.invoices, args);
    return { ...invoice, amount_due: invoice.amount_due - 100 };
  }) as typeof original;
  try {
    await expect(h.service.register("november-2026", registration())).rejects.toMatchObject({ code: "invoice_amount_unverified" });
    expect(h.fake.all()[0].sends).toBe(0); expect(h.mails).toHaveLength(0);
    expect([...h.seats.values()][0].state).toBe("payable");
  } finally { h.stripe.invoices.retrieve = original; }
});
test("paid aliases and repeated callbacks confirm once, emit only guardian/admin notices, preserve closed admission", async () => {
  const result = await h.service.register("november-2026", registration()); h.statuses.set(result.invoiceId, "paid"); h.admission = false;
  for (const type of ["invoice.paid", "invoice.payment_succeeded", "invoice.paid"] as const) expect(await h.service.webhook(h.event(result.invoiceId, type))).toEqual({ received: true, mvfSeries: true });
  expect(h.mails).toHaveLength(4); expect((await h.service.receipt("november-2026", h.token(result))).status).toBe("paid");
  const serialized = JSON.stringify(h.mails); expect(serialized).not.toMatch(/medical notes|child_dob|2016-02-20|malvero|Emergency/);
  expect(h.mails.map(m => m.to)).toEqual([["guardian@example.invalid"], ["sam.morris2131@gmail.com", "nextgenacademypb@gmail.com"], ["guardian@example.invalid"], ["sam.morris2131@gmail.com", "nextgenacademypb@gmail.com"]]);
});
test("refund evidence or unpaid redirect cannot confirm a registration", async () => {
  const result = await h.service.register("november-2026", registration());
  await expect(h.service.webhook(h.event(result.invoiceId))).rejects.toMatchObject({ code: "payment_unverified" });
  h.statuses.set(result.invoiceId, "paid"); h.refunded = true; await expect(h.service.webhook(h.event(result.invoiceId))).rejects.toMatchObject({ code: "payment_unverified" });
  expect([...h.seats.values()][0].state).toBe("payable");
  expect((await h.service.receipt("november-2026", h.token(result))).status).toBe("reconciliation_pending");
});

for (const adjustment of ["refunded", "credit", "disputed", "pending_refund"] as const) test(`post-confirmation ${adjustment} requires review and retains its paid seat`, async () => {
  const result = await h.service.register("november-2026", registration()); h.statuses.set(result.invoiceId, "paid");
  await h.service.webhook(h.event(result.invoiceId));
  expect((await h.service.receipt("november-2026", h.token(result))).status).toBe("paid");
  if (adjustment === "refunded") h.refunded = true;
  if (adjustment === "credit") h.creditCents = 100;
  if (adjustment === "disputed") h.disputed = true;
  if (adjustment === "pending_refund") h.refundEvidence = true;
  const receipt = await h.service.receipt("november-2026", h.token(result));
  expect(receipt.status).toBe("review_required"); expect(receipt.payUrl).toBeNull(); expect(receipt.cancelToken).toBeNull();
  expect(h.pages[0].properties.Status).toEqual({ select: { name: "Review required" } });
  expect([...h.seats.values()][0].state).toBe("paid"); expect(h.voids).toBe(0); expect(h.mails).toHaveLength(4);
  // A later clean provider view must not silently overrule an operator review.
  h.refunded = false; h.creditCents = 0; h.disputed = false; h.refundEvidence = false;
  expect((await h.service.receipt("november-2026", h.token(result))).status).toBe("review_required");
  expect(await h.service.webhook(h.event(result.invoiceId))).toEqual({ received: true, mvfSeries: true, reviewRequired: true });
  expect(h.mails).toHaveLength(4); expect([...h.seats.values()][0].review_required).toBe(true);
});

test("temporarily unavailable payment evidence clears confirmation without releasing or reclassifying the seat", async () => {
  const result = await h.service.register("november-2026", registration()); h.statuses.set(result.invoiceId, "paid"); await h.service.webhook(h.event(result.invoiceId));
  h.paymentEvidenceUnavailable = true;
  const receipt = await h.service.receipt("november-2026", h.token(result));
  expect(receipt.status).toBe("reconciliation_pending"); expect(receipt.payUrl).toBeNull(); expect(receipt.cancelToken).toBeNull();
  expect(h.pages[0].properties.Status).toEqual({ select: { name: "Confirmed" } }); expect([...h.seats.values()][0].state).toBe("paid");
});

test("an adjustment interleaved before a stale paid PATCH cannot be overwritten or send confirmation", async () => {
  const result = await h.service.register("november-2026", registration()); h.statuses.set(result.invoiceId, "paid");
  const original = globalThis.fetch; let release!: () => void, entered!: () => void, paused = false;
  const gate = new Promise<void>(resolve => { release = resolve; }), waiting = new Promise<void>(resolve => { entered = resolve; });
  globalThis.fetch = (async (...args: Parameters<typeof fetch>) => {
    const body = typeof args[1]?.body === "string" ? args[1].body : "";
    if (!paused && args[1]?.method === "PATCH" && body.includes('"Confirmed"')) { paused = true; entered(); await gate; }
    return original(...args);
  }) as typeof fetch;
  let pending: Promise<unknown> | undefined;
  try {
    pending = h.service.webhook(h.event(result.invoiceId)); await waiting;
    h.refunded = true;
    await h.service.adjustment({ ...h.event(result.invoiceId), type: "charge.refunded", data: { object: { id: `ch_pi_${result.invoiceId}`, livemode: true } } } as never).catch(() => undefined);
    release(); await pending;
    expect(h.pages[0].properties.Status).toEqual({ select: { name: "Review required" } }); expect(h.mails).toHaveLength(2);
    // Replay the blocked adjustment; it must be safe and must not release a seat.
    await h.service.adjustment({ ...h.event(result.invoiceId), type: "charge.refunded", data: { object: { id: `ch_pi_${result.invoiceId}`, livemode: true } } } as never);
    expect(h.pages[0].properties.Status).toEqual({ select: { name: "Review required" } });
    expect(h.pages[0].properties.Paid).toEqual({ checkbox: false }); expect(h.mails).toHaveLength(2);
    expect([...h.seats.values()][0].state).toBe("paid"); expect(h.voids).toBe(0);
    expect((await h.service.receipt("november-2026", h.token(result))).status).toBe("review_required");
  } finally { release(); await pending?.catch(() => undefined); globalThis.fetch = original; }
});

test("uncertain paid publication stays serialized until explicit reconciliation, without another notice or seat release", async () => {
  const result = await h.service.register("november-2026", registration()); h.statuses.set(result.invoiceId, "paid"); h.noticeFailure = true;
  await expect(h.service.webhook(h.event(result.invoiceId))).rejects.toMatchObject({ code: "notification_pending" });
  h.noticeFailure = false;
  await expect(h.service.webhook(h.event(result.invoiceId))).rejects.toMatchObject({ code: "ledger_unavailable" });
  const seat = [...h.seats.values()][0]; expect(seat.state).toBe("paid"); expect(seat.publication).toBeTruthy();
  expect((await h.service.receipt("november-2026", h.token(result))).status).toBe("reconciliation_pending");
  h.refunded = true;
  expect((await h.service.receipt("november-2026", h.token(result))).status).toBe("reconciliation_pending");
  expect(h.mails).toHaveLength(2); expect(h.voids).toBe(0);
});

for (const type of ["charge.refunded", "credit_note.created", "charge.dispute.created"] as const) test(`signed ${type} reconciles the series roster without legacy cancellation or another notice`, async () => {
  const result = await h.service.register("november-2026", registration()); h.statuses.set(result.invoiceId, "paid"); await h.service.webhook(h.event(result.invoiceId));
  if (type === "charge.refunded") h.refunded = true;
  if (type === "credit_note.created") h.creditCents = 100;
  if (type === "charge.dispute.created") h.disputed = true;
  process.env.STRIPE_WEBHOOK_SECRET = "whsec_offline_synthetic";
  const original = mvfSeriesService.adjustment; mvfSeriesService.adjustment = h.service.adjustment;
  try {
    for (let retry = 0; retry < 2; retry++) {
      const event = { ...h.event(result.invoiceId), type, data: { object: type === "credit_note.created" ? { id: "cn_fixture", invoice: result.invoiceId, livemode: true } : type === "charge.refunded" ? { id: `ch_pi_${result.invoiceId}`, livemode: true } : { id: "dp_fixture", charge: `ch_pi_${result.invoiceId}`, livemode: true } } };
      const payload = JSON.stringify(event), signature = h.stripe.webhooks.generateTestHeaderString({ payload, secret: process.env.STRIPE_WEBHOOK_SECRET });
      const response = await signedWebhook(new NextRequest("http://localhost/api/stripe/webhook", { method: "POST", body: payload, headers: { "stripe-signature": signature } }));
      expect(response.status).toBe(200); expect(await response.json()).toEqual({ received: true, mvfSeries: true, reviewRequired: true });
    }
    expect(h.pages[0].properties.Status).toEqual({ select: { name: "Review required" } }); expect([...h.seats.values()][0].state).toBe("paid"); expect(h.voids).toBe(0); expect(h.mails).toHaveLength(4);
  } finally { mvfSeriesService.adjustment = original; }
});
test("unpaid cancellation waits for confirmed void and survives lost response", async () => {
  const result = await h.service.register("november-2026", registration()); const receipt = await h.service.receipt("november-2026", h.token(result));
  h.voidLoss = true; await expect(h.service.cancel("november-2026", receipt.cancelToken)).rejects.toBeTruthy(); expect([...h.seats.values()][0].state).toBe("payable");
  expect(await h.service.cancel("november-2026", receipt.cancelToken)).toEqual({ status: "cancelled", refundInitiated: false });
  expect(h.voids).toBe(1); expect([...h.seats.values()][0].state).toBe("void"); expect((await h.service.receipt("november-2026", h.token(result))).status).toBe("cancelled");
  await h.service.webhook(h.event(result.invoiceId, "invoice.voided")); expect(h.mails).toHaveLength(4);
  await h.service.register("november-2026", registration(2, { childLastName: "Fixture 1" })); expect(h.fake.all()).toHaveLength(2);
});
test("receipt capability cannot cancel, forged/expired/cross-event capabilities cannot read", async () => {
  const result = await h.service.register("november-2026", registration()); const token = h.token(result);
  await expect(h.service.cancel("november-2026", token)).rejects.toMatchObject({ code: "invalid_receipt" });
  await expect(h.service.receipt("november-2026", token + "x")).rejects.toMatchObject({ code: "invalid_receipt" });
  expect(() => readSeriesToken(token, "november-2026", "receipt", Date.parse("2030-01-01"))).toThrow("invalid_receipt");
  expect(seriesPayUrl("https://invoice.stripe.com.evil.invalid/pay")).toBeNull(); expect(seriesPayUrl("https://user:pass@invoice.stripe.com/pay")).toBeNull();
});
test("a payment racing unpaid cancellation cannot release a paid seat or initiate a refund", async () => {
  const result = await h.service.register("november-2026", registration()); const receipt = await h.service.receipt("november-2026", h.token(result));
  h.statuses.set(result.invoiceId, "paid"); await expect(h.service.cancel("november-2026", receipt.cancelToken)).rejects.toMatchObject({ code: "paid_cancellation_requires_review" });
  expect(h.voids).toBe(0); expect([...h.seats.values()][0].state).toBe("payable");
});
