import { test, expect } from "@playwright/test";
import {
  ageFromBirthYear,
  isoWeekday,
  areaOverlap,
  sharedDays,
  isCandidateMatch,
  findCandidateMatches,
  matchSessionsForPreferences,
  AGE_GAP_MAX,
  type CrewCandidate,
  type MatchableSession,
} from "../src/lib/crew-matching";

const NOW = new Date("2026-06-17T12:00:00Z");

function candidate(over: Partial<CrewCandidate>): CrewCandidate {
  return {
    id: "c1",
    childFirstName: "Mia",
    childBirthYear: 2016, // age 10 at NOW
    childLevel: "Green",
    childSubLevel: "Mid",
    preferredDays: ["Tue", "Thu"],
    preferredArea: "Rockville",
    ...over,
  };
}

test.describe("crew-matching helpers", () => {
  test("ageFromBirthYear uses the UTC year of `now`", () => {
    expect(ageFromBirthYear(2016, NOW)).toBe(10);
    expect(ageFromBirthYear(0, NOW)).toBeNull();
    expect(ageFromBirthYear(Number.NaN, NOW)).toBeNull();
  });

  test("isoWeekday maps dates without UTC drift", () => {
    expect(isoWeekday("2026-06-16")).toBe("Tue");
    expect(isoWeekday("2026-06-21")).toBe("Sun");
    expect(isoWeekday("not-a-date")).toBeNull();
  });

  test("areaOverlap treats empty as a wildcard and matches substrings", () => {
    expect(areaOverlap("", "Rockville")).toBe(true);
    expect(areaOverlap("Rockville", "")).toBe(true);
    expect(areaOverlap("Rockville", "rockville")).toBe(true);
    expect(areaOverlap("Rockville, MD", "Rockville")).toBe(true);
    expect(areaOverlap("Bethesda", "Rockville")).toBe(false);
  });

  test("sharedDays intersects preferred days", () => {
    expect(sharedDays(["Tue", "Thu"], ["Thu", "Fri"])).toEqual(["Thu"]);
    expect(sharedDays(["Mon"], ["Tue"])).toEqual([]);
  });
});

test.describe("isCandidateMatch", () => {
  test("matches same level, age within ±3, a shared day, overlapping area", () => {
    const a = candidate({ id: "a" });
    const b = candidate({ id: "b", childBirthYear: 2018 }); // age 8, gap 2
    expect(isCandidateMatch(a, b, NOW)).toBe(true);
  });

  test("never matches a candidate against itself", () => {
    const a = candidate({ id: "same" });
    expect(isCandidateMatch(a, { ...a }, NOW)).toBe(false);
  });

  test("rejects a different ball color", () => {
    const a = candidate({ id: "a", childLevel: "Green" });
    const b = candidate({ id: "b", childLevel: "Orange" });
    expect(isCandidateMatch(a, b, NOW)).toBe(false);
  });

  test(`rejects an age gap over ±${AGE_GAP_MAX}`, () => {
    const a = candidate({ id: "a", childBirthYear: 2016 }); // 10
    const b = candidate({ id: "b", childBirthYear: 2011 }); // 15, gap 5
    expect(isCandidateMatch(a, b, NOW)).toBe(false);
  });

  test("rejects when no day overlaps", () => {
    const a = candidate({ id: "a", preferredDays: ["Mon"] });
    const b = candidate({ id: "b", preferredDays: ["Wed"] });
    expect(isCandidateMatch(a, b, NOW)).toBe(false);
  });

  test("rejects non-overlapping known areas", () => {
    const a = candidate({ id: "a", preferredArea: "Bethesda" });
    const b = candidate({ id: "b", preferredArea: "Olney" });
    expect(isCandidateMatch(a, b, NOW)).toBe(false);
  });
});

test.describe("findCandidateMatches ranking", () => {
  test("excludes self, drops non-matches, ranks more shared days higher", () => {
    const target = candidate({
      id: "t",
      preferredDays: ["Tue", "Thu"],
      childSubLevel: "Mid",
    });
    const oneDay = candidate({
      id: "one",
      preferredDays: ["Tue"],
      childSubLevel: "High",
    });
    const twoDays = candidate({
      id: "two",
      preferredDays: ["Tue", "Thu"],
      childSubLevel: "Mid",
    });
    const wrongLevel = candidate({ id: "x", childLevel: "Yellow" });

    const matches = findCandidateMatches(
      target,
      [target, oneDay, twoDays, wrongLevel],
      NOW,
    );
    expect(matches.map((m) => m.candidate.id)).toEqual(["two", "one"]);
    expect(matches[0].sharedDays).toEqual(["Tue", "Thu"]);
  });
});

test.describe("matchSessionsForPreferences", () => {
  function session(over: Partial<MatchableSession>): MatchableSession {
    return {
      id: "s",
      title: "Green Session",
      date: "2026-06-23", // Tue
      startTime: "4:00 PM",
      endTime: "5:00 PM",
      level: "Green",
      location: "Rockville, MD",
      publicArea: "",
      status: "Open",
      spotsLeft: 3,
      ...over,
    };
  }

  const pref = { level: "Green" as const, days: ["Tue"] as const, area: "Rockville" };

  test("keeps open, same-level, preferred-day, area-overlapping sessions", () => {
    const ok = session({ id: "ok" });
    const full = session({ id: "full", status: "Full", spotsLeft: 0 });
    const noSeat = session({ id: "noseat", spotsLeft: 0 });
    const wrongLevel = session({ id: "lvl", level: "Yellow" });
    const wrongDay = session({ id: "day", date: "2026-06-24" }); // Wed
    const wrongArea = session({ id: "area", location: "Bethesda, MD" });

    const out = matchSessionsForPreferences({ ...pref, days: [...pref.days] }, [
      ok,
      full,
      noSeat,
      wrongLevel,
      wrongDay,
      wrongArea,
    ]);
    expect(out.map((s) => s.id)).toEqual(["ok"]);
  });

  test("sorts soonest-first", () => {
    const later = session({ id: "later", date: "2026-06-30" });
    const sooner = session({ id: "sooner", date: "2026-06-23" });
    const out = matchSessionsForPreferences(
      { ...pref, days: ["Tue"] },
      [later, sooner],
    );
    expect(out.map((s) => s.id)).toEqual(["sooner", "later"]);
  });
});
