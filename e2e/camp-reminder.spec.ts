import { test, expect } from "@playwright/test";
import {
  campReminderHtml,
  campReminderText,
  campReminderSubject,
  type CampReminderInput,
} from "../src/lib/email/camp-reminder";
import {
  addDaysIso,
  upcomingCampForReminder,
  campsNeedingRosterSync,
  formatCampDayLong,
  formatCampWeekday,
  resolveCampWhere,
} from "../src/lib/camp-reminder-schedule";
import { CAMPS, findCampBySlug } from "../src/data/camps";
import {
  collectPaidCampSessions,
  type CampSessionSource,
} from "../src/lib/notion-camp-roster";
import type Stripe from "stripe";

const input: CampReminderInput = {
  parentFirst: "Hun",
  childFirst: "Zoe",
  campTitle: "Summer Camp — Week 1",
  campWeek: "June 29 – July 2, 2026",
  optionLabel: "Full week (Mon–Thu)",
  optionHours: "9:30 AM – 12:30 PM",
  location: "Gaithersburg High School — outdoor courts\n314 South Frederick Ave, Gaithersburg, MD 20877",
  startDayLong: "Monday, June 29",
  dropoffWindow: "9:15–9:30 AM",
  pickupWindow: "12:30–12:45 PM",
  lateFee: "$25",
  makeupDayLong: "Friday, July 3",
};

test.describe("campReminderHtml", () => {
  test("renders parent, child, camp, hours and the exact location", () => {
    const html = campReminderHtml(input);
    expect(html).toContain("Hun");
    expect(html).toContain("Zoe");
    expect(html).toContain("Summer Camp — Week 1");
    expect(html).toContain("June 29 – July 2, 2026");
    expect(html).toContain("Full week (Mon–Thu)");
    expect(html).toContain("9:30 AM – 12:30 PM");
    expect(html).toContain("Gaithersburg High School");
    expect(html).toContain("314 South Frederick Ave");
  });

  test("communicates the drop-off and pick-up windows", () => {
    const html = campReminderHtml(input);
    expect(html).toContain("9:15–9:30 AM");
    expect(html).toContain("12:30–12:45 PM");
  });

  test("states the $25 administrative fee as policy, with no payment link", () => {
    const html = campReminderHtml(input);
    expect(html).toContain("$25 administrative fee");
    // Policy statement only — no Stripe/payment link in the reminder.
    expect(html).not.toContain("stripe.com");
    expect(html).not.toContain("checkout");
  });

  test("carries the rain plan + makeup day", () => {
    const html = campReminderHtml(input);
    expect(html).toContain("rain or shine");
    expect(html).toContain("Friday, July 3");
  });

  test("lists what to bring each day", () => {
    const html = campReminderHtml(input);
    expect(html).toContain("water bottle");
    expect(html).toContain("Court shoes");
    expect(html).toContain("loaners");
  });

  test("carries the Coach Sam signoff and tagline", () => {
    const html = campReminderHtml(input);
    expect(html).toContain("better than yesterday, together");
    expect(html).toContain("Coach Sam &middot; Next Gen Pickleball Academy");
  });

  test("carries no Dill Dinkers / CourtReserve references", () => {
    const html = campReminderHtml(input).toLowerCase();
    expect(html).not.toContain("dill dinker");
    expect(html).not.toContain("courtreserve");
  });

  test("escapes HTML-special characters in interpolated values", () => {
    const html = campReminderHtml({ ...input, childFirst: "A<b>&'\"" });
    expect(html).not.toContain("<b>");
    expect(html).toContain("&lt;b&gt;");
  });
});

test.describe("campReminderText", () => {
  test("mirrors the key details in the plain-text fallback", () => {
    const text = campReminderText(input);
    expect(text).toContain("Hi Hun,");
    expect(text).toContain("Zoe starts camp Monday, June 29");
    expect(text).toContain("Gaithersburg High School");
    expect(text).toContain("9:15–9:30 AM");
    expect(text).toContain("12:30–12:45 PM");
    expect(text).toContain("$25 administrative fee");
    expect(text).toContain("Friday, July 3");
    expect(text).toContain("Coach Sam · Next Gen Pickleball Academy");
  });
});

test.describe("campReminderSubject", () => {
  test("names the child + start weekday and stays short", () => {
    const subject = campReminderSubject("Zoe", "Monday");
    expect(subject).toContain("Zoe");
    expect(subject).toContain("Monday");
    expect(subject.length).toBeLessThanOrEqual(60);
  });
});

