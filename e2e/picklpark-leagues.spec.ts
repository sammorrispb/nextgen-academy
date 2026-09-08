import { test, expect } from "@playwright/test";
import {
  PICKLPARK_LEAGUES,
  PICKLPARK_LEAGUE_COACH_EMAIL,
  findPicklParkLeague,
  picklParkLeagueStartHour24,
  PICKLPARK_LEAGUES_FORMAT_LINE,
} from "../src/data/picklpark-leagues-2026";
import {
  PICKLPARK_SATURDAYS,
  PICKLPARK_MAKEUP_DATES,
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
// The Pickl Park Fall 2026 Saturday moved from NGA's own Stripe season to two
// leagues The Pickl Park sells through podplay (Sam, 2026-09-07). These pin
// the three things that change: NGA no longer takes the money, the site
// publishes no price, and the two leagues carry their real times and ages.

test("both leagues exist, at their real times and ages", () => {
  expect(PICKLPARK_LEAGUES).toHaveLength(2);

  const intro = findPicklParkLeague("drill-and-play");
  expect(intro).toBeDefined();
  expect(intro?.timeLabel).toBe("2:00–3:00 PM");
  expect(intro?.minAge).toBe(8);
  expect(intro?.maxAge).toBe(13);

  const league = findPicklParkLeague("youth-league");
  expect(league).toBeDefined();
  expect(league?.timeLabel).toBe("3:00–4:30 PM");
  expect(league?.minAge).toBe(10);
  // Ages 10 and UP — no ceiling beyond the academy's own 16.
  expect(league?.maxAge).toBe(16);
});

test("they run in play order, and the earlier one is the beginner one", () => {
  expect(PICKLPARK_LEAGUES.map((l) => l.slug)).toEqual([
    "drill-and-play",
    "youth-league",
  ]);
  expect(PICKLPARK_LEAGUES[0].minAge).toBeLessThan(
    PICKLPARK_LEAGUES[1].minAge,
  );
});

test("every league registers on podplay over https, and nowhere else", () => {
  for (const league of PICKLPARK_LEAGUES) {
    expect(league.signupUrl).toMatch(
      /^https:\/\/thepicklpark\.podplay\.app\/community\/events\/[0-9a-f-]+$/,
    );
  }
  // Two distinct events, not one URL pasted twice.
  expect(new Set(PICKLPARK_LEAGUES.map((l) => l.signupUrl)).size).toBe(2);
});

test("the site publishes no price — podplay quotes at the point of sale", () => {
  const blob = JSON.stringify(PICKLPARK_LEAGUES);
  expect(blob).not.toMatch(/\$\s*\d/);
  expect(blob).not.toMatch(/\b(30|225|250)\.00\b/);
  for (const league of PICKLPARK_LEAGUES) {
    expect(league).not.toHaveProperty("priceUsd");
  }
});

test("the Intro league announces its signup opening; the other is open now", () => {
  expect(findPicklParkLeague("drill-and-play")?.signupOpensOn).toBe(
    "2026-09-09",
  );
  expect(findPicklParkLeague("youth-league")?.signupOpensOn).toBeUndefined();
});

test("both leagues run the season's six Saturdays, 9/26 included", () => {
  expect(PICKLPARK_SATURDAYS).toHaveLength(6);
  expect(PICKLPARK_SATURDAYS).toContain("2026-09-26");
  expect(PICKLPARK_SATURDAYS[0]).toBe("2026-09-19");
  expect(PICKLPARK_SATURDAYS[PICKLPARK_SATURDAYS.length - 1]).toBe(
    "2026-10-24",
  );
  expect(PICKLPARK_MAKEUP_DATES).toContain("2026-10-31");
});

test("copy carries no podplay typos and names the coach's real address", () => {
  const blob = PICKLPARK_LEAGUES.map((l) => `${l.title} ${l.blurb}`).join(" ");
  expect(blob).not.toMatch(/Fredrick/);
  expect(blob).not.toMatch(/All ready/);
  expect(blob).not.toMatch(/\bcheckout\b/);
  expect(PICKLPARK_LEAGUE_COACH_EMAIL).toBe("sam.morris2131@gmail.com");
});

test("NGA's own season checkout is retired — no date reopens it", () => {
  for (const iso of [...PICKLPARK_SATURDAYS, "2026-09-07", "2026-08-01"]) {
    expect(picklParkRegistrationOpen(iso, undefined)).toBe(false);
    expect(picklParkRegistrationOpen(iso, "true")).toBe(false);
  }
});

test("the leagues stay advertised through the last Saturday, then stop", () => {
  expect(picklParkLeaguesOpen("2026-09-07")).toBe(true);
  expect(picklParkLeaguesOpen("2026-10-24")).toBe(true);
  expect(picklParkLeaguesOpen("2026-10-25")).toBe(false);
});

test("the open-now block advertises the leagues without a price or a season sale", () => {
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
  const after = buildOpenNowOffers("2026-10-25", {
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

test("each league states its OWN split — 90 minutes is not 30 plus 30", () => {
  // The retired blocks were both 60 minutes, so one shared
  // PICKLPARK_SESSION_FORMAT worked. Youth League is 90; describing it as
  // "30 minutes of drills, then 30 of game play" leaves a third of the
  // session unaccounted for to a parent reading the page.
  const intro = findPicklParkLeague("drill-and-play")!;
  const league = findPicklParkLeague("youth-league")!;
  expect(intro.sessionFormat).toContain("30 minutes");
  expect(league.sessionFormat).toContain("45 minutes");
  expect(league.sessionFormat).not.toContain("30 minutes");

  // Each league's halves must actually add up to its own slot length.
  for (const l of PICKLPARK_LEAGUES) {
    const halves = [...l.sessionFormat.matchAll(/(\d+) minutes/g)].map((m) =>
      Number(m[1]),
    );
    expect(halves).toHaveLength(2);
    expect(halves[0] + halves[1]).toBe(minutesBetween(l.startTime, l.endTime));
  }
});

test("the one-sentence line for BOTH leagues quotes no minute count", () => {
  // The two split differently, so any single number is wrong for one of them.
  expect(PICKLPARK_LEAGUES_FORMAT_LINE).not.toMatch(/\d+ minutes/);
  expect(PICKLPARK_LEAGUES_FORMAT_LINE).toContain("half");
});

test("JSON-LD start hours are parsed from startTime, not pattern-matched", () => {
  expect(picklParkLeagueStartHour24(findPicklParkLeague("drill-and-play")!)).toBe(
    "14:00",
  );
  expect(picklParkLeagueStartHour24(findPicklParkLeague("youth-league")!)).toBe(
    "15:00",
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
