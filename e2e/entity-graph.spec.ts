import { test, expect } from "@playwright/test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import type { NgaSession } from "../src/lib/notion-sessions";
import { sportsEventJsonLd } from "../src/lib/sports-event-jsonld";
import { blogPosts } from "../src/data/blog";
import {
  EXTENDED_SERVICE_AREAS,
  CITY_LANDING_PAGES,
  ORG_ID,
  PERSON_IDS,
  blogPostingJsonLd,
  courseJsonLd,
  extendedAreaServiceJsonLd,
  cityServiceJsonLd,
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
  test("the academy has one stable organization identity without a facility claim", () => {
    expect(ORG_ID).toBe("https://nextgenpbacademy.com/#organization");
    const org = organizationJsonLd() as Record<string, unknown>;
    expect(org["@id"]).toBe(ORG_ID);
    expect(org["@type"]).toBe("SportsOrganization");
    expect(org).not.toHaveProperty("address");
    expect(org).not.toHaveProperty("geo");
    expect(org.alternateName).toEqual(["Next Gen PB Academy", "NGA"]);
    const sameAs = org.sameAs as string[];
    expect(sameAs).toContain("https://www.instagram.com/nextgenpickleballacademy");
    expect(sameAs).toContain("https://www.facebook.com/profile.php?id=61579009749341");
    expect(sameAs).toContain("https://maps.google.com/?cid=13747039329786027007");
    expect(sameAs).not.toContain("https://www.sammorrispb.com");
    expect(sameAs).not.toContain("https://www.linkanddink.com");
    expect(org.founder).toEqual([
      { "@type": "Person", "@id": PERSON_IDS["Sam Morris"], name: "Sam Morris" },
      { "@type": "Person", "@id": PERSON_IDS["Amine Lahlou"], name: "Amine Lahlou" },
    ]);
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
      (cityServiceJsonLd({ city: "Rockville", url: "u", description: "d" }) as { provider: Ref }).provider,
      "city.provider",
    );
    expectOrgRef(
      (extendedAreaServiceJsonLd({ area: EXTENDED_SERVICE_AREAS[0], url: "u", description: "d" }) as { provider: Ref }).provider,
      "frederick.provider",
    );
    const posting = blogPostingJsonLd(blogPosts[0]) as { publisher: Ref; author: Ref };
    expectOrgRef(posting.publisher, "blog.publisher");
    expect(posting.author["@id"]).toBe(PERSON_IDS["Sam Morris"]);
    expect(posting.author.name).toBe("Sam Morris");
  });

  test("every city guide describes an academy service, not a separate branch", () => {
    for (const { city, slug } of CITY_LANDING_PAGES) {
      const url = `https://nextgenpbacademy.com/${slug}`;
      const service = cityServiceJsonLd({ city, url, description: "" });
      expect(service["@type"]).toBe("Service");
      expect(service).toHaveProperty("@id", `${url}#service`);
      expect(service.url).toBe(url);
      expect(service.description).toBe("");
      expect(service.areaServed).toContainEqual({ "@type": "City", name: city });
      expect(service).not.toHaveProperty("address");
      expect(service).not.toHaveProperty("geo");
      expect(service).not.toHaveProperty("parentOrganization");
    }
    const event = sportsEventJsonLd(makeSession());
    expect(event.location.name).toBe("Earle B. Wood Middle School");
    expect(event.location.address.addressLocality).toBe("Montgomery County");
    expect(event.offers.url).toBe("https://nextgenpbacademy.com/schedule");
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
