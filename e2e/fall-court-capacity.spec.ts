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
  test("Wood MS resolves from the season venue string", () => {
    expect(getVenue(FALL_VENUE)).not.toBeNull();
  });

  test("Wood MS has rentable tennis courts, not zero", () => {
    const wood = getVenue(FALL_VENUE)!;
    // The old record described the free Bauer Drive park pickleball courts next
    // door and reported nothing rentable, so the season's own venue looked
    // unbookable and its capacity computed to 0.
    expect(wood.tennisCourts).toBeGreaterThan(0);
    expect(pickleballCourts(wood)).toBeGreaterThan(0);
    expect(playerCapacity(wood)).toBeGreaterThan(0);
  });

  test("the venue holds at least the courts the season books", () => {
    const wood = getVenue(FALL_VENUE)!;
    expect(wood.tennisCourts).toBeGreaterThanOrEqual(
      FALL_TENNIS_COURTS_PER_SESSION,
    );
  });

  test("the parking tip points at the school courts, not the public park ones", () => {
    const wood = getVenue(FALL_VENUE)!;
    // Parents were being sent to the rec-center lot by Bauer Drive Local Park —
    // the free first-come courts — rather than the school courts we permit.
    expect(wood.tip).toMatch(/Wood MS lot|school lot/i);
    expect(wood.tip).toMatch(/tennis court/i);
    // Naming the rec center is fine, but only to steer parents AWAY from it.
    if (/Community Recreation Center/i.test(wood.tip)) {
      expect(wood.tip).toMatch(/Don't|not ours|public park|park's/i);
    }
    // The school courts are reserved, so nothing about them is first-come.
    expect(wood.tip).not.toMatch(/first-come/i);
  });
});
