import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test, expect } from "@playwright/test";

// Season-play wiring pins (source checks). Actions can't be invoked from a
// pure spec — requireCoach() needs a request scope — so, like
// invariant-coach-inbox-authz, the gate composition is pinned in the source:
//   1. every fall-season action awaits the ONE shared requireCoach and fails
//      closed; no action talks to Notion directly;
//   2. the coach pages live under (authed) — positional gating by the layout;
//   3. the parent page reaches data ONLY through resolveStandingsView, which
//      verifies the signed token BEFORE any Notion read;
//   4. the token family has no NGA_ADMIN_SECRET fallback;
//   5. the parent page is noindex, robots-disallowed, unlisted in the sitemap,
//      and never ISR-cached.
//
// Mutation checks: drop `await requireCoach()` from any action → pin 1 fails;
// move `loadLeagueSnapshot` above `verifyStandingsLink` in resolveStandingsView
// → pin 3 fails; add `signingSecrets("STANDINGS_LINK_SECRET")` to the token lib
// → pin 4 fails.

const root = (...parts: string[]) => join(__dirname, "..", ...parts);
const read = (...parts: string[]) => readFileSync(root(...parts), "utf8");

const actionsSrc = () => read("src", "app", "coach", "(authed)", "fall-season", "actions.ts");
const viewSrc = () => read("src", "lib", "season-league-view.ts");
const tokenSrc = () => read("src", "lib", "standings-link-token.ts");
const parentPageSrc = () => read("src", "app", "fall", "standings", "[group]", "[token]", "page.tsx");

test.describe("fall-season actions are coach-gated", () => {
  test("use the ONE shared requireCoach (no local copy)", () => {
    const src = actionsSrc();
    expect(src).toContain('from "@/lib/coach-auth-server"');
    expect(src).not.toMatch(/async function requireCoach/);
  });

  test("every exported action awaits requireCoach and fails closed", () => {
    const src = actionsSrc();
    const exported = src.match(/export async function \w+Action/g) ?? [];
    expect(exported.length).toBe(7);
    const gates = src.match(/await requireCoach\(\)/g) ?? [];
    expect(gates.length, "each action must call requireCoach()").toBeGreaterThanOrEqual(exported.length);
    const denials = src.match(/if \(!email\) return/g) ?? [];
    expect(denials.length, "each action must return unauthorized on a null gate").toBeGreaterThanOrEqual(exported.length);
  });

  test("actions never call Notion directly — the view lib does", () => {
    const src = actionsSrc();
    expect(src).not.toContain("api.notion.com");
    expect(src).not.toContain("notion-season-league");
    expect(src).toContain('from "@/lib/season-league-view"');
  });
});

test.describe("coach pages sit under (authed)", () => {
  test("both pages exist inside the gated segment and read through the view lib", () => {
    const index = root("src", "app", "coach", "(authed)", "fall-season", "page.tsx");
    const day = root("src", "app", "coach", "(authed)", "fall-season", "[group]", "[week]", "page.tsx");
    expect(existsSync(index)).toBe(true);
    expect(existsSync(day)).toBe(true);
    for (const p of [index, day]) {
      const src = readFileSync(p, "utf8");
      expect(src).not.toContain("api.notion.com");
      expect(src).toContain('export const dynamic = "force-dynamic"');
    }
    // No ungated twin outside (authed).
    expect(existsSync(root("src", "app", "coach", "fall-season"))).toBe(false);
  });
});

test.describe("the parent standings page", () => {
  test("verifies the token before any read, via resolveStandingsView only", () => {
    const page = parentPageSrc();
    expect(page).toContain("resolveStandingsView(");
    expect(page).toContain("notFound()");
    expect(page).not.toContain("api.notion.com");
    expect(page).not.toContain("loadLeagueSnapshot");
    expect(page).not.toContain("fetchSeasonLeagueRows");
    expect(page).not.toContain("fetchFallRosterForLeague");

    const view = viewSrc();
    const fnStart = view.indexOf("export async function resolveStandingsView");
    expect(fnStart).toBeGreaterThan(-1);
    const body = view.slice(fnStart);
    const verifyAt = body.indexOf("verifyStandingsLink(");
    const loadAt = body.indexOf("loadLeagueSnapshot(");
    expect(verifyAt).toBeGreaterThan(-1);
    expect(loadAt).toBeGreaterThan(-1);
    expect(verifyAt, "token check must precede the Notion read").toBeLessThan(loadAt);
  });

  test("is noindex, never ISR-cached, robots-disallowed and absent from the sitemap", () => {
    const page = parentPageSrc();
    expect(page).toMatch(/robots:\s*\{\s*index:\s*false,\s*follow:\s*false\s*\}/);
    expect(page).toContain('export const dynamic = "force-dynamic"');
    expect(page).not.toMatch(/export const revalidate/);
    expect(read("src", "app", "robots.ts")).toContain('"/fall/standings/"');
    expect(read("src", "app", "sitemap.ts")).not.toContain("standings");
  });

  test("the view it renders carries no parent field, age or attendance list", () => {
    const view = viewSrc();
    const start = view.indexOf("export interface StandingsViewRow");
    const end = view.indexOf("export function buildStandingsView");
    const shapes = view.slice(start, end);
    for (const banned of ["parentEmail", "parentPhone", "parentName", "birthYear", "age", "allergies", "emergency", "present", "sitting", "absent"]) {
      expect(shapes, `StandingsView shapes must not carry ${banned}`).not.toMatch(new RegExp(`\\b${banned}\\b`, "i"));
    }
  });
});

test.describe("the standings token family", () => {
  test("reads only STANDINGS_LINK_SECRET — no admin-secret fallback, no shared resolver", () => {
    const src = tokenSrc();
    expect(src).toContain("STANDINGS_LINK_SECRET");
    expect(src).not.toContain("NGA_ADMIN_SECRET");
    expect(src).not.toContain("signingSecrets(");
    expect(src).toContain("secretEquals(");
  });
});
