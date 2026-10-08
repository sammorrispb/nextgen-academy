import { test, expect } from "@playwright/test";
import { newsletterPrograms } from "../src/lib/newsletter-programs";

test("fall issue includes MVF classes and tournament, girls group, and labeled interest checks", () => {
  const programs = newsletterPrograms("2026-10-01", "https://nextgenpbacademy.com", "weekly-2026-10-01");
  const content = programs.map(p => `${p.title} ${p.body}`).join("\n");
  for (const value of ["Montgomery Village", "Oct 15 – Nov 19", "October 24", "North Creek", "4:00–7:00 PM", "Monday", "6:00–7:00 PM", "Rockville", "Orange Ball", "12:00–1:00 PM", "Walter Johnson", "Lake Marion", "The Pickl Park", "not open"]) {
    expect(content).toContain(value);
  }
  expect(programs.every(p => !p.url || p.url.includes("utm_campaign=weekly-2026-10-01"))).toBe(true);
  expect(content).not.toContain("Apple Ridge");
});

test("ended programs and unconfirmed interest announcements retire instead of repeating forever", () => {
  expect(newsletterPrograms("2027-01-01", "https://nextgenpbacademy.com", "wk")).toEqual([]);
  const afterTournament = newsletterPrograms("2026-10-25", "https://nextgenpbacademy.com", "wk");
  expect(afterTournament.some(p => p.title.includes("tournament"))).toBe(false);
  const afterFallI = newsletterPrograms("2026-10-09", "https://nextgenpbacademy.com", "wk");
  expect(afterFallI.map(p => p.body).join(" ")).not.toContain("Sept 3 – Oct 8");
});


test("tournament card gives both conditional venues, event hours and 15-minute check-in", () => {
  const card = newsletterPrograms("2026-10-08", "https://nextgenpbacademy.com", "wk")
    .find(program => program.key === "mvf-junior-tournament");
  expect(card).toBeDefined();
  for (const fact of ["North Creek Community Center", "20125 Arrowhead Road", "4:00–7:00 PM ET", "Outdoor check-in: 3:45 PM ET", "Lake Marion Community Center", "8821 East Village Avenue", "3:00–6:00 PM ET", "Indoor check-in: 2:45 PM ET"]) {
    expect(card!.body).toContain(fact);
  }
  expect(card!.body).toMatch(/if it rains/i);
  expect(card!.body).toContain("one hour earlier");
  expect(card!.body).not.toContain("3:30 PM");
});
