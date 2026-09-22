import { test, expect } from "@playwright/test";
import {
  MVF_TOURNAMENT_LD_EVENT_SLUGS,
  mvfTournamentLdEventSlug,
} from "../src/lib/linkdink-roster-sync";

test.describe("MVF tournament → Link & Dink roster sync", () => {
  test("maps both divisions to their popup event slugs", () => {
    expect(mvfTournamentLdEventSlug("10u")).toBe(
      "mvf-junior-tournament-10u-2026-10-24-3",
    );
    expect(mvfTournamentLdEventSlug("14u")).toBe(
      "mvf-junior-tournament-14u-2026-10-24-2",
    );
  });

  test("returns null for an unknown division (caller skips the sync)", () => {
    expect(mvfTournamentLdEventSlug("12u")).toBeNull();
    expect(mvfTournamentLdEventSlug("")).toBeNull();
  });

  test("covers every division the tournament data module defines", () => {
    // If a new division is added to the tournament, the sync map must follow.
    expect(Object.keys(MVF_TOURNAMENT_LD_EVENT_SLUGS).sort()).toEqual([
      "10u",
      "14u",
    ]);
  });
});
