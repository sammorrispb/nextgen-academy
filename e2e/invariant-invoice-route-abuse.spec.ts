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
import { cleanPersonName, invoiceSafeName } from "../src/lib/invoice-text";
import { mvfTournamentSignupConfirmationSubject } from "../src/lib/email/mvf-tournament-signup-confirmation";

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
    ["look-alike dot (Lisu) can't survive", "Pay at evil\uA4F8com", "Pay at evil com"],
    ["look-alike colon and slashes can't survive", "https\u02D0\u141F\u141Fevil\uA78Fcom", "https evil com"],
    ["a URL can't survive", "Pay at https://evil.example/pay", "Pay at https evil example pay"],
    ["markup can't survive", "<a href=x>Verify</a>", "a href x Verify a"],
    ["digits and punctuation dropped", "Kid 2 (call 555-0100!)", "Kid call -"],
    ["capped at 40 characters", "A".repeat(80), "A".repeat(40)],
    ["empty → fallback", "   ", "your player"],
    ["nothing left → fallback", "!!!@@@", "your player"],
    ["non-string → fallback", 42, "your player"],
    // Latin letters U+01C0–U+01C3 (ǀ ǁ ǂ ǃ) read as a pipe, a double pipe, a
    // crossed bar and a "!".
    ["pipe look-alike letters can't survive", "Pay\u01C0evil\u01C1com\u01C2now\u01C3", "Pay evil com now"],
    // A combining mark only rides a letter: after a space, a hyphen, an
    // apostrophe, a stripped character or the start, a dot-below mark would
    // print as a floating "." between words.
    ["a floating dot mark between spaces can't survive", "evil \u0323 com", "evil com"],
    ["a mark where a dot was stripped can't survive", "evil.\u0323com", "evil com"],
    ["a leading mark can't survive", "\u0307Ava", "Ava"],
    ["a mark after a hyphen or apostrophe can't survive", "Mary-\u0323Kate O'\u0307Neil", "Mary-Kate O'Neil"],
    // Positive control: a letter + mark with no precomposed form (q̇) stays.
    ["a mark on a letter survives", "Aq\u0307a Nguyễn", "Aq\u0307a Nguyễn"],
  ];
  for (const [name, input, expected] of cases) {
    test(name, () => expect(invoiceSafeName(input)).toBe(expected));
  }
  test("the result never contains a dot, slash or colon (no domains, no links)", () => {
    for (const s of ["evil.example", "http://x.y/z", "a:b", "x@y.com", "evil\uA4F8com", "x\u02D0\u141Fy", "x\u01C0y\u01C3"]) {
      expect(invoiceSafeName(s)).not.toMatch(/[.:/@\uA4F8\u02D0\u141F\uA78F\u01C0-\u01C3]/);
    }
  });
  test("no spacing or enclosing mark survives, even on a letter", () => {
    // Mc/Me marks print their own glyph: U+302E is a dot, U+0903 a colon.
    const survivors: string[] = [];
    for (let cp = 0; cp <= 0x10ffff; cp++) {
      if (cp >= 0xd800 && cp <= 0xdfff) continue;
      const ch = String.fromCodePoint(cp);
      if (!/[\p{Mc}\p{Me}]/u.test(ch)) continue;
      if (cleanPersonName(`evil${ch}com`) !== "evil com") survivors.push(cp.toString(16));
    }
    expect(survivors).toEqual([]);
  });
  test("a non-spacing mark from another script can't ride a Latin letter", () => {
    // U+0901 Devanagari candrabindu is Mn but Script=Devanagari.
    expect(cleanPersonName("evil\u0901com")).toBe("evil com");
    // Inherited-script marks (the ordinary accents) still attach.
    expect(cleanPersonName("Nguye\u0302\u0303n")).toBe("Nguyễn");
  });
  test("the 40-character cap never splits a character", () => {
    const astralLatin = String.fromCodePoint(0x1df00); // Latin Extended-G, Script=Latin
    const out = cleanPersonName("A".repeat(39) + astralLatin + "B");
    expect(out.isWellFormed()).toBe(true);
    expect(Array.from(out)).toHaveLength(40);
  });
  test("no combining mark survives anywhere but on a letter", () => {
    for (const s of [" \u0323 ", "a \u0323\u0323 b", "1\u0307x", "-\u0301", "ꓸ\u0323com", "\u01C3\u0323"]) {
      expect(invoiceSafeName(s, "")).not.toMatch(/(?<![\p{L}\p{M}])\p{M}/u);
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
      // After the invoice: anything else addressed to the typed email.
      const after = src.slice(src.indexOf("footer:", start));
      expect(after).not.toMatch(/childFirst:\s*data\.childFirstName/);
      expect(after).not.toMatch(/parentFirst\s*=\s*data\.parentName/);
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
    test(`${name}: the 21st request in an hour from one IP → 429, no network`, async () => {
      stub.reset();
      stub.install(); // any fetch at all would throw
      const ip = `10.44.${name.length}.9`;
      const req = () =>
        new NextRequest(`http://localhost${path}`, {
          method: "POST",
          body: JSON.stringify({}), // invalid on purpose: 400 without any fetch
          headers: { "content-type": "application/json", "x-forwarded-for": ip },
        });
      for (let i = 0; i < 20; i++) expect((await handler(req())).status).not.toBe(429);
      const limited = await handler(req());
      expect(limited.status).toBe(429);
      expect((await limited.json()).error).toContain("301-325-4731");
      expect(stub.calls).toHaveLength(0);
    });
  }
});

