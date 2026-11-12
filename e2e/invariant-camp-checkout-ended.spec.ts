import { test, expect } from "@playwright/test";
import * as reactJsx from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import { createRequire } from "node:module";
import { NextRequest } from "next/server";
import { POST } from "../src/app/api/checkout-camp/route";
import CampWeekPage, { generateMetadata } from "../src/app/camp/[slug]/page";
import { CAMPS, CAMP_OPTIONS, isCampOver, type Camp } from "../src/data/camps";
import { FetchStub } from "./fixtures/fetch-stub";
import { fixedDate } from "./fixtures/fixed-date";

// A camp week that is over must not take a registration: not on its page, and
// not through the checkout endpoint a cached or bookmarked form still posts to.
// "Over" is the /camp index's own rule: the makeup/rain Friday is behind us in
// America/New_York.

const submit: (request: NextRequest) => Promise<Response> = POST;
const PRICE_ENVS = CAMP_OPTIONS.map((o) => o.priceEnvVar);
const TOUCHED_ENV = [...PRICE_ENVS, "STRIPE_SECRET_KEY", "NOTION_API_KEY", "NOTION_WAIVERS_DB_ID"];
let saved: Record<string, string | undefined>;
let restoreDate: (() => void) | null = null;
const stub = new FetchStub();

test.beforeEach(() => {
  saved = Object.fromEntries(TOUCHED_ENV.map((key) => [key, process.env[key]]));
  for (const key of TOUCHED_ENV) delete process.env[key];
  // Prices configured, as they were all summer: the date is the only thing
  // standing between a stale form and a new Stripe checkout.
  for (const key of PRICE_ENVS) process.env[key] = "price_camp_fixture";
  Object.assign(process.env, {
    NOTION_API_KEY: "notion_fixture",
    NOTION_WAIVERS_DB_ID: "db_waiver_fixture",
  });
  stub.reset();
  // No waiver on file. An in-season request therefore stops at the waiver gate
  // (409) before Stripe, which is the positive control for "the guard let it in".
  stub.on("api.notion.com", { results: [] }).install();
});
test.afterEach(() => {
  restoreDate?.();
  restoreDate = null;
  stub.uninstall();
  for (const key of TOUCHED_ENV) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
});

const WEEK_ONE = CAMPS.find((c) => c.slug === "june-29") as Camp;

function body(camp: Camp, optionKey = "week") {
  return JSON.stringify({
    campSlug: camp.slug,
    optionKey,
    selectedDay: optionKey === "day" ? camp.startDate : "",
    parentName: "Test Parent",
    email: "parent@example.com",
    phone: "3015550142",
    childFirstName: "Testkid",
    childBirthYear: "2016",
    emergencyName: "Test Contact",
    emergencyPhone: "3015550143",
    allergies: "",
    smsConsent: false,
  });
}

function request(payload: string): NextRequest {
  return new NextRequest("http://localhost/api/checkout-camp", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: payload,
  });
}

test.describe("isCampOver", () => {
  test("open through the makeup Friday, over the day after", () => {
    expect(isCampOver(WEEK_ONE, "2026-06-01")).toBe(false);
    expect(isCampOver(WEEK_ONE, WEEK_ONE.startDate)).toBe(false);
    expect(isCampOver(WEEK_ONE, WEEK_ONE.makeupDate)).toBe(false);
    expect(isCampOver(WEEK_ONE, "2026-07-04")).toBe(true);
  });
});

test.describe("POST /api/checkout-camp", () => {
  for (const camp of CAMPS) {
    for (const optionKey of CAMP_OPTIONS.map((o) => o.key)) {
      test(`${camp.slug} (${optionKey}) on 2026-11-12: closed, nothing looked up, nothing charged`, async () => {
        restoreDate = fixedDate("2026-11-12T16:00:00Z");
        const response = await submit(request(body(camp, optionKey)));
        expect(response.status).toBe(410);
        expect(await response.json()).toEqual({
          code: "registration_closed",
          error: "This camp week has ended. Registration is closed.",
        });
        expect(stub.calls, "no waiver lookup and no provider call for an ended camp").toEqual([]);
      });
    }
  }

  test("positive control: before the week starts, the same request gets past the date guard", async () => {
    restoreDate = fixedDate("2026-06-20T16:00:00Z");
    const response = await submit(request(body(WEEK_ONE)));
    expect(response.status, "reaches the waiver gate, so the guard did not block it").toBe(409);
    expect(stub.calls.length, "the waiver lookup ran").toBeGreaterThan(0);
  });

  test("boundary: still open at 11:59 PM ET on the makeup Friday, closed at midnight", async () => {
    // July 3 2026 is EDT (UTC-4): 03:59:59Z on July 4 is still July 3 in New York.
    restoreDate = fixedDate("2026-07-04T03:59:59Z");
    expect((await submit(request(body(WEEK_ONE)))).status).toBe(409);
    restoreDate();
    restoreDate = fixedDate("2026-07-04T04:00:00Z");
    expect((await submit(request(body(WEEK_ONE)))).status).toBe(410);
  });

  test("an unknown camp is still a validation error, not a closed season", async () => {
    restoreDate = fixedDate("2026-11-12T16:00:00Z");
    const response = await submit(request(JSON.stringify({ campSlug: "no-such-week" })));
    expect(response.status).toBe(400);
  });
});

// Render the real week page offline. Playwright's JSX transform defaults to
// serialized descriptors; swap in React's runtime for the synchronous render.
async function renderWeek(slug: string, nowIso: string): Promise<string> {
  const runtime = createRequire(`${process.cwd()}/package.json`)("playwright/jsx-runtime");
  const originalRuntime = { ...runtime };
  const restore = fixedDate(nowIso);
  try {
    Object.assign(runtime, { jsx: reactJsx.jsx, jsxs: reactJsx.jsxs, Fragment: reactJsx.Fragment });
    const element = await CampWeekPage({ params: Promise.resolve({ slug }) });
    return renderToStaticMarkup(element);
  } finally {
    restore();
    Object.assign(runtime, originalRuntime);
  }
}

test.describe("/camp/[slug]", () => {
  for (const camp of CAMPS) {
    test(`${camp.slug} on 2026-11-12 shows the wrapped-up state with no form and no price`, async () => {
      const html = await renderWeek(camp.slug, "2026-11-12T16:00:00Z");
      expect(html).toContain("This camp week has wrapped up.");
      expect(html).not.toContain("<form");
      expect(html).not.toContain("Register");
      expect(html).not.toContain("$");
      expect(html, "the reader still has somewhere to go").toContain('href="/newsletter"');
    });
  }

  test("positive control: before the week starts the form and prices render", async () => {
    const html = await renderWeek(WEEK_ONE.slug, "2026-06-20T16:00:00Z");
    expect(html).toContain("<form");
    expect(html).toContain("Register");
    expect(html).toContain("$150");
    expect(html).not.toContain("wrapped up");
  });

  test("metadata stops selling an ended week", async () => {
    const restore = fixedDate("2026-11-12T16:00:00Z");
    try {
      const meta = await generateMetadata({ params: Promise.resolve({ slug: WEEK_ONE.slug }) });
      expect(String(meta.description)).not.toMatch(/Register|\$/);
      expect(String(meta.description)).toContain("wrapped up");
    } finally {
      restore();
    }
    const restoreLive = fixedDate("2026-06-20T16:00:00Z");
    try {
      const meta = await generateMetadata({ params: Promise.resolve({ slug: WEEK_ONE.slug }) });
      expect(String(meta.description)).toMatch(/^Register for/);
    } finally {
      restoreLive();
    }
  });
});
