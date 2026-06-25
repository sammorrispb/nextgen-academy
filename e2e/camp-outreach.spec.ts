import { test, expect } from "@playwright/test";
import {
  campOutreachHtml,
  campOutreachText,
  CAMP_OUTREACH_SUBJECT,
} from "../src/lib/email/camp-outreach";

const input = {
  parentFirst: "Jen",
  campUrl:
    "https://nextgenpbacademy.com/camp?utm_source=email&utm_medium=parent-outreach&utm_campaign=summer-camps-2026",
};

test.describe("campOutreachHtml", () => {
  test("renders greeting, both weeks, register CTA, reply-skip", () => {
    const html = campOutreachHtml(input);
    expect(html).toContain("Hi Jen,");
    expect(html).toContain("June 29");
    expect(html).toContain("July 20");
    expect(html).toContain("Register for camp");
    expect(html).toContain('Reply "skip"');
    expect(html).toContain("better than yesterday, together");
  });

  test("CTA link is UTM-stamped for attribution", () => {
    expect(campOutreachHtml(input)).toContain(
      "utm_campaign=summer-camps-2026",
    );
  });

  test("quotes the real camp prices (camp is a concrete product, not teased)", () => {
    const html = campOutreachHtml(input);
    expect(html).toContain("$50");
    expect(html).toContain("$150");
  });

  test("uses generic copy — no child name (parent-email egress only)", () => {
    // The blast carries no child PII; personalization is parent first name only.
    const html = campOutreachHtml(input);
    expect(html).toContain("your camper");
    // The only interpolated value besides the static body is parentFirst/campUrl.
    expect(html).not.toContain("childFirst");
  });

  test("times carry am/pm + ET and the camp age range", () => {
    const html = campOutreachHtml(input);
    expect(html).toContain("9:30am");
    expect(html).toContain("ET");
    expect(html).toContain("8");
    expect(html).toContain("16");
  });

  test("subject is short and does not start with the full brand name", () => {
    expect(
      CAMP_OUTREACH_SUBJECT.startsWith("Next Gen Pickleball Academy"),
    ).toBe(false);
    expect(CAMP_OUTREACH_SUBJECT.length).toBeLessThanOrEqual(60);
  });
});

test.describe("campOutreachText", () => {
  test("mirrors CTA + camp URL + reply-skip in plain text", () => {
    const text = campOutreachText(input);
    expect(text).toContain(`Register for camp: ${input.campUrl}`);
    expect(text).toContain('Reply "skip"');
    expect(text).toContain("$150");
  });
});
