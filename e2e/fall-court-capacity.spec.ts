import { test, expect } from "@playwright/test";

import {
  FALL_TENNIS_COURTS_PER_SESSION,
  FALL_PLAYERS_PER_COURT,
  FALL_SLOTS_BY_GROUP,
  FALL_YOUTH_BLOCKS,
} from "../src/data/fall-2026";
import {
  PICKLEBALL_COURTS_PER_TENNIS_COURT,
  PLAYERS_PER_PICKLEBALL_COURT,
  getVenue,
  pickleballCourts,
  playerCapacity,
} from "../src/data/venue-parking";
import { FALL_VENUE } from "../src/data/fall-2026";

// The Fall 2026 season sells spots against courts Sam pays CUPF to reserve, so
// the seat count and the court count have to be the same decision. They drifted
// once already: fall-2026 advertised 9 slots per group while fall-poll-2026 sold
// 8, and venue-parking recorded Wood MS as having nothing rentable at all.
//
// Per-group since 2026-08-29: Green and Yellow no longer hold the same number,
// so there is nothing left to assert about "the" seat count — each group is
// pinned to its own court math instead.
//
// Written against FALL_VENUE rather than a named school, because the season
// moved venues mid-registration (Wood MS → Walter Johnson HS, 2026-08-27) with
// 9 seats already sold. Whatever venue the season names, these must hold.

test.describe("fall season seats are derived from the booked courts", () => {
  test("every group's seats are its own court math, never a typed number", () => {
    expect(FALL_TENNIS_COURTS_PER_SESSION).toBe(1);
    for (const block of FALL_YOUTH_BLOCKS) {
      expect(FALL_SLOTS_BY_GROUP[block.level]).toBe(
        FALL_TENNIS_COURTS_PER_SESSION *
          PICKLEBALL_COURTS_PER_TENNIS_COURT *
          FALL_PLAYERS_PER_COURT[block.level],
      );
    }
  });

  test("every Sunday block has a seat count and a players-per-court figure", () => {
    // A block added to the season without an entry in either map would sell
    // `undefined` seats through the checkout gate.
    for (const block of FALL_YOUTH_BLOCKS) {
      expect(typeof FALL_SLOTS_BY_GROUP[block.level]).toBe("number");
      expect(FALL_SLOTS_BY_GROUP[block.level]).toBeGreaterThan(0);
      expect(FALL_PLAYERS_PER_COURT[block.level]).toBeGreaterThan(0);
    }
  });

  test("Green holds the standard 4 a court; Yellow is the deliberate exception", () => {
    // Sam, 2026-08-29: Yellow runs 5 a court against the SAME single booking.
    // Green must not drift along with it, and neither may the site-wide cap
    // that sizes drop-ins and every venue's playerCapacity.
    expect(FALL_PLAYERS_PER_COURT.Green).toBe(PLAYERS_PER_PICKLEBALL_COURT);
    expect(FALL_PLAYERS_PER_COURT.Yellow).toBe(5);
    expect(PLAYERS_PER_PICKLEBALL_COURT).toBe(4);
    expect(FALL_SLOTS_BY_GROUP.Green).toBe(8);
    expect(FALL_SLOTS_BY_GROUP.Yellow).toBe(10);
  });

  test("no group is sized past what its court can physically hold", () => {
    // 4 a court is NGA's comfortable cap; 5 is the agreed squeeze. Anything
    // above 6 a court is not a booking decision any more, it's an overbook.
    const MAX_PLAYERS_PER_COURT = 6;
    const courts =
      FALL_TENNIS_COURTS_PER_SESSION * PICKLEBALL_COURTS_PER_TENNIS_COURT;
    for (const block of FALL_YOUTH_BLOCKS) {
      expect(FALL_SLOTS_BY_GROUP[block.level]).toBeLessThanOrEqual(
        courts * MAX_PLAYERS_PER_COURT,
      );
    }
  });
});

test.describe("the fall venue is a bookable CUPF court", () => {
  test("the season venue string resolves to a known venue", () => {
    // A venue the table can't resolve has no court count and no parking tip,
    // so a rename or a move that misses venue-parking fails here first.
    expect(getVenue(FALL_VENUE)).not.toBeNull();
  });

  test("the season venue has rentable tennis courts, not zero", () => {
    const venue = getVenue(FALL_VENUE)!;
    // The old Wood record described the free Bauer Drive park pickleball courts
    // next door and reported nothing rentable, so the season's own venue looked
    // unbookable and its capacity computed to 0.
    expect(venue.tennisCourts).toBeGreaterThan(0);
    expect(pickleballCourts(venue)).toBeGreaterThan(0);
    expect(playerCapacity(venue)).toBeGreaterThan(0);
  });

  test("the venue holds at least the courts the season books", () => {
    const venue = getVenue(FALL_VENUE)!;
    expect(venue.tennisCourts).toBeGreaterThanOrEqual(
      FALL_TENNIS_COURTS_PER_SESSION,
    );
  });

  test("the parking tip sends parents to the school lot and our courts", () => {
    const venue = getVenue(FALL_VENUE)!;
    // Parents were once sent to the rec-center lot by Bauer Drive Local Park —
    // the free first-come courts — rather than the school courts we permit.
    expect(venue.tip).toMatch(/school lot|main .*lot/i);
    expect(venue.tip).toMatch(/tennis court/i);
    // Naming a neighbouring public facility is fine, but only to steer AWAY.
    if (/Community Recreation Center|Parking Garage/i.test(venue.tip)) {
      expect(venue.tip).toMatch(/Don't|Skip|not ours|public park|park's/i);
    }
    // The school courts are reserved, so nothing about them is first-come.
    expect(venue.tip).not.toMatch(/first-come/i);
  });
});
