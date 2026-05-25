/**
 * Host-based redirects — www.nextgenpbacademy.com → nextgenpbacademy.com.
 *
 * Production verification 2026-05-25 found both hosts returning HTTP 200 with
 * identical content (same etag), splitting PageRank between two GSC properties
 * (apex 65 clicks / www 31 clicks). We're consolidating to the apex.
 *
 * The redirect lives in `next.config.ts` as a `redirects()` entry with a
 * host-based `has` rule. Next.js matches the rule against the request's `Host`
 * header, so against the dev server (baseURL = http://localhost:3000) we can
 * still exercise the rule by overriding the Host header on the request.
 *
 * We use `request.fetch()` with `maxRedirects: 0` so we observe the raw 301
 * (or 308 — Next emits 308 in some versions) rather than auto-following.
 */
import { test, expect } from "@playwright/test";

const WWW_HOST = "www.nextgenpbacademy.com";
const APEX = "https://nextgenpbacademy.com";

const PATHS = [
  "/",
  "/free-evaluation",
  "/youth-pickleball-bethesda",
  "/schedule",
  "/montgomery-county-youth-pickleball",
];

test.describe("www → apex 301", () => {
  for (const path of PATHS) {
    test(`www${path} → apex${path}`, async ({ request }) => {
      const res = await request.fetch(path, {
        method: "GET",
        headers: { host: WWW_HOST },
        maxRedirects: 0,
      });
      // Next.js `permanent: true` emits 308 by default on the App Router
      // edge; either is a permanent redirect signal Google honors.
      expect([301, 308]).toContain(res.status());
      const location = res.headers()["location"];
      expect(location, `Location header for www${path}`).toBeTruthy();
      // Expect absolute redirect to the apex (no www, https). Next.js
      // collapses the trailing slash on "/" (emits the bare origin), so
      // normalize both sides before comparing.
      const norm = (u: string) => u.replace(/\/$/, "");
      expect(norm(location!)).toBe(norm(`${APEX}${path}`));
    });
  }

  test("preserves query string when redirecting", async ({ request }) => {
    const res = await request.fetch("/free-evaluation?utm_source=test&utm_campaign=x", {
      method: "GET",
      headers: { host: WWW_HOST },
      maxRedirects: 0,
    });
    expect([301, 308]).toContain(res.status());
    const location = res.headers()["location"];
    expect(location).toContain("utm_source=test");
    expect(location).toContain("utm_campaign=x");
    expect(location?.startsWith(`${APEX}/free-evaluation`)).toBe(true);
  });

  test("apex requests are NOT redirected", async ({ request }) => {
    // Sanity check — the rule must only fire on the www host. An apex
    // request should resolve normally (200) without any redirect.
    const res = await request.fetch("/", {
      method: "GET",
      headers: { host: "nextgenpbacademy.com" },
      maxRedirects: 0,
    });
    // Apex should not 301 to anywhere. Either 200 or any non-redirect status.
    expect([200, 304]).toContain(res.status());
  });
});
