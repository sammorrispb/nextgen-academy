import { test, expect } from "@playwright/test";
import { buildLeagueHubCards } from "../src/lib/league-hub";
import { PICKLPARK_LEAGUES } from "../src/data/picklpark-leagues-2026";

/**
 * /league is the hub for youth leagues and seasons that actually run
 * (AEO audit, 2026-09-13). It used to describe only the planned fixed-roster
 * league — an interest list — while the enrollable seasons had no league page
 * at all. Cards are derived from the season data files and retire on their
 * own dates; each names who takes registration, and none quotes a price (the
 * linked page does).
 */

const DURING = "2026-09-19";
const AFTER_ALL = "2026-12-01";

test.describe("league hub cards", () => {
  test("mid-fall: the Sunday season, both Pickl Park leagues, and MVF are listed", () => {
    const cards = buildLeagueHubCards(DURING, { fallRegistrationOpen: true });
    const keys = cards.map((c) => c.key);
    expect(keys).toContain("fall");
    for (const l of PICKLPARK_LEAGUES) expect(keys).toContain(`picklpark-${l.slug}`);
    expect(keys.some((k) => k.startsWith("mvf-"))).toBe(true);

    const fall = cards.find((c) => c.key === "fall")!;
    expect(fall.href).toBe("/fall");
    expect(fall.registrar).toMatch(/on this site/);

    for (const l of PICKLPARK_LEAGUES) {
      const c = cards.find((x) => x.key === `picklpark-${l.slug}`)!;
      expect(c.href).toBe(l.signupUrl);
      expect(c.external).toBe(true);
      expect(c.registrar).toBe("The Pickl Park");
      expect(c.where).toContain("Frederick, MD");
    }
  });

  test("no card quotes a price", () => {
    expect(JSON.stringify(buildLeagueHubCards(DURING, { fallRegistrationOpen: true }))).not.toContain("$");
  });

  test("a closed fall flag says so instead of implying sign-ups", () => {
    const fall = buildLeagueHubCards(DURING, { fallRegistrationOpen: false }).find((c) => c.key === "fall")!;
    expect(fall.registrar).not.toMatch(/on this site/);
  });

  test("finished seasons drop off", () => {
    const keys = buildLeagueHubCards(AFTER_ALL, { fallRegistrationOpen: true }).map((c) => c.key);
    expect(keys).not.toContain("fall");
    expect(keys.some((k) => k.startsWith("picklpark-"))).toBe(false);
  });
});
