import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { FetchStub } from "./fixtures/fetch-stub";

process.env.STANDINGS_LINK_SECRET = "standings-secret-test";
process.env.NGA_SYNC_SECRET = "s3cret";
process.env.LINKDINK_BASE_URL = "https://ld.example.test";

import {
  leagueStandingsPath,
  signLeagueStandingsLink,
  verifyLeagueStandingsLink,
} from "../src/lib/league-standings-token";
import { signStandingsLink } from "../src/lib/standings-link-token";
import { ROTATION_LEAGUE_SEASONS } from "../src/data/rotation-league-seasons";
import LeagueStandingsLinkPage from "../src/app/standings/[slug]/[token]/page";
import robots from "../src/app/robots";
import sitemap from "../src/app/sitemap";
import { lockPlayoffTeams, recordPlayoffScore } from "../src/lib/rotation-league/view";

// The parent standings link for a Link & Dink rotation-league season shows
// children's first and last names (Sam, 2026-10-20), so who can open it is the
// whole protection: an unguessable signed URL per season, verified before any
// Link & Dink call, kept out of search, caches and Referer headers, and
// revoked by rotating STANDINGS_LINK_SECRET (no admin-secret fallback).

const [GREEN, YELLOW] = ROTATION_LEAGUE_SEASONS;
const ROOT = process.cwd();
const src = (p: string) => readFileSync(join(ROOT, p), "utf8");

const stub = new FetchStub();
test.beforeEach(() => {
  stub.reset();
  // Other specs in the same worker clear these between tests.
  process.env.STANDINGS_LINK_SECRET = "standings-secret-test";
  process.env.NGA_SYNC_SECRET = "s3cret";
  process.env.LINKDINK_BASE_URL = "https://ld.example.test";
});
test.afterEach(() => stub.uninstall());

test.describe("league standings link — token", () => {
  test("a token opens exactly its own season", () => {
    const t = signLeagueStandingsLink(GREEN.slug);
    expect(t).toBeTruthy();
    expect(verifyLeagueStandingsLink(t, GREEN.slug)).toBe(true);
    expect(verifyLeagueStandingsLink(t, YELLOW.slug)).toBe(false);
    expect(leagueStandingsPath(GREEN.slug, t as string)).toBe(`/standings/${GREEN.slug}/${t}`);
  });

  test("tampered, malformed and cross-family tokens fail", () => {
    const t = signLeagueStandingsLink(GREEN.slug) as string;
    const [enc, mac] = t.split(".");
    for (const bad of [`${enc}.${mac}x`, `${enc}`, "", ".", `${enc}.${mac}.x`, signStandingsLink("Green") ?? "x"]) {
      expect(verifyLeagueStandingsLink(bad, GREEN.slug), bad).toBe(false);
    }
  });

  test("an unset secret signs nothing and verifies nothing, and there is no fallback", () => {
    const t = signLeagueStandingsLink(GREEN.slug);
    const saved = process.env.STANDINGS_LINK_SECRET;
    process.env.STANDINGS_LINK_SECRET = "";
    process.env.NGA_ADMIN_SECRET = "admin-secret-test";
    try {
      expect(signLeagueStandingsLink(GREEN.slug)).toBeNull();
      expect(verifyLeagueStandingsLink(t, GREEN.slug)).toBe(false);
    } finally {
      process.env.STANDINGS_LINK_SECRET = saved;
      delete process.env.NGA_ADMIN_SECRET;
    }
    expect(src("src/lib/league-standings-token.ts")).not.toContain("NGA_ADMIN_SECRET");
  });

  test("rotating the secret revokes every link", () => {
    const t = signLeagueStandingsLink(GREEN.slug);
    process.env.STANDINGS_LINK_SECRET = "rotated";
    try {
      expect(verifyLeagueStandingsLink(t, GREEN.slug)).toBe(false);
    } finally {
      process.env.STANDINGS_LINK_SECRET = "standings-secret-test";
    }
  });
});

