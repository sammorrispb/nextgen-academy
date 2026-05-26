// Pure-function specs for the Color Cluster data + lib. No dev server needed.
//   npx playwright test e2e/clusters.spec.ts --project=desktop
import { test, expect } from "@playwright/test";
import {
  CLUSTERS,
  RESERVED_BALL_COLOR_HEXES,
  type ClusterSlug,
} from "../src/data/clusters";
import { CLUSTER_FAQ } from "../src/data/cluster-faq";
import {
  assertNoSkillBallCollision,
  assertSlugsUniqueAndLower,
  buildCrewWaitlistHref,
  getAllClusters,
  getAllClusterSlugs,
  getClusterBySlug,
  isCanonicalHex,
} from "../src/lib/clusters";

test.describe("CLUSTERS data integrity", () => {
  test("ships exactly 4 clusters for v1", () => {
    expect(CLUSTERS).toHaveLength(4);
  });

  test("every cluster carries the required fields", () => {
    for (const c of CLUSTERS) {
      expect(c.slug).toBeTruthy();
      expect(c.name).toMatch(/Cluster$/);
      expect(c.hex).toMatch(/^#[0-9A-F]{6}$/);
      expect(c.tokenClass).toMatch(/^ngpa-/);
      expect(c.region).toBeTruthy();
      expect(c.neighborhoods.length).toBeGreaterThan(0);
      expect(c.blurb.length).toBeGreaterThan(20);
      expect(c.blurb.length).toBeLessThanOrEqual(200);
    }
  });

  test("slugs are the canonical 4 colors", () => {
    const slugs = CLUSTERS.map((c) => c.slug).sort();
    expect(slugs).toEqual(["cyan", "lime", "orange", "teal"]);
  });

  test("lime is flagged darkSurfaceOnly (1.5:1 contrast on white)", () => {
    const lime = CLUSTERS.find((c) => c.slug === "lime");
    expect(lime?.darkSurfaceOnly).toBe(true);
  });
});

test.describe("getClusterBySlug", () => {
  test("returns the cluster for every canonical slug", () => {
    for (const slug of ["teal", "lime", "orange", "cyan"] as ClusterSlug[]) {
      const c = getClusterBySlug(slug);
      expect(c?.slug).toBe(slug);
    }
  });

  test("returns undefined for unknown slugs", () => {
    expect(getClusterBySlug("magenta")).toBeUndefined();
    expect(getClusterBySlug("")).toBeUndefined();
    expect(getClusterBySlug("TEAL")).toBeUndefined();
  });
});

test.describe("getAllClusterSlugs", () => {
  test("returns the same 4 slugs in CLUSTERS order", () => {
    expect(getAllClusterSlugs()).toEqual(["teal", "lime", "orange", "cyan"]);
  });
});

test.describe("getAllClusters", () => {
  test("returns the full CLUSTERS array", () => {
    expect(getAllClusters()).toHaveLength(4);
  });
});

test.describe("skill-ball-color collision guards", () => {
  test("no cluster hex collides with the reserved skill-ball pathway", () => {
    expect(() => assertNoSkillBallCollision()).not.toThrow();
  });

  test("reserved skill-ball hexes are exactly the four ball colors", () => {
    expect([...RESERVED_BALL_COLOR_HEXES].sort()).toEqual(
      ["#FF4040", "#FF8C00", "#00C853", "#FFD600"].sort(),
    );
  });

  test("Orange cluster hex is distinguishable from ball-orange", () => {
    const orange = CLUSTERS.find((c) => c.slug === "orange");
    expect(orange?.hex).toBe("#FF6B2B");
    expect(orange?.hex).not.toBe("#FF8C00");
  });
});

test.describe("hex + slug invariants", () => {
  test("every cluster hex is canonical #RRGGBB uppercase", () => {
    for (const c of CLUSTERS) {
      expect(isCanonicalHex(c.hex)).toBe(true);
    }
  });

  test("isCanonicalHex rejects non-canonical input", () => {
    expect(isCanonicalHex("#fff")).toBe(false);
    expect(isCanonicalHex("#aabbcc")).toBe(false);
    expect(isCanonicalHex("00B4D8")).toBe(false);
    expect(isCanonicalHex("#GGGGGG")).toBe(false);
  });

  test("slugs are unique and lowercase", () => {
    expect(() => assertSlugsUniqueAndLower()).not.toThrow();
  });
});

test.describe("buildCrewWaitlistHref", () => {
  test("routes to /crew with the cluster query param", () => {
    expect(buildCrewWaitlistHref("teal")).toBe("/crew?cluster=teal");
    expect(buildCrewWaitlistHref("lime")).toBe("/crew?cluster=lime");
    expect(buildCrewWaitlistHref("orange")).toBe("/crew?cluster=orange");
    expect(buildCrewWaitlistHref("cyan")).toBe("/crew?cluster=cyan");
  });
});

test.describe("CLUSTER_FAQ shape", () => {
  test("ships a non-trivial number of items", () => {
    expect(CLUSTER_FAQ.length).toBeGreaterThanOrEqual(6);
  });

  test("every item has a question + answer", () => {
    for (const item of CLUSTER_FAQ) {
      expect(item.question.trim().length).toBeGreaterThan(0);
      expect(item.question.endsWith("?")).toBe(true);
      expect(item.answer.trim().length).toBeGreaterThan(20);
    }
  });

  test("no FAQ answer claims MCPS varsity status for cluster play", () => {
    const joined = CLUSTER_FAQ.map((i) => i.answer.toLowerCase()).join("\n");
    // We're allowed to MENTION MCPS varsity (the corollary program is real),
    // but NEVER claim that NGA clusters ARE varsity or replace school teams.
    expect(joined).not.toMatch(/clusters? (are|is) varsity/);
    expect(joined).not.toMatch(/replaces? (your |the )?school team/);
  });

  test("includes a question that addresses the varsity-confusion trap", () => {
    const questions = CLUSTER_FAQ.map((i) => i.question.toLowerCase());
    expect(questions.some((q) => q.includes("varsity"))).toBe(true);
  });

  test("does not quote dollar amounts (pricing teased per CLAUDE.md)", () => {
    const joined = CLUSTER_FAQ.map((i) => i.answer).join("\n");
    expect(joined).not.toMatch(/\$\d/);
  });

  test("does not mention DD / CourtReserve / JOOLA gear pipeline", () => {
    const joined = CLUSTER_FAQ.map((i) => i.answer.toLowerCase()).join("\n");
    expect(joined).not.toContain("dill dinker");
    expect(joined).not.toContain("courtreserve");
    expect(joined).not.toContain("joola");
    expect(joined).not.toContain("pickleball dc");
  });
});
