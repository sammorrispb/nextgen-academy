import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import {
  PICKLPARK_LEAGUES,
  PICKLPARK_LEAGUE_COACH_EMAIL,
  findPicklParkLeague,
  picklParkLeagueStartHour24,
  picklParkLeaguePriceLine,
  PICKLPARK_LEAGUES_FORMAT_LINE,
} from "../src/data/picklpark-leagues-2026";
import { buildLlmsTxt } from "../src/lib/llms-txt";
import { buildLeagueHubCards } from "../src/lib/league-hub";
import { FREDERICK_PAGE, FREDERICK_FAQ } from "../src/data/frederick";
import { faq } from "../src/data/faq";
import {
  PICKLPARK_SATURDAYS,
  PICKLPARK_MAKEUP_DATES,
  PICKLPARK_SEASON_WEEKS,
} from "../src/data/picklpark-2026";
import {
  picklParkLeaguesOpen,
  picklParkRegistrationOpen,
} from "../src/lib/picklpark-registration-window";
import { buildOpenNowOffers } from "../src/lib/open-now-offers";
import { RECURRING_TEMPLATES } from "../src/data/recurring-templates";

// Pure spec — no dev server.
//   npx playwright test e2e/picklpark-leagues.spec.ts --project=desktop
//
// The Pickl Park Fall 2026 Saturday moved from NGA's own Stripe season to a
// league The Pickl Park sells through podplay (Sam, 2026-09-07). A second
// league, Youth League, was removed on 2026-09-22 after The Pickl Park changed
// its dates with no confirmed replacement. These pin the three things that
// change: NGA no longer takes the money, the site publishes no price, and
// the league carries its real time and ages.

test("the league exists, at its real time and ages", () => {
  expect(PICKLPARK_LEAGUES).toHaveLength(1);

  const intro = findPicklParkLeague("drill-and-play");
  expect(intro).toBeDefined();
  expect(intro?.timeLabel).toBe("2:00–3:00 PM");
  expect(intro?.minAge).toBe(8);
  expect(intro?.maxAge).toBe(13);
});

test("the league registers on podplay over https, and nowhere else", () => {
  for (const league of PICKLPARK_LEAGUES) {
    // `series` as well as `events`: podplay hands a multi-week listing a
    // /community/series/ permalink. The host stays pinned — that is the half
    // of this that matters.
    expect(league.signupUrl).toMatch(
      /^https:\/\/thepicklpark\.podplay\.app\/community\/(events|series)\/[0-9a-f-]+$/,
    );
  }
});

// --- price: two tiers, one surface (Sam, 2026-09-20) ------------------------
// The old rule was "no price anywhere", because a second copy of The Pickl
// Park's number can only go stale. A non-member then read the listing's "$225
// per player" and was charged $250. The fix is scope, not volume: the numbers
// live in the data and render on /picklpark ALONE.

test("each league carries both tiers, and the member price is the lower one", () => {
  for (const league of PICKLPARK_LEAGUES) {
    expect(typeof league.memberPriceUsd, league.slug).toBe("number");
    expect(typeof league.nonMemberPriceUsd, league.slug).toBe("number");
    // If these ever invert, the page tells every non-member the cheaper
    // number and The Pickl Park collects the dearer one at the box.
    expect(league.memberPriceUsd, league.slug).toBeLessThan(
      league.nonMemberPriceUsd,
    );
    expect(league.memberPriceUsd, league.slug).toBeGreaterThan(0);
  }
  expect(findPicklParkLeague("drill-and-play")?.memberPriceUsd).toBe(150);
  expect(findPicklParkLeague("drill-and-play")?.nonMemberPriceUsd).toBe(175);
});

test("the price line shows both tiers and says WHOSE membership it means", () => {
  for (const league of PICKLPARK_LEAGUES) {
    const line = picklParkLeaguePriceLine(league);
    expect(line).toContain(`$${league.memberPriceUsd}`);
    expect(line).toContain(`$${league.nonMemberPriceUsd}`);
    // A bare "members" reads as an NGA membership a parent doesn't have, and
    // this is The Pickl Park's membership, not ours.
    expect(line, league.slug).toContain("The Pickl Park members");
    // "per player", not per family — a parent with two kids must not read one
    // figure as covering both.
    expect(line, league.slug).toContain("per player");
    // One tier alone is the bug that started this.
    expect(line.match(/\$\d+/g), league.slug).toHaveLength(2);
  }
});

