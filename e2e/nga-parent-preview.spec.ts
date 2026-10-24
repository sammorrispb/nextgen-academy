import { test, expect } from "@playwright/test";
import { createHmac } from "node:crypto";
import { issueParentPreviewCode, verifyParentPreviewCode } from "../src/lib/nga-parent-preview";
const now = Date.parse("2026-10-23T16:00:00Z");
const coach = "synthetic-coach@example.invalid";
const authority = { registrationId: "00000000-0000-4000-8000-000000000004", playerId: "00000000-0000-4000-8000-000000000001", registrationRevision: "a".repeat(64), assessmentRevision: "b".repeat(64), identityRevision: "c".repeat(64), focusId: "skill-6" };
test.beforeEach(() => { process.env.NGA_JOURNEY_PREVIEW_SIGNING_SECRET = "synthetic-dedicated-parent-preview-signing-key-20261023"; process.env.COACH_ALLOWED_EMAILS = coach; });

test("NGA-C9 parent code: dedicated purpose, exact subject and ten-minute lifetime", () => {
  const code = issueParentPreviewCode(authority, coach, now)!;
  expect(code).toMatch(/^ngaj1\./);
  expect(verifyParentPreviewCode(code, now)).toMatchObject({ ...authority, purpose: "nga_registration_journey_preview", issuedAt: now / 1000, expiresAt: now / 1000 + 600 });
  expect(verifyParentPreviewCode(code, now + 600_000)).toBeNull();
  expect(verifyParentPreviewCode(code, now - 1000)).toBeNull();
  expect(code).not.toContain(coach);
});

test("NGA-C9 parent code: unset, weak or malformed dedicated key never falls back", () => {
  process.env.NGA_ADMIN_SECRET = "synthetic-admin-key";
  for (const key of [undefined, "short", " synthetic-dedicated-parent-preview-signing-key", "synthetic-dedicated-parent-preview-signing-key\n"]) {
    if (key === undefined) delete process.env.NGA_JOURNEY_PREVIEW_SIGNING_SECRET; else process.env.NGA_JOURNEY_PREVIEW_SIGNING_SECRET = key;
    expect(issueParentPreviewCode(authority, coach, now)).toBeNull();
    expect(verifyParentPreviewCode("ngaj1.fake.fake", now)).toBeNull();
  }
});

test("NGA-C9 parent code: forged, foreign-purpose, malformed and excessive codes fail closed", () => {
  const code = issueParentPreviewCode(authority, coach, now)!;
  for (const value of ["", "cancel-token", "commit-token", code + ".extra", code.replace("ngaj1", "other"), code.slice(0, -5) + "fake", "x".repeat(5000)]) expect(verifyParentPreviewCode(value, now)).toBeNull();
  for (const patch of [{ registrationId: "../other" }, { playerId: "invalid" }, { focusId: "invented-focus" }, { assessmentRevision: "" }]) expect(issueParentPreviewCode({ ...authority, ...patch }, coach, now)).toBeNull();
});

test("NGA-C9 parent code: issuer removal and key rotation revoke outstanding codes", () => {
  const code = issueParentPreviewCode(authority, coach, now)!;
  process.env.COACH_ALLOWED_EMAILS = "other-coach@example.invalid";
  expect(verifyParentPreviewCode(code, now)).toBeNull();
  expect(issueParentPreviewCode(authority, coach, now)).toBeNull();
  process.env.COACH_ALLOWED_EMAILS = coach;
  process.env.NGA_JOURNEY_PREVIEW_SIGNING_SECRET = "rotated-synthetic-dedicated-parent-preview-signing-key";
  expect(verifyParentPreviewCode(code, now)).toBeNull();
});

test("NGA-C9 parent code: only the exact authority shape can be encoded", () => {
  const extra = { ...authority, childName: "SyntheticChild" };
  expect(issueParentPreviewCode(extra, coach, now) === null).toBe(true);
  for (const malformed of [null, [], "authority", undefined]) expect(issueParentPreviewCode(malformed as never, coach, now) === null).toBe(true);
});

test("NGA-C9 parent code: even signed foreign purpose, extended lifetime and extra fields are rejected", () => {
  const code = issueParentPreviewCode(authority, coach, now)!;
  const claims = JSON.parse(Buffer.from(code.split(".")[1], "base64url").toString("utf8"));
  for (const patch of [{ purpose: "cancel_registration" }, { expiresAt: claims.expiresAt + 1 }, { childName: "SyntheticChild" }, { version: 2 }, { issuedAt: claims.issuedAt + 1 }]) {
    const payload = Buffer.from(JSON.stringify({ ...claims, ...patch })).toString("base64url");
    const signature = createHmac("sha256", process.env.NGA_JOURNEY_PREVIEW_SIGNING_SECRET!).update(`ngaj1.${payload}`).digest("base64url");
    expect(verifyParentPreviewCode(`ngaj1.${payload}.${signature}`, now) === null).toBe(true);
  }
});