// These helpers are UTC-anchored (T12:00:00Z + Intl timeZone:"UTC") so they
// return identical results under any server TZ — the date-only off-by-one guard.
test.describe("camp-reminder schedule helpers", () => {
  test("addDaysIso steps whole days without off-by-one", () => {
    expect(addDaysIso("2026-06-26", 3)).toBe("2026-06-29");
    expect(addDaysIso("2026-07-17", 3)).toBe("2026-07-20");
  });

  test("upcomingCampForReminder matches the Friday → Monday camp", () => {
    expect(upcomingCampForReminder("2026-06-26", CAMPS)?.slug).toBe("june-29");
    expect(upcomingCampForReminder("2026-07-17", CAMPS)?.slug).toBe("july-20");
  });

  test("upcomingCampForReminder is a safe no-op on a Friday with no camp Monday", () => {
    expect(upcomingCampForReminder("2026-06-19", CAMPS)).toBeNull();
    // A non-Friday run (wrong gap) also returns null rather than a wrong week.
    expect(upcomingCampForReminder("2026-06-27", CAMPS)).toBeNull();
  });

  // Backstop for the Notion Camp Roster read-model — unlike
  // upcomingCampForReminder's single-day match, this covers a whole window
  // (startDate - 7 days through the rain/makeup day) so a daily cron catches a
  // checkout completed after the one-shot Friday reminder already ran (the bug
  // that dropped Logan/Louis from the june-29 roster on 2026-06-30) — including
  // a checkout completed on the makeup day itself.
  test("campsNeedingRosterSync includes a camp from a week before it starts through its makeup day", () => {
    // june-29: startDate 2026-06-29, endDate 2026-07-02, makeupDate 2026-07-03
    // → window [06-22, 07-03].
    expect(campsNeedingRosterSync("2026-06-22", CAMPS).map((c) => c.slug)).toEqual(["june-29"]);
    expect(campsNeedingRosterSync("2026-06-30", CAMPS).map((c) => c.slug)).toEqual(["june-29"]);
    expect(campsNeedingRosterSync("2026-07-02", CAMPS).map((c) => c.slug)).toEqual(["june-29"]);
    expect(campsNeedingRosterSync("2026-07-03", CAMPS).map((c) => c.slug)).toEqual(["june-29"]);
  });

  test("campsNeedingRosterSync excludes a camp just outside its window on either edge", () => {
    expect(campsNeedingRosterSync("2026-06-21", CAMPS).map((c) => c.slug)).not.toContain("june-29");
    expect(campsNeedingRosterSync("2026-07-04", CAMPS).map((c) => c.slug)).not.toContain("june-29");
  });

  test("campsNeedingRosterSync returns [] when no camp's window is live", () => {
    expect(campsNeedingRosterSync("2026-08-01", CAMPS)).toEqual([]);
  });

  test("formats the start day + weekday from an ISO date", () => {
    expect(formatCampDayLong("2026-06-29")).toBe("Monday, June 29");
    expect(formatCampWeekday("2026-06-29")).toBe("Monday");
    expect(formatCampDayLong("2026-07-03")).toBe("Friday, July 3");
  });

  test("resolveCampWhere builds the exact venue block from camps.ts", () => {
    const camp = findCampBySlug("june-29")!;
    const where = resolveCampWhere(camp);
    expect(where).toContain("Gaithersburg High School — outdoor courts");
    expect(where).toContain("314 South Frederick Ave");
    // Exact venue comes from camps.ts, never Stripe metadata.
    expect(where).not.toContain("undefined");
  });
});

test.describe("collectPaidCampSessions", () => {
  function stub(sessions: Stripe.Checkout.Session[]): CampSessionSource {
    return {
      checkout: {
        sessions: { list: () => (async function* () { yield* sessions; })() },
      },
    };
  }

  test("trims stray whitespace on parent/child free-text fields", async () => {
    const session = {
      id: "cs_trim_1",
      payment_status: "paid",
      created: 1_750_000_000,
      customer_email: "  parent@example.com ",
      customer_details: { email: "  parent@example.com " },
      metadata: {
        kind: "camp",
        camp_slug: "june-29",
        parent_name: " Smruti ",
        parent_phone: " 3015550100 ",
        child_first_name: "Krishav ",
      },
    } as unknown as Stripe.Checkout.Session;

    const { entries } = await collectPaidCampSessions("june-29", stub([session]));
    expect(entries).toHaveLength(1);
    expect(entries[0].childFirstName).toBe("Krishav");
    expect(entries[0].parentName).toBe("Smruti");
    expect(entries[0].parentEmail).toBe("parent@example.com");
    expect(entries[0].parentPhone).toBe("3015550100");
  });

  test("only collects paid camp sessions matching the slug", async () => {
    const sessions = [
      { id: "a", payment_status: "paid", metadata: { kind: "camp", camp_slug: "june-29", child_first_name: "A" } },
      { id: "b", payment_status: "unpaid", metadata: { kind: "camp", camp_slug: "june-29", child_first_name: "B" } },
      { id: "c", payment_status: "paid", metadata: { kind: "camp", camp_slug: "july-20", child_first_name: "C" } },
      { id: "d", payment_status: "paid", metadata: { kind: "dropin", child_first_name: "D" } },
    ] as unknown as Stripe.Checkout.Session[];
    const { entries } = await collectPaidCampSessions("june-29", stub(sessions));
    expect(entries.map((e) => e.stripeSessionId)).toEqual(["a"]);
  });

  test("excludes camp sessions whose charge was fully refunded", async () => {
    // A refunded Checkout Session still reports payment_status:"paid" (the
    // refund lands on the charge). The roster read-model must drop it, or a
    // cancelled camper reappears on the next Friday sync.
    const sessions = [
      {
        id: "keep",
        payment_status: "paid",
        metadata: { kind: "camp", camp_slug: "july-20", child_first_name: "Keep" },
        payment_intent: { latest_charge: { refunded: false } },
      },
      {
        id: "refunded",
        payment_status: "paid",
        metadata: { kind: "camp", camp_slug: "july-20", child_first_name: "Bear" },
        payment_intent: { latest_charge: { refunded: true } },
      },
    ] as unknown as Stripe.Checkout.Session[];
    const { entries } = await collectPaidCampSessions("july-20", stub(sessions));
    expect(entries.map((e) => e.stripeSessionId)).toEqual(["keep"]);
  });
});
