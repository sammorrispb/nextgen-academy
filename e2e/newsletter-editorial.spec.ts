import { test, expect } from "@playwright/test";
import { newsletterEditorial } from "../src/lib/newsletter-editorial";
import { newsletterPrograms } from "../src/lib/newsletter-programs";
import { weeklyNewsletterHtml, weeklyNewsletterText, type WeeklyNewsletterInput } from "../src/lib/email/weekly-newsletter";
import { fallNewsletterProgress, picklParkNewsletterProgress } from "../src/lib/newsletter-season-progress";

const winter = {
  pageId: "3ebfa3ac-27dc-8167-8030-e58c8c7bbe8e",
  html: "<h2>Where will your player play this winter?</h2><p>Winter dates and prices are not confirmed.</p>",
  text: "Where will your player play this winter?\nWinter dates and prices are not confirmed.",
};
const origin = "https://nextgenpbacademy.com";
const rampDrafts = [
  { date: "2026-10-01", pageId: "3ebfa3ac-27dc-813f-b2f2-c0b5beb68332", subject: "Your player's winter pickleball options",
    previewText: "Indoor plans for Montgomery Village and Frederick. Tell us what works for your family.",
    heading: "Where will your player play this winter?", excludesWinter: true },
  { date: "2026-10-08", pageId: "3ebfa3ac-27dc-8192-be55-f3feaaea8244", subject: "A game-day goal for your player: October 24",
    previewText: "No fixed partner needed. Four games or more at North Creek.",
    heading: "Give your player a game-day goal", excludesWinter: false },
];

for (const issue of rampDrafts) {
  const draft = { pageId: issue.pageId, html: `<h2>${issue.heading}</h2><p>MVF Junior Tournament: October 24, 4–7 PM ET. $50 / $60. At least four games.</p>`,
    text: `${issue.heading}\nMVF Junior Tournament: October 24, 4–7 PM ET. $50 / $60. At least four games.` };
  test(`${issue.date} campaign framing requires its readable approved row, expires exactly with its issue`, () => {
    expect(newsletterEditorial(issue.date, [draft])).toMatchObject({ leadPageId: issue.pageId, subject: issue.subject,
      previewText: issue.previewText, headline: issue.subject });
    for (const date of ["2026-09-30", "2026-10-02", "2026-10-09", "2026-10-15", "2026-10-24", "invalid"])
      expect(newsletterEditorial(date, [draft])).toBeNull();
    for (const drafts of [[], [{ ...draft, pageId: "unapproved" }], [{ ...draft, html: " " }], [{ ...draft, text: "" }]])
      expect(newsletterEditorial(issue.date, drafts)).toBeNull();
  });
  test(`${issue.date} lead appears once in each MIME part with no duplicate tournament card and automatic offers retained`, () => {
    const input: WeeklyNewsletterInput = {
      parentFirst: "Taylor", editorial: newsletterEditorial(issue.date, [draft]),
      newsletterLeadHtml: draft.html, newsletterLeadText: draft.text,
      programs: newsletterPrograms(issue.date, origin, `weekly-${issue.date}`),
      fallSeason: null, sessions: [], laterSessions: [], openPolls: [], news: [], camps: [],
      tip: { title: "Practice", body: "Try one thing." }, scheduleUrl: `${origin}/schedule`,
      crewInterestUrl: `${origin}/crew`, unsubscribeUrl: `${origin}/unsubscribe`, origin,
      utmCampaign: `weekly-${issue.date}`, campUrl: `${origin}/camp`, campAgeMin: 8, campPriceFromUsd: 50,
    };
    for (const body of [weeklyNewsletterHtml(input), weeklyNewsletterText(input)]) {
      expect(body.split(issue.heading)).toHaveLength(2);
      expect(body.split("At least four games.")).toHaveLength(2);
      expect(body.indexOf(issue.heading)).toBeLessThan(body.indexOf("Fall Session II"));
      expect(body).not.toContain("Montgomery Village junior tournament");
      expect(body.includes("Winter league interest — Montgomery Village and Frederick")).toBe(!issue.excludesWinter);
      expect(body).toContain("$50"); expect(body).toContain("$60"); expect(body).toContain("4–7 PM ET");
      expect(body).toContain("/book/private-lesson"); expect(body).toContain("Unsubscribe"); expect(body).toContain("chat.whatsapp.com");
      expect(body).toContain("Try one thing.");
    }
    expect(weeklyNewsletterHtml(input)).toContain(issue.previewText);
  });
}

test("October 1 campaign takes precedence over the original approved Winter fallback", () => {
  const draft = { ...winter, pageId: rampDrafts[0].pageId };
  expect(newsletterEditorial("2026-10-01", [winter, draft])?.leadPageId).toBe(draft.pageId);
  expect(newsletterEditorial("2026-10-01", [winter])?.leadPageId).toBe(winter.pageId);
});

test("October 1 editorial requires the readable approved winter draft", () => {
  expect(newsletterEditorial("2026-10-01", [winter])).toMatchObject({
    subject: "Your player's winter pickleball options",
    previewText: "Indoor plans for Montgomery Village and Frederick. Tell us what works for your family.",
    leadPageId: winter.pageId,
  });
  for (const day of ["", "invalid", "2026-09-30", "2026-10-02", "2026-10-08"]) {
    expect(newsletterEditorial(day, [winter])).toBeNull();
  }
  for (const drafts of [[], [{ ...winter, pageId: "other-draft" }], [{ ...winter, html: " " }], [{ ...winter, text: "" }]]) {
    expect(newsletterEditorial("2026-10-01", drafts)).toBeNull();
  }
});

