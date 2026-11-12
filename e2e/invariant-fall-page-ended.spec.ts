import { test, expect } from "@playwright/test";
import * as reactJsx from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import { createRequire } from "node:module";
import type { ReactElement } from "react";
import type { Metadata } from "next";
import * as fallPage from "../src/app/fall/page";
import { FALL_SEASON_END, FALL_VENUE } from "../src/data/fall-2026";
import { FALL_SEASON_PRICE_USD } from "../src/data/fall-season-2026";
import { FetchStub } from "./fixtures/fetch-stub";
import { fixedDate } from "./fixtures/fixed-date";

// A season that is over must not take a registration on its own page, whatever
// the ships-dark flag still says in production. The flag was left "true" after
// the Fall 2026 finale and /fall kept rendering the form for four days while
// the checkout endpoint was already answering 410.

const FLAG = "NEXT_PUBLIC_FALL_REGISTRATION_OPEN";
// Deleted so every Notion reader on these pages takes its config-missing path;
// the rule-less FetchStub then turns any stray network read into a failure.
const TOUCHED_ENV = [
  FLAG,
  "NOTION_API_KEY",
  "NOTION_FALL_CALLS_DB_ID",
  "NOTION_FALL_REGS_DB_ID",
  "NOTION_SESSIONS_DB_ID",
] as const;
const savedEnv = Object.fromEntries(TOUCHED_ENV.map((key) => [key, process.env[key]]));
const stub = new FetchStub();

