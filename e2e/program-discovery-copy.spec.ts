import { test, expect } from "@playwright/test";
import { faq } from "../src/data/faq";
import { site } from "../src/data/site";
import { blogPosts } from "../src/data/blog";
import { PICKLPARK_LEAGUES } from "../src/data/picklpark-leagues-2026";
import { FALL_SEASON_PRICE_USD } from "../src/data/fall-season-2026";

function answer(question: string): string {
  const item = faq.find((entry) => entry.question === question);
  expect(item, question).toBeDefined();
  return item!.answer;
}

test.describe("public program discovery copy", () => {
  test("academy descriptions distinguish the pathway from listing eligibility", () => {
    for (const copy of [site.description, site.boilerplate25, site.boilerplate50]) {
      expect(copy).toContain("6–16");
      expect(copy).toMatch(/program|listing/i);
      expect(copy).not.toMatch(/court (?:per|for every) level|all welcome/i);
    }
    for (const level of ["Red", "Orange", "Green", "Yellow"]) {
      expect(site.boilerplate50).toContain(level);
    }
  });

  test("academy ages do not imply every program admits every age or level", () => {
    const copy = answer("What ages do you accept?");
    expect(copy).toContain("6–16");
    expect(copy).toMatch(/each program|program listing/i);
    expect(copy).not.toMatch(/each on its own court|run at every ball color/i);
  });

  test("new players are welcomed without guaranteeing all-level group availability", () => {
    const copy = answer("Does my child need experience?");
    expect(copy).toMatch(/^No\./);
    expect(copy).toMatch(/private lessons/i);
    expect(copy).toMatch(/current|available|listing/i);
    expect(copy).not.toMatch(/group sessions run at every level/i);
  });

  test("cost advice separates single drop-ins from paid seasons and partner registration", () => {
    const copy = answer("How much do youth pickleball lessons cost at Next Gen?");
    expect(copy).toMatch(/drop-in sessions/i);
    expect(copy).not.toMatch(/group classes are drop-in/i);
    expect(copy).toContain(`$${FALL_SEASON_PRICE_USD}`);
    expect(copy).toMatch(/paid up front/i);
    expect(copy).toMatch(/The Pickl Park sets/i);
    expect(copy).toMatch(/MVF.*registration portal/i);
  });

  test("mid-season advice checks availability instead of promising admission", () => {
    const copy = answer("Can my child join mid-season?");
    expect(copy).toMatch(/availability|available|space|spots/i);
    expect(copy).not.toMatch(/we accept new players throughout the season/i);
    expect(copy).toMatch(/Coach Sam/);
  });

  test("the Frederick guide describes only the listed league and its actual ages", () => {
    const post = blogPosts.find((entry) => entry.slug === "indoor-youth-pickleball-near-frederick-md");
    expect(post).toBeDefined();
    const copy = post!.sections.flatMap((section) => section.paragraphs).join(" ");
    expect(copy).not.toMatch(/two Saturday youth leagues|ages 10\+/i);
    for (const league of PICKLPARK_LEAGUES) {
      expect(copy).toContain(league.title);
      expect(copy.toLowerCase()).toContain(league.ageLabel.toLowerCase());
    }
    expect(copy).toMatch(/registration and payment go through The Pickl Park/i);
  });
});