test.describe("league standings link — page", () => {
  test("a bad token or unknown season 404s with zero network calls", async () => {
    stub.install();
    const good = signLeagueStandingsLink(GREEN.slug) as string;
    for (const params of [
      { slug: GREEN.slug, token: "nope" },
      { slug: YELLOW.slug, token: good },
      { slug: "not-a-season", token: good },
    ]) {
      await expect(LeagueStandingsLinkPage({ params: Promise.resolve(params) })).rejects.toThrow();
    }
    expect(stub.calls).toHaveLength(0);
  });

  test("a good token reads standings and the playoff from Link & Dink only", async () => {
    stub
      .on("ld.example.test", (call: { body: string }) =>
        JSON.parse(call.body).action === "standings"
          ? { ok: true, standings: [] }
          : { ok: true, locked: false, slots: [], champion: null, runner_up: null, complete: false },
      )
      .install();
    const good = signLeagueStandingsLink(GREEN.slug) as string;
    await LeagueStandingsLinkPage({ params: Promise.resolve({ slug: GREEN.slug, token: good }) });
    expect(stub.calls.map((c) => JSON.parse(c.body).action).sort()).toEqual(["read_playoff", "standings"]);
    for (const c of stub.calls) {
      expect(new URL(c.url).host).toBe("ld.example.test");
      expect(c.body).not.toContain(good);
    }
  });

  test("noindex, no-referrer, never cached, robots-disallowed, not in the sitemap", () => {
    const page = src("src/app/standings/[slug]/[token]/page.tsx");
    expect(page).toContain('export const dynamic = "force-dynamic"');
    expect(page).toContain("robots: { index: false, follow: false }");
    expect(page).toContain('referrer: "no-referrer"');
    expect(page.indexOf("verifyLeagueStandingsLink(")).toBeLessThan(page.indexOf("readStandings(season"));
    const disallow = JSON.stringify(robots().rules);
    expect(disallow).toContain("/standings/");
    expect(JSON.stringify(sitemap())).not.toContain("/standings/");
  });

  test("the page reads only standings and the playoff: no roster, attendance or registrations", () => {
    const page = src("src/app/standings/[slug]/[token]/page.tsx");
    const code = page.replace(/^\s*\/\/.*$/gm, "");
    for (const forbidden of ["readWeek", "previewPlayoff", "readSeasonRegistrations", "birth", "email", "phone", "allerg", "emergency"]) {
      expect(code, forbidden).not.toContain(forbidden);
    }
    expect(code).toContain("readStandings(season.slug)");
    expect(code).toContain("readPlayoff(season.slug)");
  });
});

test.describe("playoff commands carry ids and scores only", () => {
  test("a lock sends seeds and registration refs, a score sends a slot and numbers", async () => {
    process.env.VERCEL_ENV = "preview";
    stub.on("ld.example.test", { ok: true }).install();
    await lockPlayoffTeams(GREEN.slug, [
      ["ref-1", "ref-2"],
      ["ref-3", "ref-4"],
    ]);
    await recordPlayoffScore({ slug: GREEN.slug, slot: "w1m1", scoreA: 11, scoreB: 7, gameTarget: 11, timed: false });
    const bodies = stub.calls.map((c) => JSON.parse(c.body));
    expect(bodies[0]).toEqual({
      action: "playoff_lock",
      season_slug: GREEN.slug,
      teams: [
        { seed: 1, external_refs: ["ref-1", "ref-2"] },
        { seed: 2, external_refs: ["ref-3", "ref-4"] },
      ],
    });
    expect(bodies[1]).toEqual({
      action: "playoff_score",
      season_slug: GREEN.slug,
      slot: "w1m1",
      score_a: 11,
      score_b: 7,
      game_target: 11,
      timed: false,
    });
    delete process.env.VERCEL_ENV;
  });

  test("bad teams and bad slots never leave NGA", async () => {
    stub.install();
    expect((await lockPlayoffTeams(GREEN.slug, [["ref-1"], ["ref-3", "ref-4"]])).ok).toBe(false);
    expect((await lockPlayoffTeams(GREEN.slug, [["a@b.com", "ref-2"], ["ref-3", "ref-4"]])).ok).toBe(false);
    expect(
      (await recordPlayoffScore({ slug: GREEN.slug, slot: "w1 m1", scoreA: 11, scoreB: 7, gameTarget: 11, timed: false })).ok,
    ).toBe(false);
    expect(stub.calls).toHaveLength(0);
  });
});
