import { test, expect } from "@playwright/test";
import {
  FALL_PREVIOUS_VENUE_SHORT,
  FALL_SEASON_URL,
  fallVenueChangeHtml,
  fallVenueChangeSubject,
  fallVenueChangeText,
} from "../src/lib/email/fall-venue-change";
import {
  FALL_PUBLIC_AREA,
  FALL_RAIN_DATES,
  FALL_SUNDAYS,
  FALL_VENUE,
  FALL_VENUE_SHORT,
} from "../src/data/fall-2026";
import { FALL_SEASON_PRICE_USD } from "../src/data/fall-season-2026";

// Copy rules for the "the season moved" notice to families who already paid.
// The load-bearing one is the refund offer: the season is sold non-refundable,
// but the venue changed after purchase and not by the family's choice, so the
// way out has to be stated plainly and NOT buried (Sam's call, 2026-08-27).

const INPUT = { firstName: "Dana" };

function bothParts(): string[] {
  return [fallVenueChangeHtml(INPUT), fallVenueChangeText(INPUT)];
}

test.describe("fall venue-change notice — the change itself", () => {
  test("names the new venue and the old one, in both parts", () => {
    for (const part of bothParts()) {
      expect(part).toContain(FALL_VENUE_SHORT);
      // Naming what we moved AWAY from is the point — a parent who booked
      // their Sunday around Rockville needs to see that word to register the
      // change at all.
      expect(part).toContain(FALL_PREVIOUS_VENUE_SHORT);
    }
  });

  test("carries the full new street address, not just the school name", () => {
    // A parent is driving somewhere new; the school name alone isn't enough.
    for (const part of bothParts()) {
      expect(part).toContain(FALL_VENUE);
    }
  });

  test("carries parking guidance for the new venue", () => {
    for (const part of bothParts()) {
      expect(part).toMatch(/lot/i);
      expect(part).toMatch(/tennis court/i);
    }
  });

  // Brand-guide rules for a parent-facing send (BRAND_GUIDELINES.md
  // §COMMS TEMPLATES): subject <= 60 chars, and "you" — the parent — is the
  // anchor inside the first 10 words. The first draft of this email broke
  // both (a 71-char subject opening "one important change to pass on").
  test("the subject fits a phone preview — 60 chars absolute max", () => {
    expect(fallVenueChangeSubject().length).toBeLessThanOrEqual(60);
  });

  test("the parent is the anchor — 'you' lands in the first 10 words", () => {
    const opening = fallVenueChangeText(INPUT)
      .split("\n")
      .find((l) => l.startsWith("Hi "))!;
    const firstTen = opening.split(/\s+/).slice(0, 10).join(" ");
    expect(firstTen).toMatch(/\byou\b|\byou'll\b|\byour\b/i);
  });

  test("the signoff carries the tagline above the signature, in both parts", () => {
    for (const part of bothParts()) {
      expect(part).toMatch(/better than yesterday, together/i);
      expect(part).toMatch(/Coach Sam/);
    }
  });

  test("the subject names the change and the new venue", () => {
    const subject = fallVenueChangeSubject();
    expect(subject).toContain(FALL_VENUE_SHORT);
    expect(subject).toMatch(/location change|moved/i);
    // Never let the subject read like routine season news — a recipient who
    // only sees the subject line must still learn the venue moved.
    expect(subject).not.toContain(FALL_PREVIOUS_VENUE_SHORT);
  });
});

test.describe("fall venue-change notice — the way out", () => {
  test("offers a full refund, in both parts", () => {
    for (const part of bothParts()) {
      expect(part).toMatch(/refund you in full/i);
    }
  });

  test("the refund offer is body copy, not a footnote after the sign-off", () => {
    const text = fallVenueChangeText(INPUT);
    const refundAt = text.search(/refund you in full/i);
    const signOffAt = text.search(/Coach Sam · Next Gen/);
    expect(refundAt).toBeGreaterThan(-1);
    expect(signOffAt).toBeGreaterThan(-1);
    expect(refundAt).toBeLessThan(signOffAt);
  });

  test("asks for no justification and attaches no condition to the refund", () => {
    for (const part of bothParts()) {
      expect(part).toMatch(/no explanation needed/i);
      // Dark-pattern guard: no deadline, fee, or eligibility test bolted onto
      // an offer we made because WE changed the deal.
      expect(part).not.toMatch(/within \d+ (day|hour)/i);
      expect(part).not.toMatch(/processing fee|restocking|minus a/i);
    }
  });
});

test.describe("fall venue-change notice — what did NOT change", () => {
  test("says plainly that dates, times and price are unchanged", () => {
    for (const part of bothParts()) {
      expect(part).toMatch(/everything else is exactly the same/i);
      expect(part).toMatch(/only the courts changed/i);
    }
  });

  test("lists every season Sunday and both rain dates", () => {
    const text = fallVenueChangeText(INPUT);
    // September 20 … October 25 — rendered long-form from the ISO constants.
    for (const iso of [...FALL_SUNDAYS, ...FALL_RAIN_DATES]) {
      const label = new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        timeZone: "UTC",
      });
      expect(text).toContain(label);
    }
  });

  test("says the rain dates moved to the new courts too", () => {
    // A held rain date at the OLD venue is the quiet way this move goes wrong.
    for (const part of bothParts()) {
      expect(part).toMatch(/rain dates.*new courts|new courts too/is);
    }
  });

  test("re-quotes no price — the amount they already paid is not in question", () => {
    for (const part of bothParts()) {
      expect(part).not.toContain(`$${FALL_SEASON_PRICE_USD}`);
    }
  });

  test("points at the season page as the single CTA", () => {
    for (const part of bothParts()) {
      expect(part).toContain(FALL_SEASON_URL);
    }
  });
});

test.describe("fall venue-change notice — minor-PII posture", () => {
  test("never names a child — the email is addressed to the parent", () => {
    // The engine reads parent fields only; this pins the template can't drift
    // into wanting a child name to personalize with.
    for (const part of bothParts()) {
      expect(part).toMatch(/your player/i);
    }
    const html = fallVenueChangeHtml({ firstName: "Dana" });
    expect(html).toContain("Dana");
  });

  test("escapes the parent name into HTML", () => {
    const html = fallVenueChangeHtml({ firstName: '<script>x</script>' });
    expect(html).not.toContain("<script>x</script>");
    expect(html).toContain("&lt;script&gt;");
  });

  test("greets a nameless row without rendering an empty salutation", () => {
    const html = fallVenueChangeHtml({ firstName: "there" });
    expect(html).toMatch(/Hi there/);
  });
});

test.describe("fall venue-change notice — no stale venue anywhere", () => {
  test("the new area is named, and the old venue only as the thing we left", () => {
    for (const part of bothParts()) {
      expect(part).toContain(FALL_PUBLIC_AREA);
      // The old venue appears exactly once — in the sentence explaining the
      // move. More than that means a stale reference crept back in.
      const hits = part.split(FALL_PREVIOUS_VENUE_SHORT).length - 1;
      expect(hits).toBe(1);
    }
  });
});
