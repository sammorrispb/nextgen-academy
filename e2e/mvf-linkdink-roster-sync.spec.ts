import { test, expect } from "@playwright/test";
import {
  MVF_JUNIOR_TOURNAMENT_DATE_ISO,
  MVF_JUNIOR_TOURNAMENT_DIVISIONS,
} from "../src/data/mvf-junior-tournament-2026";
import {
  MVF_TOURNAMENT_LD_EVENT_KEYS,
  mvfTournamentLdEventKey,
} from "../src/lib/linkdink-roster-sync";

// The L&D endpoint's key shape (isMvfEventKey in community-os
// apps/p3/src/lib/nga-roster-sync.ts): lowercase slug words under the MVF
// prefix. Anything else is refused with 400 bad_event_slug.
const LD_EVENT_KEY_SHAPE = /^mvf-junior-tournament-[a-z0-9]+(?:-[a-z0-9]+)*$/;

test.describe("MVF tournament → Link & Dink roster sync", () => {
  test("maps both divisions to their stable L&D event keys", () => {
    expect(mvfTournamentLdEventKey("10u")).toBe(
      "mvf-junior-tournament-10u-2026-10-24",
    );
    expect(mvfTournamentLdEventKey("14u")).toBe(
      "mvf-junior-tournament-14u-2026-10-24",
    );
  });

  test("a key is division + tournament date, with no -N suffix naming one event row", () => {
    // L&D re-creates an event as …-2026-10-24-3, then -4, and cancels the old
    // row; the endpoint resolves the key to the live one. A key ending in a
    // suffix pins a single row and breaks on the next re-creation.
    for (const { division } of MVF_JUNIOR_TOURNAMENT_DIVISIONS) {
      const key = mvfTournamentLdEventKey(division);
      expect(key).toBe(
        `mvf-junior-tournament-${division}-${MVF_JUNIOR_TOURNAMENT_DATE_ISO}`,
      );
      expect(key).toMatch(LD_EVENT_KEY_SHAPE);
    }
  });

  test("returns null for an unknown division (caller skips the sync)", () => {
    for (const division of ["12u", "", "10U", "constructor", "__proto__", "toString"]) {
      expect(mvfTournamentLdEventKey(division)).toBeNull();
    }
  });

  test("covers every division the tournament data module defines", () => {
    // If a division is added to the tournament, the sync map must follow.
    expect(Object.keys(MVF_TOURNAMENT_LD_EVENT_KEYS).sort()).toEqual(
      MVF_JUNIOR_TOURNAMENT_DIVISIONS.map((d) => d.division).sort(),
    );
  });
});