test("the MVF pre-payment email and the partner notice get cleaned names", () => {
  const notify = readFileSync(join(__dirname, "..", "src", "lib", "signup-admin-notify.ts"), "utf8");
  expect(notify).toMatch(/subject:[^\n]*invoiceSafeName\(notice\.childFirstName\)/);
  // The subject renders whatever childFirst it is handed — the route must hand it a cleaned one.
  expect(mvfTournamentSignupConfirmationSubject({ childFirst: invoiceSafeName("Pay at evil.example/now") }))
    .not.toMatch(/evil\.example/);
});

// The one-time audit of customers created before this fix (their stored name
// still prints on future invoices). Read-only, and it never prints a name.
test.describe("scripts/audit-stripe-customer-names.mjs", () => {
  // A dynamic import: the runner turns a static one into require(), which
  // can't load a plain ES module.
  type AuditModule = {
    auditCustomers: (opts: {
      apiKey: string;
      fetchImpl: (url: string, init: RequestInit) => Promise<Response>;
      write: (line: string) => void;
    }) => Promise<{ scanned: number; flagged: number }>;
    cleanPersonName: (raw: unknown) => string;
    nameAuditReasons: (name: unknown) => string[];
  };
  let auditCustomers: AuditModule["auditCustomers"];
  let scriptCleanPersonName: AuditModule["cleanPersonName"];
  let nameAuditReasons: AuditModule["nameAuditReasons"];
  test.beforeAll(async () => {
    const mod = (await import("../scripts/audit-stripe-customer-names.mjs")) as AuditModule;
    ({ auditCustomers, nameAuditReasons } = mod);
    scriptCleanPersonName = mod.cleanPersonName;
  });
  test("reason codes", () => {
    const cases: Array<[unknown, string[]]> = [
      ["Zoë O’Brien-Nguyễn", []],
      ["Aq\u0307a", []],
      [null, []],
      ["", []],
      ["Pay at evil.example", ["punct"]],
      ["x@y", ["punct"]],
      ["Kid 2", ["digit"]],
      ["Kid \u0662", ["digit", "non_latin"]],
      ["Pay\u01C3", ["lookalike"]],
      ["evil \u0323 com", ["lookalike"]],
      ["evil\uA78Fcom", ["lookalike"]],
      ["\u674E\u5C0F\u9F99", ["non_latin"]],
      ["evil\uA4F8com", ["lookalike", "non_latin"]],
      ["<b>Ava</b>", ["punct"]],
      ["Ava!", ["other"]],
    ];
    for (const [name, expected] of cases) {
      expect(nameAuditReasons(name), JSON.stringify(name)).toEqual(expected);
    }
  });

  test("the script's cleaner matches the invoice cleaner (no drift)", () => {
    const fixtures = [
      "Zoë O’Brien-Nguyễn", "Pay at https://evil.example/pay", "evil\uA4F8com", "x\u02D0\u141Fy",
      "Pay\u01C0evil\u01C3", "evil \u0323 com", "Mary-\u0323Kate", "Aq\u0307a", "A".repeat(80), "evil\u302Ecom", "evil\u{1D16D}com", "https\u0903", "evil\u0901com",
      "A".repeat(39) + "\u{1DF00}B",
      "\u674E\u5C0F\u9F99", "Kid 2 (call 555-0100!)", "ꞏ", "\u02B0i", "", "   ",
    ];
    for (const f of fixtures) expect(scriptCleanPersonName(f), JSON.stringify(f)).toBe(cleanPersonName(f));
  });

  test("pages through every customer with GET only and prints ids, dates and codes — never a name or email", async () => {
    const calls: Array<{ url: string; method: string }> = [];
    const pages = [
      {
        has_more: true,
        data: [
          { id: "cus_a", created: 1756684800, name: "Pay at evil.example", email: "victim@example.com" },
          { id: "cus_b", created: 1756684800, name: "Zoë O’Brien", email: "zoe@example.com" },
        ],
      },
      {
        has_more: false,
        data: [{ id: "cus_c", created: 1759190400, name: "Auditkid 2", email: "kid@example.com" }],
      },
    ];
    const fetchImpl = async (url: string, init: RequestInit) => {
      calls.push({ url, method: init.method ?? "GET" });
      return new Response(JSON.stringify(pages[calls.length - 1]), { status: 200 });
    };
    const lines: string[] = [];
    const result = await auditCustomers({ apiKey: "rk_test_audit", fetchImpl, write: (l: string) => lines.push(l) });

    expect(result).toEqual({ scanned: 3, flagged: 2 });
    expect(calls.map((c) => c.method)).toEqual(["GET", "GET"]);
    for (const c of calls) expect(c.url.startsWith("https://api.stripe.com/v1/customers?")).toBe(true);
    expect(new URL(calls[1].url).searchParams.get("starting_after")).toBe("cus_b");
    expect(lines).toEqual([
      "cus_a\t2025-09-01\tpunct",
      "cus_c\t2025-09-30\tdigit",
      "scanned 3 customers, flagged 2",
    ]);
    const out = lines.join("\n");
    for (const pii of ["evil", "Zoë", "Auditkid", "@example.com", "victim"]) expect(out).not.toContain(pii);
  });

  test("a page that says there is more but carries no customers stops the run instead of reporting a clean scan", async () => {
    for (const data of [[], null]) {
      const fetchImpl = async () => new Response(JSON.stringify({ has_more: true, data }), { status: 200 });
      const lines: string[] = [];
      await expect(
        auditCustomers({ apiKey: "rk_test_audit", fetchImpl, write: (l: string) => lines.push(l) }),
      ).rejects.toThrow(/incomplete/);
      expect(lines).toEqual([]);
    }
  });

  test("a spacing mark and a long clean name are classified correctly", () => {
    expect(nameAuditReasons("evil\u{1D16D}com")).toEqual(["lookalike"]);
    expect(nameAuditReasons("Ava ".repeat(15).trim())).toEqual([]);
  });

  test("a Stripe error stops the run and reports the status alone", async () => {
    const fetchImpl = async () =>
      new Response(JSON.stringify({ error: { message: "No such customer: Leakname" } }), { status: 401 });
    const lines: string[] = [];
    await expect(
      auditCustomers({ apiKey: "rk_test_audit", fetchImpl, write: (l: string) => lines.push(l) }),
    ).rejects.toThrow(/^Stripe customer list failed: HTTP 401$/);
    expect(lines).toEqual([]);
  });

  test("the script has no way to write to Stripe", () => {
    const src = readFileSync(join(__dirname, "..", "scripts", "audit-stripe-customer-names.mjs"), "utf8");
    expect(src.match(/method:\s*"[A-Z]+"/g)).toEqual(['method: "GET"']);
    expect(src).not.toMatch(/new Stripe\(|from\s+"stripe"|require\("stripe"\)/);
    // The only Stripe URL is the customer list.
    expect([...src.matchAll(/https:\/\/api\.stripe\.com[^"`]*/g)].map((m) => m[0])).toEqual([
      "https://api.stripe.com/v1/customers",
    ]);
    expect(src).not.toMatch(/console\.log\([^)]*\.(name|email)\b/);
  });
});