test("NO shared surface quotes a Pickl Park price — /picklpark is the only one", () => {
  const DURING = PICKLPARK_SATURDAYS[0];
  const hasDollar = (s: string) => /\$\s*\d/.test(s);

  // llms.txt — read by AI answerers, the worst place for a stale number.
  //
  // Split into ENTRIES, not lines. llms.txt hard-wraps, so a price sitting on
  // a continuation line belongs to an entry whose own line never says "Pickl
  // Park" — a per-line filter reads clean while the number ships. Caught by
  // mutation: injecting "From $150." into the Pickl Park entry passed the
  // line-based version of this check.
  const entries = buildLlmsTxt(DURING)
    .split(/\n(?=- )/)
    .filter((e) => /Pickl Park|\/picklpark/.test(e));
  expect(entries.length).toBeGreaterThan(0);
  for (const entry of entries) {
    expect(hasDollar(entry), entry.slice(0, 120)).toBe(false);
  }

  // The empty-state offer card and the /league hub.
  const offer = buildOpenNowOffers(DURING, {
    fallRegistrationOpen: false,
    picklParkRegistrationOpen: false,
  }).find((o) => o.href === "/picklpark");
  expect(offer).toBeDefined();
  expect(hasDollar(`${offer?.title} ${offer?.detail} ${offer?.cta}`)).toBe(false);

  for (const card of buildLeagueHubCards(DURING, {
    fallRegistrationOpen: false,
  }).filter((c) => c.key.startsWith("picklpark-"))) {
    expect(hasDollar(JSON.stringify(card)), card.key).toBe(false);
  }

  // The Frederick landing page's copy.
  expect(hasDollar(JSON.stringify(FREDERICK_PAGE))).toBe(false);
  expect(hasDollar(JSON.stringify(FREDERICK_FAQ))).toBe(false);

  // The cost FAQ is checked DIFFERENTLY on purpose. It legitimately quotes
  // NGA's own season and camp prices in the same answer that mentions the
  // Pickl Park league, so "this answer contains a $" proves nothing. Pin the
  // deferral sentence instead: the regression to catch is someone replacing
  // it with a number, and this fails when they do.
  const cost = faq.find((f) => /How much do youth pickleball lessons cost/.test(f.question));
  expect(cost).toBeDefined();
  expect(cost!.answer).toContain("The Pickl Park sets and shows the price");
});

test("only /picklpark's own source reads the price fields", () => {
  const readers = [
    "src/app/youth-pickleball-frederick/page.tsx",
    "src/app/fall/page.tsx",
    "src/app/schedule/page.tsx",
    "src/app/api/cron/weekly-newsletter/route.ts",
    "src/lib/llms-txt.ts",
    "src/lib/league-hub.ts",
    "src/lib/open-now-offers.ts",
    "src/data/frederick.ts",
    "src/data/faq.ts",
    "src/data/blog.ts",
  ];
  for (const path of readers) {
    const src = readFileSync(path, "utf8");
    expect(src, path).not.toContain("picklParkLeaguePriceLine");
    expect(src, path).not.toContain("memberPriceUsd");
    expect(src, path).not.toContain("nonMemberPriceUsd");
  }
  // And the one page that IS allowed to, still does — otherwise this whole
  // test passes by the price having quietly disappeared from the site.
  //
  // Assert the CALL, not the bare name: an `import { picklParkLeaguePriceLine }`
  // left behind after the render was deleted satisfies a substring check while
  // the page shows no price at all. Caught by mutation — this exact test
  // passed against a /picklpark with the price line ripped out.
  const page = readFileSync("src/app/picklpark/page.tsx", "utf8");
  expect(page).toContain("picklParkLeaguePriceLine(league)");
});

test("the league announces its signup opening", () => {
  expect(findPicklParkLeague("drill-and-play")?.signupOpensOn).toBe(
    "2026-09-09",
  );
});

test("the league runs the season's six Saturdays, Sep 26 – Oct 31", () => {
  // Shifted a week later on 2026-09-20 to match the listings The Pickl Park
  // actually sells; Sep 19 never ran. Pinned as the exact list rather than
  // first/last plus a length, so a dropped middle Saturday cannot pass.
  expect(PICKLPARK_SATURDAYS).toEqual([
    "2026-09-26",
    "2026-10-03",
    "2026-10-10",
    "2026-10-17",
    "2026-10-24",
    "2026-10-31",
  ]);
  expect(PICKLPARK_SATURDAYS).toHaveLength(PICKLPARK_SEASON_WEEKS);
  // Oct 31 is now a PLAYING week, so no date is held back. The season is
  // indoors, so there is nothing a hold would protect against.
  expect(PICKLPARK_MAKEUP_DATES).toEqual([]);
  // Whatever the dates are, a held date can never also be a playing one.
  for (const held of PICKLPARK_MAKEUP_DATES) {
    expect(PICKLPARK_SATURDAYS).not.toContain(held);
  }
});

