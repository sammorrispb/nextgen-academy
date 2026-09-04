import { test, expect } from "@playwright/test";
import {
  newsletterWelcomeHtml,
  newsletterWelcomeText,
} from "../src/lib/email/newsletter-welcome";

// The welcome email used to carry a personalized /newsletter?ref= link and a
// "you both get 50% off" perk, and its fallback copy promised that every
// Thursday issue carries the link. Both came out 2026-09-03 with the weekly
// issue's referral card — the referral program isn't set up, and a perk the
// business can't honor is a promise, not a nudge. These pin the removal so a
// partial revert can't bring the promise back on one surface only.

const input = {
  parentFirst: "Lauren",
  childFirst: "Ava",
  scheduleUrl: "https://nextgenpbacademy.com/schedule",
  crewInterestUrl: "https://nextgenpbacademy.com/crew",
};

test.describe("newsletter welcome — forward ask", () => {
  test("keeps the forward ask but carries no referral link and no discount", () => {
    for (const rendered of [newsletterWelcomeHtml(input), newsletterWelcomeText(input)]) {
      expect(rendered).toContain("Bring the crew");
      expect(rendered).toContain("Forward this email");
      expect(rendered).not.toMatch(/\?ref=/);
      expect(rendered).not.toContain("forward link");
      expect(rendered).not.toMatch(/\d+% off/);
      expect(rendered).not.toContain("Thursday issue carries");
    }
  });

  test("still quotes no dollar prices", () => {
    expect(newsletterWelcomeHtml(input)).not.toMatch(/\$\d/);
    expect(newsletterWelcomeText(input)).not.toMatch(/\$\d/);
  });
});
