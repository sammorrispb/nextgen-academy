import { test, expect } from "@playwright/test";
import { CAMPS, findCampBySlug } from "../src/data/camps";
import {
  buildCampShareBlurb,
  campFollowupSubject,
  campFollowupHtml,
  campFollowupText,
  type CampFollowupInput,
  type CampFollowupNextCamp,
} from "../src/lib/email/camp-followup";
import {
  concludedCampForFollowup,
  nextCampAfter,
  toFollowupNextCamp,
} from "../src/lib/camp-followup-run";

// Pure-function specs — no dev server. Run with:
//   npx playwright test e2e/camp-followup.spec.ts --project=desktop

const NEXT_CAMP: CampFollowupNextCamp = {
  title: "Summer Camp — Back to School",
  weekLabel: "August 17 – August 20, 2026",
  publicArea: "Rockville, MD",
  hours: "9:30 AM – 12:30 PM",
  registerUrl: "https://nextgenpbacademy.com/camp/august-17",
  priceDayUsd: 50,
  priceWeekUsd: 150,
  ageMin: 8,
  ageMax: 16,
};

function input(overrides: Partial<CampFollowupInput> = {}): CampFollowupInput {
  return {
    parentFirst: "Jordan",
    childFirst: "Ava",
    campTitle: "Summer Camp — Week 2",
    campWeek: "July 20 – July 23, 2026",
    reviewUrl: "https://g.page/r/test-review-link/review",
    shareBlurb: buildCampShareBlurb(NEXT_CAMP),
    nextCamp: NEXT_CAMP,
    ...overrides,
  };
}

test.describe("camp follow-up subject", () => {
  test("carries the camper's name", () => {
    expect(campFollowupSubject("Ava")).toBe(
      "Ava crushed camp week — thank you (+ a quick favor)",
    );
  });

  test("falls back when the name is missing", () => {
    expect(campFollowupSubject("")).toContain("Your camper");
  });
});

test.describe("share blurb", () => {
  test("carries the next camp's dates, public area, ages, prices, and register link", () => {
    const blurb = buildCampShareBlurb(NEXT_CAMP);
    expect(blurb).toContain("August 17 – August 20, 2026");
    expect(blurb).toContain("Rockville, MD");
    expect(blurb).toContain("Ages 8–16");
    expect(blurb).toContain("$50 a morning or $150 for the full week");
    expect(blurb).toContain("https://nextgenpbacademy.com/camp/august-17");
  });

  test("built from the REAL August camp, it never leaks the exact venue (child-safety location policy)", () => {
    const august = findCampBySlug("august-17");
    expect(august).toBeTruthy();
    const blurb = buildCampShareBlurb(toFollowupNextCamp(august!));
    // Parents paste this publicly — broad area only, never the school address.
    expect(blurb).toContain(august!.publicArea);
    expect(blurb).not.toContain("Earle B. Wood");
    expect(blurb).not.toContain("Bauer");
    expect(blurb.toLowerCase()).not.toContain(august!.exactLocation.toLowerCase().slice(0, 12));
  });
});

test.describe("camp follow-up email body", () => {
  test("HTML carries the review CTA, the paste-ready blurb, and the register link", () => {
    const html = campFollowupHtml(input());
    expect(html).toContain("https://g.page/r/test-review-link/review");
    expect(html).toContain("Leave a Google review");
    expect(html).toContain("listserv");
    expect(html).toContain("https://nextgenpbacademy.com/camp/august-17");
    expect(html).toContain("August 17 – August 20, 2026");
    expect(html).toContain("Rockville, MD");
  });

  test("plain-text fallback carries the same review URL, blurb, and register URL (parity rule)", () => {
    const text = campFollowupText(input());
    expect(text).toContain("https://g.page/r/test-review-link/review");
    expect(text).toContain("Rockville, MD");
    expect(text).toContain("https://nextgenpbacademy.com/camp/august-17");
    expect(text).toContain("Coach Sam · Next Gen Pickleball Academy");
    expect(text).toContain("better than yesterday, together");
  });

  test("omits the next-camp block cleanly when no camp follows", () => {
    const noNext = input({ nextCamp: null, shareBlurb: "Generic blurb" });
    const html = campFollowupHtml(noNext);
    const text = campFollowupText(noNext);
    expect(html).not.toContain("One more camp this summer");
    expect(text).not.toContain("ONE MORE CAMP THIS SUMMER");
    // The review ask still stands on its own.
    expect(html).toContain("Leave a Google review");
  });

  test("escapes HTML in user-derived fields", () => {
    const html = campFollowupHtml(
      input({ parentFirst: `<script>alert("x")</script>`, childFirst: `O'Brien & Co` }),
    );
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("O&#39;Brien &amp; Co");
  });
});

test.describe("camp resolution helpers", () => {
  test("concludedCampForFollowup picks the latest finished camp, not a running one", () => {
    // 2026-07-24: Week 2 (ended 7/23) is done; August camp hasn't started.
    expect(concludedCampForFollowup("2026-07-24", CAMPS)?.slug).toBe("july-20");
    // Mid-Week-2 (ends 7/23): only Week 1 has concluded.
    expect(concludedCampForFollowup("2026-07-21", CAMPS)?.slug).toBe("june-29");
    // Before any camp has finished.
    expect(concludedCampForFollowup("2026-06-01", CAMPS)).toBeNull();
    // The camp's own last day counts as concluded (mornings end at 12:30).
    expect(concludedCampForFollowup("2026-07-23", CAMPS)?.slug).toBe("july-20");
  });

  test("nextCampAfter promotes the first camp starting after the concluded one", () => {
    const week2 = findCampBySlug("july-20")!;
    expect(nextCampAfter(week2, CAMPS)?.slug).toBe("august-17");
    const august = findCampBySlug("august-17")!;
    expect(nextCampAfter(august, CAMPS)).toBeNull();
  });

  test("toFollowupNextCamp exposes only the public area and a real register URL", () => {
    const next = toFollowupNextCamp(findCampBySlug("august-17")!);
    expect(next.publicArea).toBe("Rockville, MD");
    expect(next.registerUrl).toBe("https://nextgenpbacademy.com/camp/august-17");
    expect(JSON.stringify(next)).not.toContain("Earle B. Wood");
  });
});
