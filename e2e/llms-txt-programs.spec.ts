import { test, expect } from "@playwright/test";
import { activeSeasonLines, buildLlmsTxt, wrapEntry } from "../src/lib/llms-txt";
import { FALL_SEASON_LABEL, FALL_SUNDAYS } from "../src/data/fall-2026";
import {
  PICKLPARK_SATURDAYS,
  PICKLPARK_SEASON_LABEL,
} from "../src/data/picklpark-2026";
import { PICKLPARK_LEAGUES } from "../src/data/picklpark-leagues-2026";
import { MVF_PROGRAMS } from "../src/data/mvf";

/**
 * llms.txt is the THIRD surface to publish the season facts, after the page
 * and the events feed, so these tests are drift tests first: they assert the
 * document agrees with the data files rather than matching typed prose. A
 * season that moves in its data file and not here should fail here.
 *
 * The second thing under test is the money boundary. Three programs are
 * registered off this host and three more have no registration at all; an
 * assistant that reads this file and tells a parent to "sign up on
 * nextgenpbacademy.com" for any of them has invented a checkout. The listing
 * therefore has to keep saying who takes the money, out loud.
 */

const DURING = "2026-09-19"; // first Pickl Park Saturday, mid-fall-season
const AFTER_ALL = "2026-12-01"; // both seasons finished

/**
 * Prose is wrapped to 78 columns, so a fact can straddle a line break. These
 * assertions are about the facts, not the wrap — collapse whitespace first, or
 * a harmless re-flow turns into a red suite and the real drift gets lost in it.
 */
const flat = (s: string) => s.replace(/\s+/g, " ");

