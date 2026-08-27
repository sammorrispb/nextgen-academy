import { test, expect } from "@playwright/test";

import { COURT_DIAGRAMS, findDiagram } from "../src/data/court-diagrams";
import { BALL_RULES, SKILL_STACK, MODIFIED_GAMES } from "../src/data/session-curriculum";

// Pure-data checks. Run with:
//   npx playwright test e2e/court-diagrams.spec.ts --project=desktop
//
// These diagrams are GENERATED markup injected with dangerouslySetInnerHTML on
// a publicly reachable page. That is safe only while the generator's output
// stays inert and self-contained, so this spec pins exactly that — and pins
// that every Skill Stack block and named game still has a picture, because a
// new drill with no diagram is a silent hole in a run sheet.

test.describe("the generated markup is inert", () => {
  test("carries no script, no foreignObject and no inline handlers", () => {
    expect(COURT_DIAGRAMS.length).toBeGreaterThan(0);
    for (const d of COURT_DIAGRAMS) {
      expect(d.svg, `${d.id}: script`).not.toMatch(/<script/i);
      expect(d.svg, `${d.id}: foreignObject`).not.toMatch(/<foreignObject/i);
      expect(d.svg, `${d.id}: style element`).not.toMatch(/<style/i);
      // on* handlers, javascript: urls, and anything that reaches the network
      expect(d.svg, `${d.id}: event handler`).not.toMatch(/\son[a-z]+\s*=/i);
      expect(d.svg, `${d.id}: javascript url`).not.toMatch(/javascript:/i);
      expect(d.svg, `${d.id}: external ref`).not.toMatch(/https?:\/\//i);
      expect(d.svg, `${d.id}: xlink`).not.toMatch(/xlink:href/i);
    }
  });

  test("every marker a figure references is defined inside that same figure", () => {
    for (const d of COURT_DIAGRAMS) {
      const refs = new Set([...d.svg.matchAll(/url\(#([A-Za-z0-9_-]+)\)/g)].map((m) => m[1]));
      const defs = new Set([...d.svg.matchAll(/<marker id="([^"]+)"/g)].map((m) => m[1]));
      for (const r of refs) {
        expect(defs.has(r), `${d.id} references #${r} but does not define it`).toBe(true);
      }
    }
  });

  test("every figure has a viewBox, a caption claim and an aria label", () => {
    for (const d of COURT_DIAGRAMS) {
      expect(d.viewBox, d.id).toMatch(/^0 0 \d+ \d+$/);
      expect(d.claim.length, `${d.id} claim`).toBeGreaterThan(20);
      expect(d.aria.length, `${d.id} aria`).toBeGreaterThan(40);
      expect(d.title, `${d.id} title`).not.toBe("");
    }
  });

  test("ids are unique and resolvable", () => {
    const ids = COURT_DIAGRAMS.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(findDiagram(id)?.id).toBe(id);
    expect(findDiagram("nope")).toBeUndefined();
  });
});

test.describe("nothing on the run sheet is left without a picture", () => {
  const BLOCK_DIAGRAM: Record<number, string> = {
    1: "k2k", 2: "slinky", 3: "drops", 4: "volleys", 5: "kitchen-play", 6: "serve",
  };
  const GAME_DIAGRAM: Record<string, string> = {
    "kitchen-game": "kitchen-game", "seven-eleven": "seven-eleven",
    "skinny-singles": "skinny", "king-of-the-court": "king",
    squirrel: "squirrel", jailbreak: "jailbreak",
  };

  test("every Skill Stack block maps to a diagram that exists", () => {
    for (const block of SKILL_STACK) {
      const id = BLOCK_DIAGRAM[block.order];
      expect(id, `block ${block.order} has no diagram`).toBeTruthy();
      expect(findDiagram(id), `block ${block.order} → ${id}`).toBeDefined();
    }
  });

  test("every named game maps to a diagram that exists", () => {
    // Hot Feet Tag is the one deliberate exception — it is a warm-up with balls
    // spread at random, so a fixed court picture would misrepresent it.
    const exempt = new Set(["hot-feet-tag"]);
    for (const game of MODIFIED_GAMES) {
      if (exempt.has(game.slug)) continue;
      const id = GAME_DIAGRAM[game.slug];
      expect(id, `${game.slug} has no diagram`).toBeTruthy();
      expect(findDiagram(id), `${game.slug} → ${id}`).toBeDefined();
    }
  });

  test("the legend, the arc and the two-court layout are all present", () => {
    for (const id of ["legend", "arc", "two-courts"]) {
      expect(findDiagram(id), id).toBeDefined();
    }
  });

  // The ball-rules panel is rendered from BALL_RULES in the page, NOT generated,
  // so that a rule change can never leave a stale serve count in a picture.
  test("the ball-rules panel is deliberately not a generated diagram", () => {
    expect(findDiagram("ball-rules")).toBeUndefined();
    expect(BALL_RULES.length).toBe(4);
  });
});
