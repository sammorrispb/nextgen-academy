// Pure-function specs for the NGA Cluster data + lib. No dev server needed.
//   npx playwright test e2e/clusters.spec.ts --project=desktop
import { test, expect } from "@playwright/test";
import {
  CLUSTERS,
  LEGACY_COLOR_SLUGS,
  RESERVED_BALL_COLOR_HEXES,
  type ClusterSlug,
} from "../src/data/clusters";
import { CLUSTER_FAQ } from "../src/data/cluster-faq";
import {
  assertEveryServiceCityHasCluster,
  assertNoSkillBallCollision,
  assertSlugsUniqueAndLower,
  buildCrewWaitlistHref,
  getAllClusters,
  getAllClusterSlugs,
  getClusterBySlug,
  getClusterForCity,
  isCanonicalHex,
  isClusterSlug,
  resolveClusterSlug,
} from "../src/lib/clusters";
import { SERVICE_AREAS } from "../src/lib/seo";

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

  test("slugs are the canonical 4 areas (never colors)", () => {
    const slugs = CLUSTERS.map((c) => c.slug).sort();
    expect(slugs).toEqual([
      "down-county",
      "east-county",
      "mid-county",
      "up-county",
    ]);
  });

  test("no cluster name or slug mentions a color", () => {
    for (const c of CLUSTERS) {
      expect(c.name).not.toMatch(/teal|lime|orange|cyan/i);
      expect(c.slug).not.toMatch(/teal|lime|orange|cyan/);
      expect(c.name).toContain(c.region);
    }
  });

  test("the lime-colored cluster is flagged darkSurfaceOnly (1.5:1 contrast on white)", () => {
    const upCounty = CLUSTERS.find((c) => c.slug === "up-county");
    expect(upCounty?.hex).toBe("#AADC00");
    expect(upCounty?.darkSurfaceOnly).toBe(true);
  });
});

test.describe("getClusterBySlug", () => {
  test("returns the cluster for every canonical slug", () => {
    for (const slug of [
      "down-county",
      "up-county",
      "east-county",
      "mid-county",
    ] as ClusterSlug[]) {
      const c = getClusterBySlug(slug);
      expect(c?.slug).toBe(slug);
    }
  });

  test("returns undefined for unknown + legacy color slugs (strict lookup)", () => {
    expect(getClusterBySlug("magenta")).toBeUndefined();
    expect(getClusterBySlug("")).toBeUndefined();
    expect(getClusterBySlug("teal")).toBeUndefined();
    expect(getClusterBySlug("DOWN-COUNTY")).toBeUndefined();
  });
});

