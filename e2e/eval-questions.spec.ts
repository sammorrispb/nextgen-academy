import { test, expect } from "@playwright/test";
import {
  evalQuestionsCardHtml,
  evalQuestionsText,
} from "../src/lib/email/eval-questions";
import { site } from "../src/data/site";

test.describe("evalQuestionsCardHtml", () => {
  test("asks the MoCo-area and availability questions", () => {
    const html = evalQuestionsCardHtml("Adyson");
    expect(html).toContain("Which part of Montgomery County is most convenient");
    expect(html).toContain(
      "general availability for an evaluation in the next week or two",
    );
  });

  test("surfaces the phone as a tel: call/text CTA", () => {
    const html = evalQuestionsCardHtml("Adyson");
    expect(html).toContain(`href="tel:${site.phone}"`);
    expect(html).toContain(site.phone);
    expect(html).toContain("call/text Coach Sam");
    // Yellow Ball bans mailto: (verify-funnel.mjs) — the CTA must not use it.
    expect(html).not.toContain("mailto:");
  });

  test("personalizes with the child's first name when provided", () => {
    expect(evalQuestionsCardHtml("Adyson")).toContain("Adyson&rsquo;s evaluation");
  });

  test("falls back to a generic phrase when no name is given", () => {
    const html = evalQuestionsCardHtml();
    expect(html).toContain("your child&rsquo;s evaluation");
    expect(html).not.toContain("undefined");
  });

  test("treats a blank/whitespace name as no name", () => {
    const html = evalQuestionsCardHtml("   ");
    expect(html).toContain("your child&rsquo;s evaluation");
  });

  test("text variant mirrors the questions and phone", () => {
    const text = evalQuestionsText("Adyson");
    expect(text).toContain("Adyson's evaluation");
    expect(text).toContain("Which part of Montgomery County is most convenient");
    expect(text).toContain(site.phone);
  });
});
