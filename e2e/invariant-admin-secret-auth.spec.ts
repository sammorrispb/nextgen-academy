import { test, expect } from "@playwright/test";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { NextRequest } from "next/server";

process.env.NGA_ADMIN_SECRET = "test-admin-secret";

import { authorizeAdminSecret } from "../src/lib/admin-secret-auth";

// NGA_ADMIN_SECRET moves from `?secret=` (logged by Vercel, shell history,
// proxies) to `Authorization: Bearer`. The query string stays as a deprecated
// fallback until the `admin_secret_in_query` log goes quiet.

function req(opts: { header?: string; query?: string } = {}): NextRequest {
  const qs = opts.query !== undefined ? `?secret=${encodeURIComponent(opts.query)}` : "";
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (opts.header !== undefined) headers.authorization = opts.header;
  return new NextRequest(`http://localhost/api/x${qs}`, { method: "POST", headers });
}

test.describe("authorizeAdminSecret", () => {
  test("Bearer header with the secret is accepted", () => {
    expect(authorizeAdminSecret(req({ header: "Bearer test-admin-secret" }))).toBe(true);
  });

  test("wrong Bearer is rejected", () => {
    expect(authorizeAdminSecret(req({ header: "Bearer nope" }))).toBe(false);
  });

  test("raw secret without the Bearer scheme is rejected", () => {
    expect(authorizeAdminSecret(req({ header: "test-admin-secret" }))).toBe(false);
  });

  test("a header is judged alone: wrong header + right query is rejected", () => {
    expect(
      authorizeAdminSecret(req({ header: "Bearer nope", query: "test-admin-secret" })),
    ).toBe(false);
  });

  test("deprecated ?secret= still works and is logged without the value", () => {
    const logs: string[] = [];
    const orig = console.warn;
    console.warn = (m: unknown) => logs.push(String(m));
    try {
      expect(authorizeAdminSecret(req({ query: "test-admin-secret" }))).toBe(true);
    } finally {
      console.warn = orig;
    }
    expect(logs.join("\n")).toContain("admin_secret_in_query");
    expect(logs.join("\n")).not.toContain("test-admin-secret");
  });

  test("nothing presented → rejected", () => {
    expect(authorizeAdminSecret(req())).toBe(false);
  });

  test("fails closed when NGA_ADMIN_SECRET is unset", () => {
    const original = process.env.NGA_ADMIN_SECRET;
    try {
      delete process.env.NGA_ADMIN_SECRET;
      expect(authorizeAdminSecret(req({ header: "Bearer " }))).toBe(false);
      expect(authorizeAdminSecret(req({ header: "Bearer undefined" }))).toBe(false);
      expect(authorizeAdminSecret(req({ query: "" }))).toBe(false);
    } finally {
      process.env.NGA_ADMIN_SECRET = original;
    }
  });
});

// Source pin: no API route may read `?secret=` on its own any more — the only
// sanctioned reader is the helper. notion-session-webhook is the one exception
// (its own NOTION_WEBHOOK_SECRET, header-first already).
test.describe("every admin-secret route goes through the helper", () => {
  const API = join(__dirname, "..", "src", "app", "api");
  const EXEMPT = new Set(["notion-session-webhook/route.ts"]);

  function walk(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
      const p = join(dir, name);
      return statSync(p).isDirectory() ? walk(p) : name === "route.ts" ? [p] : [];
    });
  }

  const routes = walk(API);

  test("no route reads searchParams secret directly", () => {
    const offenders = routes
      .filter((p) => !EXEMPT.has(p.slice(API.length + 1)))
      .filter((p) => /searchParams\.get\(\s*["']secret["']\s*\)/.test(readFileSync(p, "utf8")));
    expect(offenders).toEqual([]);
  });

  test("the known operator routes all call authorizeAdminSecret", () => {
    const expected = [
      "camp-followup", "camp-outreach", "cancel-camp-registration",
      "cancel-fall-registration", "cancel-picklpark-registration",
      "cancel-registration", "eval-confirmation", "eval-reengagement",
      "fall-poll-outreach", "fall-reg-link", "fall-survey",
      "fall-venue-change", "post-eval-followup",
    ];
    for (const name of expected) {
      const src = readFileSync(join(API, name, "route.ts"), "utf8");
      expect(src, name).toMatch(/if \(!authorizeAdminSecret\(\w+\)\)/);
    }
  });
});
