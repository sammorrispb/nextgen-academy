import { test, expect } from "@playwright/test";
import {
  weeklyNewsletterHtml,
  weeklyNewsletterText,
  weeklyNewsletterSubject,
  weeklyNewsletterPreview,
  newsletterHighlights,
  fallSpotsLabel,
  type WeeklyNewsletterInput,
} from "../src/lib/email/weekly-newsletter";
import { picklParkNewsletterProgress } from "../src/lib/newsletter-season-progress";
import { appendUtm } from "../src/lib/email/utm";
import { newsletterPrograms } from "../src/lib/newsletter-programs";
import { CAMP_OPTIONS, CAMPS, upcomingCamps } from "../src/data/camps";
import {
  FALL_SEASON_LABEL,
  FALL_SEASON_WEEKS,
  FALL_SUNDAYS,
} from "../src/data/fall-2026";
import {
  FALL_SEASON_GROUPS,
  FALL_SEASON_PRICE_USD,
  fallSeasonSlotsFor,
  FALL_SEASON_TITLE,
} from "../src/data/fall-season-2026";
import {
  PICKLPARK_INDOOR_NOTE,
  PICKLPARK_SATURDAYS,
  PICKLPARK_SEASON_LABEL,
  PICKLPARK_SEASON_WEEKS,
  PICKLPARK_SESSION_FORMAT,
} from "../src/data/picklpark-2026";
import {
  PICKLPARK_LEAGUES,
  PICKLPARK_LEAGUES_FORMAT_LINE,
} from "../src/data/picklpark-leagues-2026";
import {
  COACH_PHONE_DISPLAY,
  WHATSAPP_LD_GROUP_URL,
  WHATSAPP_NGA_GROUP_URL,
} from "../src/lib/email/signature";

const tip = { title: "Soft hands win", body: "Loosen the grip." };
const ORIGIN = "https://nextgenpbacademy.com";

const baseInput: WeeklyNewsletterInput = {
  parentFirst: "Lauren",
  fallSeason: null,
  sessions: [
    {
      dateLong: "Saturday, May 23",
      location: "Walter Johnson HS, Bethesda",
      weatherNote: "Sunny, 75°",
      slots: [
        { label: "4:30–5:30 PM" },
        { label: "5:30–6:30 PM" },
      ],
    },
  ],
  laterSessions: [],
  openPolls: [],
  tip,
  scheduleUrl: `${ORIGIN}/schedule`,
  crewInterestUrl: `${ORIGIN}/crew`,
  unsubscribeUrl: `${ORIGIN}/api/newsletter/unsubscribe?token=abc`,
  origin: ORIGIN,
  utmCampaign: "weekly-2026-06-04",
  camps: [],
  campUrl: `${ORIGIN}/camp`,
  campAgeMin: 8,
  campPriceFromUsd: 50,
};

test("program announcements have HTML/text parity and safe escaping", () => {
  const programs = newsletterPrograms("2026-10-01", ORIGIN, "weekly-2026-10-01");
  const html = weeklyNewsletterHtml({ ...baseInput, programs });
  const text = weeklyNewsletterText({ ...baseInput, programs });
  for (const p of programs) {
    expect(text).toContain(p.title);
    expect(text).toContain(p.body);
    expect(html).toContain(p.title);
    if (p.url) {
      expect(text).toContain(p.url);
      expect(html).toContain(p.url.replaceAll("&", "&amp;"));
    }
  }
  const unsafe = weeklyNewsletterHtml({ ...baseInput, programs: [{ section: "join", title: "<script>", body: "<img src=x>" }] });
  expect(unsafe).not.toContain("<script>");
  expect(unsafe).toContain("&lt;img src=x&gt;");
});

test("enrollment explanation covers CRM families and preserves unsubscribe", () => {
  for (const body of [weeklyNewsletterHtml(baseInput), weeklyNewsletterText(baseInput)]) {
    expect(body).toContain("connected with us through an inquiry or program");
    expect(body).not.toContain("because you joined the Next Gen newsletter");
    expect(body).toContain(baseInput.unsubscribeUrl);
  }
});

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

