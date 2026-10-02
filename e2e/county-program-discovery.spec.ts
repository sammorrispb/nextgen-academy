import { test, expect } from "@playwright/test";
import { createElement } from "react";
import * as reactJsx from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import { createRequire } from "node:module";
import CountyPage, { metadata } from "../src/app/montgomery-county-youth-pickleball/page";
import { faq, localFaq } from "../src/data/faq";
import { FALL_SUNDAYS } from "../src/data/fall-2026";
import { MVF_PROGRAMS } from "../src/data/mvf";
import { EVALUATION_SMS_URL } from "../src/data/scheduling";
import { CITY_LANDING_PAGES, orgRef } from "../src/lib/seo";

// Render the actual public page without a server or network. Freeze only its
// clock and public registration flag so season boundaries stay deterministic.
function renderOn(today: string, registrationOpen = false): string {
  const OriginalDate = globalThis.Date;
  const originalFlag = process.env.NEXT_PUBLIC_FALL_REGISTRATION_OPEN;
  // Playwright's JSX transform defaults to serialized component descriptors.
  // Use React's runtime only during this synchronous server render, restoring
  // the runner's runtime afterwards so other tests keep their usual behavior.
  const runtime = createRequire(`${process.cwd()}/package.json`)("playwright/jsx-runtime");
  const originalRuntime = { ...runtime };
  class FixedDate extends OriginalDate {
    constructor(value?: string | number) {
      super(value ?? `${today}T16:00:00Z`);
    }
  }
  try {
    globalThis.Date = FixedDate as DateConstructor;
    Object.assign(runtime, { jsx: reactJsx.jsx, jsxs: reactJsx.jsxs, Fragment: reactJsx.Fragment });
    process.env.NEXT_PUBLIC_FALL_REGISTRATION_OPEN = String(registrationOpen);
    return renderToStaticMarkup(createElement(CountyPage));
  } finally {
    globalThis.Date = OriginalDate;
    Object.assign(runtime, originalRuntime);
    if (originalFlag === undefined) delete process.env.NEXT_PUBLIC_FALL_REGISTRATION_OPEN;
    else process.env.NEXT_PUBLIC_FALL_REGISTRATION_OPEN = originalFlag;
  }
}

function programs(html: string): string {
  const section = html.match(/<section\b[^>]*\bid="programs"[^>]*>([\s\S]*?)<\/section>/);
  expect(section, "public program section").not.toBeNull();
  return section![1];
}

function schemas(html: string): Record<string, unknown>[] {
  return [...html.matchAll(/<script\b[^>]*type="application\/ld\+json"[^>]*>(.*?)<\/script>/g)]
    .map((match) => JSON.parse(match[1]));
}

