import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { FREDERICK_FAQ, FREDERICK_PAGE, frederickPageFaq } from "../src/data/frederick";
import { stickyCtaFor } from "../src/lib/sticky-cta";
import { faq } from "../src/data/faq";
import { PICKLPARK_LEAGUES } from "../src/data/picklpark-leagues-2026";
import {
  EXTENDED_AREA_LANDING_PAGES,
  EXTENDED_SERVICE_AREAS,
  extendedAreaLocalBusinessJsonLd,
} from "../src/lib/seo";

/**
 * The Frederick landing page may only claim what NGA actually runs there
 * (AEO audit, 2026-09-13). Zero Frederick families are in the CRM, the only
 * Frederick programs are the Pickl Park Saturday league (ages 8–13,
 * registered by The Pickl Park) plus private lessons at The Pickl Park,
 * and no free evaluation is offered at a Frederick venue.
 *
 * So: no "6–16" promise, no free evaluation in Frederick, no price (The Pickl
 * Park sets and shows it), and every league's age band present in the
 * Frederick FAQ answer so the copy can't drift from the data file.
 *
 * Mutation check: append "ages 6–16" to FREDERICK_PAGE.intro → red.
 */

// Scan EVERYTHING the page renders, not just its own data: the 2026-09-13
// brand review found the shared cost FAQ, LeadForm's success message and the
// sticky mobile CTA all offering a free evaluation on a page whose own copy
// passed this spec. Hence the combined FAQ, the page source, and the CTA.
const pageFaq = frederickPageFaq();
const copy = JSON.stringify({ FREDERICK_PAGE, pageFaq });
const sentences = [FREDERICK_PAGE, ...pageFaq]
  .flatMap((o) => Object.values(o))
  .join(" ")
  .split(/(?<=[.!?])\s+/);
// Code only: the page's own comments explain why LeadForm and the free
// evaluation are absent, and must not trip the guard that checks they are.
const pageSrc = readFileSync(
  join(__dirname, "..", "src", "app", "youth-pickleball-frederick", "page.tsx"),
  "utf8",
)
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/^\s*\/\/.*$/gm, "");

test.describe("Frederick landing page copy", () => {
  test("never promises the full 6–16 ladder", () => {
    expect(copy).not.toMatch(/6\s*[–-]\s*16/);
    expect(copy).not.toMatch(/\bages?\s+6\b/i);
  });

  test("never offers a free evaluation at a Frederick venue", () => {
    for (const s of sentences) {
      if (/free (30-minute )?evaluation/i.test(s)) {
        expect(s, s).not.toMatch(/Frederick|Pickl Park/);
      }
    }
  });

  test("quotes no price", () => {
    expect(copy).not.toContain("$");
  });

  test("the rendered FAQ includes the Frederick entries and never the MoCo cost or ages entries", () => {
    const qs = pageFaq.map((f) => f.question);
    for (const f of FREDERICK_FAQ) expect(qs).toContain(f.question);
    expect(qs).not.toContain("How much do youth pickleball lessons cost at Next Gen?");
    expect(qs).not.toContain("What ages do you accept?");
    expect(JSON.stringify(pageFaq)).not.toMatch(/free (30-minute )?evaluation/i);
  });

  test("the page renders no evaluation-booking form and the sticky CTA points at the leagues", () => {
    expect(pageSrc).not.toMatch(/LeadForm|ContactForm/);
    expect(pageSrc).not.toMatch(/free evaluation/i);
    const cta = stickyCtaFor("/youth-pickleball-frederick");
    expect(cta.label).not.toMatch(/evaluation/i);
    expect(cta.href).toBe("#leagues");
    expect(pageSrc).toContain('id="leagues"');
    // Everywhere else keeps the primary conversion.
    expect(stickyCtaFor("/").label).toBe("Free Evaluation");
    expect(stickyCtaFor("/youth-pickleball-frederick/").href).toBe("#leagues");
  });

  test("the shared FAQ answers the Frederick question from the league data", () => {
    const item = faq.find((f) => f.question === "Do you run anything in Frederick County?");
    expect(item, "Frederick FAQ entry exists").toBeTruthy();
    for (const league of PICKLPARK_LEAGUES) {
      expect(item!.answer, league.slug).toContain(league.title);
    }
    expect(item!.answer).toMatch(/The Pickl Park/);
    // The band is The Pickl Park's, not NGA's 6–16 policy — say so.
    // (Singular since 2026-09-22: only the Drill and Play league remains.)
    expect(item!.answer).toMatch(/sets the age band/);
    expect(item!.answer).not.toContain("$");
  });

  test("Frederick graduates via EXTENDED_SERVICE_AREAS, not SERVICE_AREAS", () => {
    expect(EXTENDED_SERVICE_AREAS[0].slug).toBe("youth-pickleball-frederick");
    expect(EXTENDED_AREA_LANDING_PAGES).toContainEqual({
      city: "Frederick",
      slug: "youth-pickleball-frederick",
    });
  });

  test("LocalBusiness areaServed names Frederick County towns and the MoCo bridge", () => {
    const area = EXTENDED_SERVICE_AREAS[0];
    const ld = extendedAreaLocalBusinessJsonLd({
      area,
      url: "https://nextgenpbacademy.com/youth-pickleball-frederick",
      description: FREDERICK_PAGE.description,
    });
    const names = (ld.areaServed as { name: string }[]).map((a) => a.name);
    for (const n of ["Frederick", "Frederick County, MD", "Germantown", ...area.nearbyTowns]) {
      expect(names, n).toContain(n);
    }
    expect(JSON.stringify(ld.address)).toContain("Frederick County");
  });
});