const poll = (title: string, yesCount: number) => ({
  title,
  slug: "sat-4pm-green",
  day: "Sat",
  startTime: "4:00 PM",
  endTime: "5:00 PM",
  location: "Walter Johnson HS",
  level: "Green",
  minPartySize: 4,
  yesCount,
});

const fallGroups = FALL_SEASON_GROUPS.map((g) => ({
  label: g.label,
  timeLabel: g.timeLabel,
  spotsLeft: fallSeasonSlotsFor(g.group),
}));

/** The fall season before its first Sunday: registration open. */
const fallOpen = {
  title: FALL_SEASON_TITLE,
  seasonLabel: FALL_SEASON_LABEL,
  weeks: FALL_SEASON_WEEKS,
  venueLine: "Walter Johnson High School, Bethesda, MD",
  priceUsd: FALL_SEASON_PRICE_USD,
  groups: fallGroups,
  url: `${ORIGIN}/fall`,
};

/** The fall season as the Oct 29 2026 issue sees it: underway, playoff ahead. */
const fallUnderway = {
  ...fallOpen,
  progress: {
    underway: true,
    hasUpcoming: true,
    scheduleNotes: ["2 Sundays remaining: Sun, Nov 1; Sun, Nov 8."],
    makeupNotes: [],
  },
  playoffDate: "2026-11-08",
};

/** Pickl Park as the cron builds it; progress decides whether it shows. */
const picklPark = (today: string) => ({
  title: "Pickl Park Saturday Leagues",
  seasonLabel: PICKLPARK_SEASON_LABEL,
  weeks: PICKLPARK_SEASON_WEEKS,
  venueLine: "The Pickl Park, Frederick, MD",
  sessionFormat: PICKLPARK_LEAGUES_FORMAT_LINE,
  indoorNote: PICKLPARK_INDOOR_NOTE,
  groups: PICKLPARK_LEAGUES.map((l) => ({ label: `${l.title} (${l.ageLabel})`, timeLabel: l.timeLabel, spotsLeft: null })),
  url: `${ORIGIN}/picklpark`,
  progress: picklParkNewsletterProgress(today),
});

/** A realistic issue: the Thursday after this layout ships. */
const oct29: WeeklyNewsletterInput = {
  ...baseInput,
  issueDate: "2026-10-29",
  sessions: [],
  programs: newsletterPrograms("2026-10-29", ORIGIN, "weekly-2026-10-29"),
  fallSeason: fallUnderway,
  picklParkSeason: picklPark("2026-10-29"),
};

