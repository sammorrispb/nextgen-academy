import { test, expect } from "@playwright/test";
import { NextRequest } from "next/server";
import { SeriesHarness, registration, syntheticRelease } from "./fixtures/mvf-series";
import { activeSeriesRelease, findSeriesRelease, releaseProblems, validateSeriesRegistration, seriesEventKey } from "../src/data/mvf-series-registration";
import { POST } from "../src/app/api/mvf-series/[event]/register/route";
import { readSeriesToken, seriesPayUrl } from "../src/lib/mvf-series-service";
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
