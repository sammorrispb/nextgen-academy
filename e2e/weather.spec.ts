import { test, expect } from "@playwright/test";
import {
  assessWindow,
  assessSessions,
  assessDates,
  upcomingDates,
  etDateString,
  type NwsPeriod,
} from "../src/lib/weather";

// Synthetic NWS hourly periods. Each period is a 1-hour block keyed off its
// startTime; assessWindow treats [start, start+1h) as its coverage.
function mkPeriod(
  startTime: string,
  precip: number | null,
  shortForecast = "Sunny",
  temperature = 72,
): NwsPeriod {
  return {
    startTime,
    isDaytime: true,
    temperature,
    probabilityOfPrecipitation: { value: precip },
    shortForecast,
  };
}

// A 10–11 AM ET window on 2026-06-15 (EDT, -04:00), expressed as epoch ms.
const startMs = Date.parse("2026-06-15T10:00:00-04:00");
const endMs = Date.parse("2026-06-15T11:00:00-04:00");

test.describe("assessWindow — scopes rain to the event's hours, not the whole day", () => {
  test("a 2 PM storm is EXCLUDED from a 10–11 AM window (the reported bug)", () => {
    const periods = [
      mkPeriod("2026-06-15T10:00:00-04:00", 10, "Sunny"),
      mkPeriod("2026-06-15T14:00:00-04:00", 90, "Showers And Thunderstorms"),
    ];
    const w = assessWindow(periods, startMs, endMs);
    expect(w).not.toBeNull();
    expect(w!.maxRain).toBe(10);
    expect(w!.risk).toBe("proceed");
  });

  test("rain INSIDE the window is counted", () => {
    const w = assessWindow(
      [mkPeriod("2026-06-15T10:00:00-04:00", 70, "Rain")],
      startMs,
      endMs,
    );
    expect(w!.maxRain).toBe(70);
    expect(w!.risk).toBe("cancel");
  });

  test("a window spanning two hourly periods takes the max across both", () => {
    const twoHrEnd = Date.parse("2026-06-15T12:00:00-04:00");
    const w = assessWindow(
      [
        mkPeriod("2026-06-15T10:00:00-04:00", 20),
        mkPeriod("2026-06-15T11:00:00-04:00", 60, "Chance Showers"),
      ],
      startMs,
      twoHrEnd,
    );
    expect(w!.maxRain).toBe(60);
  });

  test("half-open boundary: a period starting exactly at endMs is excluded", () => {
    const w = assessWindow(
      [mkPeriod("2026-06-15T11:00:00-04:00", 90, "Rain")], // starts at endMs
      startMs,
      endMs,
    );
    expect(w).toBeNull();
  });

  test("half-open boundary: a period ending exactly at startMs is excluded", () => {
    const w = assessWindow(
      [mkPeriod("2026-06-15T09:00:00-04:00", 90, "Rain")], // ends at startMs
      startMs,
      endMs,
    );
    expect(w).toBeNull();
  });

  test("no overlapping period → null (caller renders 'forecast pending')", () => {
    const w = assessWindow(
      [mkPeriod("2026-06-15T14:00:00-04:00", 90, "Rain")],
      startMs,
      endMs,
    );
    expect(w).toBeNull();
  });

  test("overlap with all-null precip → 0% / proceed, NOT null (a real day, no rain data)", () => {
    const w = assessWindow(
      [mkPeriod("2026-06-15T10:00:00-04:00", null, "Sunny")],
      startMs,
      endMs,
    );
    expect(w).not.toBeNull();
    expect(w!.maxRain).toBe(0);
    expect(w!.risk).toBe("proceed");
  });

  test("thunder in-window escalates risk to at least 'watch' even at low precip", () => {
    const w = assessWindow(
      [mkPeriod("2026-06-15T10:00:00-04:00", 30, "Scattered Thunderstorms")],
      startMs,
      endMs,
    );
    // riskFromRain(30) would be "proceed"; thunder bumps it to "watch".
    expect(w!.risk).toBe("watch");
  });
});

