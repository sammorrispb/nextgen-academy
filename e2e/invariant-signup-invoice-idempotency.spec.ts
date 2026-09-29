import { test, expect } from "@playwright/test";
import { NextRequest } from "next/server";
import { FetchStub, type RecordedFetch } from "./fixtures/fetch-stub";
import { FakeStripeInvoicing, type FakeStripeEndpoint } from "./fixtures/fake-stripe-invoices";

process.env.STRIPE_SECRET_KEY = "sk_test_dummy_offline";
process.env.NOTION_API_KEY = "ntn_test_invoice_idempotency";
process.env.NOTION_MVF_TOURNAMENT_REGS_DB_ID = "mvfregsdb";
process.env.RESEND_API_KEY = "re_test_invoice_idempotency";
// Waiver gate fails open without its DB; the L&D roster sync skips outside a
// production deploy, so neither reaches the network here.
delete process.env.NOTION_WAIVERS_DB_ID;
delete process.env.VERCEL_ENV;
delete process.env.LINKDINK_BASE_URL;
delete process.env.NGA_SYNC_SECRET;

import { getStripe } from "../src/lib/stripe";
import { createAndSendSignupInvoice } from "../src/lib/stripe-invoices";
import {
  createMvfTournamentRegistration,
  markMvfTournamentRegPaid,
} from "../src/lib/notion-mvf-tournament-registrations";
import { POST as mvfCheckout } from "../src/app/api/checkout-mvf-junior-tournament/route";
import { POST as lessonCheckout } from "../src/app/api/checkout-lesson/route";

// The invariant (hostile review of #368, 2026-09-28): ONE sign-up submission,
// however many times it is retried, produces at most one Stripe invoice — one
// line, sent once — one roster row, and one "invoice sent" announcement.
//
// A parent retries when the response never arrives (a phone dropping signal
// is the common case), or when the route answers 502 after Stripe finished
// part of the job. The form now resends the SAME submission id for the same
// content, and the helper keys EVERY Stripe write off it, so Stripe replays
// what already happened instead of doing it again. Keying only the invoice
// create — the shape before this — was worse than no key on a retry: the
// replayed draft then took a second line (double the price) or, once
// finalized, refused the line and the parent read "couldn't create your
// invoice" about an invoice already in their inbox.

const PRICE_CENTS = 5000;
const SUB_A = "11111111-1111-4111-8111-111111111111";
const SUB_B = "22222222-2222-4222-8222-222222222222";

// Stripe finishes one of these, then the response is lost.
const STEPS: FakeStripeEndpoint[] = [
  "customers.create",
  "invoices.create",
  "invoiceItems.create",
  "invoices.finalizeInvoice",
  "invoices.sendInvoice",
];

function helperArgs(idempotencyKey: string | undefined, childName = "Ava P") {
  return {
    customerEmail: "pat@example.com",
    customerName: "Pat Parent",
    items: [{ description: `MVF Junior Tournament — 10U — ${childName}`, amountCents: PRICE_CENTS, quantity: 1 }],
    metadata: { kind: "mvf-junior-tournament", child_first_name: childName },
    memo: "MVF Junior Tournament",
    footer: "No refunds.",
    daysUntilDue: 7,
    idempotencyKey,
  };
}

function expectOneInvoiceSentOnce(fake: FakeStripeInvoicing) {
  const invoices = fake.all();
  expect(invoices, "invoices on the account").toHaveLength(1);
  const [invoice] = invoices;
  expect(invoice.lines.map((l) => l.amount), "one line at the price").toEqual([PRICE_CENTS]);
  expect(invoice.status).toBe("open");
  expect(invoice.sends, "emailed exactly once").toBe(1);
  return invoice;
}

