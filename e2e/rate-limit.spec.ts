import { test, expect } from "@playwright/test";
import { NextRequest } from "next/server";
import { createRateLimiter, getClientIp } from "../src/lib/rate-limit";

// Pins the semantics of the shared limiter to EXACTLY what the ten inlined
// copies it replaced did: 5/hr fixed window, per-limiter buckets, fail-open
// reset once the window lapses.

test.describe("createRateLimiter", () => {
  test("allows the first 5 hits, limits the 6th (default 5/hr)", () => {
    const limiter = createRateLimiter();
    for (let i = 0; i < 5; i++) {
      expect(limiter.isRateLimited("1.2.3.4"), `hit ${i + 1}`).toBe(false);
    }
    expect(limiter.isRateLimited("1.2.3.4")).toBe(true);
  });

  test("buckets are per-IP", () => {
    const limiter = createRateLimiter({ limit: 1 });
    expect(limiter.isRateLimited("1.1.1.1")).toBe(false);
    expect(limiter.isRateLimited("1.1.1.1")).toBe(true);
    expect(limiter.isRateLimited("2.2.2.2")).toBe(false);
  });

  test("buckets are per-limiter (two routes never share a window)", () => {
    const a = createRateLimiter({ limit: 1 });
    const b = createRateLimiter({ limit: 1 });
    expect(a.isRateLimited("1.2.3.4")).toBe(false);
    expect(a.isRateLimited("1.2.3.4")).toBe(true);
    expect(b.isRateLimited("1.2.3.4"), "route B unaffected by route A").toBe(false);
  });

  test("window lapse resets the count", async () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: 10 });
    expect(limiter.isRateLimited("1.2.3.4")).toBe(false);
    expect(limiter.isRateLimited("1.2.3.4")).toBe(true);
    await new Promise((r) => setTimeout(r, 25));
    expect(limiter.isRateLimited("1.2.3.4")).toBe(false);
  });
});

test.describe("getClientIp", () => {
  function reqWith(headers: Record<string, string>): NextRequest {
    return new NextRequest("http://localhost/api/lead", { method: "POST", headers });
  }

  test("first x-forwarded-for hop wins, trimmed", () => {
    expect(
      getClientIp(reqWith({ "x-forwarded-for": " 9.9.9.9 , 10.0.0.1" })),
    ).toBe("9.9.9.9");
  });

  test("falls back to x-real-ip, then 'unknown'", () => {
    expect(getClientIp(reqWith({ "x-real-ip": "8.8.8.8" }))).toBe("8.8.8.8");
    expect(getClientIp(reqWith({}))).toBe("unknown");
  });
});
