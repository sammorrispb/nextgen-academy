import { test, expect } from "@playwright/test";
import * as reactJsx from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import type { ReactElement } from "react";
import SeasonCallouts from "../src/components/SeasonCallouts";
import HomeMvfFeature from "../src/components/HomeMvfFeature";
import { FALL_SEASON_END } from "../src/data/fall-2026";
import { MVF_PROGRAMS } from "../src/data/mvf";
import { PICKLPARK_SATURDAYS } from "../src/data/picklpark-2026";

// The season cards on /schedule and the home page retire with their seasons.
// Both sat ungated: /schedule kept advertising two finished seasons, and the
// home page's "Enrolling now" card had no end date at all.

// Playwright's JSX transform defaults to serialized descriptors; swap in
// React's runtime for the synchronous render (same approach as the camp spec).
function render(build: () => ReactElement | null): string {
  const runtime = createRequire(`${process.cwd()}/package.json`)("playwright/jsx-runtime");
  const originalRuntime = { ...runtime };
  try {
    Object.assign(runtime, { jsx: reactJsx.jsx, jsxs: reactJsx.jsxs, Fragment: reactJsx.Fragment });
    return renderToStaticMarkup(build());
  } finally {
    Object.assign(runtime, originalRuntime);
  }
}

const DAY_MS = 86_400_000;
const shift = (iso: string, days: number) =>
  new Date(Date.parse(`${iso}T12:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);

test.describe("SeasonCallouts on /schedule", () => {
  const FALL = 'href="/fall"';
  const PICKLPARK = 'href="/picklpark"';
  const callouts = (todayIso: string) => render(() => SeasonCallouts({ todayIso }));
  const lastSaturday = PICKLPARK_SATURDAYS[PICKLPARK_SATURDAYS.length - 1];

  test("the dates below are the real season ends", () => {
    expect(lastSaturday).toBe("2026-10-31");
    expect(FALL_SEASON_END).toBe("2026-11-08");
  });

  test("2026-10-31: both seasons still running, both cards show", () => {
    const html = callouts("2026-10-31");
    expect(html).toContain(FALL);
    expect(html).toContain("Fall 2026 Season");
    expect(html).toContain(PICKLPARK);
    expect(html.indexOf(FALL), "fall card first, as before").toBeLessThan(html.indexOf(PICKLPARK));
  });

  test("2026-11-01: Pickl Park is over, the fall card stays", () => {
    const html = callouts("2026-11-01");
    expect(html).toContain(FALL);
    expect(html).not.toContain(PICKLPARK);
    expect(html).not.toContain("Pickl Park");
  });

  test("the fall card shows through the finale Sunday", () => {
    expect(callouts(FALL_SEASON_END)).toContain(FALL);
  });

  test("2026-11-09: both seasons over, nothing renders at all", () => {
    expect(callouts("2026-11-09"), "no empty wrapper left holding padding").toBe("");
    expect(callouts(shift(FALL_SEASON_END, 400))).toBe("");
  });

  test("/schedule renders the component with an Eastern date and keeps no ungated copy", () => {
    const page = readFileSync("src/app/schedule/page.tsx", "utf8");
    expect(page).toMatch(/<SeasonCallouts todayIso=\{todayET\(\)\} \/>/);
    expect(page).not.toContain('href="/fall"');
    expect(page).not.toContain('href="/picklpark"');
  });
});

test.describe("home page: the MVF Session II card", () => {
  const CARD = 'data-testid="mvf-session-2-feature"';
  const fallTwo = MVF_PROGRAMS.filter((p) => p.key.startsWith("fall-2"));
  const lastClass = fallTwo.map((p) => p.endDate).sort().at(-1) as string;
  const feature = (todayIso: string) => render(() => HomeMvfFeature({ todayIso }));

  test("shows through the last class and is gone the day after", () => {
    expect(fallTwo.length, "re-pin this test if Session II leaves the data file").toBeGreaterThan(0);
    expect(lastClass).toBe("2026-11-19");
    const during = feature(lastClass);
    expect(during).toContain(CARD);
    expect(during).toContain("Enrolling now");
    expect(feature(shift(lastClass, -30))).toContain(CARD);
    expect(feature(shift(lastClass, 1)), "no empty section left holding padding").toBe("");
    expect(feature("2026-11-20")).toBe("");
  });

  test("the home page renders the card only through the gate, with an Eastern date", () => {
    const page = readFileSync("src/app/page.tsx", "utf8");
    expect(page).toMatch(/<HomeMvfFeature todayIso=\{todayET\(\)\} \/>/);
    expect(page, "the ungated card must not come back").not.toContain("MvfSessionTwoFeature");
    expect(page).toMatch(/export const revalidate = \d+/);
  });
});
