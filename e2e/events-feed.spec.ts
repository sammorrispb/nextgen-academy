import { test, expect } from "@playwright/test";
import type { NgaSession } from "../src/lib/notion-sessions";
import {
  addDaysIso,
  buildEventsFeed,
  buildFallEvents,
  buildMvfEvents,
  buildSessionEvents,
  parseTimeRange,
  timeToMinutes,
} from "../src/lib/events-feed";
import { MVF_PROGRAMS } from "../src/data/mvf";
import { FALL_SATURDAYS, FALL_SUNDAYS } from "../src/data/fall-2026";

const ORIGIN = "https://nextgenpbacademy.com";

function session(overrides: Partial<NgaSession> = {}): NgaSession {
  return {
    id: "page-id",
    title: "Wood Saturday Evening — Red",
    date: "2026-08-22",
    startTime: "6:00 PM",
    endTime: "7:00 PM",
    level: "Red",
    location:
      "Earle B. Wood Middle School Tennis Courts, 14615 Bauer Dr, Rockville, MD 20853",
    publicArea: "",
    courtCount: 1,
    maxCourts: 2,
    capacity: 4,
    registeredCount: 0,
    spotsLeft: 4,
    status: "Open",
    roster: [],
    ageStats: { count: 0, minAge: null, maxAge: null },
    coachReminderSent: false,
    ...overrides,
  };
}

test.describe("events feed — date helpers", () => {
  test("addDaysIso steps whole days without UTC off-by-one", () => {
    expect(addDaysIso("2026-09-03", 7)).toBe("2026-09-10");
    expect(addDaysIso("2026-09-03", 0)).toBe("2026-09-03");
    // Across a DST boundary (US falls back 2026-11-01) and a month end.
    expect(addDaysIso("2026-10-29", 7)).toBe("2026-11-05");
    expect(addDaysIso("2026-08-27", 7)).toBe("2026-09-03");
  });

  test("timeToMinutes handles noon/midnight correctly", () => {
    expect(timeToMinutes("12:00 AM")).toBe(0);
    expect(timeToMinutes("12:30 PM")).toBe(12 * 60 + 30);
    expect(timeToMinutes("6:30 PM")).toBe(18 * 60 + 30);
    expect(timeToMinutes("nonsense")).toBeNull();
    expect(timeToMinutes("13:00 PM")).toBeNull();
  });

  test("parseTimeRange handles both spaced and shared-meridiem forms", () => {
    expect(parseTimeRange("9:30 AM – 12:30 PM")).toEqual({
      start: "9:30 AM",
      end: "12:30 PM",
    });
    // MVF's tight form — the start borrows the end's meridiem.
    expect(parseTimeRange("6:00–7:00 PM")).toEqual({
      start: "6:00 PM",
      end: "7:00 PM",
    });
    expect(parseTimeRange("8:30 AM – 3:00 PM")).toEqual({
      start: "8:30 AM",
      end: "3:00 PM",
    });
    expect(parseTimeRange("times TBD")).toBeNull();
  });
});

test.describe("events feed — sessions", () => {
  test("four ball-color rows at one venue collapse into one evening block", () => {
    const rows = [
      session({ id: "a", level: "Red", startTime: "6:00 PM", endTime: "7:00 PM" }),
      session({
        id: "b",
        title: "Wood Saturday Evening — Orange",
        level: "Orange",
        startTime: "6:00 PM",
        endTime: "7:00 PM",
      }),
      session({
        id: "c",
        title: "Wood Saturday Evening — Green",
        level: "Green",
        startTime: "7:00 PM",
        endTime: "8:00 PM",
      }),
      session({
        id: "d",
        title: "Wood Saturday Evening — Yellow",
        level: "Yellow",
        startTime: "7:00 PM",
        endTime: "8:00 PM",
      }),
    ];

    const items = buildSessionEvents(rows, ORIGIN);
    expect(items).toHaveLength(1);
    const [item] = items;
    expect(item.title).toBe("Wood Saturday Evening");
    expect(item.key).toBe("nga-sess:wood-saturday-evening:2026-08-22");
    // Spans the earliest start to the latest end across all four courts.
    expect(item.startTime).toBe("6:00 PM");
    expect(item.endTime).toBe("8:00 PM");
    expect(item.status).toBe("Open");
    expect(item.allDay).toBe(false);
  });

  test("cancelled rows never reach the feed; all-Full reads Full", () => {
    expect(
      buildSessionEvents([session({ status: "Cancelled" })], ORIGIN),
    ).toHaveLength(0);

    const full = buildSessionEvents(
      [
        session({ id: "a", status: "Full" }),
        session({ id: "b", title: "Wood Saturday Evening — Orange", status: "Full" }),
      ],
      ORIGIN,
    );
    expect(full).toHaveLength(1);
    expect(full[0].status).toBe("Full");
  });

  test("different venues on the same date stay separate blocks", () => {
    const items = buildSessionEvents(
      [
        session(),
        session({
          id: "wj",
          title: "Walter Johnson Sunday Evening — Red",
          location:
            "Walter Johnson High School Tennis Courts, 6400 Rock Spring Dr, Bethesda, MD 20814",
        }),
      ],
      ORIGIN,
    );
    expect(items).toHaveLength(2);
    expect(new Set(items.map((i) => i.key)).size).toBe(2);
  });
});