test.describe("createAndSendSignupInvoice — one submission, one invoice", () => {
  let fake: FakeStripeInvoicing;
  let restore: () => void;

  test.beforeEach(() => {
    fake = new FakeStripeInvoicing();
    restore = fake.install(getStripe());
  });
  test.afterEach(() => restore());

  test("a first submission: one invoice, one line, sent once — not a replay", async () => {
    const { invoice, alreadySent } = await createAndSendSignupInvoice(helperArgs("mvf-" + SUB_A));
    const onAccount = expectOneInvoiceSentOnce(fake);
    expect(invoice.id).toBe(onAccount.id);
    expect(invoice.hosted_invoice_url).toBe(onAccount.hosted_invoice_url);
    expect(alreadySent).toBe(false);
  });

  test("resubmitting a finished submission returns the SAME invoice and says it already went out", async () => {
    const first = await createAndSendSignupInvoice(helperArgs("mvf-" + SUB_A));
    const retry = await createAndSendSignupInvoice(helperArgs("mvf-" + SUB_A));
    expectOneInvoiceSentOnce(fake);
    expect(retry.invoice.id).toBe(first.invoice.id);
    expect(first.alreadySent).toBe(false);
    expect(retry.alreadySent).toBe(true);
    expect(fake.customers.size, "no second customer").toBe(1);
  });

  for (const step of STEPS) {
    test(`Stripe finished ${step} but the response was lost: the retry converges on one invoice`, async () => {
      fake.loseResponseOf = step;
      await expect(createAndSendSignupInvoice(helperArgs("mvf-" + SUB_A))).rejects.toThrow();

      const retry = await createAndSendSignupInvoice(helperArgs("mvf-" + SUB_A));
      const onAccount = expectOneInvoiceSentOnce(fake);
      expect(retry.invoice.id).toBe(onAccount.id);
      expect(fake.customers.size, "no second customer").toBe(1);
      // Only a replayed SEND means the parent already has the invoice email.
      expect(retry.alreadySent).toBe(step === "invoices.sendInvoice");
    });
  }

  test("two different submissions still make two invoices (siblings, a second division)", async () => {
    const a = await createAndSendSignupInvoice(helperArgs("mvf-" + SUB_A, "Ava P"));
    const b = await createAndSendSignupInvoice(helperArgs("mvf-" + SUB_B, "Max P"));
    expect(fake.all()).toHaveLength(2);
    expect(a.invoice.id).not.toBe(b.invoice.id);
    expect(a.alreadySent || b.alreadySent).toBe(false);
    for (const invoice of fake.all()) {
      expect(invoice.lines).toHaveLength(1);
      expect(invoice.sends).toBe(1);
    }
  });

  test("with no key nothing is replayed — every call is its own invoice", async () => {
    await createAndSendSignupInvoice(helperArgs(undefined));
    const second = await createAndSendSignupInvoice(helperArgs(undefined));
    expect(fake.all()).toHaveLength(2);
    expect(second.alreadySent).toBe(false);
  });

  test("a key reused for a CHANGED request fails without a second invoice — why the form re-keys on every edit", async () => {
    await createAndSendSignupInvoice(helperArgs("mvf-" + SUB_A, "Ava P"));
    await expect(createAndSendSignupInvoice(helperArgs("mvf-" + SUB_A, "Ava Q"))).rejects.toThrow();
    expectOneInvoiceSentOnce(fake);
  });
});

// ---------------------------------------------------------------------------
// The routes, end to end: Stripe is the fake above, Notion and Resend ride
// fetch. A retry must not add a roster row or announce the invoice again.

interface RosterRow {
  id: string;
  invoiceId: string;
  paid: boolean;
}

function page(row: RosterRow) {
  return {
    id: row.id,
    properties: {
      Paid: { checkbox: row.paid },
      "Stripe Invoice ID": { rich_text: [{ plain_text: row.invoiceId }] },
    },
  };
}

/** A tiny MVF roster DB: answers the invoice-id lookup and the paid-seat
 * count, and records page creates. */
function stubRoster(stub: FetchStub, rows: RosterRow[]) {
  stub.onDynamic(/api\.notion\.com\/v1\/databases\/mvfregsdb\/query/, (call) => {
    const filter = JSON.parse(call.body || "{}").filter;
    if (filter?.property === "Stripe Invoice ID") {
      const hits = rows.filter((r) => r.invoiceId === filter.rich_text.equals);
      return { status: 200, json: { results: hits.map(page), has_more: false } };
    }
    return { status: 200, json: { results: rows.filter((r) => r.paid).map(page), has_more: false } };
  });
  stub.onDynamic(/api\.notion\.com\/v1\/pages$/, (call) => {
    const props = JSON.parse(call.body).properties;
    const row = { id: `page_${rows.length + 1}`, invoiceId: props["Stripe Invoice ID"].rich_text[0].text.content, paid: false };
    rows.push(row);
    return { status: 200, json: { id: row.id } };
  });
}

