import { test, expect } from "@playwright/test";
import { NextRequest } from "next/server";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { FetchStub, type RecordedFetch } from "./fixtures/fetch-stub";

// Env pinned BEFORE the routes import. NEXT_PUBLIC_SITE_URL is deliberately
// unset so the canonical fallback (seo.ts SITE_URL) is what links must use.
process.env.RESEND_API_KEY = "re_test_origin";
process.env.ADMIN_ALLOWLIST = "admin-origin@example.com";
process.env.COACH_ALLOWED_EMAILS = "coach-origin@example.com";
process.env.COACH_SIGNING_SECRET = "origin-test-signing-secret-0123456789";
delete process.env.NEXT_PUBLIC_SITE_URL;
delete process.env.TWILIO_ACCOUNT_SID;
delete process.env.TWILIO_AUTH_TOKEN;

import { POST as adminRequestLink } from "../src/app/api/admin/request-link/route";
import { POST as coachRequestLink } from "../src/app/api/coach/request-link/route";
import { siteOrigin } from "../src/lib/site-origin";

// Security review 2026-09-28, H1 + M1: emailed sign-in links and Stripe
// return URLs were built from the request's Origin header. An attacker could
// make NGA's real sender email Sam a sign-in link to their own host; one click
// leaked a token worth a 30-day admin cookie. Every link we mint must come
// from server configuration, never from the request.
const CANONICAL = "https://nextgenpbacademy.com";
const EVIL_HEADERS = {
  origin: "https://nextgenpbacademy.com.evil.example",
  host: "evil.example",
  "x-forwarded-host": "evil.example",
  referer: "https://evil.example/login",
};

let ip = 0;
function linkReq(path: string, email: string, fixedIp?: string): NextRequest {
  ip += 1;
  return new NextRequest(`https://evil.example${path}`, {
    method: "POST",
    body: JSON.stringify({ email }),
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": fixedIp ?? `10.8.${Math.floor(ip / 250)}.${ip % 250}`,
      ...EVIL_HEADERS,
    },
  });
}

const stub = new FetchStub();
test.beforeEach(() => {
  stub.reset();
  stub.on("api.resend.com", { id: "email_test" }).install();
});
test.afterEach(() => stub.uninstall());

function sent(): Array<{ to: string | string[]; subject: string; text?: string }> {
  return stub.callsTo("api.resend.com").map((c: RecordedFetch) => JSON.parse(c.body));
}

