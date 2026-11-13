import { test, expect } from "@playwright/test";
import * as reactJsx from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { EVALUATION_SMS_URL } from "../src/data/scheduling";
import { faq } from "../src/data/faq";
import { coaches } from "../src/data/coaches";
import { FetchStub } from "./fixtures/fetch-stub";
import { fixedDate } from "./fixtures/fixed-date";

// The home page's shape: which blocks a parent meets, in what order, which
// sections are folded, and which anchors other pages and old URLs still land
// on. The page used to be fifteen full sections; this pins the short version
// so a later edit cannot quietly grow it back or strand a redirect.

// The league season and MVF Session II are both still running.
const LEAGUE_LIVE = "2026-11-05T15:00:00Z";
// The league season has ended; MVF Session II still has a class to come.
const IN_SEASON = "2026-11-14T15:00:00Z";
// MVF Session II has ended too.
const AFTER_SEASON = "2026-11-25T15:00:00Z";

const NOTION_ENV = ["NOTION_API_KEY", "NOTION_SESSIONS_DB_ID", "NOTION_FALL_CALLS_DB_ID", "NOTION_FALL_REGS_DB_ID"] as const;
const savedEnv = Object.fromEntries(NOTION_ENV.map((key) => [key, process.env[key]]));
const stub = new FetchStub();
let restoreDate: (() => void) | null = null;

