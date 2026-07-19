import { test, expect } from "@playwright/test";
import {
  bookingConfirmationHtml,
  type ConfirmationInput,
} from "../src/lib/email/booking-confirmation";

// Pure-function spec for the drop-in confirmation template. Focus here is the
// "Bring a friend" referral block: it must (a) render only when a newsletter
// URL is supplied, (b) route through /newsletter (the honest path — the payout
// only fires for newsletter subscribers), and (c) carry no child PII, so it
// stays off the minor-data egress surface.

const base: ConfirmationInput = {
  parentFirst: "Gloria",
  childFirst: "Eliana",
  sessionTitle: "Westland Wed · Green",
  sessionDateLong: "Wednesday, July 22, 2026",
  sessionStart: "6:30 PM",
  sessionEnd: "7:30 PM",
  sessionLocation: "Westland Middle School",
  amountPaid: "20.00",
  detailUrl: "https://nextgenpbacademy.com/schedule/westland-wed-green",
};

test.describe("booking confirmation — referral block", () => {
  test("renders the newsletter referral block when newsletterUrl is set", () => {
    const html = bookingConfirmationHtml({
      ...base,
      newsletterUrl: "https://nextgenpbacademy.com/newsletter",
    });
    expect(html).toContain("Bring a friend");
    expect(html).toContain("https://nextgenpbacademy.com/newsletter");
    // The perk is framed as a percentage, never a dollar figure (pricing is
    // teased, not quoted).
    expect(html).toContain("50% off");
    expect(html).not.toContain("$25");
  });

  test("omits the referral block entirely when no newsletterUrl is supplied", () => {
    const html = bookingConfirmationHtml(base);
    expect(html).not.toContain("Bring a friend");
    expect(html).not.toContain("/newsletter");
  });

  test("referral block never carries child PII", () => {
    const html = bookingConfirmationHtml({
      ...base,
      childFirst: "Zzchildname",
      newsletterUrl: "https://nextgenpbacademy.com/newsletter",
    });
    // Isolate the referral card and assert the child's name isn't inside it —
    // the link a parent forwards to a friend must not leak their kid's name.
    const marker = "Bring a friend";
    const idx = html.indexOf(marker);
    expect(idx).toBeGreaterThan(-1);
    const block = html.slice(idx, idx + 600);
    expect(block).not.toContain("Zzchildname");
  });
});