test.beforeEach(() => {
  for (const key of TOUCHED_ENV) delete process.env[key];
  stub.reset();
  stub.install();
});
test.afterEach(() => {
  stub.uninstall();
});
test.afterAll(() => {
  for (const key of TOUCHED_ENV) {
    const value = savedEnv[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

// Noon Eastern, well clear of midnight in either direction.
const DAY_MS = 86_400_000;
const noonEt = (iso: string, offsetDays = 0) =>
  new Date(Date.parse(`${iso}T17:00:00Z`) + offsetDays * DAY_MS).toISOString();
const IN_SEASON = noonEt(FALL_SEASON_END, -30);
const DAY_AFTER = noonEt(FALL_SEASON_END, 1);

// Playwright's JSX transform defaults to serialized descriptors; swap in
// React's runtime for the synchronous render (same approach as the camp spec).
async function render(
  build: () => ReactElement | Promise<ReactElement>,
  nowIso: string,
  flag: string | undefined,
): Promise<string> {
  const runtime = createRequire(`${process.cwd()}/package.json`)("playwright/jsx-runtime");
  const originalRuntime = { ...runtime };
  if (flag === undefined) delete process.env[FLAG];
  else process.env[FLAG] = flag;
  const restore = fixedDate(nowIso);
  try {
    Object.assign(runtime, { jsx: reactJsx.jsx, jsxs: reactJsx.jsxs, Fragment: reactJsx.Fragment });
    return renderToStaticMarkup(await build());
  } finally {
    restore();
    Object.assign(runtime, originalRuntime);
  }
}

const renderFall = (nowIso: string, flag: string | undefined) =>
  render(() => fallPage.default(), nowIso, flag);

/** The SportsEvent node the page publishes for the season. */
function seasonJsonLd(html: string): Record<string, unknown> {
  const blocks = [...html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/g)].map(
    (m) => JSON.parse(m[1]) as Record<string, unknown>,
  );
  const event = blocks.find((b) => b["@type"] === "SportsEvent");
  expect(event, "the page still publishes its SportsEvent").toBeTruthy();
  return event as Record<string, unknown>;
}

/** What a reader sees: markup with the JSON-LD and any other script removed. */
const visibleBody = (html: string) => html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, "");

// Copy that sells or runs a live season. None of it may outlive the finale,
// anywhere on the page; all of it must still render while the season is on.
const SELLING_COPY = [
  "$",
  'itemprop="price"',
  "non-refundable",
  "first come first serve",
  "sub list",
  "weather call",
  "paid up front",
];

test.describe("/fall once the season is over", () => {
  for (const flag of ["true", "false", undefined]) {
    test(`flag ${String(flag)}: ended badge and copy, no form, nothing on offer`, async () => {
      const html = await renderFall(DAY_AFTER, flag);
      expect(html).toContain("Fall 2026 season complete");
      expect(html).toContain(">The Fall 2026 season has ended</h2>");
      expect(html).toContain("Registration is closed.");
      expect(html).not.toContain("<form");
      expect(html).not.toContain("Grab your spot");
      expect(html).not.toContain("registration open");
      expect(html).not.toContain("opening soon");
      expect(html).not.toContain("Registration opens soon");
      expect(html).not.toContain("InStock");
      expect(html).not.toContain("PreOrder");
      expect(seasonJsonLd(html)).not.toHaveProperty("offers");
      const body = visibleBody(html).toLowerCase();
      for (const phrase of SELLING_COPY) {
        expect(body, `ended page must not carry ${JSON.stringify(phrase)}`).not.toContain(phrase);
      }
      expect(body, "no em dash in the ended page's visible text").not.toContain("\u2014");
      expect(body).not.toContain("&mdash;");
      // What stays is plain history: when it was played and where.
      expect(html).toContain("Six Sundays. One crew. Real games every week.");
      expect(html).toContain(`<time dateTime="${FALL_SEASON_END}">`);
      expect(html).toContain(FALL_VENUE);
    });
  }

  test("an ended season reads nothing from Notion; a live one reads seats and weather calls", async () => {
    const configure = () => {
      Object.assign(process.env, {
        NOTION_API_KEY: "notion_fixture",
        NOTION_FALL_REGS_DB_ID: "db_fall_regs_fixture",
        NOTION_FALL_CALLS_DB_ID: "db_fall_calls_fixture",
      });
      stub.reset();
      stub.on("api.notion.com", { results: [], has_more: false });
    };
    // Positive control first: with the same config, a live season does read.
    configure();
    await renderFall(IN_SEASON, "true");
    expect(stub.callsTo("db_fall_regs_fixture").length, "seat counts are read in season").toBeGreaterThan(0);
    expect(stub.callsTo("db_fall_calls_fixture").length, "weather calls are read in season").toBeGreaterThan(0);

    configure();
    const html = await renderFall(DAY_AFTER, "true");
    expect(html).toContain("Fall 2026 season complete");
    expect(stub.calls, "no seat count and no weather-call read for a finished season").toEqual([]);
  });

  test("the ended registration section has one way forward: View Schedule", async () => {
    const html = await renderFall(DAY_AFTER, "true");
    const section = html.slice(html.indexOf('id="register"'));
    const registration = section.slice(0, section.indexOf("</section>"));
    expect(registration).toContain(">The Fall 2026 season has ended</h2>");
    const links = [...registration.matchAll(/<a [^>]*href="([^"]+)"[^>]*>(.*?)<\/a>/g)];
    expect(links.map((m) => m[1])).toEqual(["/schedule"]);
    expect(links[0][2]).toContain("View Schedule");
    expect(registration, "new public copy carries no em dash").not.toContain("—");
    expect(registration).not.toContain("&mdash;");
  });

  test("positive control: in season with the flag on, the form and the open state render", async () => {
    const html = await renderFall(IN_SEASON, "true");
    expect(html).toContain("<form");
    expect(html).toContain("registration open");
    expect(html).toContain("Grab your spot");
    expect(html).not.toContain("season complete");
    expect(html).not.toContain("The Fall 2026 season has ended");
    expect(seasonJsonLd(html).offers).toMatchObject({ availability: "https://schema.org/InStock" });
    const body = visibleBody(html).toLowerCase();
    for (const phrase of SELLING_COPY) {
      expect(body, `in season the page still carries ${JSON.stringify(phrase)}`).toContain(phrase);
    }
  });

  test("in season with the flag unset, the opening-soon state is unchanged", async () => {
    const html = await renderFall(IN_SEASON, undefined);
    expect(html).toContain("registration opening soon");
    expect(html).toContain("Registration opens soon");
    expect(html).toContain('href="/newsletter"');
    expect(html).not.toContain("<form");
    expect(html).not.toContain("season complete");
    expect(seasonJsonLd(html).offers).toMatchObject({ availability: "https://schema.org/PreOrder" });
  });

  test("the page turns over at midnight Eastern, not midnight UTC", async () => {
    // November is EST (UTC-5): 04:59:59Z on Nov 9 is still the finale Sunday
    // in New York. Pinned to the real season end; re-pin if the season moves.
    expect(FALL_SEASON_END).toBe("2026-11-08");
    const lastMinute = await renderFall("2026-11-09T04:59:59Z", "true");
    expect(lastMinute).toContain("<form");
    expect(lastMinute).not.toContain("season complete");
    const midnight = await renderFall("2026-11-09T05:00:00Z", "true");
    expect(midnight).toContain("Fall 2026 season complete");
    expect(midnight).not.toContain("<form");
  });
});

test.describe("/fall metadata", () => {
  async function description(nowIso: string, flag: string | undefined): Promise<string> {
    if (flag === undefined) delete process.env[FLAG];
    else process.env[FLAG] = flag;
    const restore = fixedDate(nowIso);
    try {
      const generate = (fallPage as { generateMetadata?: () => Metadata | Promise<Metadata> })
        .generateMetadata;
      expect(generate, "the description must be decided per render, not frozen at build").toBeTruthy();
      return String((await generate!()).description);
    } finally {
      restore();
    }
  }

  test("stops selling a finished season", async () => {
    const text = await description(DAY_AFTER, "true");
    expect(text).not.toContain("$");
    expect(text).not.toContain(String(FALL_SEASON_PRICE_USD));
    expect(text).toContain("ended");
    expect(text, "new public copy carries no em dash").not.toContain("—");
  });

  test("positive control: in season it still carries the price", async () => {
    expect(await description(IN_SEASON, "true")).toContain(`$${FALL_SEASON_PRICE_USD}`);
  });
});
