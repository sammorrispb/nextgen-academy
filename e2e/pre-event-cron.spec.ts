import { test, expect } from "@playwright/test";
import { NextRequest } from "next/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Env BEFORE importing the route (mirrors cron-alert.spec.ts): the wrapper
// reads CRON_SECRET at request time, but keep the SMS fallback offline —
// sendSms() returns { skipped: "not_configured" } without touching the
// network when the TWILIO_* envs are absent.
process.env.CRON_SECRET = "test-cron-secret";
delete process.env.TWILIO_ACCOUNT_SID;
delete process.env.TWILIO_AUTH_TOKEN;
delete process.env.TWILIO_FROM_NUMBER;

import {
  signSessionCancelToken,
  verifySessionCancelToken,
} from "../src/lib/session-cancel-token";
import { signCancelToken } from "../src/lib/cancel-token";
import {
  parseStartTime,
  sessionStartUtcMs,
  hoursUntilStart,
  isWithinPreEventWindow,
} from "../src/lib/session-time";
import { GET as coachPreEvent } from "../src/app/api/cron/coach-pre-event/route";
import { FetchStub } from "./fixtures/fetch-stub";

// The token libs read NGA_ADMIN_SECRET at call time.
test.beforeAll(() => {
  process.env.NGA_ADMIN_SECRET = "test-secret-abc";
});

test.describe("session cancel token", () => {
  test("round-trips a session id", () => {
    const t = signSessionCancelToken("page-123")!;
    expect(verifySessionCancelToken(t)).toBe("page-123");
  });

  test("rejects a tampered token", () => {
    const t = signSessionCancelToken("page-123")!;
    expect(verifySessionCancelToken(t + "x")).toBeNull();
  });

  test("domain separation: a per-row drop-in token is NOT a valid session token", () => {
    const dropToken = signCancelToken("cs_test_123")!;
    expect(verifySessionCancelToken(dropToken)).toBeNull();
  });

  test("garbage is rejected", () => {
    expect(verifySessionCancelToken("not.a.token")).toBeNull();
    expect(verifySessionCancelToken("")).toBeNull();
  });
});

test.describe("session time math", () => {
  test("parses 12-hour clock incl. noon/midnight edges", () => {
    expect(parseStartTime("4:30 PM")).toEqual({ h: 16, m: 30 });
    expect(parseStartTime("10:00 AM")).toEqual({ h: 10, m: 0 });
    expect(parseStartTime("12:00 PM")).toEqual({ h: 12, m: 0 });
    expect(parseStartTime("12:15 AM")).toEqual({ h: 0, m: 15 });
    expect(parseStartTime("nope")).toBeNull();
  });

  test("EDT start resolves to the right UTC instant (4:30pm ET = 20:30Z in May)", () => {
    const ms = sessionStartUtcMs("2026-05-23", "4:30 PM")!;
    expect(new Date(ms).toISOString()).toBe("2026-05-23T20:30:00.000Z");
  });

  test("EST start in winter is 5h offset (10:00am ET = 15:00Z in January)", () => {
    const ms = sessionStartUtcMs("2026-01-10", "10:00 AM")!;
    expect(new Date(ms).toISOString()).toBe("2026-01-10T15:00:00.000Z");
  });

  test("pre-event window is true ~23h before, false at 25h and after start", () => {
    const start = "2026-05-23T20:30:00.000Z"; // 4:30pm ET
    const at = (iso: string) => new Date(iso);
    expect(isWithinPreEventWindow("2026-05-23", "4:30 PM", at("2026-05-22T21:30:00Z"))).toBe(true); // ~23h
    expect(isWithinPreEventWindow("2026-05-23", "4:30 PM", at("2026-05-22T19:30:00Z"))).toBe(false); // ~25h
    expect(isWithinPreEventWindow("2026-05-23", "4:30 PM", at("2026-05-23T21:00:00Z"))).toBe(false); // after start
    expect(hoursUntilStart("2026-05-23", "4:30 PM", at(start))).toBeCloseTo(0, 1);
  });
});

// ─── Route posture: missing Resend key is a FAILURE, empty coach list is not ─

function cronReq(): NextRequest {
  return new NextRequest("http://localhost/api/cron/coach-pre-event", {
    method: "GET",
    headers: { authorization: "Bearer test-cron-secret" },
  });
}

test.describe("coach-pre-event route — Resend misconfiguration posture", () => {
  const stub = new FetchStub();
  let savedResend: string | undefined;
  let savedCoaches: string | undefined;

  test.beforeEach(() => {
    savedResend = process.env.RESEND_API_KEY;
    savedCoaches = process.env.COACH_ALLOWED_EMAILS;
    stub.reset();
    stub.install();
  });
  test.afterEach(() => {
    stub.uninstall();
    if (savedResend === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = savedResend;
    if (savedCoaches === undefined) delete process.env.COACH_ALLOWED_EMAILS;
    else process.env.COACH_ALLOWED_EMAILS = savedCoaches;
  });

  // The "dead key, nothing reached Sam" incident class: a missing
  // RESEND_API_KEY used to early-return 200 "skipped" — inconsistent with the
  // resend_not_configured failure posture of dropin-reminder /
  // dropin-post-session / crew-followup / weekly-newsletter.
  test("RESEND_API_KEY missing → 500 (failing run), zero network", async () => {
    delete process.env.RESEND_API_KEY;
    process.env.COACH_ALLOWED_EMAILS = "coach@example.com";

    const res = await coachPreEvent(cronReq());
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({
      ok: false,
      cron: "coach-pre-event",
      error: "run failed — see logs",
    });
    // No Notion read (fails before fetching sessions) and no alert email is
    // even possible without a key — the alert lands in logs (+SMS fallback
    // when Twilio is configured; offline here).
    expect(stub.calls.length).toBe(0);
  });

  test("missing key wins over an empty coach list (misconfig beats benign skip)", async () => {
    delete process.env.RESEND_API_KEY;
    delete process.env.COACH_ALLOWED_EMAILS;

    const res = await coachPreEvent(cronReq());
    expect(res.status).toBe(500);
    expect(stub.calls.length).toBe(0);
  });

  test("empty coach list with a live key → benign 200 skip, zero network", async () => {
    process.env.RESEND_API_KEY = "re_test";
    delete process.env.COACH_ALLOWED_EMAILS;

    const res = await coachPreEvent(cronReq());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.skipped).toBe("no coach emails configured");
    expect(stub.calls.length).toBe(0);
  });

  // The generic 500 body hides the signature by design, so pin the
  // controlled-vocabulary signature at the source level (same OBSERVE-only
  // pattern as invariant-camp-promo-code.spec.ts).
  test("route source pushes the sibling-consistent resend_not_configured signature", () => {
    const src = readFileSync(
      join(__dirname, "..", "src", "app", "api", "cron", "coach-pre-event", "route.ts"),
      "utf8",
    );
    expect(src).toMatch(/signature:\s*"resend_not_configured"/);
  });
});
