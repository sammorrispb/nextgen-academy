import { test, expect } from "@playwright/test";
import {
  buildCrewId,
  signCommitToken,
  verifyCommitToken,
} from "../src/lib/commit-token";

test.describe("commit-token", () => {
  test.beforeEach(() => {
    process.env.COMMIT_TOKEN_SECRET = "test-commit-secret-do-not-use-in-prod";
  });

  test("signs and verifies a payload round-trip", () => {
    const payload = {
      parentEmail: "parent@example.com",
      childFirstName: "Avery",
      crewId: "Green|Tuesday|5pm|sherwood hs tennis courts",
    };
    const token = signCommitToken(payload);
    expect(token).toBeTruthy();
    const verified = verifyCommitToken(token!);
    expect(verified).toEqual(payload);
  });

  test("rejects a tampered payload", () => {
    const token = signCommitToken({
      parentEmail: "parent@example.com",
      childFirstName: "Avery",
      crewId: "Green|Tuesday|5pm|sherwood",
    });
    expect(token).toBeTruthy();
    const [payload, mac] = token!.split(".");
    // Flip a char in the payload — MAC must no longer match.
    const tampered = `${payload.slice(0, -1)}x.${mac}`;
    expect(verifyCommitToken(tampered)).toBeNull();
  });

  test("rejects a tampered MAC", () => {
    const token = signCommitToken({
      parentEmail: "a@b.com",
      childFirstName: "Sam",
      crewId: "Yellow|Sat|9am|rockville",
    });
    const [payload, mac] = token!.split(".");
    const tampered = `${payload}.${mac.slice(0, -1)}x`;
    expect(verifyCommitToken(tampered)).toBeNull();
  });

  test("rejects malformed tokens", () => {
    expect(verifyCommitToken("not-a-token")).toBeNull();
    expect(verifyCommitToken("a.b.c")).toBeNull();
    expect(verifyCommitToken("")).toBeNull();
  });

  test("returns null when secret is not configured", () => {
    delete process.env.COMMIT_TOKEN_SECRET;
    delete process.env.NGA_ADMIN_SECRET;
    expect(
      signCommitToken({ parentEmail: "a@b.com", childFirstName: "x", crewId: "y" }),
    ).toBeNull();
  });

  test("falls back to NGA_ADMIN_SECRET when COMMIT_TOKEN_SECRET is unset", () => {
    delete process.env.COMMIT_TOKEN_SECRET;
    process.env.NGA_ADMIN_SECRET = "admin-fallback-secret";
    const token = signCommitToken({
      parentEmail: "a@b.com",
      childFirstName: "Avery",
      crewId: "Green|Tue|5pm|loc",
    });
    expect(token).toBeTruthy();
    expect(verifyCommitToken(token!)).not.toBeNull();
  });
});

test.describe("buildCrewId", () => {
  test("normalizes location to lowercase and strips punctuation", () => {
    const a = buildCrewId({
      level: "Green",
      date: "2026-06-09",
      startTime: "5:00pm",
      location: "Sherwood HS Tennis Courts, Sandy Spring, MD",
    });
    const b = buildCrewId({
      level: "Green",
      date: "2026-06-09",
      startTime: "5:00pm",
      location: "sherwood hs tennis courts sandy spring md",
    });
    expect(a).toBe(b);
  });

  test("normalizes start time by removing whitespace", () => {
    const a = buildCrewId({
      level: "Yellow",
      date: "2026-06-13",
      startTime: "9:00 AM",
      location: "Rockville",
    });
    const b = buildCrewId({
      level: "Yellow",
      date: "2026-06-13",
      startTime: "9:00am",
      location: "Rockville",
    });
    expect(a).toBe(b);
  });

  test("includes weekday derived from the date", () => {
    // 2026-06-09 is a Tuesday in UTC.
    const id = buildCrewId({
      level: "Green",
      date: "2026-06-09",
      startTime: "5pm",
      location: "Rockville",
    });
    expect(id.split("|")[1]).toBe("Tuesday");
  });

  test("two sessions on the same weekday produce identical crew-ids", () => {
    // 2026-06-09 and 2026-06-16 are both Tuesdays — same crew.
    const w1 = buildCrewId({
      level: "Green",
      date: "2026-06-09",
      startTime: "5pm",
      location: "Sherwood",
    });
    const w2 = buildCrewId({
      level: "Green",
      date: "2026-06-16",
      startTime: "5pm",
      location: "Sherwood",
    });
    expect(w1).toBe(w2);
  });

  test("different level or location produces different crew-ids", () => {
    const base = buildCrewId({
      level: "Green",
      date: "2026-06-09",
      startTime: "5pm",
      location: "Sherwood",
    });
    expect(
      buildCrewId({ level: "Yellow", date: "2026-06-09", startTime: "5pm", location: "Sherwood" }),
    ).not.toBe(base);
    expect(
      buildCrewId({ level: "Green", date: "2026-06-09", startTime: "5pm", location: "Wootton" }),
    ).not.toBe(base);
  });
});
