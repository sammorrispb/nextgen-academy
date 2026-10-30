import { test, expect } from "@playwright/test";
import { createRequire } from "node:module";
import { renderToStaticMarkup } from "react-dom/server";
import * as jsx from "react/jsx-runtime";
import {
  MVF_JUNIOR_SERIES,
  findMvfJuniorSeriesEvent,
  mvfJuniorSeriesUrl,
} from "../src/data/mvf-junior-series";
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

for (const event of ["november-2026", "january-2027", "february-2027"]) {
  test(`${event}: no registration or unconfirmed event promises in the page`, async () => {
    const html = renderToStaticMarkup(await Page({ params: Promise.resolve({ event }) }));
    expect(html).toContain("Registration is not open yet.");
    expect(html).toContain("Date and time to be confirmed");
    expect(html).toContain("Maximum 10 players per bracket");
    expect(html).toContain("12 and under");
    expect(html).toContain("16 and under");
    expect(html).toContain("$50");
    expect(html).toContain("$60");
    expect(html).not.toMatch(/<form|<input|checkout-mvf|application\/ld\+json|Oct(?:ober)? 24|3:45|2:45|No refunds|guaranteed|merged into|rain or shine/i);
    expect(html).toContain("Tentative schedule");
    expect(html).toContain("Proposed dates and times may change.");
    const selected = findMvfJuniorSeriesEvent(event)!;
    for (const date of selected.proposedDates) expect(html).toContain(`<time dateTime="${date.iso}">`);
    expect(html).toContain(selected.proposedTime ?? "Time to be confirmed");
    expect(html).toContain(event === "november-2026" ? "North Creek Community Center" : "Lake Marion Community Center");
    if (event !== "november-2026") expect(html).toContain("Indoors");
    else {
      expect(html).toContain("Outdoors");
      expect(html).toContain("November rain plan: to be confirmed.");
    }
  });

  test(`${event}: metadata stays noindex with its own canonical and no sale offer`, async () => {
    const meta = await generateMetadata({ params: Promise.resolve({ event }) });
    expect(meta.robots).toEqual({ index: false, follow: false });
    expect(meta.alternates?.canonical).toBe(`https://nextgenpbacademy.com/mvf-junior-tournament/${event}`);
    expect(meta.description).toContain("Registration is not open yet");
    expect(JSON.stringify(meta)).not.toMatch(/November 14\b|January 16\b|February (13|20)\b|October 24/);
  });
}

test("unknown pages and metadata return not found", async () => {
  await expect(Page({ params: Promise.resolve({ event: "unknown" }) })).rejects.toThrow("NEXT_HTTP_ERROR_FALLBACK;404");
  await expect(generateMetadata({ params: Promise.resolve({ event: "unknown" }) })).rejects.toThrow("NEXT_HTTP_ERROR_FALLBACK;404");
});
