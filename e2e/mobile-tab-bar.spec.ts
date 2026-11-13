import { test, expect } from "@playwright/test";
import * as reactJsx from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { EVALUATION_SMS_URL } from "../src/data/scheduling";
import { stickyCtaFor } from "../src/lib/sticky-cta";

// On phones the site is steered from a fixed bar at the bottom: three tabs, a
// More tab, and the page's own action. It replaced the hamburger menu and the
// old sticky button (Sam, 2026-11-13). Three things must survive that swap:
// every door the menu had is still reachable, the action still changes per
// page (Frederick never offers an evaluation), and staff pages get no bar.

const load = () => createRequire(`${process.cwd()}/package.json`);

function render(make: () => React.ReactNode): string {
  const runtime = load()("playwright/jsx-runtime");
  const original = { ...runtime };
  try {
    Object.assign(runtime, { jsx: reactJsx.jsx, jsxs: reactJsx.jsxs, Fragment: reactJsx.Fragment });
    return renderToStaticMarkup(make());
  } finally {
    Object.assign(runtime, original);
  }
}

const bar = (pathname: string) =>
  render(() => reactJsx.jsx(load()("./src/components/MobileTabBar").default, { pathname }));
const lib = () => load()("./src/lib/mobile-tabs") as {
  TABS: readonly { key: string; label: string; href: string }[];
  MORE_LINKS: readonly { label: string; href: string }[];
  NAV_LINKS: readonly { label: string; href: string }[];
  tabBarHidden: (pathname: string | null | undefined) => boolean;
  activeTab: (pathname: string | null | undefined) => string | null;
  activeMoreHref: (pathname: string | null | undefined) => string | null;
};

const hrefs = (html: string) => [...html.matchAll(/<a\b[^>]*\bhref="([^"]*)"/g)].map((m) => m[1]);
/** The always-visible row: everything before the More sheet's markup. */
const row = (html: string) => html.slice(0, html.indexOf('id="mobile-more"'));

test.describe("the bar", () => {
  test("has three tabs, a More tab and the page's action, and never more than five", () => {
    const html = bar("/");
    expect(hrefs(row(html))).toEqual(["/", "/levels", "/schedule", EVALUATION_SMS_URL]);
    expect(row(html).split("<button").length - 1).toBe(1);
    expect(row(html)).toMatch(/<button[^>]*aria-controls="mobile-more"[^>]*aria-expanded="false"/);
    // Five slots in all: the brand guide's ceiling for a phone bar.
    expect(hrefs(row(html)).length + 1).toBe(5);
  });

  test("marks the tab for the page a parent is on", () => {
    const current = (html: string) =>
      (html.match(/<a\b[^>]*>/g) ?? [])
        .filter((tag) => tag.includes('aria-current="page"'))
        .map((tag) => /href="([^"]*)"/.exec(tag)?.[1]);
    expect(current(row(bar("/")))).toEqual(["/"]);
    expect(current(row(bar("/schedule")))).toEqual(["/schedule"]);
    expect(current(row(bar("/league")))).toEqual([]);
    expect(lib().activeTab("/schedule/some-session")).toBe("schedule");
    expect(lib().activeTab("/levels")).toBe("levels");
    expect(lib().activeTab("/league")).toBeNull();
  });

  test("is hidden from lg up, where the top menu shows", () => {
    expect(bar("/")).toMatch(/<nav\b[^>]*class="[^"]*\blg:hidden\b/);
  });
});

test.describe("the page's action", () => {
  for (const path of ["/", "/schedule", "/lessons", "/youth-pickleball-frederick", "/free-evaluation"]) {
    test(`on ${path} it is the same action the sticky button had`, () => {
      const cta = stickyCtaFor(path);
      const html = row(bar(path));
      expect(html).toContain(`href="${cta.href}"`);
      expect(html).toContain(cta.label);
    });
  }

  test("Frederick's bar offers no evaluation anywhere, sheet included", () => {
    const html = bar("/youth-pickleball-frederick");
    expect(html).toContain('href="#leagues"');
    expect(html).not.toContain(EVALUATION_SMS_URL);
    expect(html).not.toMatch(/evaluation/i);
    // Positive control: the home bar does carry the evaluation.
    expect(bar("/")).toContain(EVALUATION_SMS_URL);
  });
});

