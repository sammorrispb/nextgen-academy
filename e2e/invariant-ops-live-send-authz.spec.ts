import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test, expect } from "@playwright/test";

// Env BEFORE import (both allowlists are read at call time, but keep the
// pattern consistent with the sibling invariant specs).
process.env.ADMIN_ALLOWLIST = "sam@admin.test";
process.env.COACH_ALLOWED_EMAILS = "sam@admin.test, coach@allowed.test";

import {
  isOpsLiveSendAdmin,
  authorizeOpsSend,
  validateCampLiveOnly,
} from "../src/lib/ops-authz";

// Parent first-contact blasts are a Sam-reserved surface. The /coach/ops
// console therefore splits authority in two:
//   - PREVIEW (dry run): any allow-listed coach.
//   - LIVE send (all three ops) and the camp `includeAmbiguous` bucket (even
//     on preview): ADMIN identity only — the same ADMIN_ALLOWLIST the /admin
//     portal uses (src/lib/admin-allowlist.ts).
// The decision logic is the pure src/lib/ops-authz.ts, called SERVER-SIDE by
// every ops action — hiding the toggle in the UI is convenience, not the gate.
// Mutation checks: (a) make authorizeOpsSend allow live for non-admins → the
// "denied" cases below fail; (b) make validateCampLiveOnly accept an empty
// allow-list on live → its 400 cases fail; (c) drop the authorizeOpsSend /
// validateCampLiveOnly calls from actions.ts → the source pins fail.

const ADMIN = "sam@admin.test";
const COACH = "coach@allowed.test"; // allow-listed coach, NOT an admin

test.describe("ops live-send authz — live is admin-only, preview is any coach", () => {
  test("admin identity comes from the /admin portal allowlist", () => {
    expect(isOpsLiveSendAdmin(ADMIN)).toBe(true);
    expect(isOpsLiveSendAdmin("  SAM@Admin.Test ")).toBe(true); // case/space-insensitive
    expect(isOpsLiveSendAdmin(COACH)).toBe(false);
    expect(isOpsLiveSendAdmin("sam@admin.test.evil.example")).toBe(false);
  });

  test("non-admin coach: preview (dry run) is allowed", () => {
    expect(authorizeOpsSend(COACH, { live: false })).toEqual({ ok: true });
  });

  test("non-admin coach: LIVE send is rejected with a clear message", () => {
    const d = authorizeOpsSend(COACH, { live: true });
    expect(d.ok).toBe(false);
    if (!d.ok) {
      expect(d.status).toBe(403);
      expect(d.message).toContain("admin");
    }
  });

  test("non-admin coach: includeAmbiguous is rejected EVEN on preview", () => {
    const d = authorizeOpsSend(COACH, { live: false, includeAmbiguous: true });
    expect(d.ok).toBe(false);
    if (!d.ok) {
      expect(d.status).toBe(403);
      expect(d.message).toContain("admin");
    }
  });

  test("admin: live send and includeAmbiguous are both allowed", () => {
    expect(authorizeOpsSend(ADMIN, { live: true })).toEqual({ ok: true });
    expect(
      authorizeOpsSend(ADMIN, { live: true, includeAmbiguous: true }),
    ).toEqual({ ok: true });
  });

  test("fails closed: empty/unset ADMIN_ALLOWLIST denies live sends for everyone", () => {
    const original = process.env.ADMIN_ALLOWLIST;
    try {
      delete process.env.ADMIN_ALLOWLIST;
      expect(authorizeOpsSend(ADMIN, { live: true }).ok).toBe(false);
      process.env.ADMIN_ALLOWLIST = "";
      expect(authorizeOpsSend(ADMIN, { live: true }).ok).toBe(false);
      // Previews stay open — the console degrades to read-only, not broken.
      expect(authorizeOpsSend(ADMIN, { live: false }).ok).toBe(true);
    } finally {
      process.env.ADMIN_ALLOWLIST = original;
    }
  });
});

test.describe("camp live send requires an explicit non-empty allow-list", () => {
  test("live with no allow-list → 400", () => {
    const d = validateCampLiveOnly(true, undefined);
    expect(d.ok).toBe(false);
    if (!d.ok) expect(d.status).toBe(400);
  });

  test("live with an empty or whitespace-only allow-list → 400", () => {
    expect(validateCampLiveOnly(true, []).ok).toBe(false);
    expect(validateCampLiveOnly(true, ["  ", ""]).ok).toBe(false);
  });

  test("live with a real allow-list passes and returns the trimmed list", () => {
    const d = validateCampLiveOnly(true, [" a@x.org ", "b@x.org", ""]);
    expect(d.ok).toBe(true);
    if (d.ok) expect(d.only).toEqual(["a@x.org", "b@x.org"]);
  });

  test("preview may run WITHOUT an allow-list (full eligible count for awareness)", () => {
    const d = validateCampLiveOnly(false, undefined);
    expect(d.ok).toBe(true);
    if (d.ok) expect(d.only).toBeNull();
  });

  test("preview with a pasted allow-list previews exactly that list", () => {
    const d = validateCampLiveOnly(false, ["a@x.org"]);
    expect(d.ok).toBe(true);
    if (d.ok) expect(d.only).toEqual(["a@x.org"]);
  });
});

// ---------------------------------------------------------------------------
// Source pins — the pure gates above are only worth their salt if the server
// actions actually call them. Pin the wiring (same technique as
// invariant-waiver-gate.spec.ts's "gate precedes Stripe" pin).
// ---------------------------------------------------------------------------

test.describe("ops actions wire the gates server-side (source pins)", () => {
  const src = readFileSync(
    join(__dirname, "..", "src", "app", "coach", "(authed)", "ops", "actions.ts"),
    "utf8",
  );

  test("all three actions authorize via authorizeOpsSend (admin-only live)", () => {
    expect(src).toContain('from "@/lib/ops-authz"');
    const calls = src.match(/authorizeOpsSend\(/g) ?? [];
    expect(calls.length, "each of the 3 ops actions must call authorizeOpsSend").toBeGreaterThanOrEqual(3);
  });

  test("campOutreachAction enforces the live allow-list via validateCampLiveOnly", () => {
    expect(src).toContain("validateCampLiveOnly(");
  });

  test("actions use the ONE shared requireCoach (no local copy)", () => {
    expect(src).toContain('from "@/lib/coach-auth-server"');
    expect(src).not.toMatch(/async function requireCoach/);
  });

  test("playerId is type-guarded before .trim() (no throw on missing id)", () => {
    expect(src).toMatch(/typeof input\.playerId === "string"/);
  });

  test("the shared requireCoach is the only copy across the coach area", () => {
    const sites = [
      ["src", "app", "coach", "(authed)", "layout.tsx"],
      ["src", "app", "coach", "(authed)", "eval", "actions.ts"],
      ["src", "app", "coach", "(authed)", "inbox", "actions.ts"],
      ["src", "app", "coach", "(authed)", "polls", "[slug]", "actions.ts"],
      ["src", "app", "coach", "(authed)", "[slug]", "actions.ts"],
    ];
    for (const parts of sites) {
      const s = readFileSync(join(__dirname, "..", ...parts), "utf8");
      expect(s, parts.join("/")).toContain('from "@/lib/coach-auth-server"');
      expect(s, parts.join("/")).not.toMatch(/async function requireCoach/);
    }
  });
});