test("winter leads both MIME parts once, ahead of fall, with supporting offers intact", () => {
  const input: WeeklyNewsletterInput = {
    parentFirst: "Taylor",
    editorial: newsletterEditorial("2026-10-01", [winter]),
    newsletterLeadHtml: winter.html,
    newsletterLeadText: winter.text,
    programs: newsletterPrograms("2026-10-01", origin, "weekly-2026-10-01"),
    fallSeason: { title: "Fall season", seasonLabel: "Fall 2026", weeks: 6, venueLine: "Walter Johnson", priceUsd: 120, groups: [], url: `${origin}/fall` },
    sessions: [], laterSessions: [], openPolls: [], news: [], camps: [],
    tip: { title: "Practice", body: "Try one thing." },
    scheduleUrl: `${origin}/schedule`, crewInterestUrl: `${origin}/crew`,
    unsubscribeUrl: `${origin}/unsubscribe`, origin, utmCampaign: "weekly-2026-10-01",
    campUrl: `${origin}/camp`, campAgeMin: 8, campPriceFromUsd: 50,
  };
  for (const body of [weeklyNewsletterHtml(input), weeklyNewsletterText(input)]) {
    expect(body.split("Where will your player play this winter?")).toHaveLength(2);
    expect(body.indexOf("Where will your player play this winter?")).toBeLessThan(body.indexOf("Fall season"));
    expect(body).not.toContain("Winter league interest — Montgomery Village and Frederick");
    expect(body).toContain("$50");
    expect(body).toContain("$60");
    expect(body).toContain("4:00–7:00 PM");
    expect(body).toContain("/book/private-lesson");
    expect(body).toContain("Unsubscribe");
    expect(body).toContain("chat.whatsapp.com");
  }
  expect(weeklyNewsletterHtml(input)).toContain(input.editorial!.previewText);
  const ordinary = { ...input, editorial: null };
  for (const body of [weeklyNewsletterHtml(ordinary), weeklyNewsletterText(ordinary)]) {
    expect(body).toContain("Winter league interest — Montgomery Village and Frederick");
    expect(body.indexOf("Fall season")).toBeLessThan(body.indexOf("Where will your player play this winter?"));
  }
});

test("current fall sections show remaining dates in both MIME parts, after the winter lead and upcoming enrollment", () => {
  const input: WeeklyNewsletterInput = {
    parentFirst: "Taylor", editorial: newsletterEditorial("2026-10-01", [winter]),
    newsletterLeadHtml: winter.html, newsletterLeadText: winter.text,
    programs: newsletterPrograms("2026-10-01", origin, "weekly-2026-10-01"),
    fallSeason: { title: "WJHS Sunday season", seasonLabel: "September 20 – October 25, 2026", weeks: 6,
      venueLine: "Walter Johnson High School, Bethesda", priceUsd: 225, groups: [], url: `${origin}/fall`,
      progress: fallNewsletterProgress("2026-10-01", { status: "ok", duplicates: [], rows: [
        { pageId: "cancel", date: "2026-09-27", status: { Green: "Cancelled", Yellow: "Cancelled" } },
        { pageId: "rain", date: "2026-11-01", cupf: "Booked" },
      ] }) },
    picklParkSeason: { title: "Pickl Park Saturdays", seasonLabel: "September 26 – October 31, 2026", weeks: 6,
      venueLine: "The Pickl Park, Frederick", sessionFormat: "30 minutes of coached drills, then 30 minutes of game play",
      indoorNote: "Indoors", groups: [{ label: "Kid's Drill and Play (Ages 8–13)", timeLabel: "2:00–3:00 PM", spotsLeft: null }],
      url: `${origin}/picklpark`, progress: picklParkNewsletterProgress("2026-10-01") },
    sessions: [], laterSessions: [], openPolls: [], news: [], camps: [], tip: { title: "Practice", body: "Try one thing." },
    scheduleUrl: `${origin}/schedule`, crewInterestUrl: `${origin}/crew`, unsubscribeUrl: `${origin}/unsubscribe`,
    origin, utmCampaign: "weekly-2026-10-01", campUrl: `${origin}/camp`, campAgeMin: 8, campPriceFromUsd: 50,
  };
  for (const body of [weeklyNewsletterHtml(input), weeklyNewsletterText(input)]) {
    expect(body.indexOf("Where will your player play this winter?")).toBeLessThan(body.indexOf("Fall Session II"));
    expect(body.indexOf("Fall Session II")).toBeLessThan(body.indexOf("WJHS Sunday season"));
    expect(body).toContain("5 Sundays remaining");
    expect(body).toContain("5 Saturdays remaining");
    expect(body).toContain("Sun, Nov 1 is the makeup for Sun, Sep 27");
    expect(body).toContain("availability and registration options");
    expect(body).toContain("Ask The Pickl Park about joining");
    expect(body).not.toContain("6 Sundays at");
    expect(body).not.toContain("6 Saturdays indoors");
    expect(body).not.toContain("$225");
    expect(body).toContain("$90 resident / $100 non-resident");
    expect(body).toContain("4:00–7:00 PM");
    expect(body).toContain("$50");
    expect(body).toContain("$60");
  }
});
