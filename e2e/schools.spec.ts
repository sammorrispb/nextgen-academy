// Pure-function specs for the MCPS schools data + lib. No dev server needed.
//   npx playwright test e2e/schools.spec.ts --project=desktop
import { test, expect } from "@playwright/test";
import { CLUSTERS } from "../src/data/clusters";
import { SCHOOLS } from "../src/data/schools";
import { assertSchoolNamesUnique, getSchoolsForCluster } from "../src/lib/schools";

test.describe("SCHOOLS data integrity", () => {
  test("ships all 25 comprehensive MCPS high schools (2025-26)", () => {
    expect(SCHOOLS.filter((s) => s.level === "high")).toHaveLength(25);
  });

  test("ships all 40 MCPS middle schools (2025-26)", () => {
    expect(SCHOOLS.filter((s) => s.level === "middle")).toHaveLength(40);
  });

  test("every school carries the required fields", () => {
    for (const s of SCHOOLS) {
      expect(s.name.trim().length).toBeGreaterThan(0);
      expect(["high", "middle"]).toContain(s.level);
      expect(s.town.trim().length).toBeGreaterThan(0);
      expect(s.mcpsCluster.trim().length).toBeGreaterThan(0);
    }
  });

  test("school names are unique", () => {
    expect(() => assertSchoolNamesUnique()).not.toThrow();
  });

  test("every school maps to a real cluster", () => {
    const slugs = new Set(CLUSTERS.map((c) => c.slug));
    for (const s of SCHOOLS) {
      expect(slugs.has(s.cluster), `${s.name} → ${s.cluster}`).toBe(true);
    }
  });

  test("every cluster area has high schools AND middle schools", () => {
    for (const c of CLUSTERS) {
      expect(
        getSchoolsForCluster(c.slug, "high").length,
        `${c.slug} high schools`,
      ).toBeGreaterThanOrEqual(3);
      expect(
        getSchoolsForCluster(c.slug, "middle").length,
        `${c.slug} middle schools`,
      ).toBeGreaterThanOrEqual(5);
    }
  });

  test("per-area high school counts match the 2025-26 MCPS structure", () => {
    expect(getSchoolsForCluster("down-county", "high")).toHaveLength(3);
    expect(getSchoolsForCluster("up-county", "high")).toHaveLength(8);
    expect(getSchoolsForCluster("east-county", "high")).toHaveLength(9);
    expect(getSchoolsForCluster("mid-county", "high")).toHaveLength(5);
  });

  test("MCPS Downcounty Consortium schools land in NGA East-County, not Down-County", () => {
    // The naming collision trap: MCPS's "Downcounty Consortium" serves
    // Silver Spring / Wheaton — geographically the NGA East-County area.
    const dcc = SCHOOLS.filter((s) => s.mcpsCluster === "Downcounty Consortium");
    expect(dcc.length).toBeGreaterThan(0);
    for (const s of dcc) {
      expect(s.cluster, s.name).toBe("east-county");
    }
  });

  test("anchor schools land in the expected areas", () => {
    const byName = (name: string) => SCHOOLS.find((s) => s.name.includes(name));
    expect(byName("Walt Whitman")?.cluster).toBe("down-county");
    expect(byName("Walter Johnson")?.cluster).toBe("down-county");
    expect(byName("Clarksburg High")?.cluster).toBe("up-county");
    expect(byName("Sherwood")?.cluster).toBe("east-county");
    expect(byName("Montgomery Blair")?.cluster).toBe("east-county");
    expect(byName("Winston Churchill")?.cluster).toBe("mid-county");
    expect(byName("Richard Montgomery")?.cluster).toBe("mid-county");
  });

  test("getSchoolsForCluster without level returns both levels", () => {
    const all = getSchoolsForCluster("down-county");
    expect(all.length).toBe(
      getSchoolsForCluster("down-county", "high").length +
        getSchoolsForCluster("down-county", "middle").length,
    );
  });
});
