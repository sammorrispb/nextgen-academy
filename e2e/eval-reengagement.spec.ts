import { test, expect } from "@playwright/test";
import {
  evalReengagementHtml,
  evalReengagementText,
  EVAL_REENGAGEMENT_SUBJECT,
} from "../src/lib/email/eval-reengagement";

const input = {
  parentFirst: "Jen",
  newsletterUrl: "https://nextgenpbacademy.com/newsletter",
};

test.describe("evalReengagementHtml", () => {
  test("renders greeting, primary CTA, newsletter link, reply-skip", () => {
    const html = evalReengagementHtml(input);
    expect(html).toContain("Hi Jen,");
    expect(html).toContain("Join the free newsletter");
    expect(html).toContain("https://nextgenpbacademy.com/newsletter");
    expect(html).toContain('Reply "skip"');
    expect(html).toContain("better than yesterday, together");
  });

  test("quotes no hard prices (teased, not quoted)", () => {
    expect(evalReengagementHtml(input)).not.toMatch(/\$\d/);
  });

  test("does not start the subject with the full brand name", () => {
    expect(EVAL_REENGAGEMENT_SUBJECT.startsWith("Next Gen Pickleball Academy")).toBe(false);
    expect(EVAL_REENGAGEMENT_SUBJECT.length).toBeLessThanOrEqual(60);
  });
});

test.describe("evalReengagementText", () => {
  test("mirrors CTA + newsletter URL in plain text", () => {
    const text = evalReengagementText(input);
    expect(text).toContain("Join the free newsletter: https://nextgenpbacademy.com/newsletter");
    expect(text).toContain('Reply "skip"');
  });
});
