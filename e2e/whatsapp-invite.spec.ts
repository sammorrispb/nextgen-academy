import { test, expect } from "@playwright/test";
import { WHATSAPP_PARENT_GROUP_URL } from "@/lib/email/whatsapp-invite";
import {
  bookingConfirmationHtml,
} from "@/lib/email/booking-confirmation";
import {
  bookingReminderHtml,
  bookingReminderText,
} from "@/lib/email/booking-reminder";
import { postSessionHtml, postSessionText } from "@/lib/email/post-session";
import {
  postSessionRebookHtml,
  postSessionRebookText,
} from "@/lib/email/post-session-rebook";
import {
  crewInterestWelcomeHtml,
  crewInterestWelcomeText,
} from "@/lib/email/crew-interest-welcome";

// Pure-function specs (no dev server):
//   npx playwright test e2e/whatsapp-invite.spec.ts --project=desktop
//
// Invite policy (changed 2026-06-13): the Next Gen parent WhatsApp group rides
// along on EVERY registrant-facing email, not just a parent's first touch — so
// every family has a standing way to reach Coach Sam and each other.

const confirmationInput = {
  parentFirst: "Jordan",
  childFirst: "Mia",
  sessionTitle: "Green Ball — Saturday AM",
  sessionDateLong: "Saturday, June 20, 2026",
  sessionStart: "10:00 AM",
  sessionEnd: "11:00 AM",
  sessionLocation: "Redland Middle School, Rockville, MD",
  amountPaid: "20.00",
  detailUrl: "https://nextgenpbacademy.com/schedule/green-ball-2026-06-20",
};

const reminderInput = {
  parentFirst: "Jordan",
  childFirst: "Mia",
  sessionTitle: "Green Ball — Saturday AM",
  sessionDateLong: "Saturday, June 20, 2026",
  sessionStart: "10:00 AM",
  sessionLocation: "Redland Middle School, Rockville, MD",
  detailUrl: "https://nextgenpbacademy.com/schedule/green-ball-2026-06-20",
};

const postSessionInput = {
  parentFirst: "Jordan",
  childFirst: "Mia",
  sessionTitle: "Green Ball — Saturday AM",
  sessionDateLong: "Saturday, June 20, 2026",
  scheduleUrl: "https://nextgenpbacademy.com/schedule",
};

const rebookInput = {
  parentFirst: "Jordan",
  childFirst: "Mia",
  sessionTitle: "Green Ball — Saturday AM",
  sessionDateLong: "Saturday, June 20, 2026",
  scheduleUrl: "https://nextgenpbacademy.com/schedule",
};

const crewInterestInput = {
  parentFirst: "Jordan",
  childFirst: "Mia",
  preferredSummary: "Green · Wed · 4-6pm",
  newsletterUrl: "https://nextgenpbacademy.com/newsletter",
};

test.describe("WhatsApp invite — on every registrant email", () => {
  test("booking confirmation carries the group link unconditionally", () => {
    expect(bookingConfirmationHtml(confirmationInput)).toContain(
      WHATSAPP_PARENT_GROUP_URL,
    );
  });

  test("booking reminder carries the group link (HTML + text)", () => {
    expect(bookingReminderHtml(reminderInput)).toContain(
      WHATSAPP_PARENT_GROUP_URL,
    );
    expect(bookingReminderText(reminderInput)).toContain(
      WHATSAPP_PARENT_GROUP_URL,
    );
  });

  test("post-session recap carries the group link (HTML + text)", () => {
    expect(postSessionHtml(postSessionInput)).toContain(
      WHATSAPP_PARENT_GROUP_URL,
    );
    expect(postSessionText(postSessionInput)).toContain(
      WHATSAPP_PARENT_GROUP_URL,
    );
  });

  test("no-show rebook carries the group link (HTML + text)", () => {
    expect(postSessionRebookHtml(rebookInput)).toContain(
      WHATSAPP_PARENT_GROUP_URL,
    );
    expect(postSessionRebookText(rebookInput)).toContain(
      WHATSAPP_PARENT_GROUP_URL,
    );
  });

  test("crew interest welcome carries the group link (HTML + text)", () => {
    expect(crewInterestWelcomeHtml(crewInterestInput)).toContain(
      WHATSAPP_PARENT_GROUP_URL,
    );
    expect(crewInterestWelcomeText(crewInterestInput)).toContain(
      WHATSAPP_PARENT_GROUP_URL,
    );
  });
});