test.describe("Montgomery County program discovery", () => {
  test("parents see actual Bethesda and Montgomery Village venues, eligibility and registrars", () => {
    const listing = programs(renderOn("2026-10-02", true));
    expect(listing).toContain("Walter Johnson High School, Bethesda, MD");
    expect(listing).toContain("Green Ball and Yellow Ball");
    expect(listing).toContain("Next Gen — on this site");
    expect(listing).toContain('href="/fall"');
    expect(listing).toContain("North Creek Pickleball Courts, Montgomery Village, MD");
    expect(listing).toContain("Ages 8–16");
    expect(listing).toContain("Montgomery Village Foundation");
    expect(listing).toContain('href="/montgomery-village-youth-pickleball"');
    expect(listing).not.toContain("Frederick, MD");
  });

  test("a closed Bethesda flag does not imply registration is open", () => {
    const listing = programs(renderOn("2026-10-02"));
    expect(listing).toContain("Next Gen — registration closed");
    expect(listing).not.toContain("Next Gen — on this site");
    expect(listing).toContain('href="/fall"');
  });

  test("the Bethesda season remains on its final day and retires the next day", () => {
    const lastDay = FALL_SUNDAYS.at(-1)!;
    expect(programs(renderOn(lastDay))).toContain("Walter Johnson High School");
    expect(programs(renderOn("2026-10-26"))).not.toContain("Walter Johnson High School");
    expect(programs(renderOn("2026-10-26"))).toContain("Montgomery Village Foundation");
  });

  test("each MVF session retires independently", () => {
    const lastDay = MVF_PROGRAMS.find((program) => program.key === "fall-1-beginner")!.endDate;
    expect(programs(renderOn(lastDay))).toContain("Fall Session I");
    const nextDay = new Date(`${lastDay}T12:00:00Z`);
    nextDay.setUTCDate(nextDay.getUTCDate() + 1);
    const listing = programs(renderOn(nextDay.toISOString().slice(0, 10)));
    expect(listing).not.toMatch(/Fall Session I(?:[^I]|$)/);
    expect(listing).toContain("Fall Session II");
  });

  test("an empty season list offers an evaluation or lesson without inventing a program", () => {
    const html = renderOn("2099-01-01");
    const listing = programs(html);
    expect(listing).toMatch(/No season or partner classes are listed/i);
    expect(listing).not.toContain("Walter Johnson High School");
    expect(listing).not.toContain("North Creek Pickleball Courts");
    expect(html).toContain(`href="${EVALUATION_SMS_URL.replaceAll("&", "&amp;")}"`);
    expect(html).toContain('href="/lessons"');
  });

  test("locality navigation links to existing guides without claiming a venue in each town", () => {
    const html = renderOn("2026-10-02");
    for (const city of CITY_LANDING_PAGES) expect(html).toContain(`href="/${city.slug}"`);
    expect(html).toContain('href="/youth-pickleball-frederick"');
    expect(html).toMatch(/program.*venue/i);
    expect(html).not.toMatch(/Families regularly drive in from|Sessions rotate weekly/);
  });

  test("county schema describes a coaching service instead of an invented facility address", () => {
    const nodes = schemas(renderOn("2026-10-02"));
    const service = nodes.find((node) => node["@type"] === "Service");
    expect(service).toBeDefined();
    expect(service!.provider).toEqual(orgRef());
    expect(service!.areaServed).toMatchObject({ "@type": "AdministrativeArea", name: "Montgomery County, MD" });
    expect(service).not.toHaveProperty("address");
    expect(nodes.some((node) => JSON.stringify(node["@type"]).includes("SportsActivityLocation"))).toBe(false);
  });

  test("the guide distinguishes paid seasons, partner registration and separately listed drop-ins", () => {
    const html = renderOn("2026-10-02");
    expect(html).toMatch(/paid up front/);
    expect(html).toMatch(/Drop-in sessions.*single bookings/);
    expect(html).toMatch(/cancellation terms/);
    expect(html).not.toMatch(/All group classes are|drop-in only|court for every level/);
  });

  test("metadata tells parents which local options the page helps compare", () => {
    expect(metadata.description).toMatch(/Bethesda/);
    expect(metadata.description).toMatch(/Montgomery Village/);
    expect(metadata.description).toMatch(/private lessons/i);
    expect(metadata.description!.length).toBeLessThanOrEqual(160);
    expect(metadata.alternates?.canonical).toBe("/montgomery-county-youth-pickleball");
  });

  test("shared location answers name the program's venue and confirm individual courts", () => {
    const where = faq.find((item) => item.question === "Where are you located?")!.answer;
    const towns = localFaq.find((item) => item.question === "Which Montgomery County towns do you serve?")!.answer;
    for (const answer of [where, towns]) {
      expect(answer).toContain("Bethesda");
      expect(answer).toContain("Montgomery Village");
      expect(answer).toMatch(/confirm.*court|court.*confirm/i);
      expect(answer).not.toMatch(/rotate weekly|rotate seasonally|most of the DMV/);
    }
    expect(where).toContain("The Pickl Park");
    expect(where).toContain("Frederick");
  });
});
