import { test, expect } from "@playwright/test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import type { NgaSession } from "../src/lib/notion-sessions";
import { sportsEventJsonLd } from "../src/lib/sports-event-jsonld";
import { blogPosts } from "../src/data/blog";
import {
  EXTENDED_SERVICE_AREAS,
  ORG_ID,
  PERSON_IDS,
  blogPostingJsonLd,
  courseJsonLd,
  extendedAreaLocalBusinessJsonLd,
  localBusinessJsonLd,
  organizationJsonLd,
} from "../src/lib/seo";

/**
 * One organization entity (AEO audit, 2026-09-13).
 *
 * The site used to emit a SportsActivityLocation in the layout AND a separate
 * SportsOrganization on the home page, neither with an @id, and every
 * organizer / provider / parentOrganization / publisher was an inline
 * anonymous copy. Answer engines built several small "Next Gen" nodes instead
 * of one. Now one node carries @id #organization and everything else points at
 * it with a typed, named reference (never a bare @id — Person and org nodes
 * don't appear on every page, so a nameless ref loses its label).
 *
 * Mutation check: change the ORG_ID fragment → red.
 */

type Ref = { "@id"?: string; "@type"?: unknown; name?: string };

function expectOrgRef(ref: Ref | undefined, label: string) {
  expect(ref, label).toBeTruthy();
  expect(ref!["@id"], label).toBe(ORG_ID);
  expect(ref!["@type"], label).toBeTruthy();
  expect(ref!.name, label).toBe("Next Gen Pickleball Academy");
}

function makeSession(): NgaSession {
  return {
    id: "s1",
    title: "Drop-in",
    date: "2026-09-26",
    startTime: "2:00 PM",
    endTime: "3:00 PM",
    level: "Green",
    location: "Earle B. Wood Middle School",
    publicArea: "",
    courtCount: 1,
    maxCourts: 1,
    capacity: 4,
    registeredCount: 1,
    spotsLeft: 3,
    status: "Open",
    roster: [],
    ageStats: null,
    coachReminderSent: false,
  };
}

test.describe("entity graph", () => {
  test("the org node has a stable @id, both types, and the known profiles", () => {
    expect(ORG_ID).toBe("https://nextgenpbacademy.com/#organization");
    const org = organizationJsonLd() as Record<string, unknown>;
    expect(org["@id"]).toBe(ORG_ID);
    expect(org["@type"]).toEqual(["SportsOrganization", "SportsActivityLocation"]);
    expect(org.alternateName).toEqual(["Next Gen PB Academy", "NGA"]);
    const sameAs = org.sameAs as string[];
    expect(sameAs).toContain("https://www.instagram.com/nextgenpickleballacademy");
    expect(sameAs).toContain("https://www.facebook.com/profile.php?id=61579009749341");
    const areas = (org.areaServed as { name: string }[]).map((a) => a.name);
    for (const n of ["Montgomery County, MD", "North Bethesda", "Germantown", "Frederick County, MD"]) {
      expect(areas, n).toContain(n);
    }
  });

  test("every helper references the org by @id", () => {
    expectOrgRef(
      (courseJsonLd({ name: "Red Ball", description: "d", educationalLevel: "Pre-Rally", minAge: 6, ballColor: "Red" }) as { provider: Ref }).provider,
      "course.provider",
    );
    expectOrgRef((sportsEventJsonLd(makeSession()) as { organizer: Ref }).organizer, "event.organizer");
    expectOrgRef(
      (localBusinessJsonLd({ city: "Rockville", url: "u", description: "d" }) as { parentOrganization: Ref }).parentOrganization,
      "city.parentOrganization",
    );
    expectOrgRef(
      (extendedAreaLocalBusinessJsonLd({ area: EXTENDED_SERVICE_AREAS[0], url: "u", description: "d" }) as { parentOrganization: Ref }).parentOrganization,
      "frederick.parentOrganization",
    );
    const posting = blogPostingJsonLd(blogPosts[0]) as { publisher: Ref; author: Ref };
    expectOrgRef(posting.publisher, "blog.publisher");
    expect(posting.author["@id"]).toBe(PERSON_IDS["Sam Morris"]);
    expect(posting.author.name).toBe("Sam Morris");
  });

  test("no anonymous NGA organization copy survives outside the seo lib", () => {
    const SRC = join(__dirname, "..", "src");
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const p = join(dir, name);
        if (statSync(p).isDirectory()) walk(p);
        else if (/\.(ts|tsx)$/.test(name) && !p.endsWith(join("lib", "seo.ts"))) {
          const src = readFileSync(p, "utf8");
          // Either spelling of an anonymous NGA org node: the SportsOrganization
          // literal, or an Organization named for the academy.
          if (
            /"@type":\s*"SportsOrganization"/.test(src) ||
            /"@type":\s*"Organization",\s*name:\s*"Next Gen Pickleball Academy"/.test(src)
          ) {
            offenders.push(p);
          }
        }
      }
    };
    walk(SRC);
    expect(offenders, offenders.join("\n")).toEqual([]);
  });
});
