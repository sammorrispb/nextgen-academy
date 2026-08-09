import { test, expect } from "@playwright/test";
import {
  campOutreachHtml,
  campOutreachText,
  CAMP_OUTREACH_SUBJECT,
  CONSENT_ASK,
} from "../src/lib/email/camp-outreach";

const campUrl =
  "https://nextgenpbacademy.com/camp?utm_source=email&utm_medium=parent-outreach&utm_campaign=back-to-school-camp-2026";

/** The live shape: one-click consent links present. */
const input = {
  parentFirst: "Jen",
  campUrl,
  consentUrl: "https://nextgenpbacademy.com/api/lead-consent?action=subscribe&token=AAA.BBB",
  optOutUrl: "https://nextgenpbacademy.com/api/lead-consent?action=optout&token=CCC.DDD",
};

/** Degraded shape: no signing secret configured, so no tokens to embed. */
const noTokens = { parentFirst: "Jen", campUrl };

test.describe("campOutreachHtml", () => {
  test("renders greeting, the Aug camp week, register CTA, sign-off", () => {
    const html = campOutreachHtml(input);
    expect(html).toContain("Hi Jen,");
    expect(html).toContain("August 17");
    expect(html).toContain("Rockville");
    expect(html).toContain("Register for camp");
    expect(html).toContain("better than yesterday, together");
  });

  test("does NOT advertise the concluded June/July Gaithersburg weeks", () => {
    // The July template shipped "June 29–July 2 and July 20–23 ... Gaithersburg".
    // Re-sending that after those camps ran is the failure this pins.
    const html = campOutreachHtml(input);
    expect(html).not.toContain("June 29");
    expect(html).not.toContain("July 20");
    expect(html).not.toContain("Gaithersburg");
  });

  test("CTA link is UTM-stamped for attribution", () => {
    expect(campOutreachHtml(input)).toContain(
      "utm_campaign=back-to-school-camp-2026",
    );
  });

  test("quotes the real camp prices (camp is a concrete product, not teased)", () => {
    const html = campOutreachHtml(input);
    expect(html).toContain("$50");
    expect(html).toContain("$150");
  });

  test("uses generic copy — no child name (parent-email egress only)", () => {
    const html = campOutreachHtml(input);
    expect(html).toContain("your camper");
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

test.describe("campOutreachHtml — permission pass", () => {
  test("renders BOTH choices when consent links are supplied", () => {
    const html = campOutreachHtml(input);
    expect(html).toContain(CONSENT_ASK);
    expect(html).toContain(input.consentUrl);
    expect(html).toContain(input.optOutUrl);
    expect(html).toContain("Yes, keep me posted");
    expect(html).toContain("No thanks, take me off the list");
  });

  test("the opt-out is not buried — it appears in the body AND the footer", () => {
    // No dark patterns: leaving must be at least as findable as staying.
    const html = campOutreachHtml(input);
    const occurrences = html.split(input.optOutUrl).length - 1;
    expect(occurrences).toBeGreaterThanOrEqual(2);
    expect(html).toContain("Unsubscribe here");
  });

  test("degrades to the reply-based opt-out when no tokens are available", () => {
    // A missing signing secret must not render a dead link that silently
    // swallows someone's opt-out.
    const html = campOutreachHtml(noTokens);
    expect(html).toContain(CONSENT_ASK);
    expect(html).toContain('Reply "skip"');
    expect(html).not.toContain("/api/lead-consent");
    expect(html).not.toContain("Yes, keep me posted");
  });
});

test.describe("campOutreachText", () => {
  test("mirrors CTA + camp URL + both consent choices in plain text", () => {
    const text = campOutreachText(input);
    expect(text).toContain(`Register for camp: ${campUrl}`);
    expect(text).toContain("$150");
    expect(text).toContain("August 17");
    expect(text).toContain(CONSENT_ASK);
    expect(text).toContain(`Yes, keep me posted: ${input.consentUrl}`);
    expect(text).toContain(`No thanks, take me off the list: ${input.optOutUrl}`);
    expect(text).toContain(`Unsubscribe: ${input.optOutUrl}`);
  });

  test("plain text degrades to reply-skip without tokens", () => {
    const text = campOutreachText(noTokens);
    expect(text).toContain('reply "skip"');
    expect(text).not.toContain("/api/lead-consent");
  });

  test("HTML and text carry the identical consent ask", () => {
    // One exported constant, so the two renderings cannot drift apart.
    expect(campOutreachHtml(input)).toContain(CONSENT_ASK);
    expect(campOutreachText(input)).toContain(CONSENT_ASK);
  });
});
