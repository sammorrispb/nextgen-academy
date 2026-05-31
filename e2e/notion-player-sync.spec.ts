import { test, expect } from "@playwright/test";
import {
  matchSite,
  ageFromBirthYear,
  currentSeasonLabel,
} from "../src/lib/notion-player-sync";

test.describe("matchSite", () => {
  test("maps an exact Site option", () => {
    expect(matchSite("Sherwood HS")).toBe("Sherwood HS");
  });

  test("matches case-insensitively within a longer location string", () => {
    expect(matchSite("Sherwood HS — back courts, enter off Olney Sandy Spring Rd")).toBe(
      "Sherwood HS",
    );
  });

  test("returns undefined for an unknown location so Notion never 400s", () => {
    expect(matchSite("Some Random Park")).toBeUndefined();
    expect(matchSite("")).toBeUndefined();
  });
});

test.describe("ageFromBirthYear", () => {
  test("computes whole-year age", () => {
    expect(ageFromBirthYear(2019, new Date("2026-05-31T00:00:00Z"))).toBe(7);
  });

  test("rejects junk birth years", () => {
    expect(ageFromBirthYear(0)).toBeUndefined();
    expect(ageFromBirthYear(1800)).toBeUndefined();
  });
});

test.describe("currentSeasonLabel", () => {
  test("May maps to Spring, matching the lead route's cohort labeling", () => {
    expect(currentSeasonLabel(new Date("2026-05-31T00:00:00Z"))).toBe("Spring 2026");
  });

  test("July is Summer of the same year", () => {
    expect(currentSeasonLabel(new Date("2026-07-15T00:00:00Z"))).toBe("Summer 2026");
  });

  test("December rolls into next Winter", () => {
    expect(currentSeasonLabel(new Date("2026-12-15T00:00:00Z"))).toBe("Winter 2027");
  });
});
