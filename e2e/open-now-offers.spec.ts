import { test, expect } from "@playwright/test";
import { buildOpenNowOffers } from "../src/lib/open-now-offers";
import { FALL_SUNDAYS } from "../src/data/fall-2026";
import { FALL_SEASON_PRICE_USD } from "../src/data/fall-season-2026";
import { LEAGUE_SEASONS } from "../src/data/leagues";

// The offer block shown on the empty-state waitlist (and in its confirmation
// email). These assertions exist because the weekly newsletter learned the
// same lesson twice: copy that ships on a surface nobody re-reads goes stale
// silently, so every offer here must retire itself from its own data.

const LAST_SUNDAY = FALL_SUNDAYS[FALL_SUNDAYS.length - 1];
const DAY_AFTER_SEASON = "2026-10-26";
const LEAGUE_DEADLINE = LEAGUE_SEASONS[0].registrationDeadline;

test.describe("buildOpenNowOffers", () => {
  test("the free evaluation is always offered", () => {
    for (const [today, fallOpen] of [
      ["2026-08-28", true],
      ["2027-06-01", false],
    ] as const) {
      const hrefs = buildOpenNowOffers(today, fallOpen).map((o) => o.href);
      expect(hrefs).toContain("/free-evaluation");
    }
  });

  test("the fall season shows only while the flag is on AND the season runs", () => {
    const open = buildOpenNowOffers("2026-08-28", true).map((o) => o.href);
    expect(open).toContain("/fall");

    // Flag off — registration ships dark, so the card must not appear.
    const flagOff = buildOpenNowOffers("2026-08-28", false).map((o) => o.href);
    expect(flagOff).not.toContain("/fall");

    // Last day of the season still counts; the day after does not.
    expect(
      buildOpenNowOffers(LAST_SUNDAY, true).map((o) => o.href),
    ).toContain("/fall");
    expect(
      buildOpenNowOffers(DAY_AFTER_SEASON, true).map((o) => o.href),
    ).not.toContain("/fall");
  });

  test("the fall card quotes the real season price, from the data file", () => {
    const fall = buildOpenNowOffers("2026-08-28", true).find(
      (o) => o.href === "/fall",
    );
    expect(fall).toBeDefined();
    expect(fall!.detail).toContain(`$${FALL_SEASON_PRICE_USD}`);
  });

  test("the league drops off after its registration deadline", () => {
    expect(
      buildOpenNowOffers(LEAGUE_DEADLINE, false).map((o) => o.href),
    ).toContain("/league");

    // A day past the deadline the card is gone — it can never advertise a
    // closed league, whatever the deadline is moved to.
    const dayAfter = new Date(`${LEAGUE_DEADLINE}T12:00:00Z`);
    dayAfter.setUTCDate(dayAfter.getUTCDate() + 1);
    const afterIso = dayAfter.toISOString().slice(0, 10);
    expect(buildOpenNowOffers(afterIso, false).map((o) => o.href)).not.toContain(
      "/league",
    );
  });

  test("no offer quotes a league price — league enrollment ships dark", () => {
    const league = buildOpenNowOffers(LEAGUE_DEADLINE, true).find(
      (o) => o.href === "/league",
    );
    expect(league).toBeDefined();
    expect(league!.detail).not.toMatch(/\$\d/);
    expect(league!.cta).not.toMatch(/\$\d/);
  });

  test("every offer points at a page, never at a checkout API", () => {
    const offers = buildOpenNowOffers("2026-08-28", true);
    expect(offers.length).toBeGreaterThan(0);
    for (const offer of offers) {
      expect(offer.href.startsWith("/")).toBe(true);
      expect(offer.href).not.toContain("/api/");
      expect(offer.cta.length).toBeGreaterThan(0);
      expect(offer.title.length).toBeGreaterThan(0);
    }
  });
});
