import { test, expect } from "@playwright/test";

import { seatStatusLabel } from "../src/lib/seat-status";

// The fall season's seat line used to render "3 of 8 spots left", which
// published the group cap on a marketing surface. Capacity is a booking
// decision that moves (the season has already changed venue mid-registration),
// and every published copy of the number is one more place it can go stale.
// These pin that the label is a function of what's LEFT and never of the cap.

test.describe("seat status is derived from remaining seats alone", () => {
  test("a comfortable group reads as open", () => {
    expect(seatStatusLabel(4)).toBe("Spots open");
    expect(seatStatusLabel(8)).toBe("Spots open");
    expect(seatStatusLabel(10)).toBe("Spots open");
  });

  test("two or three left reads as filling up", () => {
    expect(seatStatusLabel(3)).toBe("Filling up");
    expect(seatStatusLabel(2)).toBe("Filling up");
  });

  test("one left is called out on its own", () => {
    expect(seatStatusLabel(1)).toBe("Last spot");
  });

  test("none left points at the waitlist", () => {
    expect(seatStatusLabel(0)).toBe("Full — join the waitlist");
  });

  test("an oversold group still reads as full, never negative", () => {
    // countFallRegistrations reads a live Notion roster; a manual row added
    // past the cap must not render "-1 spots" or fall through to "Spots open".
    expect(seatStatusLabel(-1)).toBe("Full — join the waitlist");
    expect(seatStatusLabel(-4)).toBe("Full — join the waitlist");
  });

  test("an unknown count renders nothing rather than guessing", () => {
    // Notion unavailable — the group is still selectable, it just carries no
    // seat claim. A fabricated status is worse than none.
    expect(seatStatusLabel(null)).toBeNull();
  });

  test("no label ever names the group capacity", () => {
    const labels = [-1, 0, 1, 2, 3, 4, 8, 10, 16].map((n) =>
      seatStatusLabel(n),
    );
    for (const label of labels) {
      expect(label).not.toMatch(/\d/);
    }
  });
});
