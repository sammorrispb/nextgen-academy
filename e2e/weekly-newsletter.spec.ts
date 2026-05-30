import { test, expect } from "@playwright/test";
import {
  spotsLabel,
  weeklyNewsletterHtml,
  weeklyNewsletterText,
  type WeeklyNewsletterInput,
} from "../src/lib/email/weekly-newsletter";

const tip = { title: "Soft hands win", body: "Loosen the grip." };
const ORIGIN = "https://nextgenpbacademy.com";

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
  summerSessions: [],
  openPolls: [],
  news: [],
  tip,
  scheduleUrl: `${ORIGIN}/schedule`,
  crewInterestUrl: `${ORIGIN}/crew`,
  unsubscribeUrl: `${ORIGIN}/api/newsletter/unsubscribe?token=abc`,
  referralUrl: `${ORIGIN}/newsletter?ref=signed-token-abc`,
  origin: ORIGIN,
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
  test("renders spots, weather, and unsubscribe", () => {
    const html = weeklyNewsletterHtml(baseInput);
    expect(html).toContain("12 of 16 spots left");
    expect(html).toContain("only 2 spots left");
    expect(html).toContain("Forecast: Sunny, 75°");
    expect(html).toContain("/api/newsletter/unsubscribe?token=abc");
  });

  test("personalized forward link surfaces with the 50% referral offer", () => {
    const html = weeklyNewsletterHtml(baseInput);
    expect(html).toContain("Bring the crew");
    expect(html).toContain("50% off");
    expect(html).toContain("/newsletter?ref=signed-token-abc");
  });

  test("falls back to generic forward ask when no referral URL is configured", () => {
    const html = weeklyNewsletterHtml({ ...baseInput, referralUrl: null });
    expect(html).not.toMatch(/\?ref=/);
    expect(html).toContain("Forward this email");
  });

  test("crew interest CTA always renders, with copy that adapts to poll presence", () => {
    const noPolls = weeklyNewsletterHtml(baseInput);
    expect(noPolls).toContain("Want a regular crew?");
    expect(noPolls).toContain(`${ORIGIN}/crew`);

    const withPolls = weeklyNewsletterHtml({
      ...baseInput,
      openPolls: [
        {
          title: "Sat 4pm Bethesda — Green",
          slug: "sat-4pm-green",
          day: "Sat",
          startTime: "4:00 PM",
          endTime: "5:00 PM",
          location: "Walter Johnson HS",
          level: "Green",
          minPartySize: 4,
          yesCount: 2,
        },
      ],
    });
    expect(withPolls).toContain("Forming crews now");
    expect(withPolls).toContain("Sat 4pm Bethesda — Green");
    expect(withPolls).toContain(`${ORIGIN}/poll/sat-4pm-green`);
    expect(withPolls).toContain("None of these fit?");
  });

  test("poll progress label reflects yes-count vs minPartySize", () => {
    const html = weeklyNewsletterHtml({
      ...baseInput,
      openPolls: [
        {
          title: "Tue 5pm Rockville",
          slug: "tue-5pm",
          day: "Tue",
          startTime: "5:00 PM",
          endTime: "6:00 PM",
          location: "RM HS",
          level: "Orange",
          minPartySize: 4,
          yesCount: 2,
        },
      ],
    });
    expect(html).toContain("2 in · need 2 more to lock the crew");
  });

  test("private-lessons card routes to the free evaluation form", () => {
    const html = weeklyNewsletterHtml(baseInput);
    expect(html).toContain("Brand new to a court?");
    expect(html).toContain(`${ORIGIN}/#contact-form`);
    expect(html).toContain("Get a free evaluation");
  });

  test("quotes no hard prices in session/tip/CTA blocks (drop-in $40 stays on /schedule only)", () => {
    // Allow "50% off" in the referral block but no dollar prices.
    const html = weeklyNewsletterHtml(baseInput);
    expect(html).not.toMatch(/\$\d/);
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

  test("news block renders Approved items with title link + source + summary", () => {
    const html = weeklyNewsletterHtml({
      ...baseInput,
      news: [
        {
          title: "Bethesda middle school launches pickleball PE unit",
          url: "https://example.com/article",
          source: "Bethesda Beat",
          summary: "Three schools added paddle sports this spring.",
        },
        {
          title: "Junior tournament returns to MoCo",
          url: "https://example.com/jr",
          source: "USA Pickleball",
          summary: "",
        },
      ],
    });
    expect(html).toContain("In the news: youth pickleball");
    expect(html).toContain("Bethesda middle school launches pickleball PE unit");
    expect(html).toContain("https://example.com/article");
    expect(html).toContain("Bethesda Beat");
    expect(html).toContain("Three schools added paddle sports this spring.");
    expect(html).toContain("Junior tournament returns to MoCo");
    expect(html).toContain("Read the story");
  });

  test("news block is hidden entirely when no approved items", () => {
    const html = weeklyNewsletterHtml(baseInput);
    expect(html).not.toContain("In the news");
  });

  test("hides the summer block when there are no summer sessions", () => {
    expect(weeklyNewsletterHtml(baseInput)).not.toContain(
      "Summer sessions are live",
    );
  });

  test("renders the summer block with a sign-up CTA when present", () => {
    const withSummer: WeeklyNewsletterInput = {
      ...baseInput,
      summerSessions: [
        {
          dateLong: "Saturday, July 18",
          location: "Walter Johnson HS, Bethesda",
          slots: [],
        },
      ],
    };
    const html = weeklyNewsletterHtml(withSummer);
    expect(html).toContain("Summer sessions are live");
    expect(html).toContain("Saturday, July 18");
    expect(html).toContain("Sign up for summer");
  });
});

