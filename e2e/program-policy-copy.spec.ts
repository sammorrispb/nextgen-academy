import { test, expect } from "@playwright/test";
import { renderToStaticMarkup } from "react-dom/server";
import * as jsx from "react/jsx-runtime";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import TermsPage from "../src/app/terms/page";
import LessonsPage from "../src/app/lessons/page";
import LessonBookPage from "../src/app/lessons/book/page";
import CancelClient from "../src/app/schedule/cancel/CancelClient";
import CommitForm from "../src/components/CommitForm";
import ScheduleSuccessPage from "../src/app/schedule/success/page";
import { cancelConfirmationHtml, cancelConfirmationText } from "../src/lib/email/cancel-confirmation";
import { commitConfirmationHtml, commitConfirmationText } from "../src/lib/email/commit-confirmation";
import { commitChargeReceiptHtml, commitChargeReceiptText } from "../src/lib/email/commit-charge-receipt";
import { bookingCancellationCopy, bookingConfirmationHtml } from "../src/lib/email/booking-confirmation";
import { bookingReminderHtml, bookingReminderText } from "../src/lib/email/booking-reminder";
import { cancelConfirmationSms } from "../src/lib/sms";
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

test("new NGA offers use case-by-case refund review while existing and host agreements survive", () => {
  const html = renderToStaticMarkup(TermsPage());
  expect(html).toContain("For new NGA-controlled offers using these terms");
  expect(html).toContain("refund requests are reviewed case by case");
  expect(html).toContain("A refund is not guaranteed");
  expect(html).toContain("Existing registrations and confirmed lessons retain");
  expect(html).toContain("For existing registrations, the supplied season terms");
  expect(html).toContain("For existing registrations, the supplied tournament terms");
  expect(html).toContain("host");
  expect(html).not.toContain("without refund");
  const refund = faq.find((item) => item.question.includes("refund policy"))!;
  expect(refund.answer).toContain("refund requests are reviewed case by case");
  expect(refund.answer).toContain("A refund is not guaranteed");
  expect(refund.answer).toContain("Existing registrations and confirmed lessons retain");
});

test("Terms and lesson requests disclose a prospective $50 fee only for confirmed lesson no-shows", () => {
  for (const view of [TermsPage(), LessonsPage()]) {
    const html = renderToStaticMarkup(view);
    expect(html).toContain("$50 no-show fee");
    expect(html).toContain("new lessons confirmed under these terms");
    expect(html).toContain("Unconfirmed requests have no no-show fee");
    expect(html).toContain("earlier agreement");
    expect(html).not.toMatch(/24 hours|late cancellation|grace period|per-player no-show/);
  }
  const html = renderToStaticMarkup(LessonsPage());
  expect(html.indexOf("$50 no-show fee")).toBeLessThan(html.indexOf('href="/lessons/book"'));
  expect(html).toContain("refund requests are reviewed case by case");
  expect(html).toContain('href="/terms"');
  expect(html).toContain("does not reserve");
  expect(html).toContain("charge your card");
});