test.describe("getAllClusterSlugs", () => {
  test("returns the same 4 slugs in CLUSTERS order", () => {
    expect(getAllClusterSlugs()).toEqual([
      "down-county",
      "up-county",
      "east-county",
      "mid-county",
    ]);
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

  test("East-County accent hex is distinguishable from ball-orange", () => {
    const eastCounty = CLUSTERS.find((c) => c.slug === "east-county");
    expect(eastCounty?.hex).toBe("#FF6B2B");
    expect(eastCounty?.hex).not.toBe("#FF8C00");
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
    expect(buildCrewWaitlistHref("down-county")).toBe("/crew?cluster=down-county");
    expect(buildCrewWaitlistHref("up-county")).toBe("/crew?cluster=up-county");
    expect(buildCrewWaitlistHref("east-county")).toBe("/crew?cluster=east-county");
    expect(buildCrewWaitlistHref("mid-county")).toBe("/crew?cluster=mid-county");
  });
});

test.describe("isClusterSlug", () => {
  test("accepts every canonical cluster slug", () => {
    for (const slug of ["down-county", "up-county", "east-county", "mid-county"]) {
      expect(isClusterSlug(slug)).toBe(true);
    }
  });

  test("rejects unknown / malformed / legacy values (strict guard)", () => {
    expect(isClusterSlug("magenta")).toBe(false);
    expect(isClusterSlug("teal")).toBe(false);
    expect(isClusterSlug("DOWN-COUNTY")).toBe(false);
    expect(isClusterSlug("")).toBe(false);
    expect(isClusterSlug(undefined)).toBe(false);
    expect(isClusterSlug(null)).toBe(false);
    expect(isClusterSlug(42)).toBe(false);
    expect(isClusterSlug({ slug: "down-county" })).toBe(false);
  });
});

test.describe("resolveClusterSlug — legacy color slug mapping", () => {
  test("passes canonical area slugs through", () => {
    for (const slug of ["down-county", "up-county", "east-county", "mid-county"]) {
      expect(resolveClusterSlug(slug)).toBe(slug);
    }
  });

  test("maps every legacy color slug to its area", () => {
    expect(resolveClusterSlug("teal")).toBe("down-county");
    expect(resolveClusterSlug("lime")).toBe("up-county");
    expect(resolveClusterSlug("orange")).toBe("east-county");
    expect(resolveClusterSlug("cyan")).toBe("mid-county");
  });

  test("every LEGACY_COLOR_SLUGS target is a real cluster", () => {
    for (const target of Object.values(LEGACY_COLOR_SLUGS)) {
      expect(getClusterBySlug(target)).toBeDefined();
    }
  });

  test("rejects junk", () => {
    expect(resolveClusterSlug("magenta")).toBeUndefined();
    expect(resolveClusterSlug("")).toBeUndefined();
    expect(resolveClusterSlug(undefined)).toBeUndefined();
    expect(resolveClusterSlug(42)).toBeUndefined();
  });
});

test.describe("getClusterForCity", () => {
  test("maps every SERVICE_AREAS city to a cluster", () => {
    for (const city of SERVICE_AREAS) {
      const c = getClusterForCity(city);
      expect(c, `${city} should map to a cluster`).toBeDefined();
    }
  });

  test("Down-County cities map to the Down-County Cluster", () => {
    expect(getClusterForCity("Bethesda")?.slug).toBe("down-county");
    expect(getClusterForCity("North Bethesda")?.slug).toBe("down-county");
    expect(getClusterForCity("Chevy Chase")?.slug).toBe("down-county");
  });

  test("Up-County cities map to the Up-County Cluster", () => {
    expect(getClusterForCity("Gaithersburg")?.slug).toBe("up-county");
    expect(getClusterForCity("Germantown")?.slug).toBe("up-county");
  });

  test("East-County cities map to the East-County Cluster", () => {
    expect(getClusterForCity("Olney")?.slug).toBe("east-county");
    expect(getClusterForCity("Silver Spring")?.slug).toBe("east-county");
  });

  test("Mid-County cities map to the Mid-County Cluster", () => {
    expect(getClusterForCity("Rockville")?.slug).toBe("mid-county");
    expect(getClusterForCity("Potomac")?.slug).toBe("mid-county");
  });

  test("assertEveryServiceCityHasCluster passes today", () => {
    expect(() => assertEveryServiceCityHasCluster()).not.toThrow();
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

  test("never names clusters by color (colors are visual cues only)", () => {
    const joined = CLUSTER_FAQ.map((i) => `${i.question} ${i.answer}`.toLowerCase()).join("\n");
    expect(joined).not.toMatch(/color cluster/);
    expect(joined).not.toMatch(/(teal|lime|cyan) cluster/);
    expect(joined).not.toContain("color cup");
  });

  test("does not mention DD / CourtReserve / JOOLA gear pipeline", () => {
    const joined = CLUSTER_FAQ.map((i) => i.answer.toLowerCase()).join("\n");
    expect(joined).not.toContain("dill dinker");
    expect(joined).not.toContain("courtreserve");
    expect(joined).not.toContain("joola");
    expect(joined).not.toContain("pickleball dc");
  });
});
