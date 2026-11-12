import { test, expect } from "@playwright/test";
import * as fall from "../src/data/fall-2026";
import { FALL_SEASON_END } from "../src/data/fall-2026";
import { todayET } from "../src/lib/fall-refund-policy";
import { buildOpenNowOffers, openNowFlags } from "../src/lib/open-now-offers";
import { buildLeagueHubCards } from "../src/lib/league-hub";
import { fixedDate } from "./fixtures/fixed-date";

// One rule for "is fall registration open", so the page, the cross-links and
// the offer cards cannot disagree. A season that is over is closed whatever
// the ships-dark flag says: the flag stayed "true" in production after the
// Fall 2026 finale and /fall kept selling for four days.

type State = "soon" | "open" | "ended";
const state = (todayIso: string, flag: string | undefined): State =>
  (fall as unknown as {
    fallRegistrationState: (todayIso: string, flag: string | undefined) => State;
  }).fallRegistrationState(todayIso, flag);

const DAY_MS = 86_400_000;
const shift = (iso: string, days: number) =>
  new Date(Date.parse(`${iso}T12:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
const WELL_BEFORE = shift(FALL_SEASON_END, -60);
const DAY_AFTER = shift(FALL_SEASON_END, 1);

const FLAG = "NEXT_PUBLIC_FALL_REGISTRATION_OPEN";
const savedFlag = process.env[FLAG];
let restoreDate: (() => void) | null = null;
test.afterEach(() => {
  restoreDate?.();
  restoreDate = null;
  if (savedFlag === undefined) delete process.env[FLAG];
  else process.env[FLAG] = savedFlag;
});

test.describe("fallRegistrationState", () => {
  const rows: Array<[string | undefined, string, State]> = [
    ["true", WELL_BEFORE, "open"],
    ["true", FALL_SEASON_END, "open"],
    ["true", DAY_AFTER, "ended"],
    ["false", WELL_BEFORE, "soon"],
    ["false", FALL_SEASON_END, "soon"],
    ["false", DAY_AFTER, "ended"],
    [undefined, WELL_BEFORE, "soon"],
    [undefined, FALL_SEASON_END, "soon"],
    [undefined, DAY_AFTER, "ended"],
    // Only the exact string opens it: the flag ships dark, so a typo stays shut.
    ["TRUE", WELL_BEFORE, "soon"],
    ["TRUE", FALL_SEASON_END, "soon"],
    ["TRUE", DAY_AFTER, "ended"],
    ["", WELL_BEFORE, "soon"],
    ["", FALL_SEASON_END, "soon"],
    ["", DAY_AFTER, "ended"],
  ];
  for (const [flag, today, expected] of rows) {
    test(`flag ${JSON.stringify(flag)} on ${today} is ${expected}`, () => {
      expect(state(today, flag)).toBe(expected);
    });
  }

  test("invariant: a season whose last Sunday has passed is never open, flag or no flag", () => {
    // Next season's mistake: the flag is left on and the dates move on. Every
    // day after the end, out to a year, must read ended.
    for (const days of [1, 2, 7, 30, 180, 365]) {
      expect(state(shift(FALL_SEASON_END, days), "true"), `+${days} days`).toBe("ended");
    }
    expect(state("9999-12-31", "true")).toBe("ended");
  });

  test("the day turns over at midnight Eastern", () => {
    // November is EST (UTC-5). Pinned to the real season end; re-pin if it moves.
    expect(FALL_SEASON_END).toBe("2026-11-08");
    restoreDate = fixedDate("2026-11-09T04:59:59Z");
    expect(todayET()).toBe("2026-11-08");
    expect(state(todayET(), "true")).toBe("open");
    restoreDate();
    restoreDate = fixedDate("2026-11-09T05:00:00Z");
    expect(todayET()).toBe("2026-11-09");
    expect(state(todayET(), "true")).toBe("ended");
  });
});

test.describe("openNowFlags reads the date it is given", () => {
  test("flag on: open through the last Sunday, closed the day after", () => {
    process.env[FLAG] = "true";
    expect(openNowFlags(WELL_BEFORE).fallRegistrationOpen).toBe(true);
    expect(openNowFlags(FALL_SEASON_END).fallRegistrationOpen).toBe(true);
    expect(openNowFlags(DAY_AFTER).fallRegistrationOpen).toBe(false);
  });

  test("flag off or unset: closed on every date", () => {
    for (const value of ["false", undefined]) {
      if (value === undefined) delete process.env[FLAG];
      else process.env[FLAG] = value;
      expect(openNowFlags(WELL_BEFORE).fallRegistrationOpen).toBe(false);
      expect(openNowFlags(DAY_AFTER).fallRegistrationOpen).toBe(false);
    }
  });

  test("in season the offers are the same ones a literal flag produced", () => {
    process.env[FLAG] = "true";
    for (const today of [WELL_BEFORE, FALL_SEASON_END]) {
      expect(buildOpenNowOffers(today, openNowFlags(today))).toEqual(
        buildOpenNowOffers(today, { fallRegistrationOpen: true, picklParkRegistrationOpen: false }),
      );
    }
    delete process.env[FLAG];
    expect(buildOpenNowOffers(WELL_BEFORE, openNowFlags(WELL_BEFORE))).toEqual(
      buildOpenNowOffers(WELL_BEFORE, { fallRegistrationOpen: false, picklParkRegistrationOpen: false }),
    );
  });
});

test.describe("the league hub card follows the same state", () => {
  const registrar = (today: string, flag: string | undefined) =>
    buildLeagueHubCards(today, { fallRegistrationOpen: state(today, flag) === "open" }).find(
      (card) => card.key === "fall",
    )?.registrar;

  test("on this site while open, closed otherwise, gone after the season", () => {
    expect(registrar(WELL_BEFORE, "true")).toContain("on this site");
    expect(registrar(WELL_BEFORE, undefined)).toContain("registration closed");
    expect(registrar(DAY_AFTER, "true")).toBeUndefined();
  });
});
