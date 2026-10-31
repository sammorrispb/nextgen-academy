import { test, expect } from "@playwright/test";
import { createRequire } from "node:module";
import { renderToStaticMarkup } from "react-dom/server";
import * as jsx from "react/jsx-runtime";
import {
  MVF_JUNIOR_SERIES,
  findMvfJuniorSeriesEvent,
  mvfJuniorSeriesUrl,
} from "../src/data/mvf-junior-series";
import MvfJuniorSeriesOverview from "../src/components/MvfJuniorSeriesOverview";
import { publicSeriesRelease } from "../src/data/mvf-series-registration";
import Page, { generateMetadata, generateStaticParams } from "../src/app/mvf-junior-tournament/[event]/page";

const require = createRequire(`${process.cwd()}/package.json`);
const runtime = require("playwright/jsx-runtime");
const originalRuntime = { ...runtime };
test.beforeEach(() => Object.assign(runtime, { jsx: jsx.jsx, jsxs: jsx.jsxs, Fragment: jsx.Fragment }));
test.afterEach(() => Object.assign(runtime, originalRuntime));

test("three permanent month URLs stay separate from the October registration", () => {
  expect(generateStaticParams()).toEqual([
    { event: "november-2026" }, { event: "january-2027" }, { event: "february-2027" },
  ]);
  expect(new Set(MVF_JUNIOR_SERIES.map(mvfJuniorSeriesUrl)).size).toBe(3);
  for (const event of MVF_JUNIOR_SERIES) {
    expect(mvfJuniorSeriesUrl(event)).toBe(`https://nextgenpbacademy.com/mvf-junior-tournament/${event.slug}`);
    expect(event.divisions.map((d) => [d.label, d.capacity])).toEqual([["12U", 10], ["16U", 10]]);
    expect(event.prices).toEqual({ residentUsd: 50, nonresidentUsd: 60 });
  }
});

test("unknown, inherited and historical keys cannot resolve a new event", () => {
  for (const slug of ["", "__proto__", "constructor", "success", "october-2026", "february-13-2027"]) {
    expect(findMvfJuniorSeriesEvent(slug)).toBeUndefined();
  }
});

