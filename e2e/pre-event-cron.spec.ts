import { test, expect } from "@playwright/test";
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
