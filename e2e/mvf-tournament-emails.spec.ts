// Pure-function specs for the three MVF Junior Tournament lifecycle emails.
// No dev server needed; runs in the pure suite (playwright.pure.config.ts).
import { test, expect } from "@playwright/test";
import {
  mvfTournamentSignupConfirmationSubject,
  mvfTournamentSignupConfirmationText,
  mvfTournamentSignupConfirmationHtml,
} from "../src/lib/email/mvf-tournament-signup-confirmation";
import {
  mvfTournamentPaymentReminderSubject,
  mvfTournamentPaymentReminderText,
  mvfTournamentPaymentReminderHtml,
} from "../src/lib/email/mvf-tournament-payment-reminder";
import {
  mvfTournamentPreEventReminderSubject,
  mvfTournamentPreEventReminderText,
  mvfTournamentPreEventReminderHtml,
  todayEtIso,
} from "../src/lib/email/mvf-tournament-pre-event-reminder";

const signupInput = {
  parentFirst: "Hun",
  childFirst: "Zoe",
  divisionLabel: "10U",
  amountUsd: "50.00",
  residencyLabel: "MV resident",
  payUrl: "https://pay.stripe.com/invoice/test",
};

const reminderInput = {
  parentFirst: "Hun",
  childFirst: "Zoe",
  divisionLabel: "14U",
  amountUsd: "60.00",
  residencyLabel: "non-resident",
  payUrl: "https://pay.stripe.com/invoice/test",
};

const preEventInput = {
  parentFirst: "Hun",
  childFirst: "Zoe",
  divisionLabel: "10U",
};

test.describe("mvf tournament signup confirmation", () => {
  test("subject names the step, not the brand", () => {
    const subject = mvfTournamentSignupConfirmationSubject({
      childFirst: "Zoe",
    });
    expect(subject).toContain("Zoe");
    expect(subject.startsWith("Next Gen")).toBe(false);
  });

  test("text carries the pay CTA, event details, and policies", () => {
    const text = mvfTournamentSignupConfirmationText(signupInput);
    expect(text).toContain("Hi Hun,");
    expect(text).toContain("Zoe");
    expect(text).toContain("10U");
    expect(text).toContain("$50.00");
    expect(text).toContain("https://pay.stripe.com/invoice/test");
    expect(text).toContain("Saturday, October 24, 2026");
    expect(text).toContain("Apple Ridge Courts");
    expect(text).toContain("No refunds.");
    expect(text).toContain("Rain or shine");
    expect(text).toContain("Coach Sam");
  });

  test("makes clear the spot is not locked until payment", () => {
    const text = mvfTournamentSignupConfirmationText(signupInput);
    expect(text).toMatch(/lock in the spot/i);
    expect(text).not.toMatch(/is registered for the MVF Junior Tournament \(\w+ division\)\./);
  });

  test("html renders the pay button and the signature block", () => {
    const html = mvfTournamentSignupConfirmationHtml(signupInput);
    expect(html).toContain("https://pay.stripe.com/invoice/test");
    expect(html).toContain("301-325-4731");
  });
});

test.describe("mvf tournament payment reminder", () => {
  test("subject names the deadline", () => {
    const subject = mvfTournamentPaymentReminderSubject({ childFirst: "Zoe" });
    expect(subject).toContain("Zoe");
    expect(subject).toMatch(/2 days/i);
  });

  test("text carries the pay CTA and a reply path", () => {
    const text = mvfTournamentPaymentReminderText(reminderInput);
    expect(text).toContain("Hi Hun,");
    expect(text).toContain("Zoe");
    expect(text).toContain("14U");
    expect(text).toContain("$60.00");
    expect(text).toContain("https://pay.stripe.com/invoice/test");
    expect(text).toMatch(/reply to this email/i);
  });

  test("html renders the pay button and the signature block", () => {
    const html = mvfTournamentPaymentReminderHtml(reminderInput);
    expect(html).toContain("https://pay.stripe.com/invoice/test");
    expect(html).toContain("301-325-4731");
  });
});

test.describe("mvf tournament pre-event reminder", () => {
  test("subject is date-agnostic but event-specific", () => {
    expect(mvfTournamentPreEventReminderSubject()).toContain(
      "MVF Junior Tournament",
    );
  });

  test("text carries check-in procedures and the share ask", () => {
    const text = mvfTournamentPreEventReminderText(preEventInput);
    expect(text).toContain("Hi Hun,");
    expect(text).toContain("Zoe");
    expect(text).toContain("10U");
    expect(text).toContain("3:30 PM");
    expect(text).toContain("NGA tent");
    expect(text).toContain("water bottle");
    expect(text).toContain("loaner paddles");
    expect(text).toContain("nextgenpbacademy.com/mvf-junior-tournament");
    expect(text).toMatch(/forward this link/i);
    expect(text).toContain("Rain or shine");
  });

  test("html renders check-in card and share callout", () => {
    const html = mvfTournamentPreEventReminderHtml(preEventInput);
    expect(html).toContain("3:30 PM");
    expect(html).toContain("nextgenpbacademy.com/mvf-junior-tournament");
  });
});

test.describe("todayEtIso — the pre-event date gate", () => {
  test("formats a known instant in America/New_York", () => {
    // 2026-10-19T04:00:00Z is 2026-10-19 00:00 ET (EDT).
    expect(todayEtIso(new Date("2026-10-19T04:00:00Z"))).toBe("2026-10-19");
    // 2026-10-19T03:59:59Z is still 2026-10-18 23:59 ET — not the send date.
    expect(todayEtIso(new Date("2026-10-19T03:59:59Z"))).toBe("2026-10-18");
  });
});
