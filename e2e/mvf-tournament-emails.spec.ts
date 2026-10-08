// Pure-function specs for the three MVF Junior Tournament lifecycle emails.
// No dev server needed; runs in the pure suite (playwright.pure.config.ts).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test, expect } from "@playwright/test";
import { NORTH_CREEK } from "../src/data/mvf";
import {
  MVF_JUNIOR_TOURNAMENT_ADDRESS,
  MVF_JUNIOR_TOURNAMENT_VENUE,
} from "../src/data/mvf-junior-tournament-2026";
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
  MVF_TOURNAMENT_PRE_EVENT_SEND_DATE_ISO,
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
    expect(text).toContain("North Creek Community Center");
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

// Sam 2026-09-28: the tournament moved from Apple Ridge Courts to North Creek
// Community Center (lights, 3 dedicated courts). Every email a family gets
// must name the new venue with its street address, and none may still say
// Apple Ridge. (The post-payment "You're in" email lives in the Stripe
// webhook and reads MVF_JUNIOR_TOURNAMENT_VENUE, which the first test pins.)
test.describe("mvf tournament venue — North Creek Community Center", () => {
  test("the venue and address derive from the North Creek record in mvf.ts", () => {
    expect(MVF_JUNIOR_TOURNAMENT_VENUE).toBe("North Creek Community Center");
    expect(MVF_JUNIOR_TOURNAMENT_VENUE).toBe(NORTH_CREEK.center);
    expect(MVF_JUNIOR_TOURNAMENT_ADDRESS).toBe(
      "20125 Arrowhead Road, Montgomery Village, MD 20886",
    );
  });

  const renders: Array<[string, string]> = [
    ["signup confirmation text", mvfTournamentSignupConfirmationText(signupInput)],
    ["signup confirmation html", mvfTournamentSignupConfirmationHtml(signupInput)],
    ["payment reminder text", mvfTournamentPaymentReminderText(reminderInput)],
    ["payment reminder html", mvfTournamentPaymentReminderHtml(reminderInput)],
    ["pre-event reminder text", mvfTournamentPreEventReminderText(preEventInput)],
    ["pre-event reminder html", mvfTournamentPreEventReminderHtml(preEventInput)],
  ];

  for (const [name, body] of renders) {
    test(`${name} explains the indoor rain location and one-hour-earlier schedule`, () => {
      expect(body).toContain("Lake Marion Community Center");
      expect(body).toContain("8821 East Village Avenue, Montgomery Village, MD 20886");
      expect(body).toContain("3:00–6:00 PM ET");
      expect(body).toContain("one hour earlier than the outdoor schedule");
      expect(body).toContain("Saturday, October 24, 2026");
      expect(body).toContain("4:00–7:00 PM");
      expect(body).toMatch(/if it rains/i);
    });

    test(`${name} names North Creek, its address and its lit courts — never Apple Ridge`, () => {
      expect(body).toContain("North Creek Community Center");
      expect(body).toContain("20125 Arrowhead Road, Montgomery Village, MD 20886");
      expect(body).toContain("3 dedicated pickleball courts with lights");
      expect(body).not.toMatch(/apple ridge/i);
    });
  }

  test("pre-event email scopes check-in to outdoor play without inventing an indoor arrival time", () => {
    for (const body of [
      mvfTournamentPreEventReminderText(preEventInput),
      mvfTournamentPreEventReminderHtml(preEventInput),
    ]) {
      expect(body).toMatch(/outdoor check-in/i);
      expect(body).toContain("3:30 PM ET");
      expect(body).toContain("the outdoor check-in and warm-up times below do not apply");
      expect(body.indexOf("Lake Marion")).toBeLessThan(body.indexOf("3:30 PM"));
      expect(body).not.toMatch(/2:30 PM|2:45 PM/);
    }
    expect(MVF_TOURNAMENT_PRE_EVENT_SEND_DATE_ISO).toBe("2026-10-19");
  });

  test("no tournament web surface hardcodes a venue name", () => {
    // The success page's metadata once hardcoded "Apple Ridge Courts" and
    // would have kept saying it after the constant moved. Every surface reads
    // the venue from the data module instead.
    const surfaces = [
      "src/app/mvf-junior-tournament/page.tsx",
      "src/app/mvf-junior-tournament/success/page.tsx",
      "src/components/MvfJuniorTournamentForm.tsx",
      "src/components/TournamentBanner.tsx",
      "src/lib/email/mvf-tournament-signup-confirmation.ts",
      "src/lib/email/mvf-tournament-payment-reminder.ts",
      "src/lib/email/mvf-tournament-pre-event-reminder.ts",
    ];
    for (const file of surfaces) {
      const src = readFileSync(join(__dirname, "..", file), "utf8");
      expect(src, file).not.toMatch(/apple ridge|north creek/i);
    }
  });
});