test.describe("siteOrigin() — server configuration only", () => {
  const cases: Array<[string, string | undefined, string]> = [
    ["unset → canonical", undefined, CANONICAL],
    ["empty string → canonical", "", CANONICAL],
    ["whitespace → canonical", "   ", CANONICAL],
    ["not a URL → canonical", "not a url", CANONICAL],
    ["plain http on a real host → canonical", "http://nextgenpbacademy.com", CANONICAL],
    ["https value is used", "https://www.nextgenpbacademy.com", "https://www.nextgenpbacademy.com"],
    ["trailing slash is dropped", "https://nextgenpbacademy.com/", CANONICAL],
    ["a path is reduced to the origin", "https://nextgenpbacademy.com/some/path?x=1", CANONICAL],
  ];
  for (const [name, value, expected] of cases) {
    test(name, () => {
      const prev = process.env.NEXT_PUBLIC_SITE_URL;
      try {
        if (value === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
        else process.env.NEXT_PUBLIC_SITE_URL = value;
        expect(siteOrigin()).toBe(expected);
      } finally {
        if (prev === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
        else process.env.NEXT_PUBLIC_SITE_URL = prev;
      }
    });
  }
});

test.describe("magic-link routes ignore every request-supplied host", () => {
  for (const [label, handler, path, email, verifyPath] of [
    ["admin", adminRequestLink, "/api/admin/request-link", "admin-origin@example.com", "/admin/auth/verify?token="],
    ["coach", coachRequestLink, "/api/coach/request-link", "coach-origin@example.com", "/coach/auth/verify?token="],
  ] as const) {
    test(`${label}: the emailed link starts with the canonical origin`, async () => {
      const res = await handler(linkReq(path, email));
      expect(res.status).toBe(200);
      const mails = sent();
      expect(mails).toHaveLength(1);
      const text = mails[0].text ?? "";
      expect(text).toContain(`${CANONICAL}${verifyPath}`);
      expect(text).not.toContain("evil.example");
    });

    test(`${label}: per-IP limit — the 11th request in an hour sends nothing`, async () => {
      const fixed = `10.77.${label === "admin" ? 1 : 2}.1`;
      for (let i = 0; i < 10; i++) {
        const ok = await handler(linkReq(path, email, fixed));
        expect(ok.status).toBe(200);
      }
      expect(sent()).toHaveLength(10);
      const limited = await handler(linkReq(path, email, fixed));
      expect(limited.status).toBe(429);
      expect(sent()).toHaveLength(10);
      // A different IP is unaffected — the limit is per IP, never per email,
      // so nobody can lock Sam out by spamming his address.
      const other = await handler(linkReq(path, email));
      expect(other.status).toBe(200);
      expect(sent()).toHaveLength(11);
    });

    test(`${label}: a failed send still errors AND alerts`, async () => {
      stub.reset();
      stub
        .onDynamic("api.resend.com", (call) =>
          call.body.includes("[cron-alert]")
            ? { status: 200, json: { id: "alert_ok" } }
            : { status: 500, json: { name: "application_error", message: "down" } },
        )
        .install();
      const res = await handler(linkReq(path, email));
      expect(res.status).toBe(502);
      const alert = sent().find((m) => m.subject.includes("[cron-alert]"));
      expect(alert, "Sam must learn the sign-in email failed").toBeTruthy();
      expect(alert!.subject).toContain(`${label}-request-link`);
      expect(JSON.stringify(alert)).not.toContain(email);
    });
  }
});

// ── Source guard: no link or redirect may be built from request data ───────
const SRC = join(__dirname, "..", "src");
const REQUEST_ORIGIN_PATTERNS: RegExp[] = [
  /\.get\(\s*["'`](origin|host|x-forwarded-host|x-forwarded-proto|referer)["'`]\s*\)/i,
  /\bnextUrl\.(origin|host|hostname|href)\b/,
  /new\s+URL\(\s*(req|request)\.url\s*\)\.(origin|host|hostname)\b/,
];
// Reviewed exceptions. checkout-fall is rewritten on the unmerged branch
// feat/admin-prorated-fall-registration (which also adds admin/fall-registration);
// that branch swaps to siteOrigin() when it lands — remove both entries then.
const ALLOWLIST = new Set([
  "src/app/api/checkout-fall/route.ts",
  "src/app/api/admin/fall-registration/route.ts",
]);

function findRequestOriginReads(source: string): string[] {
  return source
    .split("\n")
    .filter((line) => REQUEST_ORIGIN_PATTERNS.some((re) => re.test(line)))
    .map((l) => l.trim());
}

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(name)) out.push(p);
  }
  return out;
}

test.describe("source guard — request-derived origins", () => {
  test("the scanner catches every known shape (self-test)", () => {
    const bad = [
      `const o = req.headers.get("origin") ?? x;`,
      `const h = req.headers; const o = h.get('Origin');`,
      "const host = (await headers()).get(`x-forwarded-host`);",
      `const r = request.headers.get("referer");`,
      `const base = req.nextUrl.origin;`,
      `const base = new URL(request.url).origin;`,
    ];
    for (const line of bad) expect(findRequestOriginReads(line), line).toHaveLength(1);
    const fine = [
      `const url = req.nextUrl.clone(); url.pathname = "/admin";`,
      `const dry = new URL(req.url).searchParams.get("dryRun");`,
      `const origin = siteOrigin();`,
    ];
    for (const line of fine) expect(findRequestOriginReads(line), line).toHaveLength(0);
  });

  test("no file under src/ builds a URL from request headers or the request URL's host", () => {
    const offenders: string[] = [];
    for (const file of walk(SRC)) {
      const rel = relative(join(__dirname, ".."), file);
      if (ALLOWLIST.has(rel)) continue;
      const hits = findRequestOriginReads(readFileSync(file, "utf8"));
      for (const h of hits) offenders.push(`${rel}: ${h}`);
    }
    expect(offenders).toEqual([]);
  });
});
