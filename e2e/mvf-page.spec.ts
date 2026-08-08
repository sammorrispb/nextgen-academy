// Browser e2e for /montgomery-village-youth-pickleball. Requires `npm run dev`.
//   npx playwright test e2e/mvf-page.spec.ts
import { test, expect } from "@playwright/test";
import {
  MVF_PROGRAMS,
  MVF_REGISTRATION_SEARCH_URL,
  MVF_TOURNAMENT,
} from "../src/data/mvf";

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

  test("renders every program card with its title, level, and MVF number", async ({
    page,
  }) => {
    await page.goto(PAGE_PATH);
    for (const program of MVF_PROGRAMS) {
      const card = page.getByTestId(`mvf-program-${program.key}`);
      await expect(card).toBeVisible();
      await expect(card).toContainText(program.title);
      await expect(card).toContainText(program.levelLabel);
      // Parents match on the activity number in MVF's portal.
      await expect(card).toContainText(program.activityNumber);
    }
  });

  test("shows the $8 intro price and $90/$100 fall session prices", async ({ page }) => {
    await page.goto(PAGE_PATH);
    await expect(page.getByTestId("mvf-program-intro")).toContainText("$8");
    const fall1 = page.getByTestId("mvf-program-fall-1-beginner");
    await expect(fall1).toContainText("$90");
    await expect(fall1).toContainText("$100");
  });

  test("every class shows its published time and its own venue", async ({ page }) => {
    await page.goto(PAGE_PATH);
    for (const program of MVF_PROGRAMS) {
      const card = page.getByTestId(`mvf-program-${program.key}`);
      await expect(card).toContainText(program.timeLabel);
      await expect(card).toContainText(program.venue.name);
    }
    // The fall sessions are at different venues — a regression to one venue is
    // the exact drift this pins.
    await expect(page.getByTestId("mvf-program-fall-1-beginner")).toContainText(
      "Watkins Mill",
    );
    await expect(page.getByTestId("mvf-program-fall-2-beginner")).toContainText(
      "North Creek",
    );
    await expect(page.getByTestId("mvf-program-intro")).toContainText("Apple Ridge");
  });

  test("every class links out to its own MVF activity in a new tab", async ({
    page,
  }) => {
    await page.goto(PAGE_PATH);
    for (const program of MVF_PROGRAMS) {
      const cta = page.getByTestId(`mvf-register-${program.key}`);
      await expect(cta).toBeVisible();
      await expect(cta).toHaveAttribute("href", program.registerUrl);
      await expect(cta).toHaveAttribute("target", "_blank");
      await expect(cta).toHaveAttribute("rel", /noopener/);
    }
  });

  test("says registration is open and routes to MVF (no NGA checkout)", async ({
    page,
  }) => {
    await page.goto(PAGE_PATH);
    await expect(page.getByTestId("mvf-registration-open-badge")).toContainText(
      /registration is open/i,
    );
    const note = page.getByTestId("mvf-registration-note");
    await expect(note).toContainText(
      /register and pay on MVF['’]s site, not ours/i,
    );
    await expect(page.getByTestId("mvf-browse-all")).toHaveAttribute(
      "href",
      MVF_REGISTRATION_SEARCH_URL,
    );
    // No NGA payment surface may appear on this page.
    await expect(page.locator('a[href*="/api/checkout"]')).toHaveCount(0);
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
    expect(joined).toContain("Watkins Mill Pickleball Courts");
    expect(joined).toContain("North Creek Pickleball Courts");
    expect(joined).toContain('"price":8');
    expect(joined).toContain('"price":90');
    expect(joined).toContain('"price":100');
    // Registration is live — offers must not still advertise PreOrder.
    expect(joined).toContain("https://schema.org/InStock");
    expect(joined).not.toContain("https://schema.org/PreOrder");
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