function recipients(call: RecordedFetch): string[] {
  return ([] as string[]).concat(JSON.parse(call.body).to ?? []);
}

function adminNotices(stub: FetchStub) {
  return stub.callsTo("api.resend.com").filter((c) => recipients(c).includes("sam.morris2131@gmail.com"));
}

function parentEmails(stub: FetchStub, parent = "pat@example.com") {
  return stub.callsTo("api.resend.com").filter((c) => recipients(c).includes(parent));
}

function rosterCreates(stub: FetchStub) {
  return stub.calls.filter((c) => /api\.notion\.com\/v1\/pages$/.test(c.url) && c.method === "POST");
}

function mvfBody(submissionId: unknown, over: Record<string, unknown> = {}) {
  return {
    division: "10u",
    resident: true,
    parentName: "Pat Parent",
    email: "pat@example.com",
    phone: "301-555-0100",
    childFirstName: "Ava",
    childLastName: "Park",
    childDob: "2017-05-01",
    emergencyName: "Jo Parent",
    emergencyPhone: "301-555-0101",
    allergies: "",
    smsConsent: false,
    submissionId,
    ...over,
  };
}

function lessonBody(submissionId: unknown) {
  return {
    lessonType: "private",
    parentName: "Pat Parent",
    email: "pat@example.com",
    phone: "301-555-0100",
    childFirstName: "Ava",
    childBirthYear: String(new Date().getFullYear() - 10),
    preferredTimes: "Tuesdays after 5",
    emergencyName: "Jo Parent",
    emergencyPhone: "301-555-0101",
    groupPlayers: "",
    allergies: "",
    notes: "",
    smsConsent: false,
    submissionId,
  };
}

function post(route: typeof mvfCheckout, path: string, body: unknown, ip: string) {
  return route(
    new NextRequest(`http://localhost${path}`, {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "content-type": "application/json", "x-forwarded-for": ip },
    }),
  );
}

