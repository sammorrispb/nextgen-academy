import { test, expect } from "@playwright/test";
import {
  spotsLabel,
  weeklyNewsletterHtml,
  weeklyNewsletterText,
  type WeeklyNewsletterInput,
} from "../src/lib/email/weekly-newsletter";

const tip = { title: "Soft hands win", body: "Loosen the grip." };

const baseInput: WeeklyNewsletterInput = {
  parentFirst: "Lauren",
  sessions: [
    {
      dateLong: "Saturday, May 23",
      location: "Walter Johnson HS, Bethesda",
      weatherNote: "Sunny, 75°",
      slots: [
        { label: "4:30–5:30 PM", spotsLeft: 12, capacity: 16 },
        { label: "5:30–6:30 PM", spotsLeft: 2, capacity: 16 },
      ],
    },
  ],
  tip,
  scheduleUrl: "https://nextgenpbacademy.com/schedule",
  unsubscribeUrl: "https://nextgenpbacademy.com/api/newsletter/unsubscribe?token=abc",
};

test.describe("spotsLabel", () => {
  test("shows X of Y when plenty remain", () => {
    expect(spotsLabel(12, 16)).toBe("12 of 16 spots left");
  });
  test("adds urgency at 3 or fewer", () => {
    expect(spotsLabel(3, 16)).toBe("only 3 spots left");
    expect(spotsLabel(1, 16)).toBe("only 1 spot left");
  });
  test("says Full at zero", () => {
    expect(spotsLabel(0, 16)).toBe("Full");
  });
});

test.describe("weeklyNewsletterHtml", () => {
  test("renders spots, weather, forward line, and unsubscribe", () => {
    const html = weeklyNewsletterHtml(baseInput);
    expect(html).toContain("12 of 16 spots left");
    expect(html).toContain("only 2 spots left");
    expect(html).toContain("Forecast: Sunny, 75°");
    expect(html).toContain("bring a friend and you both play for crew price");
    expect(html).toContain("/api/newsletter/unsubscribe?token=abc");
  });

  test("quotes no hard prices (teased, not quoted)", () => {
    expect(weeklyNewsletterHtml(baseInput)).not.toMatch(/\$\d/);
  });

  test("omits the forecast line when no weather note is present", () => {
    const noWeather = {
      ...baseInput,
      sessions: [{ ...baseInput.sessions[0], weatherNote: undefined }],
    };
    expect(weeklyNewsletterHtml(noWeather)).not.toContain("Forecast:");
  });

  test("falls back to a tip-only issue with no sessions", () => {
    const empty = { ...baseInput, sessions: [] };
    const html = weeklyNewsletterHtml(empty);
    expect(html).toContain("No open sessions this week");
    expect(html).toContain("Soft hands win");
  });
});

test.describe("weeklyNewsletterText", () => {
  test("mirrors spots + weather + forward line in plain text", () => {
    const text = weeklyNewsletterText(baseInput);
    expect(text).toContain("only 2 spots left");
    expect(text).toContain("Forecast: Sunny, 75°");
    expect(text).toContain("bring a friend and you both play for crew price");
    expect(text).toContain("Unsubscribe: https://nextgenpbacademy.com/api/newsletter/unsubscribe");
  });
});
