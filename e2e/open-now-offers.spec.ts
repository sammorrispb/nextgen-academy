import { test, expect } from "@playwright/test";
import {
  buildOpenNowOffers,
  type OpenNowFlags,
} from "../src/lib/open-now-offers";
import { FALL_SUNDAYS } from "../src/data/fall-2026";
import { FALL_SEASON_PRICE_USD } from "../src/data/fall-season-2026";
import { PICKLPARK_SATURDAYS } from "../src/data/picklpark-2026";
import { PICKLPARK_SEASON_PRICE_USD } from "../src/data/picklpark-season-2026";
import { LEAGUE_SEASONS } from "../src/data/leagues";

/** Only the fall season open. */
const fallOnly = (fallRegistrationOpen: boolean): OpenNowFlags => ({
  fallRegistrationOpen,
  picklParkRegistrationOpen: false,
});

/** Only the Pickl Park season open. */
const picklParkOnly = (picklParkRegistrationOpen: boolean): OpenNowFlags => ({
  fallRegistrationOpen: false,
  picklParkRegistrationOpen,
});

// The offer block shown on the empty-state waitlist (and in its confirmation
// email). These assertions exist because the weekly newsletter learned the
// same lesson twice: copy that ships on a surface nobody re-reads goes stale
// silently, so every offer here must retire itself from its own data.

const LAST_SUNDAY = FALL_SUNDAYS[FALL_SUNDAYS.length - 1];
const DAY_AFTER_SEASON = "2026-10-26";
const LEAGUE_DEADLINE = LEAGUE_SEASONS[0].registrationDeadline;
const LAST_SATURDAY = PICKLPARK_SATURDAYS[PICKLPARK_SATURDAYS.length - 1];
const DAY_AFTER_PICKLPARK = "2026-10-25";

test.describe("buildOpenNowOffers", () => {
  test("the free evaluation is always offered", () => {
    for (const [today, fallOpen] of [
      ["2026-08-28", true],
      ["2027-06-01", false],
    ] as const) {
      const hrefs = buildOpenNowOffers(today, fallOnly(fallOpen)).map((o) => o.href);
      expect(hrefs).toContain("/free-evaluation");
    }
  });

  test("the fall season shows only while the flag is on AND the season runs", () => {
    const open = buildOpenNowOffers("2026-08-28", fallOnly(true)).map((o) => o.href);
    expect(open).toContain("/fall");

    // Flag off — registration ships dark, so the card must not appear.
    const flagOff = buildOpenNowOffers("2026-08-28", fallOnly(false)).map((o) => o.href);
    expect(flagOff).not.toContain("/fall");

    // Last day of the season still counts; the day after does not.
    expect(
      buildOpenNowOffers(LAST_SUNDAY, fallOnly(true)).map((o) => o.href),
    ).toContain("/fall");
    expect(
      buildOpenNowOffers(DAY_AFTER_SEASON, fallOnly(true)).map((o) => o.href),
    ).not.toContain("/fall");
  });

  test("the fall card quotes the real season price, from the data file", () => {
    const fall = buildOpenNowOffers("2026-08-28", fallOnly(true)).find(
      (o) => o.href === "/fall",
    );
    expect(fall).toBeDefined();
    expect(fall!.detail).toContain(`$${FALL_SEASON_PRICE_USD}`);
  });

  test("the league drops off after its registration deadline", () => {
    expect(
      buildOpenNowOffers(LEAGUE_DEADLINE, fallOnly(false)).map((o) => o.href),
    ).toContain("/league");

    // A day past the deadline the card is gone — it can never advertise a
    // closed league, whatever the deadline is moved to.
    const dayAfter = new Date(`${LEAGUE_DEADLINE}T12:00:00Z`);
    dayAfter.setUTCDate(dayAfter.getUTCDate() + 1);
    const afterIso = dayAfter.toISOString().slice(0, 10);
    expect(buildOpenNowOffers(afterIso, fallOnly(false)).map((o) => o.href)).not.toContain(
      "/league",
    );
  });

  test("no offer quotes a league price — league enrollment ships dark", () => {
    const league = buildOpenNowOffers(LEAGUE_DEADLINE, fallOnly(true)).find(
      (o) => o.href === "/league",
    );
    expect(league).toBeDefined();
    expect(league!.detail).not.toMatch(/\$\d/);
    expect(league!.cta).not.toMatch(/\$\d/);
  });

  test("the Pickl Park season shows only while its flag is on AND it runs", () => {
    // Its own flag, not the fall one — the two seasons run in parallel this
    // autumn and a shared gate would have shown Frederick to MoCo families
    // (and hidden it from Frederick ones) depending on the wrong env var.
    const open = buildOpenNowOffers("2026-08-31", picklParkOnly(true)).map(
      (o) => o.href,
    );
    expect(open).toContain("/picklpark");
    expect(open).not.toContain("/fall");

    const flagOff = buildOpenNowOffers("2026-08-31", picklParkOnly(false)).map(
      (o) => o.href,
    );
    expect(flagOff).not.toContain("/picklpark");

    // Last Saturday still counts; the day after does not.
    expect(
      buildOpenNowOffers(LAST_SATURDAY, picklParkOnly(true)).map((o) => o.href),
    ).toContain("/picklpark");
    expect(
      buildOpenNowOffers(DAY_AFTER_PICKLPARK, picklParkOnly(true)).map(
        (o) => o.href,
      ),
    ).not.toContain("/picklpark");
  });

  test("the Pickl Park card quotes its own price, from the data file", () => {
    const card = buildOpenNowOffers("2026-08-31", picklParkOnly(true)).find(
      (o) => o.href === "/picklpark",
    );
    expect(card).toBeDefined();
    expect(card!.detail).toContain(`$${PICKLPARK_SEASON_PRICE_USD}`);
    expect(card!.detail).toContain("Frederick");
  });

  test("both seasons can be offered at once, each from its own flag", () => {
    const hrefs = buildOpenNowOffers("2026-10-03", {
      fallRegistrationOpen: true,
      picklParkRegistrationOpen: true,
    }).map((o) => o.href);
    expect(hrefs).toContain("/fall");
    expect(hrefs).toContain("/picklpark");
  });

  test("every offer points at a page, never at a checkout API", () => {
    const offers = buildOpenNowOffers("2026-08-28", fallOnly(true));
    expect(offers.length).toBeGreaterThan(0);
    for (const offer of offers) {
      expect(offer.href.startsWith("/")).toBe(true);
      expect(offer.href).not.toContain("/api/");
      expect(offer.cta.length).toBeGreaterThan(0);
      expect(offer.title.length).toBeGreaterThan(0);
    }
  });
});
