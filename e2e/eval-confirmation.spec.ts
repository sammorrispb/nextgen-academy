import { test, expect } from "@playwright/test";
import {
  evalConfirmationHtml,
  evalConfirmationText,
  evalConfirmationSubject,
  type EvalConfirmationInput,
} from "../src/lib/email/eval-confirmation";

const input: EvalConfirmationInput = {
  parentFirst: "Hun",
  childFirst: "Zoe",
  dateLong: "Tuesday, June 9, 2026",
  startTime: "10:00 AM",
  endTime: "10:45 AM",
  location: "East Norbeck Local Park, 3131 Norbeck Rd, Silver Spring, MD 20906",
};

test.describe("evalConfirmationHtml", () => {
  test("renders parent name, child name, date/time and location", () => {
    const html = evalConfirmationHtml(input);
    expect(html).toContain("You&rsquo;re all set, Hun.");
    expect(html).toContain("Zoe");
    expect(html).toContain("Tuesday, June 9, 2026");
    expect(html).toContain("10:00 AM");
    expect(html).toContain("10:45 AM");
    expect(html).toContain("East Norbeck Local Park");
  });

  test("includes a Google Maps directions link to the location", () => {
    const html = evalConfirmationHtml(input);
    expect(html).toContain("https://www.google.com/maps/dir/?api=1&destination=");
    expect(html).toContain(encodeURIComponent(input.location));
  });

  test("ladders to EASE and carries the tagline + Coach Sam signoff", () => {
    const html = evalConfirmationHtml(input);
    expect(html).toContain("Ethics, Attitude, Skills, Excellence");
    expect(html).toContain("better than yesterday, together");
    expect(html).toContain("Coach Sam &middot; Next Gen Pickleball Academy");
  });

  test("quotes no prices — evals are free", () => {
    expect(evalConfirmationHtml(input)).not.toMatch(/\$\d/);
  });

  test("carries no Dill Dinkers / CourtReserve references", () => {
    const html = evalConfirmationHtml(input).toLowerCase();
    expect(html).not.toContain("dill dinker");
    expect(html).not.toContain("courtreserve");
  });

  test("defaults the coach to Coach Sam, and honors an override", () => {
    expect(evalConfirmationHtml(input)).toContain("Free Evaluation with Coach Sam");
    const amine = evalConfirmationHtml({ ...input, coachName: "Coach Amine" });
    expect(amine).toContain("Free Evaluation with Coach Amine");
  });

  test("escapes HTML-special characters in interpolated values", () => {
    const html = evalConfirmationHtml({ ...input, childFirst: "A<b>&'\"" });
    expect(html).not.toContain("<b>");
    expect(html).toContain("&lt;b&gt;");
  });
});

test.describe("evalConfirmationText", () => {
  test("mirrors the key details in the plain-text fallback", () => {
    const text = evalConfirmationText(input);
    expect(text).toContain("You're all set, Hun.");
    expect(text).toContain("Tuesday, June 9, 2026");
    expect(text).toContain("East Norbeck Local Park");
    expect(text).toContain("https://www.google.com/maps/dir/?api=1&destination=");
    expect(text).toContain("Coach Sam · Next Gen Pickleball Academy");
  });
});

test.describe("evalConfirmationSubject", () => {
  test("is <= 60 chars, names the child, and does not lead with the brand", () => {
    const subject = evalConfirmationSubject("Zoe", "Tue, Jun 9", "10:00 AM");
    expect(subject.length).toBeLessThanOrEqual(60);
    expect(subject).toContain("Zoe");
    expect(subject.startsWith("Next Gen")).toBe(false);
  });
});
