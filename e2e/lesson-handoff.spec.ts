import { test, expect } from "@playwright/test";
import { createElement } from "react";
import * as reactJsx from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import { createRequire } from "node:module";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import * as scheduling from "../src/data/scheduling";
import * as urls from "../src/lib/urls";
import { faq } from "../src/data/faq";
import { stickyCtaFor } from "../src/lib/sticky-cta";
import LessonsPage from "../src/app/lessons/page";
import FAQSection from "../src/components/FAQSection";
import { FetchStub } from "./fixtures/fetch-stub";

// Lesson requests are taken on coach.linkanddink.com, a different site from
// this one. Two rules are pinned here: every lesson link goes straight to that
// host (the old coach.sammorrispb.com only redirected to it), and the three
// in-body lesson links tell the parent where the tap is taking them.

const COACH_HOST = "coach.linkanddink.com";
const OLD_HOST = "coach.sammorrispb.com";
// Read through the namespace so this file still loads, and each test fails on
// its own assertion, if an export is missing.
const line = (scheduling as Record<string, unknown>).LESSON_HANDOFF_LINE as string;
const coachLessonUrl = (urls as Record<string, unknown>).coachLessonUrl as (content: string) => string;

const NOTION_ENV = ["NOTION_API_KEY", "NOTION_SESSIONS_DB_ID", "NOTION_FALL_CALLS_DB_ID", "NOTION_FALL_REGS_DB_ID"] as const;
const savedEnv = Object.fromEntries(NOTION_ENV.map((key) => [key, process.env[key]]));
const stub = new FetchStub();
test.beforeEach(() => {
  for (const key of NOTION_ENV) delete process.env[key];
  stub.reset();
  stub.install();
});
test.afterEach(() => {
  stub.uninstall();
  for (const key of NOTION_ENV) {
    const value = savedEnv[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

async function render(make: () => React.ReactNode | Promise<React.ReactNode>): Promise<string> {
  const runtime = createRequire(`${process.cwd()}/package.json`)("playwright/jsx-runtime");
  const original = { ...runtime };
  try {
    Object.assign(runtime, { jsx: reactJsx.jsx, jsxs: reactJsx.jsxs, Fragment: reactJsx.Fragment });
    return renderToStaticMarkup(await make());
  } finally {
    Object.assign(runtime, original);
  }
}

interface Anchor { href: string; text: string; after: string }

function anchors(html: string): Anchor[] {
  const found: Anchor[] = [];
  const pattern = /<a\b[^>]*\bhref="([^"]*)"[^>]*>([\s\S]*?)<\/a>/g;
  for (let match = pattern.exec(html); match; match = pattern.exec(html)) {
    found.push({
      href: match[1].replaceAll("&amp;", "&"),
      text: match[2].replace(/<[^>]*>/g, "").trim(),
      after: html.slice(match.index + match[0].length, match.index + match[0].length + 400),
    });
  }
  return found;
}

/** The handoff line is the very next element after the link, nothing between. */
function lineFollows(anchor: Anchor): boolean {
  const next = /^<span\b[^>]*>([^<]*)<\/span>/.exec(anchor.after);
  return Boolean(line) && next !== null && decode(next[1]) === line;
}

// React escapes apostrophes, quotes and ampersands in rendered text. The line
// is the owner's to reword, so compare decoded text, not raw markup.
const decode = (markup: string) =>
  markup
    .replaceAll("&#x27;", "'")
    .replaceAll("&#39;", "'")
    .replaceAll("&quot;", '"')
    .replaceAll("&amp;", "&");

// The home page is imported inside the render window on purpose: HowItWorks
// builds JSX at module load, and that JSX is only renderable if React's
// runtime is the one in place when the module evaluates. Both modules are
// dropped from the cache first so that holds whatever this worker loaded before.
const Home = (): Promise<React.ReactNode> => {
  const load = createRequire(`${process.cwd()}/package.json`);
  for (const id of Object.keys(load.cache)) {
    if (/src\/(app\/page|components\/HowItWorks)\.tsx$/.test(id)) delete load.cache[id];
  }
  return load("./src/app/page").default();
};

const count = (html: string) => (line ? decode(html).split(line).length - 1 : 0);

test("the handoff line names the site the lesson request opens on", () => {
  expect(typeof line).toBe("string");
  expect(line).toContain("linkanddink.com");
  expect(new URL(scheduling.lessonSchedulingUrl()).hostname.endsWith("linkanddink.com")).toBe(true);
  expect(line).not.toMatch(/[—–]|CourtReserve|Dill Dinkers|Coach OS/);
});

test("youth and adult lesson links go straight to the coach host with their attribution", () => {
  const youth = new URL(scheduling.lessonSchedulingUrl({ utm_source: "newsletter" }));
  expect(youth.hostname).toBe(COACH_HOST);
  expect(youth.pathname).toBe("/book/nga-lessons");
  expect(youth.searchParams.get("utm_source")).toBe("newsletter");

  expect(typeof coachLessonUrl).toBe("function");
  const adult = new URL(coachLessonUrl("about_adults"));
  expect(adult.protocol).toBe("https:");
  expect(adult.hostname).toBe(COACH_HOST);
  expect(adult.pathname).toBe("/book/private-lesson");
  expect(Object.fromEntries(adult.searchParams)).toEqual({
    utm_source: "nga",
    utm_medium: "cross_family_nav",
    utm_campaign: "family_reciprocal",
    utm_content: "about_adults",
  });
  expect(new URL(coachLessonUrl("faq_adults")).searchParams.get("utm_content")).toBe("faq_adults");
});

test("the adult helper leaves the family-site helpers as they were", () => {
  const sam = new URL(urls.familySiteUrl("sammorrispb"));
  expect(sam.origin).toBe("https://sammorrispb.com");
  expect(sam.searchParams.get("utm_content")).toBe("footer_sammorrispb");
  const ld = new URL(urls.familySiteUrl("linkanddink", "/play"));
  expect(ld.origin).toBe("https://www.linkanddink.com");
  expect(ld.searchParams.get("utm_content")).toBe("footer_linkanddink");
  expect(urls.familyMarketingRef("sammorrispb")).toBe("nga_footer_sammorrispb");
});

test("/lessons shows the handoff line directly under its lesson request button", async () => {
  const html = await render(() => LessonsPage());
  const buttons = anchors(html).filter((a) => a.href === "/lessons/book");
  expect(buttons).toHaveLength(1);
  expect(buttons[0].text).toContain("Request a lesson time");
  expect(lineFollows(buttons[0])).toBe(true);
  expect(count(html)).toBe(1);
});

test("the FAQ lesson link carries the handoff line and no other FAQ link does", async () => {
  const html = await render(() => createElement(FAQSection));
  const links = anchors(html);
  const lesson = links.filter((a) => a.href === "/lessons/book");
  expect(lesson).toHaveLength(1);
  expect(lesson[0].text).toContain("Request a lesson time");
  expect(lineFollows(lesson[0])).toBe(true);
  // Positive control: the FAQ renders other links, and they stay unlabelled.
  const levels = links.filter((a) => a.href === "#levels");
  expect(levels).toHaveLength(1);
  expect(lineFollows(levels[0])).toBe(false);
  expect(count(html)).toBe(1);
  // The data still names the route the renderer keys on.
  expect(faq.filter((item) => item.cta?.href === "/lessons/book")).toHaveLength(1);
});

test("the home page adult lesson link goes to the coach host and carries the handoff line", async () => {
  const html = await render(() => Home());
  const adult = anchors(html).filter((a) => a.text.includes("Request an adult lesson with Sam"));
  expect(adult).toHaveLength(1);
  expect(adult[0].href).toBe(coachLessonUrl("about_adults"));
  expect(new URL(adult[0].href).hostname).toBe(COACH_HOST);
  expect(lineFollows(adult[0])).toBe(true);
  // Home also renders the FAQ, so the line appears exactly twice: once per link.
  expect(count(html)).toBe(2);
  expect(html).not.toContain(OLD_HOST);
  expect(stub.calls).toHaveLength(0);
});

test("the sticky mobile button stays unlabelled while the three in-body links are labelled", async () => {
  const paths = ["/", "/lessons", "/lessons/book", "/free-evaluation", "/youth-pickleball-frederick", null];
  for (const path of paths) {
    const cta = stickyCtaFor(path);
    expect(Object.keys(cta).sort()).toEqual(["href", "label", "trackLabel"]);
    expect(JSON.stringify(cta)).not.toContain("linkanddink");
  }
  expect(stickyCtaFor("/lessons").href).toBe("/lessons/book");
  for (const file of ["src/lib/sticky-cta.ts", "src/components/MobileTabBar.tsx", "src/components/Navbar.tsx", "src/app/lessons/success/page.tsx"]) {
    const text = readFileSync(file, "utf8");
    expect(text.length).toBeGreaterThan(200);
    expect(text).not.toMatch(/LessonHandoff|LESSON_HANDOFF_LINE/);
  }
  // Positive control in the same test: the line is real and the surfaces carry it.
  expect(count(await render(() => LessonsPage()))).toBe(1);
  expect(count(await render(() => createElement(FAQSection)))).toBe(1);
  expect(count(await render(() => Home()))).toBe(2);
});

test("no file under src still points at the redirect-only coach host", () => {
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) walk(path);
      else if (/\.(ts|tsx|js|mjs|json|css|md|txt)$/.test(name)) files.push(path);
    }
  };
  walk("src");
  const contents = files.map((path) => ({ path, text: readFileSync(path, "utf8") }));
  // Positive controls: the walk read real source, and the same scan finds the new host.
  expect(files.length).toBeGreaterThan(200);
  const newHostFiles = contents.filter((f) => f.text.includes(COACH_HOST)).map((f) => f.path);
  expect(newHostFiles).toContain(join("src", "data", "scheduling.ts"));
  expect(contents.filter((f) => f.text.includes(OLD_HOST)).map((f) => f.path)).toEqual([]);
});
