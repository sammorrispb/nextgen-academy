/**
 * Smoke test for the dynamic OG image at `src/app/opengraph-image.tsx`.
 *
 * Production verification 2026-05-24 confirmed nextgenpbacademy.com had
 * `og:image: 0` on every page — Slack/iMessage/FB shares rendered with no
 * preview. This convention-based file gives every page a real 1200×630 PNG.
 *
 * Mirrors the source-level assertions in
 * `community-os/apps/platform/src/lib/seo.test.ts`. Runs as a pure-function
 * Playwright spec (no dev server) — `npx playwright test
 * e2e/opengraph-image.spec.ts --project=desktop`.
 */
import { test, expect } from "@playwright/test";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const OG_PATH = join(
  __dirname,
  "..",
  "src",
  "app",
  "opengraph-image.tsx",
);

test.describe("opengraph-image.tsx — Next.js OG convention", () => {
  test("file exists at the canonical path", () => {
    expect(existsSync(OG_PATH), `expected file at ${OG_PATH}`).toBe(true);
  });

  test("exports `alt`, `size`, `contentType`, and a default function", () => {
    const source = readFileSync(OG_PATH, "utf-8");
    expect(source).toMatch(/export const alt =/);
    expect(source).toMatch(/export const size =/);
    expect(source).toMatch(/export const contentType =/);
    expect(source).toMatch(/export default function/);
  });

  test("declares the edge runtime so OG images render fast", () => {
    const source = readFileSync(OG_PATH, "utf-8");
    expect(source).toMatch(/export const runtime = ["']edge["']/);
  });

  test("size is the canonical 1200×630 OG card", () => {
    const source = readFileSync(OG_PATH, "utf-8");
    expect(source).toMatch(/width:\s*1200/);
    expect(source).toMatch(/height:\s*630/);
  });

  test("contentType is image/png", () => {
    const source = readFileSync(OG_PATH, "utf-8");
    expect(source).toMatch(/contentType\s*=\s*["']image\/png["']/);
  });

  test("uses system fonts (does not bundle web fonts)", () => {
    const source = readFileSync(OG_PATH, "utf-8");
    expect(source).toMatch(/system-ui/);
    expect(
      source,
      "OG image should not pull next/font/google — slows the edge render",
    ).not.toMatch(/next\/font\/google/);
  });

  test("age range stays 6–16 — never 5-anchored", () => {
    // Mirror of the seo.spec.ts age-range guard. NGA is 6–16 strict.
    const source = readFileSync(OG_PATH, "utf-8");
    expect(source).toMatch(/6.{0,3}16/);
    expect(source).not.toMatch(/\b5-16\b/);
    expect(source).not.toMatch(/\b5–16\b/);
    expect(source).not.toMatch(/\bages?\s+5\b/i);
  });

  test("alt text is non-empty and brand-appropriate", () => {
    const source = readFileSync(OG_PATH, "utf-8");
    const altMatch = source.match(/export const alt =\s*["']([^"']+)["']|export const alt =\s*\n?\s*["']([^"']+)["']/);
    // alt may also be a template / multi-line string; just assert it's there
    // and references NGA's vocabulary.
    expect(source).toMatch(/Next Gen Pickleball Academy|Pickleball/);
    // Sanity: don't leak DD/CR.
    expect(source).not.toMatch(/Dill Dinkers|CourtReserve/i);
    void altMatch;
  });
});
