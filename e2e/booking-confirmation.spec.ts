import { test, expect } from "@playwright/test";
import {
  bookingConfirmationHtml,
  type ConfirmationInput,
} from "../src/lib/email/booking-confirmation";

// Newsletter copy may invite families to receive updates without promising
// discounts. A forwarded newsletter link must carry no child PII.

const base: ConfirmationInput = {
  parentFirst: "Pat",
  childFirst: "Riley",
  sessionTitle: "Westland Wed · Green",
  sessionDateLong: "Wednesday, July 22, 2026",
  sessionStart: "6:30 PM",
  sessionEnd: "7:30 PM",
  sessionLocation: "Westland Middle School",
  amountPaid: "20.00",
  detailUrl: "https://nextgenpbacademy.com/schedule/westland-wed-green",
};

test.describe("booking confirmation — newsletter block", () => {
  test("renders newsletter updates without an inactive discount promise", () => {
    const html = bookingConfirmationHtml({
      ...base,
      newsletterUrl: "https://nextgenpbacademy.com/newsletter",
    });
    expect(html).toContain("Weekly updates");
    expect(html).toContain("https://nextgenpbacademy.com/newsletter");
    expect(html).not.toContain("50% off");
    expect(html).not.toContain("personal invite link");
    expect(html).not.toContain("$25");
  });

  test("omits the newsletter block entirely when no newsletterUrl is supplied", () => {
    const html = bookingConfirmationHtml(base);
    expect(html).not.toContain("Weekly updates");
    expect(html).not.toContain("/newsletter");
  });

  test("newsletter block never carries child PII", () => {
    const html = bookingConfirmationHtml({
      ...base,
      childFirst: "Zzchildname",
      newsletterUrl: "https://nextgenpbacademy.com/newsletter",
    });
    // Isolate the newsletter card and assert the child's name isn't inside it —
    // the link a parent forwards to a friend must not leak their kid's name.
    const marker = "Weekly updates";
    const idx = html.indexOf(marker);
    expect(idx).toBeGreaterThan(-1);
    const block = html.slice(idx, idx + 600);
    expect(block).not.toContain("Zzchildname");
  });
});