test("lesson scheduler fallback shows the same policy before the text request", async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async () => new Response(null, { status: 503 });
    const html = renderToStaticMarkup(await LessonBookPage({ searchParams: Promise.resolve({}) }));
    expect(html).toContain("$50 no-show fee");
    expect(html).toContain("Unconfirmed requests have no no-show fee");
    expect(html.indexOf("$50 no-show fee")).toBeLessThan(html.indexOf('href="sms:'));
    expect(html).toContain('href="/terms"');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("lesson FAQ answers the no-show question without inventing a cancellation deadline", () => {
  const policy = faq.find((item) => item.question.includes("miss a confirmed lesson"))!;
  expect(policy).toBeDefined();
  expect(policy.answer).toContain("$50 no-show fee");
  expect(policy.answer).toContain("Unconfirmed requests have no no-show fee");
  expect(policy.answer).toContain("earlier agreement");
  expect(policy.answer).not.toMatch(/24 hours|late cancellation|grace period/);
  expect(policy.cta?.href).toBe("/lessons");
});

test("drop-in cancellation distinguishes freeing a seat from a refund without denying existing rights", () => {
  const html = renderToStaticMarkup(jsx.jsx(CancelClient, { token: "synthetic", childFirstName: "Player", sessionTitle: "Session", sessionDateLong: "October 11", sessionStart: "1 PM" }));
  expect(html).toContain("does not issue a refund");
  expect(html).toContain("case by case");
  expect(html).toContain("Existing registrations and confirmed lessons retain");
  expect(html).not.toMatch(/payment isn|non-refundable/);
  const input = { parentFirst: "Parent", childFirst: "Player", sessionTitle: "Session", sessionDateLong: "October 11", sessionStart: "1 PM", status: "Cancelled" as const, amountUsd: "40.00", scheduleUrl: "https://example.com/schedule" };
  for (const part of [cancelConfirmationHtml(input), cancelConfirmationText(input)]) {
    expect(part).toContain("No refund was issued by this cancellation");
    expect(part).toContain("case by case");
    expect(part).toContain("Existing registrations and confirmed lessons retain");
    expect(part).not.toContain("non-refundable by design");
  }
  for (const part of [cancelConfirmationHtml({ ...input, status: "Refunded" }), cancelConfirmationText({ ...input, status: "Refunded" })]) {
    expect(part).toContain("$40.00");
    expect(part).toContain("on the way back");
    expect(part).not.toContain("No refund was issued by this cancellation");
  }
});

test("crew offer and receipts preserve charge disclosures and prior terms without promising a refund from the cancel link", () => {
  const offer = renderToStaticMarkup(jsx.jsx(CommitForm, { token: "synthetic", parentEmail: "parent@example.com", childFirstName: "Player" }));
  const input = { parentFirst: "Parent", childFirst: "Player", crewDescription: "Green crew", weeksCommitted: 4, cardLast4: "4242", manageUrl: "https://example.com/manage" };
  const receipt = { ...input, sessionTitle: "Session", sessionDateLong: "October 11", sessionStartTime: "1 PM", location: "Court", amountUsd: 40, weeksReservedSoFar: 1, cancelUrl: "https://example.com/cancel" };
  for (const part of [offer, commitConfirmationHtml(input), commitConfirmationText(input), commitChargeReceiptHtml(receipt), commitChargeReceiptText(receipt)]) {
    expect(part).toContain("case by case");
    expect(part).toContain("Existing registrations and confirmed lessons retain");
    expect(part).not.toMatch(/refund automatically|we.?ll refund the|we'll refund:/);
  }
  expect(offer).toContain("the same one you paid for");
  expect(commitConfirmationText(input)).toContain("same drop-in rate you paid for the first session");
  expect(commitChargeReceiptText(receipt)).toContain("$40");
  expect(commitChargeReceiptText(receipt)).toContain(receipt.cancelUrl);
  expect(commitChargeReceiptText(receipt)).toContain("does not issue a refund");
});

test("drop-in confirmation retains the actual NGA-cancellation refund flow without blanket withdrawal exclusion", async () => {
  const html = renderToStaticMarkup(await ScheduleSuccessPage({ searchParams: Promise.resolve({}) }));
  expect(html).toContain("NGA-cancelled sessions receive an automatic full refund");
  expect(html).toContain("refund requests are reviewed case by case");
  expect(html).toContain("Existing registrations and confirmed lessons retain");
  expect(html).not.toContain("non-refundable");
  expect(html).toContain('href="/terms"');
});

for (const cancelUrl of [undefined, "https://example.com/cancel"]) {
  test(`drop-in booking and reminder copy align with the purchase terms (${cancelUrl ? "cancel link" : "reply fallback"})`, () => {
    const input = { parentFirst: "Parent", childFirst: "Player", sessionTitle: "Session", sessionDateLong: "October 11", sessionStart: "1 PM", sessionEnd: "2 PM", sessionLocation: "Court", amountPaid: "40.00", detailUrl: "https://example.com/details", cancelUrl };
    for (const part of [bookingConfirmationHtml(input), bookingCancellationCopy(cancelUrl), bookingReminderHtml(input), bookingReminderText(input)]) {
      expect(part).not.toContain("Drop-ins are non-refundable");
      expect(part).toContain("case by case");
      expect(part).toContain("Existing registrations and confirmed lessons retain");
      expect(part).toContain("request a refund under your agreed terms");
    }
    expect(bookingConfirmationHtml(input)).toContain("$40.00");
    if (cancelUrl) {
      expect(bookingConfirmationHtml(input)).toContain(cancelUrl);
      expect(bookingReminderText(input)).toContain(cancelUrl);
      expect(bookingReminderText(input)).toContain("does not issue a refund");
    } else {
      expect(bookingReminderText(input)).toContain("301-325-4731");
    }
  });
}

test("actual webhook plain-text wiring and cancellation SMS do not reinstate blanket exclusions or promotions", () => {
  const webhook = readFileSync("src/app/api/stripe/webhook/route.ts", "utf8");
  expect(webhook).not.toContain("Drop-ins are non-refundable");
  expect(webhook).not.toContain("50% off your next drop-in");
  expect(webhook).toContain("bookingCancellationCopy(cancelUrl)");
  const sms = cancelConfirmationSms({ childFirst: "Player", sessionTitle: "Session", sessionDateShort: "Oct 11", status: "Cancelled", scheduleUrl: "https://example.com/schedule" });
  expect(sms).toContain("refund under your agreed terms");
  expect(sms).not.toContain("non-refundable");
  expect(sms).toContain("Reply STOP");
});
