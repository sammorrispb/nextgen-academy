import { test, expect } from "@playwright/test";
import { fallNewsletterProgress, picklParkNewsletterProgress } from "../src/lib/newsletter-season-progress";
import { newsletterPrograms } from "../src/lib/newsletter-programs";

const calls = { status: "ok" as const, duplicates: [], rows: [
  { pageId: "cancel", date: "2026-09-27", status: { Green: "Cancelled" as const, Yellow: "Cancelled" as const } },
  { pageId: "rain", date: "2026-11-01", cupf: "Booked" as const },
] };

test("October newsletter includes remaining WJHS dates and the recorded makeup", () => {
  const progress = fallNewsletterProgress("2026-10-01", calls);
  expect(progress.underway).toBe(true);
  expect(progress.hasUpcoming).toBe(true);
  expect(progress.scheduleNotes.join(" ")).toContain("5 Sundays remaining");
  expect(progress.scheduleNotes.join(" ")).toContain("Sun, Oct 4");
  expect(progress.makeupNotes.join(" ")).toContain("Sun, Nov 1");
  expect(progress.makeupNotes.join(" ")).toContain("Sun, Sep 27");
  expect(progress.makeupNotes.join(" ")).not.toContain("pending");
});

test("makeups keep the season visible after its original last Sunday, then retire", () => {
  expect(fallNewsletterProgress("2026-10-29", calls).hasUpcoming).toBe(true);
  expect(fallNewsletterProgress("2026-11-02", calls).hasUpcoming).toBe(false);
  expect(fallNewsletterProgress("2026-10-29", { ...calls, rows: [] }).hasUpcoming).toBe(false);
});

test("per-group cancellations, booking uncertainty and unreadable calendars stay truthful", () => {
  const split = fallNewsletterProgress("2026-10-01", { ...calls, rows: [
    { pageId: "cancel", date: "2026-09-27", status: { Green: "Cancelled", Yellow: "Held" } },
  ] });
  expect(split.scheduleNotes.join(" ")).toMatch(/Green Ball: 5 Sundays remaining/);
  expect(split.scheduleNotes.join(" ")).toMatch(/Yellow Ball: 4 Sundays remaining/);
  expect(split.makeupNotes.join(" ")).toContain("Court booking confirmation is pending");
  for (const status of ["config_missing", "query_failed"] as const) {
    const unknown = fallNewsletterProgress("2026-10-01", { status, message: "unavailable" });
    expect(unknown.scheduleNotes.join(" ")).toContain("current fall calendar");
    expect(unknown.scheduleNotes.join(" ")).not.toMatch(/\d Sundays remaining/);
    expect(unknown.makeupNotes).toEqual([]);
    expect(fallNewsletterProgress("2026-11-09", { status, message: "unavailable" }).hasUpcoming).toBe(false);
  }
});

test("PicklPark counts current Saturdays without promoting an ended season", () => {
  expect(picklParkNewsletterProgress("2026-09-01")).toMatchObject({ underway: false, remaining: 6 });
  expect(picklParkNewsletterProgress("2026-10-01")).toMatchObject({ underway: true, remaining: 5 });
  expect(picklParkNewsletterProgress("2026-10-31").remaining).toBe(1);
  expect(picklParkNewsletterProgress("2026-11-01").remaining).toBe(0);
});

test("invalid dates and exhausted makeup dates never invent upcoming sessions", () => {
  for (const day of ["", "invalid", "2026-09-31", "2026-13-01"]) {
    expect(fallNewsletterProgress(day, calls).hasUpcoming).toBe(false);
    expect(picklParkNewsletterProgress(day).remaining).toBe(0);
  }
  const exhausted = fallNewsletterProgress("2026-10-01", { ...calls, rows: [
    ...["2026-09-20", "2026-09-27", "2026-10-04"].map(date => ({ pageId: date, date, status: { Green: "Cancelled" as const } })),
  ] });
  expect(exhausted.makeupNotes.join(" ")).toContain("still needs a replacement date");
  expect(fallNewsletterProgress("2026-09-01", { ...calls, rows: [] }).underway).toBe(false);
});

test("MVF Fall II leads Fall I and midseason fees are never represented as a late-join price", () => {
  const programs = newsletterPrograms("2026-10-01", "https://nextgenpbacademy.com", "wk");
  const mvf = programs.filter(program => program.key?.startsWith("mvf-") && program.key !== "mvf-junior-tournament");
  expect(mvf).toHaveLength(2);
  expect(mvf[0].title).toContain("Fall Session II");
  expect(mvf[0].body).toContain("$90 resident / $100 non-resident");
  expect(mvf[0].body).toContain("6 Thursdays");
  expect(mvf[1].body).toContain("already underway");
  expect(mvf[1].body).toContain("ask MVF about joining");
  expect(mvf[1].body).not.toContain("$90");
});