test.beforeEach(() => {
  for (const key of NOTION_ENV) delete process.env[key];
  stub.reset();
  stub.install();
});
test.afterEach(() => {
  restoreDate?.();
  restoreDate = null;
  stub.uninstall();
  for (const key of NOTION_ENV) {
    const value = savedEnv[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

const load = () => createRequire(`${process.cwd()}/package.json`);

async function render(make: () => React.ReactNode | Promise<React.ReactNode>): Promise<string> {
  const runtime = load()("playwright/jsx-runtime");
  const original = { ...runtime };
  try {
    Object.assign(runtime, { jsx: reactJsx.jsx, jsxs: reactJsx.jsxs, Fragment: reactJsx.Fragment });
    return renderToStaticMarkup(await make());
  } finally {
    Object.assign(runtime, original);
  }
}

// Loaded inside the render window: HowItWorks builds JSX at module load (see
// e2e/lesson-handoff.spec.ts, which this copies).
async function home(at: string): Promise<string> {
  // One frozen clock at a time: a second render in the same test must hand
  // the real Date back first, or it stays frozen for whatever runs next.
  restoreDate?.();
  restoreDate = fixedDate(at);
  return render(() => {
    const require = load();
    for (const id of Object.keys(require.cache)) {
      if (/src\/(app\/page|components\/HowItWorks)\.tsx$/.test(id)) delete require.cache[id];
    }
    return require("./src/app/page").default();
  });
}

const text = (value: string) => [{ plain_text: value, text: { content: value } }];
const SESSION_ROW = {
  id: "11111111-2222-3333-4444-555555555555",
  properties: {
    Session: { title: text("Saturday Green Ball") },
    Date: { date: { start: "2026-11-21" } },
    "Start time": { rich_text: text("6:00 PM") },
    "End time": { rich_text: text("7:00 PM") },
    Level: { select: { name: "Green" } },
    Location: { rich_text: text("Earle B. Wood Middle School") },
    "Public Area": { rich_text: text("Rockville") },
    Status: { select: { name: "Open" } },
    "Court count": { number: 1 },
    "Registered count": { number: 0 },
  },
};

function withOneSession() {
  process.env.NOTION_API_KEY = "synthetic-key";
  process.env.NOTION_SESSIONS_DB_ID = "sessions-db";
  stub.on("sessions-db", { results: [SESSION_ROW], has_more: false, next_cursor: null });
}

const blocks = (html: string) => [...html.matchAll(/data-home-block="([^"]+)"/g)].map((m) => m[1]);
const disclosures = (html: string) =>
  (html.match(/<details\b[^>]*>/g) ?? []).filter((tag) => tag.includes("data-home-disclosure"));
const idCount = (html: string, id: string) => html.split(`id="${id}"`).length - 1;
const smsLinks = (html: string) => html.split(`href="${EVALUATION_SMS_URL}"`).length - 1;
const jsonLd = (html: string): Record<string, unknown>[] =>
  [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]));

/** The markup of one block: from its marker to the next block's marker. */
function blockHtml(html: string, name: string): string {
  const start = html.indexOf(`data-home-block="${name}"`);
  if (start < 0) return "";
  const next = html.indexOf("data-home-block=", start + 1);
  return html.slice(start, next < 0 ? undefined : next);
}

const ORDER = ["hero", "start", "coaches", "sessions", "mvf", "levels", "contact-form", "contact", "more"];
const FOLDED = ["how-it-works", "ease", "about", "faq"];

test.describe("home page order", () => {
  test("a parent meets the blocks in the short order, with the waitlist above the levels", async () => {
    expect(blocks(await home(IN_SEASON))).toEqual(ORDER);
  });

  test("the order holds when a drop-in session is listed", async () => {
    withOneSession();
    const html = await home(IN_SEASON);
    expect(blocks(html)).toEqual(ORDER);
    // The listed session replaces the waitlist form.
    expect(blockHtml(html, "sessions")).not.toContain("No drop-in sessions are listed right now.");
    expect(blockHtml(html, "sessions")).toContain("Nov 21");
    // Positive control: with no session listed, the waitlist is what renders.
    stub.reset();
    for (const key of NOTION_ENV) delete process.env[key];
    expect(blockHtml(await home(IN_SEASON), "sessions")).toContain("No drop-in sessions are listed right now.");
  });

  test("the MVF block leaves once its classes end, and nothing else moves", async () => {
    expect(blocks(await home(AFTER_SEASON))).toEqual(ORDER.filter((name) => name !== "mvf"));
  });
});

test.describe("folded sections", () => {
  test("exactly four sections are folded, each a closed disclosure carrying its own anchor", async () => {
    const tags = disclosures(await home(IN_SEASON));
    expect(tags.map((tag) => /\bid="([^"]+)"/.exec(tag)?.[1])).toEqual(FOLDED);
    for (const tag of tags) {
      expect(tag, tag).not.toMatch(/\sopen\b/);
      expect(tag, tag).toContain("scroll-mt-20");
    }
  });

  test("each fold says what it is: the section's short name, then its heading", async () => {
    const html = await home(IN_SEASON);
    const summaries = [...html.matchAll(/<summary\b[^>]*>([\s\S]*?)<\/summary>/g)].map((m) => m[1]);
    expect(summaries).toHaveLength(FOLDED.length);
    for (const summary of summaries) expect(summary).toMatch(/<h2\b/);
    for (const name of ["How it works", "Our Philosophy", "The Team", "FAQ"]) {
      expect(summaries.some((summary) => summary.includes(`>${name}<`)), name).toBe(true);
    }
    expect(html.split("<h1").length - 1).toBe(1);
  });

  test("the newsletter and crew sections are links to their own pages, not sections", async () => {
    const html = await home(IN_SEASON);
    expect(idCount(html, "newsletter")).toBe(0);
    expect(idCount(html, "crew")).toBe(0);
    const more = blockHtml(html, "more");
    expect(more).toContain('href="/newsletter"');
    expect(more).toContain('href="/crew"');
  });

  test("the home page mounts the component that opens a fold a link points at", () => {
    expect(readFileSync("src/app/page.tsx", "utf8")).toMatch(/<HomeDisclosureOpener\b/);
  });
});

test.describe("one ask", () => {
  test("the levels block sends nobody to a text message", async () => {
    const levels = blockHtml(await home(IN_SEASON), "levels");
    for (const color of ["red", "orange", "green", "yellow"]) expect(levels).toContain(`href="/levels#${color}"`);
    expect(smsLinks(levels)).toBe(0);
    // Positive control: the counter does see evaluation links elsewhere.
    expect(smsLinks(blockHtml(await home(IN_SEASON), "hero"))).toBe(1);
  });

  test("above the folds a parent meets three evaluation text links, four while MVF runs", async () => {
    // Hero, and the two in the chooser. The folded how-it-works and FAQ
    // sections each keep their own.
    const open = (html: string) => html.slice(0, html.indexOf('data-home-block="more"'));
    const after = await home(AFTER_SEASON);
    expect(smsLinks(open(after))).toBe(3);
    expect(smsLinks(after)).toBe(5);
    expect(smsLinks(open(await home(IN_SEASON)))).toBe(4);
  });

  test("the waitlist does not repeat the evaluation offer the hero already makes", async () => {
    const sessions = blockHtml(await home(IN_SEASON), "sessions");
    // Positive control: this is the waitlist block, not an empty string.
    expect(sessions).toContain("upcoming-sessions-heading");
    expect(sessions).not.toContain('href="/free-evaluation"');
  });

  test("the play card shows only while the league its button opens is running", async () => {
    const live = blockHtml(await home(LEAGUE_LIVE), "start");
    expect(live).toContain("Looking to play");
    expect(live).toContain("Three doors, one right for you.");
    const after = blockHtml(await home(IN_SEASON), "start");
    expect(after).not.toContain("Looking to play");
    expect(after).toContain("New to pickleball");
    expect(after).toContain("Looking to improve");
    // Two cards are not three doors.
    expect(after).not.toContain("Three doors");
    expect(after).toContain("Pick the one that fits");
  });

  test("only the evaluation door is a filled button", async () => {
    const start = blockHtml(await home(LEAGUE_LIVE), "start");
    expect(start.split("bg-ngpa-teal text-ngpa-deep").length - 1).toBe(1);
    expect(start.split("border-2 border-ngpa-teal").length - 1).toBe(2);
  });
});

test.describe("fold lookup", () => {
  const lib = () => load()("./src/lib/home-structure") as {
    homeFoldedIds: (input: { testimonials: readonly unknown[] }) => string[];
    disclosureIdForHash: (hash: string, folded: readonly string[]) => string | null;
    playCardLive: (todayIso: string, seasons?: readonly { endDate: string }[]) => boolean;
  };

  test("a hash resolves to the fold it names or sits inside, and to nothing otherwise", () => {
    const { disclosureIdForHash } = lib();
    expect(disclosureIdForHash("#about", FOLDED)).toBe("about");
    expect(disclosureIdForHash("#faq", FOLDED)).toBe("faq");
    expect(disclosureIdForHash("#faq-question-0", FOLDED)).toBe("faq");
    expect(disclosureIdForHash("#faq-answer-12", FOLDED)).toBe("faq");
    expect(disclosureIdForHash("about", FOLDED)).toBe("about");
    for (const none of ["", "#", "#levels", "#contact-form", "#aboutus", "#unknown", "#%E0%A4%A", "#faq-question-"]) {
      expect(disclosureIdForHash(none, FOLDED), none).toBeNull();
    }
  });

  test("parent stories are folded only when there are stories to show", () => {
    const { homeFoldedIds } = lib();
    expect(homeFoldedIds({ testimonials: [] })).toEqual(FOLDED);
    expect(homeFoldedIds({ testimonials: [{}] })).toEqual(["how-it-works", "ease", "testimonials", "about", "faq"]);
  });

  test("the play card window ends with the last league date, inclusive", () => {
    const { playCardLive } = lib();
    const seasons = [{ endDate: "2026-06-01" }, { endDate: "2026-11-10" }];
    expect(playCardLive("2026-11-10", seasons)).toBe(true);
    expect(playCardLive("2026-11-11", seasons)).toBe(false);
    expect(playCardLive("2026-11-11", [])).toBe(false);
  });
});

// These already hold on main. They are here so the rebuild cannot break them,
// and each has been shown to fail by breaking the thing it guards.
test.describe("what the rebuild must not break", () => {
  test("every anchor an old URL, the menu or another page lands on exists once", async () => {
    const html = await home(IN_SEASON);
    for (const id of ["start", "levels", "about", "contact-form", "faq", "contact"]) {
      expect(idCount(html, id), id).toBe(1);
    }
  });

  test("structured data still lists every question and every coach", async () => {
    const nodes = jsonLd(await home(IN_SEASON));
    const faqPage = nodes.find((node) => node["@type"] === "FAQPage");
    expect((faqPage?.mainEntity as unknown[]).length).toBe(faq.length);
    expect(nodes.filter((node) => node["@type"] === "Person")).toHaveLength(coaches.length);
  });

  test("a listed session still gets its event node", async () => {
    expect(jsonLd(await home(IN_SEASON)).filter((node) => node["@type"] === "SportsEvent")).toHaveLength(0);
    withOneSession();
    expect(jsonLd(await home(IN_SEASON)).filter((node) => node["@type"] === "SportsEvent")).toHaveLength(1);
  });

  test("Yellow Ball interest still routes to the inquiry page from the levels page", () => {
    // The home page's Yellow Ball card left with the rebuild; the yellow row
    // opens /levels#yellow, which carries the invite-only inquiry link.
    const levelsPage = readFileSync("src/app/levels/page.tsx", "utf8");
    expect(levelsPage).toContain("id={level.key}");
    expect(levelsPage).toContain('href="/yellowball/inquiry"');
  });

  test("the hero keeps one evaluation link and one schedule link", async () => {
    const hero = await render(() => load()("./src/components/Hero").default());
    expect(hero.split("<a ").length - 1).toBe(2);
    expect(smsLinks(hero)).toBe(1);
  });
});