test.describe("llms.txt publishes the active programs", () => {
  test("both running seasons are listed, with venue and dates from their data files", () => {
    const txt = buildLlmsTxt(DURING);

    expect(txt).toContain("/picklpark");
    expect(txt).toContain("The Pickl Park");
    expect(txt).toContain("Frederick, MD");
    expect(flat(txt)).toContain("September 19 – October 24, 2026");

    expect(txt).toContain("/fall");
    expect(flat(txt)).toContain("Walter Johnson High School");
    expect(txt).toContain("Bethesda, MD");
    expect(flat(txt)).toContain("September 20 – October 25, 2026");
  });

  test("each Pickl Park league appears with the age band and time it actually runs", () => {
    const txt = buildLlmsTxt(DURING);
    for (const league of PICKLPARK_LEAGUES) {
      expect(flat(txt), `${league.slug} title`).toContain(league.title);
      expect(flat(txt), `${league.slug} ages`).toContain(league.ageLabel);
      expect(flat(txt), `${league.slug} time`).toContain(league.timeLabel);
    }
  });

  test("MVF is listed with the age band from its data file", () => {
    const txt = buildLlmsTxt(DURING);
    expect(txt).toContain("/montgomery-village-youth-pickleball");
    expect(flat(txt)).toContain("Montgomery Village Foundation");
    // 8–16, straight off MVF_AGE_MIN/MAX rather than a typed range.
    expect(flat(txt)).toContain("ages 8–16");
    expect(MVF_PROGRAMS.length).toBeGreaterThan(0);
  });

  test("every off-site program says who takes the money", () => {
    const txt = buildLlmsTxt(DURING);
    // Pickl Park and MVF both register elsewhere; the fall season does not.
    expect(flat(txt)).toContain("REGISTRATION AND PAYMENT ARE THE PICKL PARK'S");
    expect(flat(txt)).toContain("REGISTRATION AND PAYMENT ARE MVF'S");
    expect(flat(txt)).toContain("Registration and payment are ON THIS SITE");
    expect(flat(txt)).toContain('never imply a program marked "interest list" has a signup');
  });

  test("the three interest lists are named as having no registration", () => {
    const txt = buildLlmsTxt(DURING);
    const section = txt.slice(txt.indexOf("## Interest lists"));
    expect(flat(section)).toContain("NO registration exists");
    for (const path of ["/league", "/clusters", "/crew"]) {
      expect(section, path).toContain(`https://nextgenpbacademy.com${path}`);
    }
    expect(flat(section)).toContain("Do not describe it as enrollable");
  });

  test("a season stays listed through its final date, then is dropped", () => {
    const lastSaturday = PICKLPARK_SATURDAYS[PICKLPARK_SATURDAYS.length - 1];
    const lastSunday = FALL_SUNDAYS[FALL_SUNDAYS.length - 1];

    // Final day: still listed — a season in progress still takes registrations.
    expect(flat(activeSeasonLines(lastSaturday).join("\n"))).toContain("/picklpark");
    expect(flat(activeSeasonLines(lastSunday).join("\n"))).toContain("/fall");

    // Day after each: gone.
    expect(activeSeasonLines("2026-10-25").join("\n")).not.toContain("/picklpark");
    expect(activeSeasonLines("2026-10-26").join("\n")).not.toContain("/fall");
  });

  test("once every season is over the heading goes too, and the rest survives", () => {
    const txt = buildLlmsTxt(AFTER_ALL);
    expect(activeSeasonLines(AFTER_ALL)).toHaveLength(0);
    expect(txt).not.toContain("## Seasons currently running");
    // The evergreen surface is untouched by the prune.
    expect(txt).toContain("/free-evaluation");
    expect(txt).toContain("/montgomery-village-youth-pickleball");
    expect(txt).toContain("## Interest lists");
  });

  test("the reference pages an assistant needs to answer placement are present", () => {
    const txt = buildLlmsTxt(DURING);
    expect(txt).toContain("/levels");
    expect(txt).toContain("/schools");
    expect(txt).toContain("/api/events/feed");
  });


  test("the human season label agrees with the dates it summarises", () => {
    // M3 showed the prune caught a moved Saturday but the printed label did
    // not: `PICKLPARK_SEASON_LABEL` and `PICKLPARK_SATURDAYS` are separate
    // constants and can silently disagree, which would publish a date range
    // that no session runs on. Same shape for the fall season.
    const monthDay = (iso: string) =>
      new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        timeZone: "UTC",
      });

    const ppFirst = PICKLPARK_SATURDAYS[0];
    const ppLast = PICKLPARK_SATURDAYS[PICKLPARK_SATURDAYS.length - 1];
    expect(PICKLPARK_SEASON_LABEL).toContain(monthDay(ppFirst));
    expect(PICKLPARK_SEASON_LABEL).toContain(monthDay(ppLast));

    const fFirst = FALL_SUNDAYS[0];
    const fLast = FALL_SUNDAYS[FALL_SUNDAYS.length - 1];
    expect(FALL_SEASON_LABEL).toContain(monthDay(fFirst));
    expect(FALL_SEASON_LABEL).toContain(monthDay(fLast));
  });

  test("wrapping keeps every line inside the house width and never splits a URL", () => {
    // 82 is the file's own longest hand-wrapped prose line, not a round number
    // — the point of this test is to catch a GENERATED entry running away
    // (a renamed venue, a longer season label), so the bound is the existing
    // style rather than a stricter one that would fail on untouched copy.
    for (const line of buildLlmsTxt(DURING).split("\n")) {
      const words = line.trim().split(/\s+/);
      // A single over-long token (a URL) may overhang; two words may not.
      if (words.length > 1) expect(line.length, line).toBeLessThanOrEqual(82);
    }
    const long = wrapEntry(
      "- https://nextgenpbacademy.com/montgomery-village-youth-pickleball is a very long entry that must wrap",
    );
    expect(long.split("\n")[0]).toContain(
      "https://nextgenpbacademy.com/montgomery-village-youth-pickleball",
    );
    expect(long.split("\n").slice(1).every((l) => l.startsWith("  "))).toBe(true);
  });

  test("still quotes no price anywhere (the drop-in invariant, extended)", () => {
    for (const day of [DURING, AFTER_ALL]) {
      expect(buildLlmsTxt(day)).not.toContain("$");
    }
  });
});
