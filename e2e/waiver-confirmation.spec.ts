import { test, expect } from "@playwright/test";
import {
  waiverConfirmationHtml,
  waiverConfirmationText,
  waiverConfirmationSubject,
} from "../src/lib/email/waiver-confirmation";
import { WAIVER_VERSION, WAIVER_SECTIONS } from "../src/data/waiver";

// Pure template spec — pins the brand COMMS-TEMPLATES standard on the
// signed-waiver confirmation email so a refactor can't silently drop the
// Coach Sam signoff / tagline / full-text record copy.
//   npx playwright test e2e/waiver-confirmation.spec.ts --project=desktop

const input = {
  parentFirst: "Jordan",
  signatureName: "Jordan A. Parent",
  signedAtLong: "June 27, 2026",
};

test.describe("waiver confirmation email", () => {
  const html = waiverConfirmationHtml(input);
  const text = waiverConfirmationText(input);

  test("carries the brand signature standard (HTML + text parity)", () => {
    for (const body of [html, text]) {
      expect(body).toContain("Coach Sam · Next Gen Pickleball Academy");
      expect(body).toContain("better than yesterday, together");
    }
  });

  test("is the parent's record copy — full waiver text + signed details", () => {
    expect(html).toContain(input.signatureName);
    expect(html).toContain(input.signedAtLong);
    expect(html).toContain(WAIVER_VERSION);
    // Every section of the agreement is present in both bodies. The HTML
    // entity-escapes ampersands, so compare against the escaped title there.
    for (const sec of WAIVER_SECTIONS) {
      expect(html).toContain(sec.title.replace(/&/g, "&amp;"));
      expect(text).toContain(sec.title);
    }
  });

  test("subject names the waiver and its on-file state", () => {
    expect(waiverConfirmationSubject().toLowerCase()).toContain("waiver");
  });
});