test.describe("assessSessions — ET windowing + worst-window-per-date", () => {
  test("DST fall-back day (2026-11-01, EST -05:00): a 9 AM session windows correctly", () => {
    const periods = [
      mkPeriod("2026-11-01T09:00:00-05:00", 55, "Rain"),
      mkPeriod("2026-11-01T15:00:00-05:00", 90, "Rain"), // afternoon, excluded
    ];
    const map = assessSessions(periods, [
      { date: "2026-11-01", startTime: "9:00 AM", endTime: "10:00 AM" },
    ]);
    const w = map.get("2026-11-01");
    expect(w).toBeTruthy();
    expect(w!.maxRain).toBe(55);
  });

  test("two sessions on one date → the date's entry is the WORST (max-rain) window", () => {
    const periods = [
      mkPeriod("2026-06-15T10:00:00-04:00", 10, "Sunny"), // AM session: dry
      mkPeriod("2026-06-15T18:00:00-04:00", 80, "Rain"), // PM session: wet
    ];
    const map = assessSessions(periods, [
      { date: "2026-06-15", startTime: "10:00 AM", endTime: "11:00 AM" },
      { date: "2026-06-15", startTime: "6:00 PM", endTime: "7:00 PM" },
    ]);
    const w = map.get("2026-06-15");
    expect(w!.maxRain).toBe(80);
    expect(w!.risk).toBe("cancel");
  });

  test("a session whose window has no forecast is absent from the map", () => {
    const map = assessSessions(
      [mkPeriod("2026-06-15T14:00:00-04:00", 90, "Rain")],
      [{ date: "2026-06-15", startTime: "10:00 AM", endTime: "11:00 AM" }],
    );
    expect(map.has("2026-06-15")).toBe(false);
  });
});

test.describe("upcomingDates / etDateString — ET calendar strip", () => {
  test("today (ET) is the first date", () => {
    // 2026-06-25 09:00 UTC = 05:00 ET — still the 25th in ET.
    const now = new Date("2026-06-25T09:00:00Z");
    expect(etDateString(now)).toBe("2026-06-25");
    expect(upcomingDates(8, now)[0]).toBe("2026-06-25");
  });

  test("late-evening UTC rolls back to the correct ET calendar day", () => {
    // 2026-06-26 02:00 UTC = 2026-06-25 22:00 ET — still the 25th in ET.
    const now = new Date("2026-06-26T02:00:00Z");
    expect(etDateString(now)).toBe("2026-06-25");
  });

  test("count=8 yields today plus the next seven consecutive days", () => {
    const dates = upcomingDates(8, new Date("2026-06-25T16:00:00Z"));
    expect(dates).toEqual([
      "2026-06-25",
      "2026-06-26",
      "2026-06-27",
      "2026-06-28",
      "2026-06-29",
      "2026-06-30",
      "2026-07-01",
      "2026-07-02",
    ]);
  });
});

test.describe("assessDates — fixed strip incl. no-session days (the reported bug)", () => {
  const dates = ["2026-06-25", "2026-06-26", "2026-06-29"];

  test("a no-session day still gets a forecast from the daylight default window", () => {
    // No session on the 25th, but a midday period overlaps the 9 AM–8 PM window.
    const periods = [mkPeriod("2026-06-25T13:00:00-04:00", 20, "Partly Sunny")];
    const map = assessDates(periods, [], dates);
    const w = map.get("2026-06-25");
    expect(w).toBeTruthy();
    expect(w!.maxRain).toBe(20);
    expect(w!.risk).toBe("proceed");
  });

  test("a session day uses the session window, not the day default", () => {
    const periods = [
      // 6 PM session: heavy rain (inside the session window)
      mkPeriod("2026-06-29T18:00:00-04:00", 80, "Rain"),
      // earlier in the daylight window: dry (would dominate a whole-day read)
      mkPeriod("2026-06-29T10:00:00-04:00", 5, "Sunny"),
    ];
    const map = assessDates(
      periods,
      [{ date: "2026-06-29", startTime: "6:00 PM", endTime: "7:00 PM" }],
      dates,
    );
    const w = map.get("2026-06-29");
    expect(w!.maxRain).toBe(80);
    expect(w!.risk).toBe("cancel");
  });

  test("a date beyond the hourly horizon is absent (renders 'forecast pending')", () => {
    const periods = [mkPeriod("2026-06-25T13:00:00-04:00", 10, "Sunny")];
    const map = assessDates(periods, [], dates);
    expect(map.has("2026-06-26")).toBe(false);
    expect(map.has("2026-06-29")).toBe(false);
  });
});
