// Browser e2e for /montgomery-village-youth-pickleball. Requires `npm run dev`.
//   npx playwright test e2e/mvf-page.spec.ts
import { test, expect } from "@playwright/test";
import { MVF_PROGRAMS, MVF_TOURNAMENT } from "../src/data/mvf";

const PAGE_PATH = "/montgomery-village-youth-pickleball";

test.describe("/montgomery-village-youth-pickleball", () => {
  test("renders the hero h1 and MVF partnership line", async ({ page }) => {
    await page.goto(PAGE_PATH);
    await expect(
      page.getByRole("heading", { level: 1, name: /youth pickleball in\s+montgomery village/i }),
    ).toBeVisible();
    await expect(
      page.getByText(/in partnership with the montgomery village foundation/i),
    ).toBeVisible();
  });

  test("renders all three program cards with titles", async ({ page }) => {
    await page.goto(PAGE_PATH);
    for (const program of MVF_PROGRAMS) {
      const card = page.getByTestId(`mvf-program-${program.key}`);
      await expect(card).toBeVisible();
      await expect(card).toContainText(program.title);
    }
  });

  test("shows the $8 intro price and $90/$100 fall session prices", async ({ page }) => {
    await page.goto(PAGE_PATH);
    await expect(page.getByTestId("mvf-program-intro")).toContainText("$8");
    const fall1 = page.getByTestId("mvf-program-fall-1");
    await expect(fall1).toContainText("$90");
    await expect(fall1).toContainText("$100");
  });

  test("fall sessions show dates but no class times (Rec Guide TBD)", async ({ page }) => {
    await page.goto(PAGE_PATH);
    const fall2 = page.getByTestId("mvf-program-fall-2");
    await expect(fall2).toContainText(/exact times announced in the MVF Fall Rec Guide/i);
  });

  test("carries the registration-through-MVF note (no NGA checkout)", async ({ page }) => {
    await page.goto(PAGE_PATH);
    const note = page.getByTestId("mvf-registration-note");
    await expect(note).toContainText(/through and payable to the Montgomery Village Foundation/i);
  });

  test("emits SportsEvent JSON-LD for each program", async ({ page }) => {
    await page.goto(PAGE_PATH);
    const scripts = page.locator('script[type="application/ld+json"]');
    expect(await scripts.count()).toBeGreaterThan(0);
    const bodies = await scripts.allTextContents();
    const sportsEvents = bodies.filter((b) => b.includes('"SportsEvent"'));
    expect(sportsEvents.length).toBeGreaterThanOrEqual(MVF_PROGRAMS.length);
    const joined = bodies.join("\n");
    expect(joined).toContain("Apple Ridge Pickleball Courts");
    expect(joined).toContain('"price":8');
    expect(joined).toContain('"price":90');
    expect(joined).toContain('"price":100');
  });

  test("embeds the newsletter form as the primary CTA", async ({ page }) => {
    await page.goto(PAGE_PATH);
    await expect(page.locator("#newsletter input#parentName")).toBeVisible();
    await expect(page.locator("#newsletter input#email")).toBeVisible();
  });

  test("tournament cross-promo links out to Link & Dink safely", async ({ page }) => {
    await page.goto(PAGE_PATH);
    const card = page.getByTestId("mvf-tournament-card");
    await expect(card).toBeVisible();
    await expect(card).toHaveAttribute("href", MVF_TOURNAMENT.url);
    await expect(card).toHaveAttribute("target", "_blank");
    await expect(card).toHaveAttribute("rel", /noopener/);
    await expect(card).toContainText("$25");
    await expect(card).toContainText("$35");
  });

  test("is linked from the global Navbar (desktop direct, mobile via hamburger)", async ({
    page,
  }, testInfo) => {
    await page.goto("/");
    if (testInfo.project.name === "mobile") {
      await page.getByRole("button", { name: /toggle menu/i }).click();
    }
    const navLink = page.locator("nav").getByRole("link", { name: "MVF Classes" });
    await expect(navLink.first()).toBeVisible();
    await expect(navLink.first()).toHaveAttribute("href", PAGE_PATH);
  });

  test("appears in the sitemap", async ({ page }) => {
    const resp = await page.goto("/sitemap.xml");
    expect(resp?.status()).toBe(200);
    const body = await page.content();
    expect(body).toContain(`https://nextgenpbacademy.com${PAGE_PATH}</loc>`);
  });
});