test.describe("the MVF sign-up route — a retry is the same sign-up", () => {
  const stub = new FetchStub();
  let fake: FakeStripeInvoicing;
  let restore: () => void;
  let rows: RosterRow[];

  test.beforeEach(() => {
    fake = new FakeStripeInvoicing();
    restore = fake.install(getStripe());
    rows = [];
    stub.reset();
    stubRoster(stub, rows);
    stub.on("api.resend.com", { id: "email_test" });
    stub.install();
  });
  test.afterEach(() => {
    restore();
    stub.uninstall();
  });

  test("the same submission twice: one invoice, one roster row, one admin notice, one parent email", async () => {
    const first = await post(mvfCheckout, "/api/checkout-mvf-junior-tournament", mvfBody(SUB_A), "10.68.0.1");
    const retry = await post(mvfCheckout, "/api/checkout-mvf-junior-tournament", mvfBody(SUB_A), "10.68.0.1");
    expect(first.status).toBe(200);
    expect(retry.status).toBe(200);

    const invoice = expectOneInvoiceSentOnce(fake);
    expect((await first.json()).invoiceId).toBe(invoice.id);
    expect((await retry.json()).invoiceId).toBe(invoice.id);
    expect(rows.map((r) => r.invoiceId), "one roster row, for that invoice").toEqual([invoice.id]);
    expect(adminNotices(stub), "admin 'invoice sent' notices").toHaveLength(1);
    expect(parentEmails(stub), "parent confirmations").toHaveLength(1);
  });

  for (const step of ["invoices.create", "invoiceItems.create", "invoices.finalizeInvoice"] as const) {
    test(`Stripe lost the response to ${step}: 502, then the retry lands it once`, async () => {
      fake.loseResponseOf = step;
      const first = await post(mvfCheckout, "/api/checkout-mvf-junior-tournament", mvfBody(SUB_A), "10.68.0.2");
      expect(first.status).toBe(502);
      expect(fake.all().every((i) => i.sends === 0), "nothing emailed yet").toBe(true);

      const retry = await post(mvfCheckout, "/api/checkout-mvf-junior-tournament", mvfBody(SUB_A), "10.68.0.2");
      expect(retry.status).toBe(200);
      const invoice = expectOneInvoiceSentOnce(fake);
      expect(rows.map((r) => r.invoiceId)).toEqual([invoice.id]);
      expect(adminNotices(stub)).toHaveLength(1);
      expect(parentEmails(stub)).toHaveLength(1);
    });
  }

  test("the send itself went through but its response was lost: sent once, one row, never announced twice", async () => {
    fake.loseResponseOf = "invoices.sendInvoice";
    const first = await post(mvfCheckout, "/api/checkout-mvf-junior-tournament", mvfBody(SUB_A), "10.68.0.3");
    expect(first.status).toBe(502);

    const retry = await post(mvfCheckout, "/api/checkout-mvf-junior-tournament", mvfBody(SUB_A), "10.68.0.3");
    expect(retry.status).toBe(200);
    const invoice = expectOneInvoiceSentOnce(fake);
    expect(rows.map((r) => r.invoiceId)).toEqual([invoice.id]);
    // Stripe's own email already reached the parent; ours may be skipped in
    // this narrow case, but never doubled.
    expect(adminNotices(stub).length).toBeLessThanOrEqual(1);
    expect(parentEmails(stub).length).toBeLessThanOrEqual(1);
  });

  test("two siblings are two sign-ups: two invoices, two rows, two notices (positive control)", async () => {
    const ava = await post(mvfCheckout, "/api/checkout-mvf-junior-tournament", mvfBody(SUB_A), "10.68.0.4");
    const max = await post(
      mvfCheckout,
      "/api/checkout-mvf-junior-tournament",
      mvfBody(SUB_B, { childFirstName: "Max", childDob: "2018-03-01" }),
      "10.68.0.4",
    );
    expect(ava.status).toBe(200);
    expect(max.status).toBe(200);
    expect(fake.all()).toHaveLength(2);
    expect(rows).toHaveLength(2);
    expect(adminNotices(stub)).toHaveLength(2);
    expect(parentEmails(stub)).toHaveLength(2);
  });

  test("a submission id that isn't one of ours never blocks the sign-up — it just isn't replay-protected", async () => {
    for (const [i, bad] of ["not-a-uuid", "x".repeat(300), 42, ""].entries()) {
      const res = await post(mvfCheckout, "/api/checkout-mvf-junior-tournament", mvfBody(bad), `10.68.1.${i}`);
      expect(res.status, JSON.stringify(bad).slice(0, 20)).toBe(200);
    }
    expect(fake.all()).toHaveLength(4);
  });
});