const expectedDates: Record<string, string> = { "november-2026": "2026-11-14", "january-2027": "2027-01-17", "february-2027": "2027-02-14" };
const expectedMakeups: Record<string, string> = { "january-2027": "2027-01-23", "february-2027": "2027-02-20" };
for (const event of ["november-2026", "january-2027", "february-2027"]) {
  test(`${event}: no registration or unconfirmed event promises in the page`, async () => {
    const html = renderToStaticMarkup(await Page({ params: Promise.resolve({ event }) }));
    expect(html).toContain("Registration is not open yet.");
    expect(html).toContain("Registration remains closed. Please check this page for opening updates.");
    expect(publicSeriesRelease(event)).toBeUndefined();
    expect(findMvfJuniorSeriesEvent(event)!.dates[0].iso).toBe(expectedDates[event]);
    expect(html).toContain("A minimum of 8 players across both brackets");
    expect(html).toContain("If a bracket has fewer than 5 players, we will decide whether to combine or cancel it 3 days before the tournament.");
    expect(html).toContain("Age divisions use the calendar year. Younger players may play up into an older junior bracket.");
    expect(html).toContain("Weather decisions will be made 24 hours before the tournament.");
    expect(html).toContain("No refunds unless we cancel.");
    expect(html).not.toMatch(/policies are finalized|rules will be confirmed|Final handling will|refund and credit terms are still/);
    expect(html).not.toMatch(/2027-01-16|2027-02-13|4:00–7:00 PM/);
    expect(html).toContain("Maximum 10 players per bracket");
    expect(html).toContain("12 and under");
    expect(html).toContain("16 and under");
    expect(html).toContain("$50");
    expect(html).toContain("$60");
    expect(html).toContain("Previous tournament photos");
    expect(html).toContain("Photos from a previous outdoor tournament");
    expect(html).toContain("Junior pickleball participants with medals at a previous tournament");
    expect(html).toContain("Junior pickleball participants together on outdoor courts at a previous tournament");
    expect(html.match(/<img /g)).toHaveLength(2);
    expect(html).toContain('width="1200" height="1600"');
    expect(html).not.toContain("object-cover");
    expect(html).not.toMatch(/<form|<input|checkout-mvf|application\/ld\+json|Oct(?:ober)? 24|3:45|2:45|guaranteed|merged into|rain or shine/i);
    expect(html).toContain(event === "november-2026" ? "Planned tournament schedule" : "Tournament schedule");
    const selected = findMvfJuniorSeriesEvent(event)!;
    for (const date of selected.dates) expect(html).toContain(`<time dateTime="${date.iso}">`);
    expect(html).toContain(selected.timeLabel);
    expect(html).toContain(event === "november-2026" ? "North Creek Community Center" : "Lake Marion Community Center");
    if (event !== "november-2026") {
      expect(html).toContain("Indoors");
      expect(html).toContain("10:00 AM–1:00 PM ET");
      expect(html).toContain("The main event date, time and indoor location are confirmed with MVF");
      expect(html).toContain("Offered makeup date");
      expect(html).toContain(`<time dateTime="${expectedMakeups[event]}">`);
      expect(html).toContain("3:30–6:30 PM ET");
      expect(html).toContain("The makeup venue is still to be confirmed");
    }
    else {
      expect(html).toContain("Outdoors");
      expect(html).toContain("10:00 AM–noon ET (planned)");
      expect(html).toContain("final confirmation with MVF is pending");
      expect(html).toContain("Weather backup");
      expect(html).toContain("Lake Marion Community Center gymnasium available on November 14, 3:00–6:00 PM ET");
      expect(html).toContain("on the same day, at a later time than the outdoor tournament");
      expect(html).toContain("No separate makeup date has been announced.");
      expect(html).not.toContain("Offered makeup date");
    }
  });

  test(`${event}: metadata stays noindex with its own canonical and no sale offer`, async () => {
    const meta = await generateMetadata({ params: Promise.resolve({ event }) });
    expect(meta.robots).toEqual({ index: false, follow: false });
    expect(meta.alternates?.canonical).toBe(`https://nextgenpbacademy.com/mvf-junior-tournament/${event}`);
    expect(meta.description).toContain("Registration is not open yet");
    expect(meta.description).toContain(findMvfJuniorSeriesEvent(event)!.dates[0].label);
    expect(JSON.stringify(meta)).not.toMatch(/January 16\b|February 13\b|October 24|4:00–7:00 PM/);
  });
}

test("overview separates current updates from the October archive and keeps stable links", () => {
  const html = renderToStaticMarkup(MvfJuniorSeriesOverview());
  expect(html).toContain("Registration is not open yet");
  expect(html).toContain("A minimum of 8 players across both brackets");
  for (const event of MVF_JUNIOR_SERIES) {
    expect(html).toContain(`href="${mvfJuniorSeriesUrl(event)}"`);
    expect(html).toContain(event.dates[0].label);
  }
  expect(html).toContain("10:00 AM–noon ET (planned)");
  expect(html).toContain("Age divisions use the calendar year.");
  expect(html).toContain("Younger players may play up");
  expect(html).toContain("fewer than 5 players");
  expect(html).toContain("3 days before the tournament");
  expect(html).toContain("Weather decisions will be made 24 hours before the tournament.");
  expect(html).toContain("No refunds unless we cancel.");
  expect(html).toContain("No separate makeup date has been announced.");
  expect(html).toContain("Venue to be confirmed");
  expect(html).not.toMatch(/4:00–7:00 PM|January 16|February 13|<form|<input/);
});

test("unknown pages and metadata return not found", async () => {
  await expect(Page({ params: Promise.resolve({ event: "unknown" }) })).rejects.toThrow("NEXT_HTTP_ERROR_FALLBACK;404");
  await expect(generateMetadata({ params: Promise.resolve({ event: "unknown" }) })).rejects.toThrow("NEXT_HTTP_ERROR_FALLBACK;404");
});
