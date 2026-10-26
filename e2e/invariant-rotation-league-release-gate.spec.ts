import { test, expect } from "@playwright/test";
import { readFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { renderToStaticMarkup } from "react-dom/server";
import { ROTATION_LEAGUE_SEASONS } from "../src/data/rotation-league-seasons";

const require = createRequire(`${process.cwd()}/package.json`);
const league = "src/app/coach/(authed)/league";
const weekDir = `${league}/[slug]/[week]`;
const slug = ROTATION_LEAGUE_SEASONS[0].slug;
const week = ROTATION_LEAGUE_SEASONS[0].playWeeks[0];
const game = {
  id: "aaaaaaaa-bbbb-4ccc-8ddd-000000000001", round: 1, court: 1,
  format: "singles", status: "scheduled", score_a: null, score_b: null, timed: false,
  side_a: ["Player One"], side_b: ["Player Two"], side_a_refs: ["r1"], side_b_refs: ["r2"],
};
const players = [
  { external_ref: "r1", name: "Player One", status: "active", present: true },
  { external_ref: "r2", name: "Player Two", status: "active", present: true },
];

// Execute the real wrappers/components with only request-scoped Next services
// and the view boundary substituted. No coach session or live backend is used.
function harness(authorized = true) {
  const delegated: string[] = [];
  const revalidated: string[] = [];
  const cache = new Map<string, { exports: Record<string, unknown> }>();
  const view = new Proxy({}, {
    get: (_, name: string) => async () => {
      delegated.push(name);
      if (name === "readWeek") return { ok: true, players, games: [game, { ...game, id: "later", round: 2 }] };
      if (name === "readStandings") return { ok: true, standings: [] };
      return { ok: true };
    },
  });
  function load(file: string): Record<string, unknown> {
    const path = resolve(file);
    if (cache.has(path)) return cache.get(path)!.exports;
    const mod = { exports: {} };
    cache.set(path, mod);
    const code = ts.transpileModule(readFileSync(path, "utf8"), {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
      fileName: path,
    }).outputText;
    runInNewContext(code, {
      module: mod, exports: mod.exports,
      require: (id: string) => {
        if (id === "next/cache") return { revalidatePath: (p: string) => revalidated.push(p) };
        if (id === "@/lib/coach-auth-server") return { requireCoach: async () => authorized };
        if (id === "@/lib/rotation-league/view") return view;
        if (id === "next/navigation") return { useRouter: () => ({ refresh() {} }), notFound: () => { throw Error("404"); } };
        if (id.startsWith("@/") || id.startsWith(".")) {
          const base = id.startsWith("@/") ? resolve("src", id.slice(2)) : resolve(dirname(path), id);
          const source = [base, `${base}.ts`, `${base}.tsx`].find((p) => existsSync(p));
          if (!source) throw Error(`Missing test module: ${id}`);
          return load(source);
        }
        return require(id);
      },
    }, { filename: path });
    return mod.exports;
  }
  const actions = load(`${league}/actions.ts`) as Record<string, (input: unknown) => Promise<unknown>>;
  return { load, actions, delegated, revalidated };
}

const changes = [
  ["guestCandidatesAction", { slug }, "guestCandidates"],
  ["addGuestAction", { slug, week, externalRef: "r3" }, "addGuest"],
  ["addGuestAction", { slug, week, firstName: "Guest" }, "addGuest"],
  ["editRoundAction", { slug, week, round: 1, games: [{ gameId: game.id, sideA: ["r2"], sideB: ["r1"] }] }, "editRound"],
  ["replanAfterAction", { slug, week, afterRound: 1, attempt: 1, save: false }, "replanAfter"],
  ["replanAfterAction", { slug, week, afterRound: 1, attempt: 1, save: true }, "replanAfter"],
] as const;

// The backend shipped (community-os #1931, 2026-10-26), so the switch is on.
// These pin that the four actions reach the view again, that coach login is
// still checked first, and that the week page shows the three controls.
for (const [index, [name, input, delegate]] of changes.entries()) {
  test(`${name} case ${index + 1} delegates to the view now the backend is released`, async () => {
    const h = harness();
    expect(await h.actions[name](input)).toEqual({ ok: true });
    expect(h.delegated).toEqual([delegate]);
  });
}

test("coach authentication remains first for every player-change operation", async () => {
  const h = harness(false);
  for (const [name, input] of changes) expect(await h.actions[name](input)).toEqual({ ok: false, message: "Unauthorized" });
  expect(h.delegated).toEqual([]);
  expect(h.revalidated).toEqual([]);
});

test("existing check-in, full-week planning, scoring and game removal still delegate", async () => {
  const h = harness();
  for (const [name, input] of [
    ["checkInAction", { slug, week, externalRef: "r1", present: true }],
    ["planAction", { slug, week, rounds: 2, attempt: 1, save: false }],
    ["planAction", { slug, week, rounds: 2, attempt: 1, save: true }],
    ["scoreAction", { slug, week, gameId: game.id, scoreA: 11, scoreB: 7, gameTarget: 11, timed: false }],
    ["removeGameAction", { slug, week, gameId: game.id }],
  ] as const) expect(await h.actions[name](input)).toEqual({ ok: true });
  expect(h.delegated).toEqual(["checkIn", "planWeek", "planWeek", "recordScore", "removeGame"]);
  expect(h.revalidated).toContain(`/coach/league/${slug}/${week}`);
});

test("the week shows add a player, change players and re-plan, and no unavailable notice", async () => {
  const h = harness();
  const Page = h.load(`${weekDir}/page.tsx`).default as (p: unknown) => Promise<React.ReactNode>;
  const html = renderToStaticMarkup(await Page({ params: Promise.resolve({ slug, week: String(week) }) }));
  expect(html).toContain("+ Add a player");
  expect(html).toContain("Change players");
  expect(html).toContain("Re-plan rounds after this");
  expect(html).not.toContain("temporarily unavailable");
  expect(html).toContain("Player One");
  expect(html).toContain("Plan the rounds");
  expect(html).toContain('aria-label="Score, first side"');
  expect(h.delegated).toEqual(["readWeek", "readStandings"]);
});
