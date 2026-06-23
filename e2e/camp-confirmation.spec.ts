import { test, expect } from "@playwright/test";
import {
  buildCampConfirmationEmail,
  type CampConfirmationInput,
} from "../src/lib/email/camp-confirmation";

// Exact-venue path: the webhook resolves camps.ts `exactLocation` into a
// two-line "Where" block. This is the production case (both 2026 camps have a
// populated exactLocation).
const exactVenue: CampConfirmationInput = {
  parentFirst: "Hun",
  childFirst: "Zoe",
  campTitle: "Summer Camp — Week 1",
  campWeek: "June 29 – July 2, 2026",
  optionLabel: "Full week (Mon–Thu)",
  optionHours: "9:30 AM – 12:30 PM",
  amountUsd: "150.00",
  location:
    "Gaithersburg High School — outdoor courts\n314 South Frederick Ave, Gaithersburg, MD 20877",
};

// Fallback path: exactLocation empty ("until booked") → broad area only.
const fallback: CampConfirmationInput = {
  ...exactVenue,
  location: "Gaithersburg, MD — we'll email the exact site before camp starts.",
};

test.describe("buildCampConfirmationEmail — subject", () => {
  test("names the camp and does not lead with the brand", () => {
    const { subject } = buildCampConfirmationEmail(exactVenue);
    expect(subject).toBe("You're registered — Summer Camp — Week 1");
    expect(subject.startsWith("Next Gen")).toBe(false);
  });
});

test.describe("buildCampConfirmationEmail — exact-venue body", () => {
  test("reveals the full street address and venue name", () => {
    const { text } = buildCampConfirmationEmail(exactVenue);
    expect(text).toContain("Gaithersburg High School");
    expect(text).toContain("314 South Frederick Ave, Gaithersburg, MD 20877");
  });

  test("tells parents it's outdoors with shade + a water cooler, rain or shine", () => {
    const { text } = buildCampConfirmationEmail(exactVenue);
    expect(text).toMatch(/outdoor/i);
    expect(text).toContain("shade");
    expect(text).toContain("water cooler");
    expect(text).toContain("rain or shine");
  });

  test("carries the parent/child, camp details, amount and Coach Sam signoff", () => {
    const { text } = buildCampConfirmationEmail(exactVenue);
    expect(text).toContain("Hi Hun,");
    expect(text).toContain("Zoe is registered");
    expect(text).toContain("June 29 – July 2, 2026");
    expect(text).toContain("Full week (Mon–Thu) · 9:30 AM – 12:30 PM");
    expect(text).toContain("Paid: $150.00");
    expect(text).toContain("Coach Sam · Next Gen Pickleball Academy");
  });

  test("does not duplicate a standalone rain-or-shine line", () => {
    const { text } = buildCampConfirmationEmail(exactVenue);
    expect(text).not.toContain("Camp runs rain or shine.");
  });
});

test.describe("buildCampConfirmationEmail — fallback body", () => {
  test("uses the broad-area line and never leaks a street address", () => {
    const { text } = buildCampConfirmationEmail(fallback);
    expect(text).toContain(
      "Gaithersburg, MD — we'll email the exact site before camp starts.",
    );
    expect(text).not.toContain("314 South Frederick Ave");
  });
});
