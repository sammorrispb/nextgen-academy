import { test, expect } from "@playwright/test";
import {
  campChecklistSubject,
  campChecklistHtml,
  campChecklistText,
  type CampChecklistReminderInput,
} from "../src/lib/email/camp-checklist-reminder";
import { campsRunningOn } from "../src/lib/camp-checklist-reminder";
import { CAMPS } from "../src/data/camps";

const input: CampChecklistReminderInput = {
  dayLong: "Monday, June 29",
  camps: [
    {
      title: "Summer Camp — Week 1",
      week: "June 29 – July 2, 2026",
      hours: "9:30 AM – 12:30 PM",
      location:
        "Gaithersburg High School — outdoor courts\n314 South Frederick Ave, Gaithersburg, MD 20877",
    },
  ],
  checklistUrl: "https://nextgenpbacademy.com/coach/camp-checklist",
};

test.describe("campsRunningOn", () => {
  test("returns the camp on a scheduled Mon–Thu camp morning", () => {
    // 2026-06-29 is the Monday of Week 1.
    const running = campsRunningOn("2026-06-29", CAMPS);
    expect(running.map((c) => c.slug)).toEqual(["june-29"]);
  });

  test("returns each weekday of the camp week (Mon–Thu)", () => {
    for (const d of ["2026-06-29", "2026-06-30", "2026-07-01", "2026-07-02"]) {
      expect(campsRunningOn(d, CAMPS).map((c) => c.slug)).toEqual(["june-29"]);
    }
  });

  test("no-ops on the makeup/rain Friday (cron can't know if it runs)", () => {
    // 2026-07-03 is the Friday makeup date for Week 1 — deliberately excluded.
    expect(campsRunningOn("2026-07-03", CAMPS)).toEqual([]);
  });

  test("no-ops on a non-camp day", () => {
    expect(campsRunningOn("2026-06-26", CAMPS)).toEqual([]);
  });
});

test.describe("campChecklistSubject", () => {
  test("names the weekday", () => {
    expect(campChecklistSubject("Monday")).toContain("Monday");
    expect(campChecklistSubject("Monday").toLowerCase()).toContain("checklist");
  });
});

test.describe("campChecklistHtml", () => {
  test("links to the coach checklist page", () => {
    const html = campChecklistHtml(input);
    expect(html).toContain(
      'href="https://nextgenpbacademy.com/coach/camp-checklist"',
    );
  });

  test("renders the day, camp title, hours and location", () => {
    const html = campChecklistHtml(input);
    expect(html).toContain("Monday, June 29");
    expect(html).toContain("Summer Camp — Week 1");
    expect(html).toContain("9:30 AM – 12:30 PM");
    expect(html).toContain("314 South Frederick Ave");
  });

  test("surfaces the key supplies", () => {
    const html = campChecklistHtml(input);
    for (const item of ["water cooler", "first-aid", "shade", "nets"]) {
      expect(html.toLowerCase()).toContain(item);
    }
  });
});

test.describe("campChecklistText", () => {
  test("includes the checklist URL and supplies in plain text", () => {
    const text = campChecklistText(input);
    expect(text).toContain("https://nextgenpbacademy.com/coach/camp-checklist");
    expect(text).toContain("Summer Camp — Week 1");
    expect(text.toLowerCase()).toContain("first-aid");
  });
});