test("copy carries no podplay typos and names the coach's real address", () => {
  const blob = PICKLPARK_LEAGUES.map((l) => `${l.title} ${l.blurb}`).join(" ");
  expect(blob).not.toMatch(/Fredrick/);
  expect(blob).not.toMatch(/All ready/);
  expect(blob).not.toMatch(/\bcheckout\b/);
  expect(PICKLPARK_LEAGUE_COACH_EMAIL).toBe("nextgenacademypb@gmail.com");
});

test("NGA's own season checkout is retired — no date reopens it", () => {
  for (const iso of [...PICKLPARK_SATURDAYS, "2026-09-07", "2026-08-01"]) {
    expect(picklParkRegistrationOpen(iso, undefined)).toBe(false);
    expect(picklParkRegistrationOpen(iso, "true")).toBe(false);
  }
});

test("the league stays advertised through the last Saturday, then stops", () => {
  expect(picklParkLeaguesOpen("2026-09-07")).toBe(true);
  expect(picklParkLeaguesOpen("2026-10-31")).toBe(true);
  expect(picklParkLeaguesOpen("2026-11-01")).toBe(false);
});

test("the open-now block advertises the league without a price or a season sale", () => {
  const offers = buildOpenNowOffers("2026-09-07", {
    fallRegistrationOpen: false,
    picklParkRegistrationOpen: false,
  });
  const card = offers.find((o) => o.href === "/picklpark");
  expect(card).toBeDefined();
  expect(`${card?.title} ${card?.detail}`).not.toMatch(/\$\d/);
  // It must not still be selling "the season".
  expect(card?.detail).not.toMatch(/for the season/i);

  // And it retires with the leagues.
  const after = buildOpenNowOffers("2026-11-01", {
    fallRegistrationOpen: false,
    picklParkRegistrationOpen: false,
  });
  expect(after.find((o) => o.href === "/picklpark")).toBeUndefined();
});

test("the $20 Saturday Open Court no longer seeds", () => {
  const openCourt = RECURRING_TEMPLATES.find(
    (t) => t.titleBase === "Pickl Park Saturday Open Court",
  );
  expect(openCourt).toBeDefined();
  expect(openCourt?.active).toBe(false);
});

// ── Review findings, 2026-09-07 (PR #321) ───────────────────────────────────

test("the league states its own split — the halves add up to the slot", () => {
  // The retired blocks were both 60 minutes, so one shared
  // PICKLPARK_SESSION_FORMAT worked. Each league must still spell out its
  // own halves, and those halves must actually add up to the slot length.
  const intro = findPicklParkLeague("drill-and-play")!;
  expect(intro.sessionFormat).toContain("30 minutes");

  for (const l of PICKLPARK_LEAGUES) {
    const halves = [...l.sessionFormat.matchAll(/(\d+) minutes/g)].map((m) =>
      Number(m[1]),
    );
    expect(halves).toHaveLength(2);
    expect(halves[0] + halves[1]).toBe(minutesBetween(l.startTime, l.endTime));
  }
});

test("the one-sentence line quotes no minute count", () => {
  // The line describes the split without numbers so it can't go stale.
  expect(PICKLPARK_LEAGUES_FORMAT_LINE).not.toMatch(/\d+ minutes/);
  expect(PICKLPARK_LEAGUES_FORMAT_LINE).toContain("half");
});

test("JSON-LD start hours are parsed from startTime, not pattern-matched", () => {
  expect(picklParkLeagueStartHour24(findPicklParkLeague("drill-and-play")!)).toBe(
    "14:00",
  );
  // A moved league must follow, not silently fall through to 15:00.
  expect(
    picklParkLeagueStartHour24({
      ...findPicklParkLeague("drill-and-play")!,
      startTime: "1:00 PM",
    }),
  ).toBe("13:00");
  expect(
    picklParkLeagueStartHour24({
      ...findPicklParkLeague("drill-and-play")!,
      startTime: "9:30 AM",
    }),
  ).toBe("09:30");
  expect(() =>
    picklParkLeagueStartHour24({
      ...findPicklParkLeague("drill-and-play")!,
      startTime: "noon",
    }),
  ).toThrow();
});

/** Minutes between two "h:mm AM/PM" strings. Test-local on purpose. */
function minutesBetween(start: string, end: string): number {
  const toMin = (t: string) => {
    const m = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(t.trim())!;
    return ((Number(m[1]) % 12) + (m[3].toUpperCase() === "PM" ? 12 : 0)) * 60 +
      Number(m[2]);
  };
  return toMin(end) - toMin(start);
}