test.describe("the More sheet", () => {
  test("holds every menu door the tabs do not, and the call link", () => {
    const html = bar("/");
    const sheet = html.slice(html.indexOf('id="mobile-more"'));
    expect(hrefs(sheet)).toEqual([
      "/#start",
      "/lessons",
      "/league",
      "/montgomery-village-youth-pickleball",
      "/mvf-junior-tournament",
      "/#about",
      "tel:3013254731",
    ]);
    for (const label of ["Start Here", "Lessons", "Leagues", "MVF Classes", "Tournaments", "About"]) expect(sheet).toContain(`>${label}<`);
  });

  test("starts closed", () => {
    expect(bar("/")).toMatch(/<div\b[^>]*id="mobile-more"[^>]*hidden=""/);
  });

  test("no door in the top menu is missing on phones", () => {
    const { TABS, MORE_LINKS, NAV_LINKS } = lib();
    // An anchor on the home page is written as a full path in the sheet.
    const onPhone = new Set([...TABS, ...MORE_LINKS].map((link) => link.href.replace(/^\/#/, "#")));
    for (const link of NAV_LINKS) expect(onPhone.has(link.href), `${link.label} (${link.href})`).toBe(true);
    expect(NAV_LINKS.map((link) => link.label)).toContain("Tournaments");
    // No door twice: a tab's page is not repeated in the sheet.
    for (const tab of TABS) expect(MORE_LINKS.map((link) => link.href)).not.toContain(tab.href);
  });

  test("the sheet marks the page a parent is on, and More lights up for it", () => {
    const { activeMoreHref } = lib();
    expect(activeMoreHref("/lessons")).toBe("/lessons");
    expect(activeMoreHref("/lessons/book")).toBe("/lessons");
    expect(activeMoreHref("/")).toBeNull();
    expect(activeMoreHref("/schedule")).toBeNull();
    const html = bar("/league");
    const sheet = html.slice(html.indexOf('id="mobile-more"'));
    const marked = (sheet.match(/<a\b[^>]*>/g) ?? []).filter((tag) => tag.includes('aria-current="page"'));
    expect(marked).toHaveLength(1);
    expect(marked[0]).toContain('href="/league"');
  });

  test("a long sheet scrolls instead of running off a short screen", () => {
    expect(bar("/")).toMatch(/<div\b[^>]*id="mobile-more"[^>]*class="[^"]*\bmax-h-\[calc\(100dvh-9rem\)\][^"]*\boverflow-y-auto\b/);
  });
});

test.describe("where it does not show", () => {
  test("staff pages get no bar", () => {
    for (const path of ["/admin", "/admin/fall", "/coach", "/coach/players"]) {
      expect(lib().tabBarHidden(path), path).toBe(true);
      expect(bar(path), path).toBe("");
    }
    for (const path of ["/", "/schedule", "/coaches-corner", "/administration", null]) {
      expect(lib().tabBarHidden(path), String(path)).toBe(false);
    }
  });
});

test.describe("what it replaced", () => {
  test("the top bar has no hamburger and no second menu", () => {
    const navbar = readFileSync("src/components/Navbar.tsx", "utf8");
    expect(navbar).not.toMatch(/Toggle menu|mobile-menu/);
    expect(navbar).toContain('from "@/lib/mobile-tabs"');
    // Two navigation landmarks on a phone, so each has a name.
    expect(navbar).toContain('aria-label="Site"');
  });

  test("the layout mounts the bar once and leaves room for it", () => {
    const layout = readFileSync("src/app/layout.tsx", "utf8");
    expect(layout.split("<MobileTabBar").length - 1).toBe(1);
    expect(layout).not.toContain("StickyMobileCTA");
    // The bar brings its own spacer, so the page no longer pads for it.
    expect(layout).not.toMatch(/pb-16 md:pb-0/);
    const spacer = /<div\b[^>]*data-tab-bar-spacer[^>]*>/.exec(bar("/"))?.[0] ?? "";
    // The spacer goes away with the bar: wide screens and print get neither.
    expect(spacer).toMatch(/\blg:hidden\b/);
    expect(spacer).toMatch(/\bprint:hidden\b/);
    expect(bar("/")).toMatch(/<nav\b[^>]*class="[^"]*\bprint:hidden\b/);
  });
});