test.describe("weeklyNewsletterText", () => {
  test("mirrors spots, weather, and referral block in plain text", () => {
    const text = weeklyNewsletterText(baseInput);
    expect(text).toContain("only 2 spots left");
    expect(text).toContain("Forecast: Sunny, 75°");
    expect(text).toContain("50% off");
    expect(text).toContain("/newsletter?ref=signed-token-abc");
    expect(text).toContain(
      "Unsubscribe: https://nextgenpbacademy.com/api/newsletter/unsubscribe",
    );
  });

  test("mirrors the news block in plain text when approved items exist", () => {
    const text = weeklyNewsletterText({
      ...baseInput,
      news: [
        {
          title: "Bethesda middle school launches pickleball PE unit",
          url: "https://example.com/article",
          source: "Bethesda Beat",
          summary: "Three schools added paddle sports this spring.",
        },
      ],
    });
    expect(text).toContain("In the news: youth pickleball");
    expect(text).toContain("Bethesda middle school launches pickleball PE unit");
    expect(text).toContain("(Bethesda Beat)");
    expect(text).toContain("https://example.com/article");
  });

  test("mirrors the summer block in plain text with a sign-up link", () => {
    const text = weeklyNewsletterText({
      ...baseInput,
      summerSessions: [
        {
          dateLong: "Saturday, July 18",
          location: "Walter Johnson HS, Bethesda",
          slots: [],
        },
      ],
    });
    expect(text).toContain("Summer sessions are live:");
    expect(text).toContain("Saturday, July 18");
    expect(text).toContain(`Sign up for summer: ${ORIGIN}/schedule`);
  });

  test("mirrors the polls block in plain text", () => {
    const text = weeklyNewsletterText({
      ...baseInput,
      openPolls: [
        {
          title: "Sat 4pm Bethesda — Green",
          slug: "sat-4pm-green",
          day: "Sat",
          startTime: "4:00 PM",
          endTime: "5:00 PM",
          location: "Walter Johnson HS",
          level: "Green",
          minPartySize: 4,
          yesCount: 1,
        },
      ],
    });
    expect(text).toContain("Forming crews now:");
    expect(text).toContain("Sat 4pm Bethesda — Green");
    expect(text).toContain(`${ORIGIN}/poll/sat-4pm-green`);
    expect(text).toContain("None of those fit?");
  });
});
