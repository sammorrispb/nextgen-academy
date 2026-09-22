import { test, expect } from "@playwright/test";
import type { NgaSession } from "../src/lib/notion-sessions";
import { buildEventsFeed } from "../src/lib/events-feed";
import { CAMPS } from "../src/data/camps";
import {
  EC_CLUBS,
  EC_PARTNER_NAME,
  EC_PARTNER_URL,
  ecClubLocation,
  ecClubTitle,
} from "../src/data/enrichment-collective";
import {
  PICKLPARK_END_TIME,
  PICKLPARK_MAKEUP_DATES,
  PICKLPARK_OPEN_COURT_START_TIME,
  PICKLPARK_SATURDAYS,
  PICKLPARK_START_TIME,
} from "../src/data/picklpark-2026";

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
  test("camps are out of the feed entirely, address and all", () => {
    // Camps left the feed on 2026-09-19 and stayed out; MVF left with them and
    // came back on 2026-09-20 (see buildEventsFeed). This used to assert the
    // WEAKER invariant that a camp item may ship so long as it carries
    // `publicArea` rather than `exactLocation` — unreachable through this feed
    // now, so asserting absence is both honest and stronger. `buildCampEvents`
    // keeps its own redaction coverage in e2e/events-feed.spec.ts, because it
    // is still exported and a future caller could reach it.
    const feed = buildEventsFeed(
      { sessions: [] },
      "https://nextgenpbacademy.com",
    );
    const json = JSON.stringify(feed);

    expect(feed.some((i) => i.source === "camp")).toBe(false);
    expect(json).not.toContain("nga-camp:");

    // The hidden venue strings stay absent for the original reason too.
    for (const camp of CAMPS) {
      if (camp.exactLocation) expect(json).not.toContain(camp.exactLocation);
      if (camp.venueLine) expect(json).not.toContain(camp.venueLine);
    }

    // And no street address reaches the payload from any remaining source.
    expect(json).not.toMatch(
      /\d{3,5}\s+[A-Z][a-z]+\s+(Dr|Rd|Ave|St|Blvd|Way)/,
    );
  });

  test("MVF classes ship, and carry no more than the partner published", () => {
    // MVF is back in the feed (2026-09-20). It is partner-run, so the egress
    // question is the same one camps answer: the feed may name where a class
    // meets, because MVF publishes that itself, but it must not acquire a
    // roster, a count, or anything a parent did not already see on MVF's page.
    const feed = buildEventsFeed(
      { sessions: [] },
      "https://nextgenpbacademy.com",
    );
    const mvfItems = feed.filter((i) => i.source === "mvf");
    expect(mvfItems.length).toBeGreaterThan(0);

    for (const item of mvfItems) {
      const itemJson = JSON.stringify(item);
      expect(itemJson).not.toMatch(/roster|registeredCount|ageStats|parentEmail/i);
      expect(item.location).toBeTruthy();
      expect(item.url).toMatch(/^https:\/\//);
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

  test("Enrichment Collective clubs never reach the public feed", () => {
    // EC runs after-school clubs at named ELEMENTARY SCHOOLS.
    //
    // UPDATED 2026-09-19 (Sam): the program is no longer invisible — the
    // weekday, school name, dates and the partner's own registration link now
    // render on /after-school-clubs, because Enrichment Collective already
    // publishes that page itself. See the header of
    // src/data/enrichment-collective.ts for the full reasoning, and
    // e2e/invariant-enrichment-collective-public.spec.ts for what that surface
    // may carry.
    //
    // THE FEED IS A SEPARATE DECISION AND THE ANSWER IS STILL NO. A marketing
    // page a parent reads is not a machine-readable, unauthenticated endpoint
    // that gets mirrored onward. Nothing below relaxed; the street address in
    // particular stays calendar-only.
    //
    // 2026-09-13: that private calendar now carries school NAMES and STREET
    // ADDRESSES. Nothing about this public rule relaxed — the opposite. The
    // file holds more sensitive data than it used to, so this spec is the
    // load-bearing boundary between the two surfaces and asserts on the
    // addresses as well as the names.
    //
    // Asserted on EC-specific strings only — never on town names, which are
    // legitimate NGA locations and would make this spec fire spuriously the
    // day NGA runs a session in Olney.
    const feed = buildEventsFeed(
      { sessions: [session()] },
      "https://nextgenpbacademy.com",
    );
    const json = JSON.stringify(feed);

    expect(json).not.toContain(EC_PARTNER_NAME);
    expect(json).not.toContain(EC_PARTNER_URL);
    expect(json).not.toContain("nga-ec:");
    expect(json).not.toContain("Coach Sam club");

    expect(EC_CLUBS.length).toBeGreaterThan(0);
    for (const club of EC_CLUBS) {
      expect(json).not.toContain(club.key);
      expect(json).not.toContain(ecClubTitle(club));
      if (club.schoolName) expect(json).not.toContain(club.schoolName);
      // Added 2026-09-13, when this file gained street addresses so Sam's
      // PRIVATE calendar could name the building he drives to. That is
      // precisely the `camps.ts` exactLocation risk, so the widened data
      // gets a widened guard: a school address must never reach the feed.
      if (club.exactLocation) {
        expect(json).not.toContain(club.exactLocation);
      }
      expect(json).not.toContain(ecClubLocation(club));
      // No EC session date may appear paired with an EC source marker.
      for (const date of club.dates) {
        expect(json).not.toContain(`nga-ec:${club.key}:${date}`);
      }
    }

    // And no feed item may claim EC as its source.
    for (const item of feed) {
      expect(item.source).not.toBe("enrichment");
      expect(item.key.startsWith("nga-ec")).toBe(false);
    }
  });

  test("picklpark season items: stable nga-pp keys, no counts, makeup date flagged tentative", () => {
    const feed = buildEventsFeed(
      { sessions: [] },
      "https://nextgenpbacademy.com",
    );
    const items = feed.filter((i) => i.source === "picklpark");

    // The exact KEY SET, not a count. A length derived from the same two
    // arrays the builder maps is tautological — it cannot fail for any bug in
    // the builder. Comparing keys still tracks a season that moves, but also
    // catches a dropped date, a duplicate, a collapsed key and a wrong prefix.
    expect([...items.map((i) => i.key)].sort()).toEqual(
      [...PICKLPARK_SATURDAYS, ...PICKLPARK_MAKEUP_DATES]
        .map((d) => `nga-pp:saturday:${d}`)
        .sort(),
    );
    for (const item of items) {
      expect(item.key).toMatch(/^nga-pp:saturday:\d{4}-\d{2}-\d{2}$/);
      expect(item.url).toBe("https://nextgenpbacademy.com/picklpark");
      // The Pickl Park is a public commercial facility — the address may ship,
      // but never any per-item registration data.
      expect(Object.keys(item)).not.toContain("registeredCount");
      expect(Object.keys(item)).not.toContain("roster");
      expect(item.location).toContain("The Pickl Park");
    }

    // A held date is the ONLY thing that may ship tentative — a playing
    // Saturday marked tentative tells a family it might not happen.
    //
    // Asserted per ITEM against its own date, not by filtering for tentative
    // ones: `for (const hold of holds)` is vacuous while no date is held, so
    // it proved nothing about the six Saturdays that DO ship. This form is
    // strongest exactly when the hold list is empty — it then requires all six
    // to be confirmed and untitled.
    for (const item of items) {
      const date = item.key.split(":").pop() as string;
      const held = PICKLPARK_MAKEUP_DATES.includes(date);
      expect(Boolean(item.tentative), date).toBe(held);
      expect(item.title.includes("[TENTATIVE]"), date).toBe(held);
      expect(item.status === "Tentative", date).toBe(held);
    }

    const confirmed = items.filter((i) => !i.tentative);
    expect(confirmed).toHaveLength(PICKLPARK_SATURDAYS.length);
    for (const item of confirmed) {
      // Derived from the season config, not typed — this pair went stale on
      // the 2026-08-31 reshape (1–3 PM → 3–5 PM) and only a hardcoded literal
      // made that a test edit rather than an automatic one.
      expect(item.startTime).toBe(PICKLPARK_START_TIME);
      expect(item.endTime).toBe(PICKLPARK_END_TIME);
      expect(item.allDay).toBe(false);
    }
  });

  test("the Saturday window now opens at 2:00 — the hour is a league, not a drop-in", () => {
    // INVERTED 2026-09-07. This used to assert the feed did NOT start at
    // PICKLPARK_OPEN_COURT_START_TIME: the 2:00 hour was a $20 Open Court
    // drop-in, an ordinary Sessions-DB row that already reached the feed
    // through buildSessionEvents, so emitting it here too would double-create
    // it on the calendar mirror.
    //
    // The Open Court is retired (its recurring template is inactive) and The
    // Pickl Park now sells that hour as the Kid's Drill and Play league. It is
    // no longer a Sessions row, so there is nothing to double-create — and a
    // feed that still began at 3:00 would hide a league from the calendar.
    //
    // Since 2026-09-22 the Youth League (3:00–4:30) is off every surface, so
    // the Saturday window is 2:00–3:00 — drill-and-play only. If the Youth
    // League returns with confirmed dates, this end time moves back out.
    const feed = buildEventsFeed(
      { sessions: [] },
      "https://nextgenpbacademy.com",
    );
    const picklpark = feed.filter((i) => i.source === "picklpark");
    expect(picklpark.length).toBeGreaterThan(0);
    for (const item of picklpark) {
      expect(item.startTime).toBe(PICKLPARK_OPEN_COURT_START_TIME);
      expect(item.startTime).toBe("2:00 PM");
      expect(item.endTime).toBe(PICKLPARK_END_TIME);
      expect(item.endTime).toBe("3:00 PM");
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
