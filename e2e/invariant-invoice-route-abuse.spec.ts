import { test, expect } from "@playwright/test";
import { NextRequest } from "next/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { FetchStub } from "./fixtures/fetch-stub";

process.env.STRIPE_SECRET_KEY = "sk_test_dummy_offline";
process.env.NOTION_API_KEY = "ntn_test_invoice";

import { POST as lesson } from "../src/app/api/checkout-lesson/route";
import { POST as mgDropin } from "../src/app/api/checkout-monday-girls-dropin/route";
import { POST as mvf } from "../src/app/api/checkout-mvf-junior-tournament/route";
import { invoiceSafeName } from "../src/lib/invoice-text";

// Security review 2026-09-28, H2. Three routes turn an anonymous form into a
// finalized Stripe invoice emailed to whatever address was typed, and the
// typed names went verbatim into the invoice text — so anyone could make NGA's
// Stripe account email "Pay here: evil.example" to a stranger. Names reaching
// Stripe are now reduced to letters, and the routes are rate-limited per IP.
// (Whether these routes should email an unverified address at all is Sam's
// decision D2 — not settled here.)

test.describe("invoiceSafeName — what a stranger can make Stripe print", () => {
  const cases: Array<[string, unknown, string]> = [
    ["plain name unchanged", "Ava", "Ava"],
    ["accents and apostrophes survive", "Zoë O’Brien-Nguyễn", "Zoë O’Brien-Nguyễn"],
    ["a URL can't survive", "Pay at https://evil.example/pay", "Pay at https evil example pay"],
    ["markup can't survive", "<a href=x>Verify</a>", "a href x Verify a"],
    ["digits and punctuation dropped", "Kid 2 (call 555-0100!)", "Kid call -"],
    ["capped at 40 characters", "A".repeat(80), "A".repeat(40)],
    ["empty → fallback", "   ", "your player"],
    ["nothing left → fallback", "!!!@@@", "your player"],
    ["non-string → fallback", 42, "your player"],
  ];
  for (const [name, input, expected] of cases) {
    test(name, () => expect(invoiceSafeName(input)).toBe(expected));
  }
  test("the result never contains a dot, slash or colon (no domains, no links)", () => {
    for (const s of ["evil.example", "http://x.y/z", "a:b", "x@y.com"]) {
      expect(invoiceSafeName(s)).not.toMatch(/[.:/@]/);
    }
  });
});

test.describe("every name the invoice routes hand to Stripe goes through invoiceSafeName", () => {
  const ROUTES = [
    "checkout-lesson",
    "checkout-monday-girls-dropin",
    "checkout-mvf-junior-tournament",
  ];
  for (const r of ROUTES) {
    test(r, () => {
      const src = readFileSync(join(__dirname, "..", "src", "app", "api", r, "route.ts"), "utf8");
      const start = src.indexOf("createAndSendSignupInvoice({");
      expect(start, "invoice call present").toBeGreaterThan(-1);
      // Everything the handler builds up to the invoice's footer — minus the
      // metadata block, which is internal and may keep raw values.
      const handler = src.slice(src.indexOf("export async function POST"), src.indexOf("footer:", start));
      const metaStart = handler.indexOf("metadata:", handler.indexOf("createAndSendSignupInvoice({"));
      const visible = handler.slice(0, metaStart) + handler.slice(handler.indexOf("memo:", metaStart));
      expect(visible).not.toMatch(/\$\{data\.(childFirstName|childLastName|parentName)\}/);
      expect(visible).not.toMatch(/customerName:\s*data\.parentName/);
      expect(visible).toContain("invoiceSafeName(");
    });
  }
});

test.describe("invoice routes are rate-limited per IP before any lookup", () => {
  const stub = new FetchStub();
  test.afterEach(() => stub.uninstall());
  for (const [name, handler, path] of [
    ["lesson", lesson, "/api/checkout-lesson"],
    ["monday-girls-dropin", mgDropin, "/api/checkout-monday-girls-dropin"],
    ["mvf", mvf, "/api/checkout-mvf-junior-tournament"],
  ] as const) {
    test(`${name}: the 11th request in an hour from one IP → 429, no network`, async () => {
      stub.reset();
      stub.install(); // any fetch at all would throw
      const ip = `10.44.${name.length}.9`;
      const req = () =>
        new NextRequest(`http://localhost${path}`, {
          method: "POST",
          body: JSON.stringify({}), // invalid on purpose: 400 without any fetch
          headers: { "content-type": "application/json", "x-forwarded-for": ip },
        });
      for (let i = 0; i < 10; i++) expect((await handler(req())).status).not.toBe(429);
      expect((await handler(req())).status).toBe(429);
      expect(stub.calls).toHaveLength(0);
    });
  }
});
