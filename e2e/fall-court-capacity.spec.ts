import { test, expect } from "@playwright/test";

import {
  FALL_TENNIS_COURTS_PER_SESSION,
  SLOTS_PER_GROUP,
} from "../src/data/fall-2026";
import { FALL_POLL_SPOTS_PER_GROUP } from "../src/data/fall-poll-2026";
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
// Written against FALL_VENUE rather than a named school, because the season
// moved venues mid-registration (Wood MS → Walter Johnson HS, 2026-08-27) with
// 9 seats already sold. Whatever venue the season names, these must hold.

test.describe("fall season seats are derived from the booked courts", () => {
  test("one reserved tennis court is two pickleball courts and eight seats", () => {
    expect(FALL_TENNIS_COURTS_PER_SESSION).toBe(1);
    expect(SLOTS_PER_GROUP).toBe(
      FALL_TENNIS_COURTS_PER_SESSION *
        PICKLEBALL_COURTS_PER_TENNIS_COURT *
        PLAYERS_PER_PICKLEBALL_COURT,
    );
  });

  test("the survey and the poll quote the same number of spots", () => {
    expect(SLOTS_PER_GROUP).toBe(FALL_POLL_SPOTS_PER_GROUP);
  });

  test("seats per group never exceed what one booked court holds", () => {
    const seatsOnBookedCourts =
      FALL_TENNIS_COURTS_PER_SESSION *
      PICKLEBALL_COURTS_PER_TENNIS_COURT *
      PLAYERS_PER_PICKLEBALL_COURT;
    expect(SLOTS_PER_GROUP).toBeLessThanOrEqual(seatsOnBookedCourts);
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
