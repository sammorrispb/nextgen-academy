import { test, expect } from "@playwright/test";
import { renderToStaticMarkup } from "react-dom/server";
import * as jsx from "react/jsx-runtime";
import { createRequire } from "node:module";
import TermsPage from "../src/app/terms/page";
import RegistrationNotice from "../src/components/RegistrationNotice";
import CrewPathway from "../src/components/CrewPathway";
import WeatherBar from "../src/components/WeatherBar";
import { faq } from "../src/data/faq";

const require = createRequire(`${process.cwd()}/package.json`);
const runtime = require("playwright/jsx-runtime");
const originalRuntime = { ...runtime };
test.beforeEach(() => Object.assign(runtime, { jsx: jsx.jsx, jsxs: jsx.jsxs, Fragment: jsx.Fragment }));
test.afterEach(() => Object.assign(runtime, originalRuntime));

test("Terms distinguishes season, tournament and host-managed policies", () => {
  const html = renderToStaticMarkup(TermsPage());
  for (const route of ["/fall", "/mvf-junior-tournament", "/montgomery-village-youth-pickleball", "/picklpark", "/lessons"]) {
    expect(html).toContain(`href="${route}"`);
  }
  expect(html).toContain("11:00 AM");
  expect(html).toContain("12:30 PM");
  expect(html).toContain("WhatsApp");
  expect(html).toContain("No rain date");
  expect(html).toContain("terms provided when you registered");
  expect(html).not.toMatch(/midpoint|credited after|24 hours|credit or refund/);
});

test("schedule registration notice cannot promise a uniform duration or refund", () => {
  const html = renderToStaticMarkup(RegistrationNotice());
  expect(html).not.toMatch(/One-hour slots, drop-in only|automatic full refund|otherwise payments are|reserve early/);
  expect(html).toContain("program");
  expect(html).toContain("payment");
});

test("crew matching cannot promise fixed enrollment, card charges or automatic refunds", () => {
  const html = renderToStaticMarkup(CrewPathway());
  expect(html).not.toMatch(/4-week|4 weeks|four kids every week|auto-reserve|refund automatically|save a card|4-player cap/);
  expect(html).toContain("level");
  expect(html).toContain("href=" + '"/crew"');
});

test("a high-risk forecast cannot promise automatic cancellation refunds", () => {
  const date = "2026-10-11";
  const html = renderToStaticMarkup(WeatherBar({ dates: [date], weather: new Map([[date, {
    date, maxRain: 90, tempHigh: 65, summary: "Rain", risk: "cancel",
  }]]) }));
  expect(html).not.toMatch(/automatic full refund|refunded in full|Our sessions are outdoors/);
  expect(html).toContain('href="/terms"');
  expect(html).toContain("forecast");
});

test("refund FAQ scopes withdrawal and weather rules to Walter Johnson", () => {
  const refund = faq.find((item) => item.question.includes("refund policy"))!;
  expect(refund.answer).not.toMatch(/automatic full refund|Registrations are non-refundable/);
  expect(refund.answer).toContain("Walter Johnson");
  expect(refund.answer).toContain("MVF Junior Tournament");
  expect(refund.cta?.href).toBe("/terms");
});
