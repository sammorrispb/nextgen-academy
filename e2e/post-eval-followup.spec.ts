import { test, expect } from "@playwright/test";
import {
  buildPostEvalFollowupHtml,
  isPrivateBridgeLevel,
  formatSessionLine,
  LEVEL_DESCRIPTIONS,
  type Level,
  type PostEvalEmailArgs,
} from "../src/lib/email/post-eval-followup";

function args(level: Level, sessionLines: string[]): PostEvalEmailArgs {
  return {
    parentFirstName: "Hun",
    childFirstName: "Zoe",
    level,
    levelDescription: LEVEL_DESCRIPTIONS[level],
    observations: "",
    sessionLines,
  };
}

test.describe("isPrivateBridgeLevel — Red/Orange are foundation levels", () => {
  test("Red/Orange are foundation (own-level match + private fast-track); Green/Yellow are open-group", () => {
    expect(isPrivateBridgeLevel("Red")).toBe(true);
    expect(isPrivateBridgeLevel("Orange")).toBe(true);
    expect(isPrivateBridgeLevel("Green")).toBe(false);
    expect(isPrivateBridgeLevel("Yellow")).toBe(false);
  });
});

test.describe("formatSessionLine", () => {
  test("renders date — place · time", () => {
    expect(
      formatSessionLine({
        date: "2026-06-09",
        startTime: "4:30 PM",
        location: "Walter Johnson HS, Bethesda",
        publicArea: "",
      }),
    ).toBe("Tue, Jun 9 — Walter Johnson HS, Bethesda · 4:30 PM");
  });

  test("uses publicArea (never the exact address) for location-hidden sessions", () => {
    const line = formatSessionLine({
      date: "2026-06-09",
      startTime: "10:00 AM",
      location: "123 Secret Court Rd, Olney, MD",
      publicArea: "Olney, MD",
    });
    expect(line).toContain("Olney, MD");
    expect(line).not.toContain("Secret Court Rd");
  });
});

test.describe("buildPostEvalFollowupHtml — foundation levels (Red/Orange)", () => {
  for (const level of ["Red", "Orange"] as Level[]) {
    test(`${level} leads with its own group court, labelled "${level} Ball"`, () => {
      const html = buildPostEvalFollowupHtml(args(level, []));
      // Card shows the ball color, not the retired "Private Lessons" label.
      expect(html).toContain(`${level} Ball`);
      expect(html).not.toContain("Private Lessons (pre-rally bridge)");
      // Group play is the lead recommendation — Reserve CTA always routes to
      // /schedule, even with no live lines yet.
      expect(html).toContain("Reserve a slot");
      // Private lessons remain offered as an optional fast-track.
      expect(html).toContain("private lessons");
      expect(html).toContain("fast-track");
    });

    test(`${level} with an open court: lists the session + Reserve CTA + private fast-track`, () => {
      const html = buildPostEvalFollowupHtml(
        args(level, ["Tue, Jun 9 — Olney, MD · 6:00 PM"]),
      );
      // Group drop-in is primary: the live line, price, and CTA all render.
      expect(html).toContain("Tue, Jun 9 — Olney, MD · 6:00 PM");
      expect(html).toContain("$20");
      expect(html).toContain("Reserve a slot");
      // ...with private lessons still offered underneath as a fast-track.
      expect(html).toContain("Want to fast-track?");
      expect(html).toContain("private lessons");
    });
  }
});

test.describe("buildPostEvalFollowupHtml — group levels (Green/Yellow)", () => {
  test("renders the live session lines passed in + Reserve CTA", () => {
    const lines = [
      "Sat, Jun 13 — Bethesda · 4:30 PM",
      "Sun, Jun 14 — Gaithersburg · 10:00 AM",
    ];
    const html = buildPostEvalFollowupHtml(args("Green", lines));
    expect(html).toContain("Sat, Jun 13 — Bethesda · 4:30 PM");
    expect(html).toContain("Sun, Jun 14 — Gaithersburg · 10:00 AM");
    expect(html).toContain("Reserve a slot");
    expect(html).toContain("Green Ball");
  });

  test("falls back gracefully when there are no upcoming sessions", () => {
    const html = buildPostEvalFollowupHtml(args("Yellow", []));
    expect(html).toContain("New Yellow Ball sessions post regularly");
    expect(html).toContain("Reserve a slot"); // CTA still routes to /schedule
  });

  test("carries NO stale hardcoded dates (the bug this fixes)", () => {
    const html = buildPostEvalFollowupHtml(args("Green", ["Sat, Jun 13 — Bethesda · 4:30 PM"]));
    expect(html).not.toContain("May 23");
    expect(html).not.toContain("May 24");
    expect(html).not.toContain("May 30");
  });
});