test.describe("events feed — MVF", () => {
  test("weekly expansion lands exactly on each program's endDate", () => {
    const items = buildMvfEvents(MVF_PROGRAMS, ORIGIN);

    for (const program of MVF_PROGRAMS) {
      const dates = items
        .filter((i) => i.key.startsWith(`mvf:${program.key}:`))
        .map((i) => i.date);
      expect(dates).toHaveLength(program.classCount);
      expect(dates[0]).toBe(program.startDate);
      // If this fails, the weekly cadence in the data file has drifted from
      // its own endDate — fix mvf.ts, not this test.
      expect(dates[dates.length - 1]).toBe(program.endDate);
    }
  });

  test("classes with no announced time ship all-day and say so", () => {
    const items = buildMvfEvents(MVF_PROGRAMS, ORIGIN);

    const intro = items.find((i) => i.key.startsWith("mvf:intro:"))!;
    expect(intro.allDay).toBe(false);
    expect(intro.startTime).toBe("6:00 PM");
    expect(intro.endTime).toBe("7:00 PM");
    expect(intro.title).not.toContain("time TBD");

    const fall = items.filter((i) => i.key.startsWith("mvf:fall-"));
    expect(fall.length).toBeGreaterThan(0);
    for (const item of fall) {
      expect(item.allDay).toBe(true);
      expect(item.startTime).toBeNull();
      expect(item.endTime).toBeNull();
      // Never invent an hour MVF hasn't published.
      expect(item.title).toContain("(time TBD)");
    }
  });

  test("the MVF tournament is not emitted — it belongs to the L&D namespace", () => {
    const json = JSON.stringify(buildMvfEvents(MVF_PROGRAMS, ORIGIN));
    expect(json).not.toContain("Tournament");
  });
});

test.describe("events feed — Fall 2026", () => {
  test("every season date ships as a flagged hold", () => {
    const items = buildFallEvents(ORIGIN);
    expect(items).toHaveLength(FALL_SATURDAYS.length + FALL_SUNDAYS.length);

    for (const item of items) {
      expect(item.tentative).toBe(true);
      expect(item.status).toBe("Tentative");
      expect(item.title).toContain("[TENTATIVE]");
      expect(item.startTime).toBe("5:00 PM");
      expect(item.endTime).toBe("7:00 PM");
      expect(item.url).toBe(`${ORIGIN}/fall`);
    }
  });
});

test.describe("events feed — whole payload", () => {
  test("keys are unique, dates ascending, and allDay tracks startTime", () => {
    const feed = buildEventsFeed({ sessions: [session()] }, ORIGIN);

    const keys = feed.map((i) => i.key);
    expect(new Set(keys).size).toBe(keys.length);

    for (let i = 1; i < feed.length; i += 1) {
      expect(feed[i].date >= feed[i - 1].date).toBe(true);
    }

    for (const item of feed) {
      expect(item.allDay).toBe(item.startTime === null);
      if (item.startTime === null) expect(item.endTime).toBeNull();
    }
  });

  test("only the fall season is tentative", () => {
    const feed = buildEventsFeed({ sessions: [session()] }, ORIGIN);
    for (const item of feed) {
      expect(item.tentative).toBe(item.source === "fall");
    }
  });
});
