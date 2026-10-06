import { test, expect } from "@playwright/test";
import { renderToStaticMarkup } from "react-dom/server";
import * as jsx from "react/jsx-runtime";
import { createRequire } from "node:module";
import LeaguePage from "../src/app/league/page";
import TermsPage from "../src/app/terms/page";
import { buildLlmsTxt } from "../src/lib/llms-txt";
import { leagueInterestWelcomeHtml, leagueInterestWelcomeText } from "../src/lib/email/league-interest-welcome";

const require = createRequire(`${process.cwd()}/package.json`);
const runtime = require("playwright/jsx-runtime");
const originalRuntime = { ...runtime };
test.beforeEach(() => Object.assign(runtime, { jsx: jsx.jsx, jsxs: jsx.jsxs, Fragment: jsx.Fragment }));
test.afterEach(() => Object.assign(runtime, originalRuntime));
const flat = (text: string) => text.replace(/\s+/g, " ");

test.describe("default interest view", () => {
  test.skip(process.env.NEXT_PUBLIC_LEAGUE_ENROLLMENT_OPEN === "true", "Interest view is tested with the enrollment flag absent at process startup.");

  test("the unconfirmed league is interest only without fixed format, fee or cancellation promises", () => {
    const html = flat(renderToStaticMarkup(LeaguePage()));
    expect(html).not.toMatch(/8.sessions|eight sessions|Eight sessions|9[–-]10 weeks|fixed.roster|fixed roster|\$25|10 business days|non-refundable|weatherproofed|first to enroll|front of the line/);
    expect(html).toContain("Winter details and host arrangements are still being confirmed");
    expect(html).toContain("Dates, format, price and cancellation terms");
    expect(html).toContain("does not reserve a spot");
    expect(html).toContain("Join the interest list");
    expect(html).toContain('href="#interest"');
    expect(html).not.toContain('href="#enroll"');
    expect(html).not.toContain("Save your spot");
  });

  test("league policy matches Terms while preserving supplied and host agreements", () => {
    for (const view of [LeaguePage(), TermsPage()]) {
      const html = flat(renderToStaticMarkup(view));
      expect(html).toContain("refund requests are reviewed case by case");
      expect(html).toContain("A refund is not guaranteed");
      expect(html).toContain("Existing registrations and confirmed lessons retain");
      expect(html).toContain("host&#x27;s terms");
    }
    const html = renderToStaticMarkup(LeaguePage());
    expect(html).toContain('href="/terms"');
    expect(html).not.toContain('"@type":"Course"');
  });

  test("welcome messages acknowledge interest without promising an eight-session purchase", () => {
    const input = { parentFirst: "Parent", childFirst: "Player", bandLabel: "10U", interestSummary: "Orange, Wednesdays", scheduleUrl: "https://example.com/schedule" };
    for (const part of [leagueInterestWelcomeHtml(input), leagueInterestWelcomeText(input)]) {
      expect(flat(part)).not.toMatch(/8.session|eight sessions|fixed.roster|same kids every week|first to hear|weekly slot/);
      expect(flat(part)).toContain("does not reserve a spot");
      expect(part).toContain("dates, format, price");
      expect(part).toContain("case by case");
      expect(part).toContain("Existing registrations and confirmed lessons retain");
      expect(part).toContain(input.scheduleUrl);
      expect(part).toContain("Coach Sam");
    }
  });

  test("AI-readable league listing keeps registration closed without inventing a roster or format", () => {
    const text = flat(buildLlmsTxt("2026-10-06"));
    const listing = text.split("https://nextgenpbacademy.com/league — Youth leagues hub.")[1].split("https://nextgenpbacademy.com/clusters")[0];
    expect(listing).not.toContain("fixed-roster");
    expect(listing).toContain("dates, format, price");
    expect(listing).toContain("NO registration exists");
    expect(listing).toContain("does not reserve a spot");
  });
});

test("guarded paid pilot retains its supplied format, terms and enrollment anchor", () => {
  test.skip(process.env.NEXT_PUBLIC_LEAGUE_ENROLLMENT_OPEN !== "true", "Run separately with the enrollment flag at process startup; do not mutate import-time env.");
  const html = flat(renderToStaticMarkup(LeaguePage()));
  expect(html).toContain("8 sessions / season");
  expect(html).toContain("Eight sessions across 9–10 weeks.");
  expect(html).toContain("$25 is retained");
  expect(html).toContain("10 business days");
  expect(html).toContain("season fee is non-refundable");
  expect(html).toContain('href="#enroll"');
  expect(html).not.toContain('href="#interest"');
});
