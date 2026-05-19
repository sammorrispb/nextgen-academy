import { test, expect } from "@playwright/test";
import {
  bookingReminderHtml,
  bookingReminderText,
} from "../src/lib/email/booking-reminder";
import { bookingReminderSms } from "../src/lib/sms";

const sample = {
  parentFirst: "Alex",
  childFirst: "Riley",
  sessionTitle: "Green Ball Drop-in",
  sessionDateLong: "Saturday, May 23, 2026",
  sessionStart: "5:30 PM",
  sessionLocation: "Cabin John RP, Bethesda MD",
  detailUrl: "https://www.nextgenpbacademy.com/schedule/green-ball-drop-in-2026-05-23",
};
const cancelUrl =
  "https://www.nextgenpbacademy.com/schedule/cancel?token=signed.token.here";

test.describe("Comms templates — 24h reminder", () => {
  // These are pure-function checks. No page navigation, no dev server. Run
  // with: `npx playwright test e2e/comms-templates.spec.ts --project=desktop`

  test("HTML email body carries Coach Sam signoff + tagline + EASE-Attitude framing", () => {
    const html = bookingReminderHtml({ ...sample, cancelUrl });

    expect(html).toContain("Coach Sam &middot; Next Gen Pickleball Academy");
    expect(html).toContain("better than yesterday, together.");
    // EASE-Attitude: "show up ready to grow" / "the more rest...the better the reps"
    expect(html).toMatch(/grow|rest|reps/);
    // Coach voice opens with kid's name doing something concrete
    expect(html).toContain("Riley is on the court tomorrow");
    // Helpful-action-first cancel copy
    expect(html).toContain("the next player can grab the seat");
    expect(html).toContain(cancelUrl);
    // Single arrowed CTA = Maps. "View session details" must not have an arrow.
    expect(html).toContain("Open in Google Maps &rarr;");
    expect(html).not.toContain("View session details &rarr;");
  });

  test("HTML email falls back to phone/text cue when cancelUrl is absent", () => {
    const html = bookingReminderHtml({ ...sample, cancelUrl: undefined });
    expect(html).toContain("301-325-4731");
    expect(html).toContain("open the seat");
  });

  test("plain-text fallback has parity: Maps URL, scannable list, cancel URL, Coach Sam signoff", () => {
    const text = bookingReminderText({ ...sample, cancelUrl });
    expect(text).toContain("Directions: https://www.google.com/maps/dir/");
    expect(text).toContain("Coach Sam · Next Gen Pickleball Academy");
    expect(text).toContain("better than yesterday, together.");
    // Scannable list, not comma-joined
    expect(text).toMatch(/- Water bottle, packed/);
    expect(text).toMatch(/- Court shoes/);
    expect(text).toContain(cancelUrl);
  });

  test("SMS body opens with the kid's name, signs off as Coach Sam, keeps STOP language", () => {
    const sms = bookingReminderSms({
      childFirst: "Riley",
      sessionTitle: "Green Ball Drop-in",
      sessionStart: "5:30 PM",
      sessionDateShort: "Sat May 23",
      detailUrl: sample.detailUrl,
    });
    // No robot prefix
    expect(sms.startsWith("NGA:")).toBe(false);
    expect(sms.startsWith("Riley is on the court tomorrow")).toBe(true);
    expect(sms).toContain("— Coach Sam · NGA");
    expect(sms).toContain("Reply STOP to opt out.");
  });
});
