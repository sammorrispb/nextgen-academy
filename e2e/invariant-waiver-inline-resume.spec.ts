import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  WAIVER_REQUIRED_CODE,
  isWaiverRequired,
} from "../src/lib/waiver-required";

/**
 * Invariant: hitting the one-time-waiver gate must never cost a parent their
 * registration.
 *
 * The gate 409s mid-checkout. Every paid form used to answer that by doing
 * `window.location.href = signUrl` — a full page navigation that discards the
 * React state holding the whole form. After signing, /waiver/sign linked back
 * to the program page with an EMPTY form, so the parent had to retype the
 * group, their name, email, phone, the player's first name and birth year, the
 * emergency contact and the allergy note before they could try again. Almost
 * nobody does; the funnel simply ended there and no payment was ever taken
 * (reported live on /fall, 2026-08-16).
 *
 * The fix is structural: the waiver is signed IN PLACE via <InlineWaiverStep>
 * and the form retries checkout with the payload it never let go of. This spec
 * pins that no paid form may navigate to the sign page to satisfy the gate, so
 * a future refactor can't quietly restore the dead end.
 *
 * Source-level for the same reason invariant-waiver-gate.spec.ts observes three
 * of the four checkout routes at the source level: these are client components,
 * and the pure run has no DOM renderer. The decision itself (isWaiverRequired)
 * is pure and IS driven end-to-end below.
 */

const ROOT = join(__dirname, "..");

/** Every client form that fronts a paid Stripe checkout. */
const PAID_FORMS = [
  "src/components/FallRegistrationForm.tsx",
  "src/components/CampRegisterForm.tsx",
  "src/components/LeagueSeasonForm.tsx",
  "src/components/ReserveButton.tsx",
] as const;

function read(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}

test.describe("waiver gate — inline sign, never a lost registration", () => {
  for (const rel of PAID_FORMS) {
    test(`${rel} signs the waiver in place`, () => {
      const src = read(rel);

      // The dead end: navigating away to the sign page loses the form state.
      expect(
        src,
        `${rel} must not navigate to the waiver sign page — that discards the parent's registration`,
      ).not.toMatch(/location\.href\s*=\s*[^;]*signUrl/);
      expect(
        src,
        `${rel} must not link out to /waiver/sign to satisfy the gate`,
      ).not.toMatch(/location\.(href|assign)\s*=\s*["'`]\/waiver\/sign/);

      // The replacement: the gate is still detected, and answered in place.
      expect(
        src,
        `${rel} must still detect the waiver gate`,
      ).toContain("isWaiverRequired");
      expect(
        src,
        `${rel} must render the inline waiver step`,
      ).toContain("InlineWaiverStep");
    });

    test(`${rel} retries checkout with the payload it already had`, () => {
      const src = read(rel);
      // The retry must reuse the captured payload rather than re-reading the
      // DOM — ReserveButton's inputs are uncontrolled and are hidden (not
      // unmounted) behind the waiver step, so a re-read would be empty.
      expect(
        src,
        `${rel} must hand the inline step a resume callback`,
      ).toMatch(/onSigned=\{/);
    });
  }

  test("the shared step posts the signature to the waiver route", () => {
    const src = read("src/components/InlineWaiverStep.tsx");
    expect(src).toContain('"/api/waiver-sign"');
    // Parent contact comes from the registration form the parent just filled
    // in, so the inline step never asks for it twice.
    expect(src).toContain("parentName");
    expect(src).toContain("signatureName");
    // The waiver text is rendered from the single source of truth, so the
    // inline copy can never drift from /waiver and the emailed record copy.
    expect(src).toContain("@/data/waiver");
  });

  test("no child field is persisted outside React state", () => {
    // The alternative fix (bounce, stash, resume) would have written the
    // player's first name, birth year, allergies and emergency contact into
    // browser storage. Signing in place means nothing new is persisted at all.
    for (const rel of [...PAID_FORMS, "src/components/InlineWaiverStep.tsx"]) {
      const src = read(rel);
      // Writes only — ReserveButton *reads* the UTM stash UtmCapture owns,
      // which carries no child field and predates this flow.
      expect(
        src,
        `${rel} must not stash registration data in web storage`,
      ).not.toMatch(/(localStorage|sessionStorage)\s*\.\s*setItem/);
    }
  });
});

test.describe("isWaiverRequired", () => {
  test("fires on the gate's exact 409 contract", () => {
    expect(isWaiverRequired(409, { code: WAIVER_REQUIRED_CODE })).toBe(true);
  });

  test("fires even when signUrl is absent", () => {
    // The old guard also required signUrl and fell through to a raw error
    // toast without it. Nothing navigates now, so the link is not load-bearing.
    expect(
      isWaiverRequired(409, { code: WAIVER_REQUIRED_CODE, signUrl: undefined }),
    ).toBe(true);
  });

  test("ignores every other 409 the checkout routes return", () => {
    // /api/checkout-fall 409s for sold_out and duplicate_registration too —
    // opening the waiver on those would be a lie.
    expect(isWaiverRequired(409, { code: "sold_out" })).toBe(false);
    expect(isWaiverRequired(409, { code: "duplicate_registration" })).toBe(false);
    expect(isWaiverRequired(409, {})).toBe(false);
    expect(isWaiverRequired(409, null)).toBe(false);
  });

  test("ignores the code on a non-409 status", () => {
    expect(isWaiverRequired(200, { code: WAIVER_REQUIRED_CODE })).toBe(false);
    expect(isWaiverRequired(400, { code: WAIVER_REQUIRED_CODE })).toBe(false);
    expect(isWaiverRequired(503, { code: WAIVER_REQUIRED_CODE })).toBe(false);
  });
});

test.describe("the gate's 409 code has one definition", () => {
  test("the server gate reuses the client-safe constant", () => {
    const gate = read("src/lib/waiver-gate.ts");
    expect(
      gate,
      "waiver-gate.ts must re-export WAIVER_REQUIRED_CODE, not redeclare it — two copies drift",
    ).toContain("waiver-required");
    expect(gate).not.toMatch(/WAIVER_REQUIRED_CODE\s*=\s*["']/);
  });

  test("the client-safe module pulls in no server code", () => {
    const src = read("src/lib/waiver-required.ts");
    // Importing notion-waivers (as waiver-gate does) would drag the Notion
    // client into every registration form's browser bundle. Assert on imports
    // and env reads, not prose — the module's own comments name notion-waivers.
    expect(src).not.toMatch(/^\s*(import|export)\s.*\bfrom\s+["'][^"']*notion/m);
    expect(src).not.toMatch(/process\s*\.\s*env/);
  });
});
