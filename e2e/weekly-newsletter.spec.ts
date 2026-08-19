import { test, expect } from "@playwright/test";
import {
  weeklyNewsletterHtml,
  weeklyNewsletterText,
  type WeeklyNewsletterInput,
} from "../src/lib/email/weekly-newsletter";
import { appendUtm } from "../src/lib/email/utm";
import { CAMP_OPTIONS, CAMPS } from "../src/data/camps";
import { MVF_TOURNAMENT, mvfTournamentIsUpcoming } from "../src/data/mvf";
import {
  COACH_PHONE_DISPLAY,
  WHATSAPP_LD_GROUP_URL,
  WHATSAPP_NGA_GROUP_URL,
} from "../src/lib/email/signature";

const tip = { title: "Soft hands win", body: "Loosen the grip." };
const ORIGIN = "https://nextgenpbacademy.com";

const baseInput: WeeklyNewsletterInput = {
  parentFirst: "Lauren",
  mvfTournament: null,
  sessions: [
    {
      dateLong: "Saturday, May 23",
      location: "Walter Johnson HS, Bethesda",
      weatherNote: "Sunny, 75°",
      slots: [
        { label: "4:30–5:30 PM", registered: 4, goal: 16 },
        { label: "5:30–6:30 PM", registered: 14, goal: 16 },
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
  utmCampaign: "weekly-2026-06-04",
  camps: [],
  campUrl: `${ORIGIN}/camp`,
  campAgeMin: 8,
  campPriceFromUsd: 50,
};

test.describe("appendUtm", () => {
  test("appends utm params to a bare path", () => {
    expect(appendUtm("https://x.com/schedule", "schedule", "weekly-2026-06-04")).toBe(
      "https://x.com/schedule?utm_source=newsletter&utm_medium=email&utm_campaign=weekly-2026-06-04&utm_content=schedule",
    );
  });

  test("uses & when the url already has a query string", () => {
    expect(appendUtm("https://x.com/newsletter?ref=abc", "referral", "wk")).toBe(
      "https://x.com/newsletter?ref=abc&utm_source=newsletter&utm_medium=email&utm_campaign=wk&utm_content=referral",
    );
  });

  test("inserts the query before a #hash so the anchor still jumps", () => {
    expect(appendUtm("https://x.com/#contact-form", "eval", "wk")).toBe(
      "https://x.com/?utm_source=newsletter&utm_medium=email&utm_campaign=wk&utm_content=eval#contact-form",
    );
  });
});

test.describe("weeklyNewsletterHtml", () => {
  test("renders the fill meter, weather, and unsubscribe", () => {
    const html = weeklyNewsletterHtml(baseInput);
    expect(html).toContain("4 of 16 in");
    expect(html).toContain("14 of 16 in — 2 to go");
    expect(html).toContain("▰▰▰▰");
    expect(html).toContain("Forecast: Sunny, 75°");
    expect(html).toContain("/api/newsletter/unsubscribe?token=abc");
  });

  test("never frames seats as spots left", () => {
    const html = weeklyNewsletterHtml(baseInput);
    expect(html).not.toContain("spots left");
    expect(html).not.toContain("spot left");
  });

  test("personalized forward link surfaces with the 50% referral offer", () => {
    const html = weeklyNewsletterHtml(baseInput);
    expect(html).toContain("Bring a friend");
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
    expect(noPolls).toContain("Want a regular group?");
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
    expect(withPolls).toContain("Forming groups now");
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
    expect(html).toContain("2 in · need 2 more to lock it in");
  });

  test("private-lessons card routes to the free evaluation form", () => {
    const html = weeklyNewsletterHtml(baseInput);
    expect(html).toContain("Brand new to a court?");
    // UTM query is inserted before the #hash so the anchor still jumps.
    expect(html).toContain(`${ORIGIN}/?utm_source=newsletter`);
    expect(html).toContain("utm_content=eval");
    expect(html).toContain("#contact-form");
    expect(html).toContain("Get a free evaluation");
  });

  test("internal CTA links carry first-party UTM tags for click attribution", () => {
    const html = weeklyNewsletterHtml({
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
    // Poll + eval links built inside the template get stamped with the campaign.
    expect(html).toContain(
      `${ORIGIN}/poll/sat-4pm-green?utm_source=newsletter&utm_medium=email&utm_campaign=weekly-2026-06-04&utm_content=poll`,
    );
    expect(html).toContain("utm_campaign=weekly-2026-06-04");
    // The referral forward link stays clean (own ref attribution, shown verbatim).
    expect(html).toContain(`${ORIGIN}/newsletter?ref=signed-token-abc"`);
    // Unsubscribe link is never UTM-tagged.
    expect(html).not.toContain("unsubscribe?token=abc&utm");
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

  test("hides the camp block when there are no upcoming camps", () => {
    expect(weeklyNewsletterHtml(baseInput)).not.toContain("Summer camp");
  });

  test("the camp 'from' price is derived from CAMP_OPTIONS and is $50", () => {
    // Load-bearing: the cron computes campPriceFromUsd = Math.min(CAMP_OPTIONS
    // price). This asserts the real data, not a test-supplied input — so it
    // fails if camps.ts ever drifts off $50.
    expect(Math.min(...CAMP_OPTIONS.map((o) => o.priceUsd))).toBe(50);
  });

  test("renders the camp block with weeks, price tease, and a UTM-stamped /camp link", () => {
    const html = weeklyNewsletterHtml({
      ...baseInput,
      camps: [
        { weekLabel: "June 29 – July 2, 2026", publicArea: "Gaithersburg, MD" },
        { weekLabel: "July 20 – July 23, 2026", publicArea: "Gaithersburg, MD" },
      ],
    });
    expect(html).toContain("Summer camp");
    expect(html).toContain("ages 8+");
    expect(html).toContain("June 29 – July 2, 2026");
    expect(html).toContain("July 20 – July 23, 2026");
    expect(html).toContain("From $50/day");
    // campUrl is UTM-stamped by the cron (like scheduleUrl); the template
    // renders whatever it's handed. Assert the passed-in link appears.
    expect(html).toContain(`href="${ORIGIN}/camp"`);
  });

  test("each camp's area comes from its own row, never a hardcoded city", () => {
    // Load-bearing: the block used to hardcode "mornings in Gaithersburg" in
    // the intro line, so the Aug 17–20 Rockville camp would have advertised
    // the wrong city. Area is per-row now — a camp at a new venue can't
    // inherit a stale one.
    const input = {
      ...baseInput,
      camps: [{ weekLabel: "August 17 – August 20, 2026", publicArea: "Rockville, MD" }],
    };
    for (const rendered of [weeklyNewsletterHtml(input), weeklyNewsletterText(input)]) {
      expect(rendered).toContain("August 17 – August 20, 2026");
      expect(rendered).toContain("Rockville, MD");
      expect(rendered).not.toContain("Gaithersburg");
    }
  });

  test("the upcoming-camp list matches CAMPS filtered by end date, and the Aug 17 camp is in Rockville", () => {
    // Mirrors the cron's `CAMPS.filter((c) => c.endDate >= todayIso)` so the
    // spec fails if camps.ts drifts (a renamed slug, a moved venue, a camp
    // whose endDate stops covering the send week).
    const aug = CAMPS.find((c) => c.slug === "august-17");
    expect(aug).toBeDefined();
    expect(aug!.endDate).toBe("2026-08-20");
    expect(aug!.publicArea).toBe("Rockville, MD");
    // On any date during the send week the block carries exactly this camp.
    const upcoming = CAMPS.filter((c) => c.endDate >= "2026-08-06");
    expect(upcoming.map((c) => c.slug)).toEqual(["august-17"]);
  });

  // ---- MVF tournament highlight (top block until the event) ----

  // Mirrors the cron's projection of MVF_TOURNAMENT.
  const mvfInput: WeeklyNewsletterInput = {
    ...baseInput,
    mvfTournament: {
      title: "MVF Pickleball Tournament by Link and Dink",
      dateLabel: "Saturday, September 5, 2026",
      timeLabel: "8:30 AM – 3:00 PM",
      venueLine: "Apple Ridge Pickleball Courts, Montgomery Village",
      ageMin: 9,
      format: "Same-partner round robin into single elimination",
      bracketsLabel: "Playing / Competing / Tournament Level",
      priceResidentUsd: 25,
      priceNonResidentUsd: 35,
      rainDateLabel: "Sunday, September 6",
      url: "https://p3.linkanddink.com/popup/mvf-pickleball-tournament-2026?utm_source=newsletter",
    },
  };

  test("renders the tournament block in HTML and text with date, brackets, real prices, and rain date", () => {
    for (const rendered of [weeklyNewsletterHtml(mvfInput), weeklyNewsletterText(mvfInput)]) {
      expect(rendered).toContain("MVF Pickleball Tournament by Link and Dink");
      expect(rendered).toContain("Saturday, September 5, 2026");
      expect(rendered).toContain("Playing / Competing / Tournament Level");
      expect(rendered).toContain("$25");
      expect(rendered).toContain("$35");
      expect(rendered).toContain("partner required");
      expect(rendered).toContain("Sunday, September 6");
      expect(rendered).toContain(
        "https://p3.linkanddink.com/popup/mvf-pickleball-tournament-2026?utm_source=newsletter",
      );
    }
  });

  test("the tournament block leads the issue — above the sessions block", () => {
    const html = weeklyNewsletterHtml(mvfInput);
    expect(html.indexOf("Tournament day")).toBeGreaterThan(-1);
    expect(html.indexOf("Tournament day")).toBeLessThan(
      html.indexOf("This week&rsquo;s sessions"),
    );
    // Same when there are no open sessions (fallback card).
    const noSessions = weeklyNewsletterHtml({ ...mvfInput, sessions: [] });
    expect(noSessions.indexOf("Tournament day")).toBeLessThan(
      noSessions.indexOf("No open sessions this week"),
    );
  });

  test("hides the tournament block entirely when null", () => {
    expect(weeklyNewsletterHtml(baseInput)).not.toContain("Tournament day");
    expect(weeklyNewsletterText(baseInput)).not.toContain("Tournament day");
  });

  test("mvfTournamentIsUpcoming promotes through the rain date, then stops", () => {
    expect(mvfTournamentIsUpcoming("2026-08-13")).toBe(true);
    expect(mvfTournamentIsUpcoming("2026-09-05")).toBe(true);
    expect(mvfTournamentIsUpcoming("2026-09-06")).toBe(true);
    expect(mvfTournamentIsUpcoming("2026-09-07")).toBe(false);
  });

  test("MVF tournament data matches the live L&D event (drift guard)", () => {
    // The brackets label must match what L&D's registration actually offers
    // (community-os migration 20260801161136 fixed the stale
    // Advanced Beginner / Intermediate / Advanced set).
    expect([...MVF_TOURNAMENT.brackets]).toEqual([
      "Playing",
      "Competing",
      "Tournament Level",
    ]);
    expect(MVF_TOURNAMENT.rainDate).toBe("2026-09-06");
    expect(MVF_TOURNAMENT.venue.name).toBe("Apple Ridge Pickleball Courts");
    expect(MVF_TOURNAMENT.prices.map((p) => p.usd)).toEqual([25, 35]);
  });

  test("no parent-facing copy uses the word 'crew'", () => {
    const html = weeklyNewsletterHtml({
      ...baseInput,
      camps: [{ weekLabel: "June 29 – July 2, 2026", publicArea: "Gaithersburg, MD" }],
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
    // The /crew route still appears in hrefs; assert no visible "crew" word by
    // checking the human copy phrases that used to carry it are gone.
    expect(html).not.toContain("Forming crews");
    expect(html).not.toContain("regular crew");
    expect(html).not.toContain("Bring the crew");
    expect(html).not.toContain("join a crew");
    expect(html).not.toContain("lock the crew");
  });
});

test.describe("weeklyNewsletterText", () => {
  test("mirrors the fill meter, weather, and referral block in plain text", () => {
    const text = weeklyNewsletterText(baseInput);
    expect(text).toContain("14 of 16 in — 2 to go");
    expect(text).toContain("▰▰▰▰▱");
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
    expect(text).toContain("Forming groups now:");
    expect(text).toContain("Sat 4pm Bethesda — Green");
    expect(text).toContain(`${ORIGIN}/poll/sat-4pm-green`);
    expect(text).toContain("None of those fit?");
  });
});

test.describe("weekly newsletter — community WhatsApp invites", () => {
  // Regression: the HTML used to compose the invites INSIDE the conditional
  // "From Coach Sam this week" lead card, so a week with no Approved Notion
  // draft — the normal week — shipped with no WhatsApp link at all, while the
  // plain-text part had them in the footer. baseInput sets no lead draft.
  test("both invites ship even when no lead draft is approved", () => {
    const html = weeklyNewsletterHtml(baseInput);
    const text = weeklyNewsletterText(baseInput);
    for (const url of [WHATSAPP_NGA_GROUP_URL, WHATSAPP_LD_GROUP_URL]) {
      expect(html.split(url).length - 1, `${url} once in html`).toBe(1);
      expect(text.split(url).length - 1, `${url} once in text`).toBe(1);
    }
  });

  test("the invites sit above the sessions block, not in the footer", () => {
    const html = weeklyNewsletterHtml(baseInput);
    const sessions = html.indexOf("This week&rsquo;s sessions");
    expect(sessions).toBeGreaterThan(-1);
    for (const url of [WHATSAPP_NGA_GROUP_URL, WHATSAPP_LD_GROUP_URL]) {
      expect(html.indexOf(url)).toBeLessThan(sessions);
    }

    const text = weeklyNewsletterText(baseInput);
    const textSessions = text.indexOf("This week's sessions");
    expect(textSessions).toBeGreaterThan(-1);
    for (const url of [WHATSAPP_NGA_GROUP_URL, WHATSAPP_LD_GROUP_URL]) {
      expect(text.indexOf(url)).toBeLessThan(textSessions);
    }
  });

  test("the footer keeps Coach Sam's phone", () => {
    expect(weeklyNewsletterHtml(baseInput)).toContain(COACH_PHONE_DISPLAY);
    expect(weeklyNewsletterText(baseInput)).toContain(COACH_PHONE_DISPLAY);
  });

  test("an approved lead draft does not add a second copy", () => {
    const html = weeklyNewsletterHtml({
      ...baseInput,
      newsletterLeadHtml: "<p>Draft copy.</p>",
      newsletterLeadText: "Draft copy.",
    });
    for (const url of [WHATSAPP_NGA_GROUP_URL, WHATSAPP_LD_GROUP_URL]) {
      expect(html.split(url).length - 1, `${url} once in html`).toBe(1);
    }
  });
});