const h2s = (html: string) => [...html.matchAll(/<h2[^>]*>([^<]*)<\/h2>/g)].map((m) => m[1].replace(/&#39;/g, "'"));

test.describe("agent-friendly layout", () => {
  test("opens with a dated At a glance list, before the invites and the detail", () => {
    const html = weeklyNewsletterHtml(oct29);
    const glance = html.indexOf(">At a glance</h2>");
    expect(glance).toBeGreaterThan(-1);
    expect(glance).toBeLessThan(html.indexOf(WHATSAPP_NGA_GROUP_URL));
    expect(glance).toBeLessThan(html.indexOf(">For families enrolled now</h2>"));
    expect(html).toContain('<time datetime="2026-10-29">Week of October 29, 2026</time>');
    expect(html).toContain('<html lang="en">');
    const highlights = newsletterHighlights(oct29);
    expect(highlights.length).toBeGreaterThan(0);
    expect(highlights.length).toBeLessThanOrEqual(6);
    for (const h of highlights) expect(html).toContain(h.text.replace(/'/g, "&#39;"));
  });

  test("the Oct 29 issue leads with what families need now, and nothing that has ended", () => {
    const texts = newsletterHighlights(oct29).map((h) => h.text).join("\n");
    expect(texts).toContain("Playoff Sunday, November 8");
    expect(texts).toContain("the last session is Saturday, October 31");
    expect(texts).toContain("last class Thu, Nov 19");
    expect(texts).toMatch(/Winter: indoor plans are being finalized/);
    for (const rendered of [weeklyNewsletterHtml(oct29), weeklyNewsletterText(oct29)]) {
      expect(rendered).not.toContain("Lake Marion");
      expect(rendered).not.toContain("registration is open");
      expect(rendered).not.toContain("Drill and Play");
      expect(rendered).not.toMatch(/\$\d/);
    }
  });

  test("the subject names the issue's top two items, and never says an underway season is open", () => {
    expect(weeklyNewsletterSubject(oct29)).toBe("Next Gen this week: fall playoff Nov 8 and last Pickl Park Saturday Oct 31");
    expect(weeklyNewsletterSubject(oct29)).not.toMatch(/open/i);
    expect(weeklyNewsletterSubject({ ...baseInput, fallSeason: fallOpen, sessions: [] })).toBe("Next Gen this week: fall registration open");
    expect(weeklyNewsletterSubject(baseInput)).toBe("Next Gen this week: open sessions this week");
    expect(weeklyNewsletterSubject({ ...baseInput, sessions: [] })).toBe("Next Gen this week: Soft hands win");
    const editorial = { leadPageId: "p", subject: "Editorial subject", previewText: "Editorial preview", headline: "H", intro: "I" };
    expect(weeklyNewsletterSubject({ ...oct29, editorial })).toBe("Editorial subject");
    expect(weeklyNewsletterPreview({ ...oct29, editorial })).toBe("Editorial preview");
  });

  test("the inbox preview is the opening glance lines, cut at a word", () => {
    const preview = weeklyNewsletterPreview(oct29);
    expect(preview.startsWith(newsletterHighlights(oct29)[0].text.slice(0, 40))).toBe(true);
    expect(preview.length).toBeLessThanOrEqual(153);
    expect(weeklyNewsletterHtml(oct29)).toContain(`opacity:0;">${preview.replace(/'/g, "&#39;")}</div>`);
  });

  test("the text part carries the same sections, in the same order, as markdown headings", () => {
    for (const input of [oct29, baseInput, { ...baseInput, fallSeason: fallOpen }]) {
      const html = weeklyNewsletterHtml(input);
      const text = weeklyNewsletterText(input);
      const headings = h2s(html);
      expect(headings.length).toBeGreaterThan(3);
      let at = -1;
      for (const heading of headings) {
        const found = text.indexOf(`## ${heading}`);
        expect(found, heading).toBeGreaterThan(at);
        at = found;
      }
      for (const h of newsletterHighlights(input)) expect(text).toContain(`- ${h.text}`);
    }
  });

  test("programs sit under the section for who they are for", () => {
    const html = weeklyNewsletterHtml(oct29);
    const enrolled = html.indexOf(">For families enrolled now</h2>");
    const ways = html.indexOf(">Ways to play</h2>");
    const coming = html.indexOf(">Coming up</h2>");
    expect(enrolled).toBeGreaterThan(-1);
    expect(ways).toBeGreaterThan(enrolled);
    expect(coming).toBeGreaterThan(ways);
    const mvf = html.indexOf("Montgomery Village: Fall Session II (underway)");
    expect(mvf).toBeGreaterThan(enrolled);
    expect(mvf).toBeLessThan(ways);
    expect(html.indexOf(FALL_SEASON_TITLE)).toBeLessThan(ways);
    expect(html.indexOf("Winter: details coming soon")).toBeGreaterThan(coming);
  });

  test("no em dashes anywhere in a full issue", () => {
    // Sam's rule for public copy. Rendered with every block that can appear.
    const full: WeeklyNewsletterInput = {
      ...oct29,
      sessions: baseInput.sessions,
      laterSessions: [{ dateLong: "Saturday, November 14", location: "Walter Johnson HS, Bethesda", slots: [] }],
      camps: [{ weekLabel: "June 29 – July 2, 2026", publicArea: "Gaithersburg, MD" }],
      openPolls: [poll("Sat 4pm Bethesda, Green", 4)],
      newsletterLeadHtml: "<p>Draft copy.</p>",
      newsletterLeadText: "Draft copy.",
    };
    for (const rendered of [weeklyNewsletterHtml(full), weeklyNewsletterText(full), weeklyNewsletterHtml({ ...full, fallSeason: fallOpen })]) {
      expect(rendered).not.toContain("—");
      expect(rendered).not.toContain("&mdash;");
    }
  });
});

test.describe("weeklyNewsletterHtml", () => {
  test("renders session times, weather, and unsubscribe, with no fill meter", () => {
    const html = weeklyNewsletterHtml(baseInput);
    expect(html).toContain("4:30–5:30 PM");
    expect(html).toContain("Forecast: Sunny, 75°");
    expect(html).toContain("/api/newsletter/unsubscribe?token=abc");
    expect(html).not.toContain("▰");
    expect(html).not.toMatch(/\d+ of \d+ in/);
  });

  test("never frames seats as spots left", () => {
    const html = weeklyNewsletterHtml(baseInput);
    expect(html).not.toContain("spots left");
    expect(html).not.toContain("spot left");
  });

  test("the forward ask carries no referral link and promises no discount", () => {
    // The personalized /newsletter?ref= link and its "you both get 50% off"
    // perk came out 2026-09-03: the referral program isn't set up, and a perk
    // the business can't honor is a promise, not a nudge.
    for (const rendered of [weeklyNewsletterHtml(baseInput), weeklyNewsletterText(baseInput)]) {
      expect(rendered).toContain("Forward this email");
      expect(rendered).not.toMatch(/\?ref=/);
      expect(rendered).not.toContain("forward link");
      expect(rendered).not.toMatch(/\d+% off/);
      expect(rendered).not.toContain("Bring a friend");
    }
  });

  test("group-interest CTA always renders, with copy that adapts to poll presence", () => {
    const noPolls = weeklyNewsletterHtml(baseInput);
    expect(noPolls).toContain("Want a regular group?");
    expect(noPolls).toContain(`${ORIGIN}/crew`);

    const withPolls = weeklyNewsletterHtml({ ...baseInput, openPolls: [poll("Sat 4pm Bethesda, Green", 2)] });
    expect(withPolls).toContain("Forming groups now");
    expect(withPolls).toContain("Sat 4pm Bethesda, Green");
    expect(withPolls).toContain(`${ORIGIN}/poll/sat-4pm-green`);
    expect(withPolls).toContain("None of these fit?");
  });

  test("poll progress label reflects yes-count vs minPartySize", () => {
    const html = weeklyNewsletterHtml({ ...baseInput, openPolls: [poll("Tue 5pm Rockville", 2)] });
    expect(html).toContain("2 in · need 2 more to lock it in");
  });

  test("private, semi-private and small-group lessons always have direct, audience-labeled CTAs", () => {
    // These invitations belong to the recurring template, even in a quiet
    // week with no sessions, camps, seasonal programs or approved draft.
    const input = { ...baseInput, sessions: [], programs: [], camps: [] };
    const html = weeklyNewsletterHtml(input);
    const text = weeklyNewsletterText(input);
    for (const body of [html, text]) {
      expect(body).toContain("Private, semi-private and small-group lessons");
      expect(body).toContain("For your player");
      expect(body).toContain("For parents who play");
      expect(body).toContain("Choose up to three available times for your player");
      expect(body).toContain("Sam confirms the time and sends an invoice");
      expect(body).toContain(WHATSAPP_NGA_GROUP_URL);
      expect(body).not.toContain("utm_content=eval");
      expect(body).not.toContain("youth online booking is not open yet");
      expect(body).toContain("/lessons/book");
    }
    for (const [base, content] of [
      [`${ORIGIN}/lessons/book`, "youth-lessons"],
      ["https://coach.sammorrispb.com/book/private-lesson", "parent-lessons"],
    ]) {
      const expected = appendUtm(base, content, input.utmCampaign);
      expect(text).toContain(expected);
      expect(html).toContain(expected.replaceAll("&", "&amp;"));
      const url = new URL(expected);
      expect(url.searchParams.get("utm_campaign")).toBe(input.utmCampaign);
      expect(url.searchParams.get("utm_medium")).toBe("email");
    }
  });

  test("internal CTA links carry first-party UTM tags for click attribution", () => {
    const html = weeklyNewsletterHtml({ ...baseInput, openPolls: [poll("Sat 4pm Bethesda, Green", 2)] });
    expect(html).toContain(
      `${ORIGIN}/poll/sat-4pm-green?utm_source=newsletter&amp;utm_medium=email&amp;utm_campaign=weekly-2026-06-04&amp;utm_content=poll`,
    );
    expect(html).toContain("utm_campaign=weekly-2026-06-04");
    // Unsubscribe link is never UTM-tagged.
    expect(html).not.toContain("unsubscribe?token=abc&utm");
  });

  test("quotes no hard prices in session/tip/CTA blocks (the drop-in rate stays on Stripe checkout)", () => {
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

  test("an empty week still ships, with the schedule link and the tip", () => {
    const html = weeklyNewsletterHtml({ ...baseInput, sessions: [] });
    expect(html).toContain("No open drop-in sessions this week");
    expect(html).toContain(`${ORIGIN}/schedule`);
    expect(html).toContain("Soft hands win");
  });

  test("carries no scraped news block (removed 2026-10-23)", () => {
    for (const rendered of [weeklyNewsletterHtml(oct29), weeklyNewsletterText(oct29)]) {
      expect(rendered).not.toContain("In the news");
      expect(rendered).not.toContain("Read the story");
    }
  });

  test("hides the plan-ahead block when there are no later sessions", () => {
    expect(weeklyNewsletterHtml(baseInput)).not.toContain("Further out on the calendar");
  });

  test("renders the plan-ahead block with a schedule CTA when present", () => {
    const html = weeklyNewsletterHtml({
      ...baseInput,
      laterSessions: [{ dateLong: "Saturday, July 18", location: "Walter Johnson HS, Bethesda", slots: [] }],
    });
    expect(html).toContain("Further out on the calendar");
    expect(html).toContain("Saturday, July 18");
    expect(html).toContain("See the full schedule");
  });

  test("the plan-ahead block carries no season word that can go stale", () => {
    // Load-bearing: this block used to be a hardcoded "Summer sessions are
    // live" promo fed by a June/July/August date filter.
    const withLater: WeeklyNewsletterInput = {
      ...baseInput,
      laterSessions: [{ dateLong: "Sunday, September 13", location: "Walter Johnson HS, Bethesda", slots: [] }],
    };
    for (const rendered of [weeklyNewsletterHtml(withLater), weeklyNewsletterText(withLater)]) {
      expect(rendered).not.toContain("Summer sessions are live");
      expect(rendered).not.toContain("Sign up for summer");
    }
  });

  test("hides the camp block when there are no upcoming camps", () => {
    expect(weeklyNewsletterHtml(baseInput)).not.toContain("Next Gen Pickleball Camp");
  });

  test("the camp 'from' price is derived from CAMP_OPTIONS and is $50", () => {
    // Load-bearing: the cron computes campPriceFromUsd = Math.min(CAMP_OPTIONS
    // price). This asserts the real data, so it fails if camps.ts drifts.
    expect(Math.min(...CAMP_OPTIONS.map((o) => o.priceUsd))).toBe(50);
  });

  test("renders the camp block with weeks, price, and the /camp link", () => {
    const html = weeklyNewsletterHtml({
      ...baseInput,
      camps: [
        { weekLabel: "June 29 – July 2, 2026", publicArea: "Gaithersburg, MD" },
        { weekLabel: "July 20 – July 23, 2026", publicArea: "Gaithersburg, MD" },
      ],
    });
    expect(html).toContain("Next Gen Pickleball Camp");
    expect(html).toContain("ages 8+");
    expect(html).toContain("June 29 – July 2, 2026");
    expect(html).toContain("July 20 – July 23, 2026");
    expect(html).toContain("From $50/day");
    expect(html).toContain(`href="${ORIGIN}/camp"`);
  });

  test("each camp's area comes from its own row, never a hardcoded city", () => {
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

  test("the upcoming-camp list comes from upcomingCamps, and the Aug 17 camp is in Rockville", () => {
    const aug = CAMPS.find((c) => c.slug === "august-17");
    expect(aug).toBeDefined();
    expect(aug!.startDate).toBe("2026-08-17");
    expect(aug!.endDate).toBe("2026-08-20");
    expect(aug!.publicArea).toBe("Rockville, MD");
    expect(upcomingCamps("2026-08-06", CAMPS).map((c) => c.slug)).toEqual(["august-17"]);
  });

  test("carries no tournament card for the retired Sept 5 MVF event", () => {
    for (const rendered of [weeklyNewsletterHtml(baseInput), weeklyNewsletterText(baseInput)]) {
      expect(rendered).not.toContain("Tournament day");
      expect(rendered).not.toContain("Register with your partner");
      expect(rendered).not.toContain("linkanddink.com/popup");
    }
  });

  test("no parent-facing copy uses the word 'crew'", () => {
    const html = weeklyNewsletterHtml({
      ...baseInput,
      camps: [{ weekLabel: "June 29 – July 2, 2026", publicArea: "Gaithersburg, MD" }],
      openPolls: [poll("Sat 4pm Bethesda, Green", 2)],
    });
    expect(html).not.toContain("Forming crews");
    expect(html).not.toContain("regular crew");
    expect(html).not.toContain("Bring the crew");
    expect(html).not.toContain("join a crew");
    expect(html).not.toContain("lock the crew");
  });
});

test.describe("weeklyNewsletterText", () => {
  test("mirrors sessions, weather, and the forward ask in plain text", () => {
    const text = weeklyNewsletterText(baseInput);
    expect(text).toContain("- 5:30–6:30 PM");
    expect(text).toContain("- Forecast: Sunny, 75°");
    expect(text).toContain("Forward this email");
    expect(text).toContain("Unsubscribe: https://nextgenpbacademy.com/api/newsletter/unsubscribe");
  });

  test("mirrors the plan-ahead block in plain text with a schedule link", () => {
    const text = weeklyNewsletterText({
      ...baseInput,
      laterSessions: [{ dateLong: "Saturday, July 18", location: "Walter Johnson HS, Bethesda", slots: [] }],
    });
    expect(text).toContain("### Further out on the calendar");
    expect(text).toContain("- Saturday, July 18, Walter Johnson HS, Bethesda");
    expect(text).toContain(`See the full schedule: ${ORIGIN}/schedule`);
  });

  test("mirrors the polls block in plain text", () => {
    const text = weeklyNewsletterText({ ...baseInput, openPolls: [poll("Sat 4pm Bethesda, Green", 1)] });
    expect(text).toContain("### Forming groups now");
    expect(text).toContain("Sat 4pm Bethesda, Green");
    expect(text).toContain(`${ORIGIN}/poll/sat-4pm-green`);
    expect(text).toContain("None of these fit?");
  });
});

test.describe("weekly newsletter — community WhatsApp invites", () => {
  // Regression: the HTML used to compose the invites INSIDE the conditional
  // "From Coach Sam this week" lead card, so a week with no Approved Notion
  // draft shipped with no WhatsApp link at all. baseInput sets no lead draft.
  test("both invites ship even when no lead draft is approved", () => {
    const html = weeklyNewsletterHtml(baseInput);
    const text = weeklyNewsletterText(baseInput);
    for (const url of [WHATSAPP_NGA_GROUP_URL, WHATSAPP_LD_GROUP_URL]) {
      expect(html.split(url).length - 1, `${url} once in html`).toBe(1);
      expect(text.split(url).length - 1, `${url} once in text`).toBe(1);
    }
  });

  test("the invites sit above the program detail, not in the footer", () => {
    const html = weeklyNewsletterHtml(baseInput);
    const ways = html.indexOf(">Ways to play</h2>");
    expect(ways).toBeGreaterThan(-1);
    for (const url of [WHATSAPP_NGA_GROUP_URL, WHATSAPP_LD_GROUP_URL]) {
      expect(html.indexOf(url)).toBeLessThan(ways);
    }
    const text = weeklyNewsletterText(baseInput);
    const textWays = text.indexOf("## Ways to play");
    expect(textWays).toBeGreaterThan(-1);
    for (const url of [WHATSAPP_NGA_GROUP_URL, WHATSAPP_LD_GROUP_URL]) {
      expect(text.indexOf(url)).toBeLessThan(textWays);
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

test.describe("weekly newsletter — fall season block", () => {
  test("hides the block entirely when the season isn't being promoted", () => {
    expect(weeklyNewsletterHtml(baseInput)).not.toContain(FALL_SEASON_TITLE);
    expect(weeklyNewsletterText(baseInput)).not.toContain(FALL_SEASON_TITLE);
  });

  test("before the first Sunday: dates, venue, both groups, price and the register CTA under Ways to play", () => {
    const input: WeeklyNewsletterInput = { ...baseInput, fallSeason: fallOpen };
    for (const rendered of [weeklyNewsletterHtml(input), weeklyNewsletterText(input)]) {
      expect(rendered).toContain(FALL_SEASON_TITLE);
      expect(rendered).toContain(FALL_SEASON_LABEL);
      expect(rendered).toContain("Walter Johnson High School");
      expect(rendered).toContain("Green Ball");
      expect(rendered).toContain("Yellow Ball");
      expect(rendered).toContain(`$${FALL_SEASON_PRICE_USD}`);
      expect(rendered).toContain(`${ORIGIN}/fall`);
      expect(rendered).toContain("Register for the season");
    }
    const html = weeklyNewsletterHtml(input);
    expect(html.indexOf(FALL_SEASON_TITLE)).toBeGreaterThan(html.indexOf(">Ways to play</h2>"));
    expect(html.indexOf(FALL_SEASON_TITLE)).toBeLessThan(html.indexOf("Open drop-in sessions this week</h3>"));
    expect(html).not.toContain(">For families enrolled now</h2>");
  });

  test("once underway: remaining dates and the playoff for enrolled families, no price, no sales pitch", () => {
    const input: WeeklyNewsletterInput = { ...baseInput, issueDate: "2026-10-29", fallSeason: fallUnderway };
    for (const rendered of [weeklyNewsletterHtml(input), weeklyNewsletterText(input)]) {
      expect(rendered).toContain("2 Sundays remaining: Sun, Nov 1; Sun, Nov 8.");
      expect(rendered).toContain("Playoff: Sunday, November 8.");
      expect(rendered).toContain("View remaining dates and weather calls");
      expect(rendered).not.toContain(`$${FALL_SEASON_PRICE_USD}`);
      expect(rendered).not.toContain("Register for the season");
    }
    const html = weeklyNewsletterHtml(input);
    expect(html.indexOf(FALL_SEASON_TITLE)).toBeGreaterThan(html.indexOf(">For families enrolled now</h2>"));
    expect(html.indexOf(FALL_SEASON_TITLE)).toBeLessThan(html.indexOf(">Ways to play</h2>"));
  });

  test("a passed playoff is not announced", () => {
    const input: WeeklyNewsletterInput = { ...baseInput, issueDate: "2026-11-09", fallSeason: fallUnderway };
    expect(weeklyNewsletterHtml(input)).not.toContain("Playoff");
  });

  test("the season the email advertises is the season in the data files", () => {
    expect(FALL_SUNDAYS).toHaveLength(FALL_SEASON_WEEKS);
    expect(FALL_SEASON_LABEL).toContain("September 20");
    expect(FALL_SEASON_GROUPS.map((g) => g.label)).toEqual(["Green Ball", "Yellow Ball"]);
  });

  test("a full group reads as full, never as a phantom open seat", () => {
    const html = weeklyNewsletterHtml({
      ...baseInput,
      fallSeason: { ...fallOpen, groups: [{ ...fallGroups[0], spotsLeft: 3 }, { ...fallGroups[1], spotsLeft: 0 }] },
    });
    expect(html).toContain("Filling up");
    expect(html).toContain("Full, ask about the sub list");
  });

  test("the seat line never publishes the group's capacity", () => {
    const html = weeklyNewsletterHtml({ ...baseInput, fallSeason: fallOpen });
    expect(html).toContain("Spots open");
    expect(html).not.toMatch(/\d+ of \d+ spots left/);
    expect(html).not.toMatch(/\d+ spots open/);
  });

  test("an unreadable roster says nothing rather than inventing a count", () => {
    expect(fallSpotsLabel({ label: "Green Ball", timeLabel: "1:00–2:30 PM", spotsLeft: null })).toBe("");
  });
});

test.describe("weekly newsletter — Pickl Park line", () => {
  // The partnership ends after the Oct 31 session (Sam, 2026-10-18), so the
  // issue carries one line for the families still playing there and never
  // pitches the season (Sam, 2026-10-23).
  test("absent or null renders nothing", () => {
    for (const input of [baseInput, { ...baseInput, picklParkSeason: null }] as WeeklyNewsletterInput[]) {
      expect(weeklyNewsletterHtml(input)).not.toContain("Pickl Park");
      expect(weeklyNewsletterText(input)).not.toContain("Pickl Park");
    }
  });

  test("the final week names the last Saturday, under enrolled families, with no pitch", () => {
    const input: WeeklyNewsletterInput = { ...baseInput, picklParkSeason: picklPark("2026-10-29") };
    for (const rendered of [weeklyNewsletterHtml(input), weeklyNewsletterText(input)]) {
      expect(rendered).toContain("Pickl Park Saturdays in Frederick: the last session is Saturday, October 31.");
      expect(rendered).not.toContain("Drill and Play");
      expect(rendered).not.toContain(PICKLPARK_INDOOR_NOTE);
      expect(rendered).not.toContain(`${ORIGIN}/picklpark`);
      expect(rendered).not.toMatch(/\$\s*\d/);
      expect(rendered).not.toMatch(/spots? (left|open)/i);
    }
    const html = weeklyNewsletterHtml(input);
    // lastIndexOf: the same sentence also leads At a glance and the inbox preview.
    expect(html.lastIndexOf("the last session is")).toBeGreaterThan(html.indexOf(">For families enrolled now</h2>"));
  });

  test("earlier weeks count the Saturdays left", () => {
    const html = weeklyNewsletterHtml({ ...baseInput, picklParkSeason: picklPark("2026-10-15") });
    expect(html).toContain("3 Saturdays left, the last one Saturday, October 31.");
  });

  test("retires itself after the last Saturday, even if the cron still passes it", () => {
    const input: WeeklyNewsletterInput = { ...baseInput, picklParkSeason: picklPark("2026-11-01") };
    expect(weeklyNewsletterHtml(input)).not.toContain("Pickl Park");
    expect(weeklyNewsletterText(input)).not.toContain("Pickl Park");
  });

  test("the dates come from the data file", () => {
    expect(PICKLPARK_SATURDAYS).toHaveLength(PICKLPARK_SEASON_WEEKS);
    expect(PICKLPARK_SATURDAYS[PICKLPARK_SATURDAYS.length - 1]).toBe("2026-10-31");
    expect(PICKLPARK_SESSION_FORMAT).toContain("30 minutes of coached drills");
  });
});

test.describe("upcomingCamps", () => {
  const camp = (slug: string, startDate: string, endDate: string) => ({
    slug,
    title: slug,
    weekLabel: slug,
    startDate,
    endDate,
    makeupDate: "",
    publicArea: "Rockville, MD",
    exactLocation: "",
    venueLine: "",
  });

  test("drops a camp on its final morning", () => {
    // The exact Aug 20 2026 regression: `endDate >= today` kept the Aug 17–20
    // camp in the Thursday issue hours after the last kid went home.
    const camps = [camp("august-17", "2026-08-17", "2026-08-20")];
    expect(upcomingCamps("2026-08-20", camps)).toEqual([]);
  });

  test("drops a camp already underway", () => {
    const camps = [camp("august-17", "2026-08-17", "2026-08-20")];
    expect(upcomingCamps("2026-08-18", camps)).toEqual([]);
  });

  test("keeps a camp that hasn't started", () => {
    const camps = [camp("august-17", "2026-08-17", "2026-08-20")];
    expect(upcomingCamps("2026-08-16", camps).map((c) => c.slug)).toEqual([
      "august-17",
    ]);
  });

  test("promotes nothing from the real camp list once every week has run", () => {
    const last = CAMPS.reduce((a, b) => (a.startDate > b.startDate ? a : b));
    expect(upcomingCamps(last.startDate, CAMPS)).toEqual([]);
  });
});
