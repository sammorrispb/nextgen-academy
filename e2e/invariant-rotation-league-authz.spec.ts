import { test, expect } from "@playwright/test";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  findRotationLeagueSeason,
  parsePlayWeek,
  ROTATION_LEAGUE_SEASONS,
} from "../src/data/rotation-league-seasons";

// The rotation-league coach screens read and write children's names on Link &
// Dink, so they live under coach/(authed) (the layout's requireCoach gate) and
// every server action checks the coach session itself before doing anything:
// a server action is reachable by POST without the layout ever rendering.

const ROOT = process.cwd();
const LEAGUE_DIR = join(ROOT, "src/app/coach/(authed)/league");
const src = (p: string) => readFileSync(join(ROOT, p), "utf8");

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

test.describe("rotation-league coach screens — authorization", () => {
  test("every exported action checks the coach session before anything else", () => {
    const actions = src("src/app/coach/(authed)/league/actions.ts");
    expect(actions.startsWith('"use server";')).toBe(true);
    const bodies = actions.split(/\nexport async function /).slice(1);
    expect(bodies.length).toBeGreaterThanOrEqual(5);
    for (const body of bodies) {
      const name = body.slice(0, body.indexOf("("));
      const open = body.indexOf("{\n", body.indexOf(")"));
      const firstStatement = body.slice(open + 2).trimStart().split("\n")[0];
      expect(firstStatement, name).toBe("if (!(await requireCoach())) return UNAUTHORIZED;");
    }
  });

  test("no fetch or env read lives in the actions; they delegate to the view", () => {
    const actions = src("src/app/coach/(authed)/league/actions.ts");
    expect(actions).not.toMatch(/\bfetch\(/);
    expect(actions).not.toMatch(/process\.env/);
  });

  test("every league page sits under the coach-auth layout", () => {
    const pages = walk(LEAGUE_DIR).filter((p) => p.endsWith("page.tsx"));
    expect(pages.length).toBeGreaterThanOrEqual(2);
    for (const p of pages) expect(p).toContain(join("src", "app", "coach", "(authed)", "league"));
    expect(src("src/app/coach/(authed)/layout.tsx")).toContain("requireCoach");
  });

  test("no league surface exists outside the coach area", () => {
    const appRoutes = walk(join(ROOT, "src/app")).filter(
      (p) => /rotation-league|\/league\//.test(p) && !p.includes(join("coach", "(authed)", "league")),
    );
    // /league (the 14U/16U product) predates this and never imports the client.
    for (const p of appRoutes) {
      expect(readFileSync(p, "utf8"), p).not.toContain("rotation-league/client");
      expect(readFileSync(p, "utf8"), p).not.toContain("rotation-league/view");
    }
  });

  test("only configured seasons and their play weeks are accepted", () => {
    const season = ROTATION_LEAGUE_SEASONS[0];
    expect(findRotationLeagueSeason("nga-not-a-season")).toBeNull();
    expect(findRotationLeagueSeason(undefined)).toBeNull();
    expect(parsePlayWeek(season, "3")).toBe(3);
    expect(parsePlayWeek(season, season.playoffWeek)).toBeNull();
    expect(parsePlayWeek(season, "3.5")).toBeNull();
    expect(parsePlayWeek(season, "../1")).toBeNull();
  });

  test("season slugs match Link & Dink's rule and are unique", () => {
    const slugs = ROTATION_LEAGUE_SEASONS.map((s) => s.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const s of slugs) expect(s).toMatch(/^[a-z0-9][a-z0-9-]{1,79}$/);
  });
});
