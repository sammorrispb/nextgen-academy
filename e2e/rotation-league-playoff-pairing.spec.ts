import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { FetchStub } from "./fixtures/fetch-stub";

process.env.NGA_SYNC_SECRET = "s3cret";
process.env.LINKDINK_BASE_URL = "https://ld.example.test";

import { ROTATION_LEAGUE_SEASONS } from "../src/data/rotation-league-seasons";
import { SEASON_LEAGUE_PLAYOFF_PAIRING } from "../src/data/season-league-2026";
import { previewPlayoff } from "../src/lib/rotation-league/view";

// The Fall 2026 playoff pairs the top half of the standings against the bottom
// half (Sam, 2026-11-01): eight kids play 1+4 v 5+8 and 2+3 v 6+7. The rule
// itself is pinned in season-league-finals.spec.ts; this spec pins how the two
// playoff pages ask for it. Link & Dink builds the teams for the trial seasons,
// and a build from before the `pairing` field existed rejects it as bad_input,
// so the view must fall back to that build's snake teams and SAY so rather than
// present them as the rule. Pure, no dev server:
//   npx playwright test e2e/rotation-league-playoff-pairing.spec.ts --project=desktop

const [GREEN] = ROTATION_LEAGUE_SEASONS;
const ROOT = process.cwd();
const stub = new FetchStub();
const bodies = () => stub.calls.map((c) => JSON.parse(c.body));
const snake = (n: number) =>
  Array.from({ length: n / 2 }, (_, i) => ({
    seed: i + 1,
    players: [
      { external_ref: `ref-${i + 1}`, name: `Kid${i + 1}` },
      { external_ref: `ref-${n - i}`, name: `Kid${n - i}` },
    ],
  }));

test.beforeEach(() => {
  stub.reset();
  process.env.VERCEL_ENV = "preview";
  process.env.NGA_SYNC_SECRET = "s3cret";
  process.env.LINKDINK_BASE_URL = "https://ld.example.test";
});
test.afterEach(() => {
  stub.uninstall();
  delete process.env.VERCEL_ENV;
});

test("both Fall seasons on Link & Dink and the Notion season play declare the top-half / bottom-half rule", () => {
  expect(ROTATION_LEAGUE_SEASONS.map((s) => s.playoffPairing)).toEqual(["halves", "halves"]);
  expect(SEASON_LEAGUE_PLAYOFF_PAIRING).toBe("halves");
});

test("the preview asks Link & Dink for the season's rule, and for nothing else", async () => {
  stub.on("ld.example.test", { ok: true, locked: false, pairing: "halves", teams: snake(8) }).install();
  const r = await previewPlayoff(GREEN.slug);
  expect(r.ok).toBe(true);
  if (!r.ok) return;
  expect(r.pairing).toBe("halves");
  expect(r.pairingApplied).toBe(true);
  expect(r.teams).toHaveLength(4);
  expect(bodies()).toEqual([{ action: "playoff_preview", season_slug: GREEN.slug, pairing: "halves" }]);
});

test("a snake pick travels as no field at all, so an older Link & Dink build still answers", async () => {
  stub.on("ld.example.test", { ok: true, locked: false, teams: snake(8) }).install();
  const r = await previewPlayoff(GREEN.slug, "snake");
  expect(r.ok && r.pairing).toBe("snake");
  expect(r.ok && r.pairingApplied).toBe(true);
  expect(bodies()).toEqual([{ action: "playoff_preview", season_slug: GREEN.slug }]);
});

test("when Link & Dink refuses the pairing field, its snake teams come back flagged, not relabelled", async () => {
  stub
    .onDynamic("ld.example.test", (call) =>
      JSON.parse(call.body).pairing
        ? { status: 400, json: { error: "bad_input" } }
        : { status: 200, json: { ok: true, locked: false, teams: snake(8) } },
    )
    .install();
  const r = await previewPlayoff(GREEN.slug);
  expect(r.ok).toBe(true);
  if (!r.ok) return;
  expect(r.pairing).toBe("snake");
  expect(r.pairingApplied).toBe(false);
  expect(r.teams[0].players.map((p) => p.external_ref)).toEqual(["ref-1", "ref-8"]);
  expect(bodies()).toEqual([
    { action: "playoff_preview", season_slug: GREEN.slug, pairing: "halves" },
    { action: "playoff_preview", season_slug: GREEN.slug },
  ]);
});

test("any other refusal is reported as before, with no second try", async () => {
  stub.on("ld.example.test", { error: "season_not_found" }, 404).install();
  const r = await previewPlayoff(GREEN.slug);
  expect(r.ok).toBe(false);
  expect(stub.calls).toHaveLength(1);
});

test("an unknown pairing pick never leaves NGA", async () => {
  stub.install();
  expect((await previewPlayoff(GREEN.slug, "random")).ok).toBe(false);
  expect((await previewPlayoff(GREEN.slug, 4)).ok).toBe(false);
  expect(stub.calls).toHaveLength(0);
});

test("the Notion season play seeds with the season's rule and never calls snake directly", () => {
  const code = readFileSync(join(ROOT, "src/lib/season-league-view.ts"), "utf8");
  expect(code).toContain("pairTeams(ranked, SEASON_LEAGUE_PLAYOFF_PAIRING)");
  expect(code).not.toMatch(/\bsnakeTeams\(/);
});
