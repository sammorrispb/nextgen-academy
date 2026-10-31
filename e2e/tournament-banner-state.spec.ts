import { test, expect } from "@playwright/test";
import { nextBannerWake, tournamentBannerState, tournamentBannerTiming } from "../src/lib/tournament-banner-state";
import { nextMvfJuniorSeriesEvent, mvfJuniorSeriesShortDate } from "../src/data/mvf-junior-series";

test("deadline is exclusive, cached admission cannot override it", () => {
  const timing = tournamentBannerTiming("2026-11-14", "2026-11-13T12:00:00-05:00");
  const deadline = Date.parse("2026-11-13T17:00:00Z");
  expect(tournamentBannerState(timing, true, deadline - 1)).toBe("open");
  expect(tournamentBannerState(timing, true, deadline)).toBe("closed");
  expect(tournamentBannerState(timing, true, deadline + 1)).toBe("closed");
  expect(tournamentBannerState(timing, false, deadline - 1)).toBe("closed");
});

test("missing, invalid and timezone-free deadlines fail closed", () => {
  for (const deadline of [undefined, "invalid", "2026-11-13T12:00:00", "2027-02-30T12:00:00Z"]) {
    expect(tournamentBannerState(tournamentBannerTiming("2026-11-14", deadline), true, Date.parse("2026-11-12T12:00:00Z"))).toBe("closed");
  }
  expect(tournamentBannerState(tournamentBannerTiming("2026-02-30"), true, 0)).toBe("past");
});

test("a fresh render selects the next event through the event day and retires after February", () => {
  for (const [today, expected] of [
    ["2026-10-30", "november-2026"], ["2026-11-14", "november-2026"],
    ["2026-11-15", "january-2027"], ["2027-01-17", "january-2027"],
    ["2027-01-18", "february-2027"], ["2027-02-14", "february-2027"],
    ["2027-02-15", undefined],
  ]) expect(nextMvfJuniorSeriesEvent(today!)?.slug).toBe(expected);
  expect(mvfJuniorSeriesShortDate(nextMvfJuniorSeriesEvent("2026-10-30")!)).toBe("Sat, Nov 14");
  expect(mvfJuniorSeriesShortDate(nextMvfJuniorSeriesEvent("2026-11-15")!)).toBe("Sun, Jan 17");
});

test("Eastern event day ends correctly in summer, winter and on DST transitions", () => {
  for (const [date, end] of [
    ["2026-07-14", "2026-07-15T04:00:00Z"],
    ["2026-11-14", "2026-11-15T05:00:00Z"],
    ["2026-03-08", "2026-03-09T04:00:00Z"],
    ["2026-11-01", "2026-11-02T05:00:00Z"],
  ]) {
    const timing = tournamentBannerTiming(date);
    const boundary = Date.parse(end);
    expect(timing.eventEndsAt).toBe(boundary);
    expect(tournamentBannerState(timing, false, boundary - 1)).toBe("closed");
    expect(tournamentBannerState(timing, false, boundary)).toBe("past");
  }
});

test("next wake picks exact deadline then event end, clamping distant browser timers", () => {
  const timing = tournamentBannerTiming("2026-11-14", "2026-11-13T17:00:00Z");
  expect(nextBannerWake(timing, timing.registrationClosesAt! - 30_000)).toBe(30_000);
  expect(nextBannerWake(timing, timing.registrationClosesAt!)).toBe(timing.eventEndsAt! - timing.registrationClosesAt!);
  expect(nextBannerWake(timing, Date.parse("2026-01-01T00:00:00Z"))).toBe(2_147_483_647);
  expect(nextBannerWake(timing, timing.eventEndsAt!)).toBeNull();
});
