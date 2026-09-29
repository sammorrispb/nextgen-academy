import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { lessonSchedulingUrl, EVALUATION_SMS_URL } from "../src/data/scheduling";
import { faq } from "../src/data/faq";
import { seo } from "../src/data/seo";
import { familySiteUrl } from "../src/lib/urls";
import { stickyCtaFor } from "../src/lib/sticky-cta";
import LessonBookPage from "../src/app/lessons/book/page";
import { leadConfirmationHtml } from "../src/lib/email/lead-confirmation";

const source = (path: string) => readFileSync(`src/${path}`, "utf8");

test("lesson entry shares Coach Sam's NGA request flow", () => {
  expect(lessonSchedulingUrl()).toBe("https://coach.sammorrispb.com/book/nga-lessons");
});

test("a new parent reaches request scheduling without an invoice or Stripe read", async () => {
  await expect(LessonBookPage({ searchParams: Promise.resolve({ utm_source: "newsletter" }) }))
    .rejects.toMatchObject({
      digest: "NEXT_REDIRECT;replace;https://coach.sammorrispb.com/book/nga-lessons?utm_source=newsletter;307;",
    });
});

test("lesson redirect forwards only bounded campaign attribution, never child or invoice fields", () => {
  const url = new URL(lessonSchedulingUrl({
    utm_source: "newsletter", utm_medium: "email", utm_campaign: "fall",
    utm_content: ["duplicate", "ambiguous"], utm_term: "x".repeat(201),
    childName: "Private Canary", email: "parent@example.com", inv: "in_secret",
    next: "https://evil.example/", toString: "override",
  }));
  expect(Object.fromEntries(url.searchParams)).toEqual({
    utm_source: "newsletter", utm_medium: "email", utm_campaign: "fall",
  });
  expect(url.origin).toBe("https://coach.sammorrispb.com");
});

test("legacy paid lesson invoice path retains its payment and product guards", () => {
  const page = source("app/lessons/book/page.tsx");
  expect(page).toContain("if (!inv) redirect(lessonSchedulingUrl(params))");
  expect(page).toContain('m.kind !== "lesson"');
  expect(page).toContain('invoice.status !== "paid"');
  expect(page).toContain("<LessonBookingForm invoiceId={invoice.id}");
});

test("lesson overview uses requests instead of the upfront payment form", () => {
  const page = source("app/lessons/page.tsx");
  expect(page).not.toContain("LessonPurchaseForm");
  expect(page).not.toContain("STRIPE_PRIVATE_LESSON_PRICE_ID");
  expect(page).toContain('href="/lessons/book"');
  expect(page).toContain("confirms the time and location");
  expect(page).toContain("invoice");
});

test("lead email offers text evaluation scheduling with a visible fallback number", () => {
  const html = leadConfirmationHtml({ parentName: "Pat", isFirstTimer: false });
  expect(html).toContain(`href="${EVALUATION_SMS_URL}"`);
  expect(html).toContain("301-325-4731");
  expect(html).not.toContain("free-evaluation/book");
  expect(html).not.toContain("Pick your eval time");
});

test("legacy lesson client forms never bundle server signing code", () => {
  for (const name of ["LessonBookingForm", "CoachBookingDecision"]) {
    const client = source(`components/${name}.tsx`);
    expect(client).not.toContain("@/lib/lesson-booking-token");
    expect(client).toContain("@/data/lesson-booking-times");
  }
  const data = source("data/lesson-booking-times.ts");
  expect(data).not.toMatch(/node:|process\.env|createHmac/);
});


test("mobile evaluation CTA opens a text and lesson CTA opens scheduling", () => {
  for (const path of ["/", "/free-evaluation", "/free-evaluation/book"]) {
    expect(stickyCtaFor(path).href).toBe(EVALUATION_SMS_URL);
  }
  expect(stickyCtaFor("/lessons").href).toBe("/lessons/book");
  expect(stickyCtaFor("/youth-pickleball-frederick").href).toBe("#leagues");
});


test("inquiry copy does not promise a booking and offers evaluation scheduling by text", () => {
  const form = source("components/LeadForm.tsx");
  expect(form).toContain('submitLabel = "Send my inquiry"');
  expect(form).toContain("href={EVALUATION_SMS_URL}");
  expect(form).toContain("Text to schedule an evaluation");
  expect(form).not.toContain("within 24 hours to schedule a free evaluation");
});

test("evaluation FAQ and search description use the text scheduling path", () => {
  for (const question of ["How do I sign up?", "How do free evaluations work?"]) {
    const item = faq.find(item => item.question === question)!;
    expect(item.answer).toContain("Text Coach Sam at 301-325-4731");
    expect(item.answer).not.toMatch(/fill out.*form|email.*schedule/i);
  }
  expect(seo.freeEvaluation.description).toContain("Text Coach Sam at 301-325-4731");
});

test("adult cross-invite points at live lesson requests with NGA attribution", () => {
  const target = familySiteUrl("sammorrispb", "https://coach.sammorrispb.com/book/private-lesson", "about_adults");
  const url = new URL(target);
  expect(url.hostname).toBe("coach.sammorrispb.com");
  expect(url.pathname).toBe("/book/private-lesson");
  expect(url.searchParams.get("utm_source")).toBe("nga");
  expect(url.searchParams.get("utm_content")).toBe("about_adults");
  const page = source("app/page.tsx");
  expect(page).toContain('familySiteUrl("sammorrispb", "https://coach.sammorrispb.com/book/private-lesson", "about_adults")');
  expect(page).toContain("Request an adult lesson with Sam");
  expect(faq.find(item => item.question === "Do you offer lessons for adults?")!.answer).not.toContain("free 30-minute skill evaluation");
});
