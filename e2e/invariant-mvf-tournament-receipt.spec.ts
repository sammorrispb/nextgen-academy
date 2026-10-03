import { test, expect } from "@playwright/test";
import * as jsx from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import { createRequire } from "node:module";
import Receipt, { metadata } from "../src/app/mvf-junior-tournament/success/page";
import { MVF_JUNIOR_TOURNAMENT_KIND, MVF_JUNIOR_TOURNAMENT_DATE_ISO } from "../src/data/mvf-junior-tournament-2026";
import { FetchStub } from "./fixtures/fetch-stub";

// A public receipt cannot certify payment from a redirect, another product,
// or an unavailable lookup, and cannot echo a child's identity or parent email.
const require = createRequire(`${process.cwd()}/package.json`);
const stripeModule = require("./src/lib/stripe.ts") as typeof import("../src/lib/stripe");
const originalFactory = stripeModule.getStripe;
const runtime = require("playwright/jsx-runtime");
const originalRuntime = { ...runtime };
const savedKey = process.env.STRIPE_SECRET_KEY;
const stub = new FetchStub();
const ID = "in_syntheticReceipt";
const PAY = "https://invoice.stripe.com/i/synthetic";
let calls: string[];
let value: Record<string, unknown>;
let failure: boolean;
let logs: unknown[][];
const originalError = console.error;

