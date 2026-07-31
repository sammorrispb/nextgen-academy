import { test, expect } from "@playwright/test";
import type { NgaSession } from "../src/lib/notion-sessions";
import { buildEventsFeed } from "../src/lib/events-feed";
import { CAMPS } from "../src/data/camps";

// THE unified-feed egress invariant. GET /api/events/feed is a PUBLIC,
// unauthenticated surface that unions four schedule sources into one payload —
// which makes it a new egress destination and therefore a hostile-review
// trigger (docs/hostile-reviewer.md, Minor-Data Governance).
//
// Two things must hold forever:
//   1. Camp `exactLocation` NEVER ships. Camp venues are hidden per child-safety
//      policy — public copy shows `publicArea` only, and the exact venue goes to
//      registered families privately. A camp address leaking through a feed is
//      the same failure as leaking it on the page.
//   2. No child PII. Session rosters and age stats live on `NgaSession` and must
//      be stripped, exactly as in invariant-sessions-feed-pii-egress.spec.ts.
//
// Sibling of invariant-sessions-feed-pii-egress.spec.ts (the sessions-only feed)
// and invariant-camp-followup-egress.spec.ts (the camp share blurb).

const SECRET_CHILD = "Eventsfeedsecretkid";

function session(overrides: Partial<NgaSession> = {}): NgaSession {
  return {
    id: "page-id",
    title: "Wood Saturday Evening — Green",
    date: "2026-08-22",
    startTime: "7:00 PM",
    endTime: "8:00 PM",
    level: "Green",
    location:
      "Earle B. Wood Middle School Tennis Courts, 14615 Bauer Dr, Rockville, MD 20853",
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

test.describe("events feed — egress invariants", () => {
  test("camp exactLocation never appears in the feed payload", () => {
    const feed = buildEventsFeed(
      { sessions: [] },
      "https://nextgenpbacademy.com",
    );
    const json = JSON.stringify(feed);

    // No camp's hidden venue string ships anywhere in the payload.
    for (const camp of CAMPS) {
      if (!camp.exactLocation) continue;
      expect(json).not.toContain(camp.exactLocation);
    }

    // Every camp item carries the broad public area and nothing address-like.
    // NOTE: the street-level check is scoped to CAMP items on purpose. The
    // Aug 17 camp is hidden at the same building the Fall 2026 season names
    // publicly (FALL_VENUE, rendered on /fall), so a payload-wide street search
    // would flag legitimate public copy. The invariant is that a *camp* never
    // carries its venue — not that the street never appears.
    const campItems = feed.filter((i) => i.source === "camp");
    expect(campItems.length).toBeGreaterThan(0);
    for (const item of campItems) {
      const camp = CAMPS.find((c) => item.key.includes(`:${c.slug}:`));
      expect(camp).toBeTruthy();
      expect(item.location).toBe(camp!.publicArea);

      const campJson = JSON.stringify(item);
      for (const other of CAMPS) {
        if (!other.exactLocation) continue;
        const street = other.exactLocation.split(",")[1]?.trim();
        if (street) expect(campJson).not.toContain(street);
      }
      // No street number anywhere on a camp item.
      expect(campJson).not.toMatch(/\d{3,5}\s+[A-Z][a-z]+\s+(Dr|Rd|Ave|St|Blvd|Way)/);
    }
  });

  test("session roster names and age stats never appear in the feed payload", () => {
    const feed = buildEventsFeed(
      { sessions: [session(), session({ id: "p2", level: "Yellow" })] },
      "https://nextgenpbacademy.com",
    );
    const json = JSON.stringify(feed);

    expect(json).not.toContain(SECRET_CHILD);

    for (const item of feed) {
      expect(Object.keys(item)).not.toContain("roster");
      expect(Object.keys(item)).not.toContain("ageStats");
      expect(Object.keys(item)).not.toContain("registeredCount");
    }
  });

  test("no item carries a null-ish location or a relative url", () => {
    const feed = buildEventsFeed(
      { sessions: [session()] },
      "https://nextgenpbacademy.com",
    );
    expect(feed.length).toBeGreaterThan(0);
    for (const item of feed) {
      expect(item.location.trim()).not.toBe("");
      expect(item.url.startsWith("https://")).toBe(true);
    }
  });
});
