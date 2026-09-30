import { test, expect } from "@playwright/test";
import { newsletterEditorial } from "../src/lib/newsletter-editorial";
import { newsletterPrograms } from "../src/lib/newsletter-programs";
import { weeklyNewsletterHtml, weeklyNewsletterText, type WeeklyNewsletterInput } from "../src/lib/email/weekly-newsletter";

const winter = {
  pageId: "3ebfa3ac-27dc-8167-8030-e58c8c7bbe8e",
  html: "<h2>Where will your player play this winter?</h2><p>Winter dates and prices are not confirmed.</p>",
  text: "Where will your player play this winter?\nWinter dates and prices are not confirmed.",
};
const origin = "https://nextgenpbacademy.com";

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