test.describe("the legacy lesson route — a retry is the same invoice", () => {
  const stub = new FetchStub();
  let fake: FakeStripeInvoicing;
  let restore: () => void;

  test.beforeEach(() => {
    fake = new FakeStripeInvoicing();
    restore = fake.install(getStripe());
    stub.reset();
    stub.on("api.resend.com", { id: "email_test" });
    stub.install();
  });
  test.afterEach(() => {
    restore();
    stub.uninstall();
  });

  test("the same submission twice: one invoice, one admin notice, the same invoice id back", async () => {
    const first = await post(lessonCheckout, "/api/checkout-lesson", lessonBody(SUB_A), "10.69.0.1");
    const retry = await post(lessonCheckout, "/api/checkout-lesson", lessonBody(SUB_A), "10.69.0.1");
    expect(first.status).toBe(200);
    expect(retry.status).toBe(200);
    const invoices = fake.all();
    expect(invoices).toHaveLength(1);
    expect(invoices[0].lines).toHaveLength(1);
    expect(invoices[0].sends).toBe(1);
    expect((await retry.json()).invoiceId).toBe(invoices[0].id);
    expect(adminNotices(stub)).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// One roster row per invoice. A retried sign-up now gets the SAME invoice
// back, and the webhook backfills a row it can't find — so both writers look
// first, and a lookup Notion can't answer is never read as "no row".

function regRow(stripeInvoiceId: string) {
  return {
    parentName: "Pat Parent",
    parentEmail: "pat@example.com",
    parentPhone: "301-555-0100",
    childFirstName: "Ava",
    childLastName: "Park",
    childDob: "2017-05-01",
    division: "10u" as const,
    resident: true,
    amountUsd: 50,
    stripeInvoiceId,
    smsConsent: false,
    smsConsentText: "",
    emergencyName: "Jo Parent",
    emergencyPhone: "301-555-0101",
    allergies: "",
  };
}

test.describe("the MVF roster — one row per invoice", () => {
  const stub = new FetchStub();

  test.beforeEach(() => {
    stub.reset();
    stub.install();
  });
  test.afterEach(() => stub.uninstall());

  test("a row already on file for the invoice: no second row", async () => {
    stubRoster(stub, [{ id: "page_1", invoiceId: "in_1", paid: false }]);
    expect(await createMvfTournamentRegistration(regRow("in_1"))).toBe("ok");
    expect(rosterCreates(stub)).toHaveLength(0);
  });

  test("no row yet: exactly one, carrying the invoice id", async () => {
    const rows: RosterRow[] = [];
    stubRoster(stub, rows);
    expect(await createMvfTournamentRegistration(regRow("in_1"))).toBe("ok");
    expect(rosterCreates(stub)).toHaveLength(1);
    expect(rows.map((r) => r.invoiceId)).toEqual(["in_1"]);
  });

  for (const [label, status, expected] of [
    ["a 500", 500, "transient"],
    ["a 429", 429, "transient"],
    ["a 400 (DB unshared / property renamed)", 400, "permanent"],
  ] as const) {
    test(`the lookup gets ${label}: no row is written blind`, async () => {
      stub.onDynamic(/databases\/mvfregsdb\/query/, () => ({ status, json: { message: "no" } }));
      stub.on(/api\.notion\.com\/v1\/pages$/, { id: "page_x" });
      expect(await createMvfTournamentRegistration(regRow("in_1"))).toBe(expected);
      expect(rosterCreates(stub)).toHaveLength(0);
    });
  }

  test("the lookup can't reach Notion at all: transient, no row written", async () => {
    // No rule for the query URL: the stub throws, as a dropped connection does.
    stub.on(/api\.notion\.com\/v1\/pages$/, { id: "page_x" });
    expect(await createMvfTournamentRegistration(regRow("in_1"))).toBe("transient");
    expect(rosterCreates(stub)).toHaveLength(0);
  });

  test("the create itself can't reach Notion: transient, never a throw out of the checkout route", async () => {
    // The lookup answers "no row"; the page create has no rule, so it throws
    // the way a dropped connection does.
    stub.onDynamic(/databases\/mvfregsdb\/query/, () => ({ status: 200, json: { results: [] } }));
    expect(await createMvfTournamentRegistration(regRow("in_1"))).toBe("transient");
  });

  test("mark-paid: a lookup Notion can't answer is a retry, never 'no row' (which would backfill a second one)", async () => {
    stub.onDynamic(/databases\/mvfregsdb\/query/, () => ({ status: 503, json: {} }));
    expect(await markMvfTournamentRegPaid("in_1", 50, null)).toBe("transient");
    stub.reset();
    stub.onDynamic(/databases\/mvfregsdb\/query/, () => ({ status: 404, json: {} }));
    expect(await markMvfTournamentRegPaid("in_1", 50, null)).toBe("permanent");
    stub.reset();
    expect(await markMvfTournamentRegPaid("in_1", 50, null)).toBe("transient");
  });

  test("mark-paid still flips a found row, no-ops a paid one, and reports a truly missing one", async () => {
    stubRoster(stub, [{ id: "page_1", invoiceId: "in_1", paid: false }]);
    stub.on(/api\.notion\.com\/v1\/pages\/page_1/, { id: "page_1" });
    expect(await markMvfTournamentRegPaid("in_1", 50, null)).toBe("ok");
    stub.reset();
    stubRoster(stub, [{ id: "page_1", invoiceId: "in_1", paid: true }]);
    expect(await markMvfTournamentRegPaid("in_1", 50, null)).toBe("already_paid");
    stub.reset();
    stubRoster(stub, []);
    expect(await markMvfTournamentRegPaid("in_1", 50, null)).toBe("not_found");
  });
});
