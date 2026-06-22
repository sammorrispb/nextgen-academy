import { test, expect } from "@playwright/test";
import type { NgaSession } from "../src/lib/notion-sessions";
import { buildSessionsFeed } from "../src/lib/sessions-feed";

// THE public-feed child-data invariant: the cross-brand sessions feed
// (GET /api/sessions/feed, consumed by www.linkanddink.com/schedule) carries
// session metadata + AGGREGATE counts only. Child PII that lives on NgaSession
// — roster (display-consented first names) and ageStats — must NEVER appear in
// the feed payload. COPPA / Minor-Data Governance. Sibling of
// invariant-child-pii-egress.spec.ts (the registration path).

const SECRET_CHILD = "Feedsecretkid";
const SECRET_CHILD_TWO = "Feedsecretkidtwo";

function session(overrides: Partial<NgaSession>): NgaSession {
  return {
    id: "page-id",
    title: "Sherwood HS — Green",
    date: "2026-06-27",
    startTime: "10:00 AM",
    endTime: "11:00 AM",
    level: "Green",
    location: "Sherwood HS, 300 Olney-Sandy Spring Rd, Sandy Spring, MD 20860",
    publicArea: "",
    courtCount: 1,
    maxCourts: 2,
    capacity: 4,
    registeredCount: 2,
    spotsLeft: 2,
    status: "Open",
    // The PII that must be stripped:
    roster: [SECRET_CHILD],
    ageStats: { count: 1, minAge: 9, maxAge: 9 },
    coachReminderSent: false,
    ...overrides,
  };
}

test.describe("sessions feed — no child PII egress", () => {
  test("roster names and age stats never appear in the feed payload", () => {
    const sessions: NgaSession[] = [
      session({}),
      // A grouped all-levels slot — both rows carry roster PII.
      session({
        id: "p-red",
        title: "Redland Tuesday Evening — Red",
        date: "2026-06-30",
        startTime: "6:00 PM",
        endTime: "7:00 PM",
        level: "Red",
        location: "Redland Middle School, 6505 Muncaster Mill Rd, Rockville, MD 20855",
        roster: [SECRET_CHILD_TWO],
        ageStats: { count: 1, minAge: 7, maxAge: 7 },
      }),
      session({
        id: "p-green",
        title: "Redland Tuesday Evening — Green",
        date: "2026-06-30",
        startTime: "6:00 PM",
        endTime: "7:00 PM",
        level: "Green",
        location: "Redland Middle School, 6505 Muncaster Mill Rd, Rockville, MD 20855",
        roster: [SECRET_CHILD],
        ageStats: { count: 1, minAge: 10, maxAge: 10 },
      }),
    ];

    const feed = buildSessionsFeed(sessions, "https://nextgenpbacademy.com");
    const json = JSON.stringify(feed);

    expect(json).not.toContain(SECRET_CHILD);
    expect(json).not.toContain(SECRET_CHILD_TWO);

    // Belt-and-braces: the PII-bearing keys must not exist on any item.
    for (const item of feed) {
      expect(Object.keys(item)).not.toContain("roster");
      expect(Object.keys(item)).not.toContain("ageStats");
    }
  });

  test("feed shape: aggregate counts + correct register URLs, Open/Full only", () => {
    const sessions: NgaSession[] = [
      session({}),
      session({
        id: "p-red",
        title: "Redland Tuesday Evening — Red",
        date: "2026-06-30",
        startTime: "6:00 PM",
        endTime: "7:00 PM",
        level: "Red",
        location: "Redland Middle School, 6505 Muncaster Mill Rd, Rockville, MD 20855",
        registeredCount: 1,
        spotsLeft: 3,
      }),
      session({
        id: "p-green",
        title: "Redland Tuesday Evening — Green",
        date: "2026-06-30",
        startTime: "6:00 PM",
        endTime: "7:00 PM",
        level: "Green",
        location: "Redland Middle School, 6505 Muncaster Mill Rd, Rockville, MD 20855",
        registeredCount: 2,
        spotsLeft: 2,
      }),
    ];

    const feed = buildSessionsFeed(sessions, "https://nextgenpbacademy.com");
    expect(feed).toHaveLength(2);

    const single = feed[0];
    expect(single.level).toBe("Green");
    expect(single.registerUrl).toBe(
      "https://nextgenpbacademy.com/schedule/sherwood-hs-2026-06-27-green",
    );

    const group = feed[1];
    expect(group.level).toBeNull();
    expect(group.title).toBe("Redland Tuesday Evening");
    expect(group.levels).toEqual(["Red", "Green"]);
    // Aggregate across the two courts: 1 + 2 registered, 3 + 2 spots, cap 4 + 4.
    expect(group.registeredCount).toBe(3);
    expect(group.spotsLeft).toBe(5);
    expect(group.capacity).toBe(8);
    // Grouped multi-level → parent picks a color on the schedule listing.
    expect(group.registerUrl).toBe("https://nextgenpbacademy.com/schedule");
  });
});