function invoice(status = "open"): Record<string, unknown> {
  return { id: ID, status, currency: "usd", amount_paid: 5000, amount_due: 5000,
    hosted_invoice_url: PAY, customer_email: "DO_NOT_ECHO_PARENT@example.com",
    metadata: { kind: MVF_JUNIOR_TOURNAMENT_KIND, event_date: MVF_JUNIOR_TOURNAMENT_DATE_ISO,
      division: "10u", division_label: "DO_NOT_TRUST_LABEL", child_first_name: "DO_NOT_ECHO_CHILD",
      child_last_name: "DO_NOT_ECHO_LAST", child_dob: "DO_NOT_ECHO_DOB", allergies: "DO_NOT_ECHO_MEDICAL" } };
}
async function render(inv?: unknown, division: unknown = "14u") {
  const params = { inv: arguments.length === 0 ? ID : inv, division };
  const html = renderToStaticMarkup(await Receipt({ searchParams: Promise.resolve(params as never) }));
  expect(html).not.toMatch(/DO_NOT_ECHO|DO_NOT_TRUST/);
  expect(stub.calls).toHaveLength(0);
  expect(JSON.stringify(logs)).not.toContain("DO_NOT_ECHO");
  return html;
}
function heading(html: string) { return html.match(/<h1[^>]*>(.*?)<\/h1>/)?.[1].replace(/&#x27;|&#39;/g, "'"); }
function unknown(html: string) {
  expect(heading(html)).toBe("We couldn't verify your payment status");
  expect(html).not.toMatch(/Payment received|Registration confirmed|has a spot|You're in|You&rsquo;re in|href="https:\/\/(invoice|pay)\.stripe\.com/);
  expect(html).toContain('href="/mvf-junior-tournament"');
}
test.beforeEach(() => {
  process.env.STRIPE_SECRET_KEY = "sk_test_synthetic_receipt";
  calls = []; value = invoice(); failure = false; logs = [];
  Object.assign(runtime, { jsx: jsx.jsx, jsxs: jsx.jsxs, Fragment: jsx.Fragment });
  stripeModule.getStripe = (() => ({ invoices: { retrieve: async (id: string) => {
    calls.push(id); if (failure) throw new Error("DO_NOT_ECHO_PROVIDER_DETAIL"); return value;
  } } })) as unknown as typeof originalFactory;
  console.error = (...args: unknown[]) => { logs.push(args); };
  stub.reset(); stub.install();
});
test.afterEach(() => {
  stub.uninstall(); stripeModule.getStripe = originalFactory;
  Object.assign(runtime, originalRuntime); console.error = originalError;
  if (savedKey === undefined) delete process.env.STRIPE_SECRET_KEY;
  else process.env.STRIPE_SECRET_KEY = savedKey;
});

test("paid tournament invoice proves payment, without claiming roster or email delivery", async () => {
  value = invoice("paid"); const html = await render();
  expect(heading(html)).toBe("Payment received"); expect(html).toContain("$50.00");
  expect(html).toContain("10U"); expect(html).not.toContain("14U"); expect(html).not.toContain(PAY);
  expect(html).not.toMatch(/Registration confirmed|has a spot|email.*on its way/);
  expect(calls).toEqual([ID]);
});
test("unpaid invoice has one payment next step, not a secured spot", async () => {
  const html = await render(); expect(heading(html)).toBe("One step left: pay your entry fee");
  expect(html).toContain(`href="${PAY}"`); expect(html).toContain("$50.00"); expect(html).toContain("10U");
  expect(html).not.toMatch(/Registration confirmed|has a spot|Payment received|email.*on its way/);
  expect(calls).toEqual([ID]);
});
test("verified nonresident fee and 14U come from the invoice, not query parameters", async () => {
  value.amount_due = 6000; (value.metadata as Record<string, unknown>).division = "14u";
  const html = await render(ID, "10u"); expect(html).toContain("$60.00"); expect(html).toContain("14U");
  expect(html).not.toContain("10U");
});
test("zero-dollar paid invoice remains a verified payment state", async () => {
  value = invoice("paid"); value.amount_paid = 0;
  const html = await render(); expect(heading(html)).toBe("Payment received"); expect(html).toContain("$0.00");
});
for (const status of ["draft", "void", "uncollectible"]) {
  test(`${status} invoice offers contact guidance without payment or confirmation`, async () => {
    value = invoice(status); const html = await render();
    expect(heading(html)).toBe("Contact Coach Sam about your invoice");
    expect(html).not.toContain(PAY); expect(html).not.toMatch(/Payment received|Registration confirmed|has a spot|\$50/);
  });
}
for (const inv of [undefined, "", "not-an-invoice", "in_", "in_bad/id", "in_" + "a".repeat(256), [ID], 42, null]) {
  test(`missing or malformed ID ${JSON.stringify(inv)} does not look up or invent payment`, async () => {
    unknown(await render(inv)); expect(calls).toHaveLength(0);
  });
}
test("missing configuration does not call Stripe or claim success", async () => {
  delete process.env.STRIPE_SECRET_KEY; unknown(await render()); expect(calls).toHaveLength(0);
});
test("lookup failure is unavailable, with no provider-detail leak", async () => {
  failure = true; unknown(await render()); expect(calls).toEqual([ID]);
});
for (const [name, edit] of [
  ["another product", (i: Record<string, unknown>) => { (i.metadata as Record<string, unknown>).kind = "lesson"; }],
  ["another event date", (i: Record<string, unknown>) => { (i.metadata as Record<string, unknown>).event_date = "2027-10-24"; }],
  ["missing metadata", (i: Record<string, unknown>) => { i.metadata = null; }],
  ["wrong invoice", (i: Record<string, unknown>) => { i.id = "in_other"; }],
  ["unknown division", (i: Record<string, unknown>) => { (i.metadata as Record<string, unknown>).division = "adult"; }],
  ["wrong currency", (i: Record<string, unknown>) => { i.currency = "eur"; }],
  ["unknown status", (i: Record<string, unknown>) => { i.status = "unexpected"; }],
] as const) {
  test(`${name} cannot display a paid tournament receipt`, async () => {
    value = invoice("paid"); edit(value); unknown(await render());
  });
}
for (const status of ["paid", "open"]) {
  for (const amount of [-1, 1.5, "5000", null, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    test(`${status} malformed amount ${String(amount)} cannot claim payment or quote a fee`, async () => {
      value = invoice(status); value[status === "paid" ? "amount_paid" : "amount_due"] = amount;
      unknown(await render());
    });
  }
}
test("open zero-due invoice does not claim payment or ask to pay zero", async () => {
  value.amount_due = 0; unknown(await render());
});
for (const url of [null, "https://attacker.example/pay", "javascript:alert(1)", "http://invoice.stripe.com/i/test", "https://invoice.stripe.com.attacker.example/i/test", "https://user:pass@invoice.stripe.com/i/test", "https://invoice.stripe.com:444/i/test"]) {
  test(`unsafe or absent pay URL ${String(url)} leaves pending guidance without a link`, async () => {
    value.hosted_invoice_url = url; const html = await render();
    expect(heading(html)).toBe("One step left: pay your entry fee");
    expect(html).not.toMatch(/href="(?:javascript:|https?:\/\/(?:attacker|invoice|user))/);
    expect(html).toContain("Check your invoice email");
  });
}
test("existing alternate Stripe pay host is allowed", async () => {
  value.hosted_invoice_url = "https://pay.stripe.com/invoice/synthetic";
  expect(await render()).toContain('href="https://pay.stripe.com/invoice/synthetic"');
});
test("metadata is neutral and stays out of search", () => {
  expect(metadata.title).toBe("Tournament registration status — MVF Junior Tournament");
  expect(metadata.description).not.toMatch(/registered|confirmed|you're in/i);
  expect(metadata.robots).toEqual({ index: false, follow: false });
});
