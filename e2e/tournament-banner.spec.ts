import { test, expect } from "@playwright/test";
const fixture = "/browser-test-fixture/mvf-series?banner=1";
const banner = (page: import("@playwright/test").Page) => page.getByRole("region", { name: "Synthetic tournament banner" });

test("cached open flag cannot advertise Register after the registration deadline", async ({ page }) => {
  await page.clock.install({ time: new Date("2026-11-13T17:00:01Z") });
  await page.goto(fixture);
  await expect(banner(page)).toBeVisible();
  await expect(banner(page)).toContainText("Registration not open");
  await expect(banner(page)).not.toContainText(/Register\s*→/);
  await expect(banner(page)).toContainText("Details");
});

test("an open tab stops advertising registration exactly at its deadline", async ({ page }) => {
  await page.clock.install({ time: new Date("2026-11-13T16:59:30Z") });
  await page.goto(fixture);
  await expect(banner(page)).toContainText(/Register\s*→/);
  await page.clock.fastForward(30_000);
  await expect(banner(page)).not.toContainText(/Register\s*→/);
});

test("an open tab retires a stale event at the following Eastern midnight", async ({ page }) => {
  await page.clock.install({ time: new Date("2026-11-15T04:59:30Z") });
  await page.goto(`${fixture}&open=0`);
  await expect(banner(page).getByRole("link")).toBeVisible();
  await expect(banner(page)).toContainText("Registration not open");
  await page.clock.fastForward(30_000);
  await expect(banner(page).getByRole("link")).toHaveCount(0);
});

test("an invalid registration deadline fails closed", async ({ page }) => {
  await page.clock.install({ time: new Date("2026-11-12T17:00:00Z") });
  await page.goto(`${fixture}&closes=invalid`);
  await expect(banner(page)).toContainText("Registration not open");
  await expect(banner(page)).not.toContainText(/Register\s*→/);
});

test("server-rendered cached banner does not advertise open registration", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto(fixture);
  await expect(banner(page)).toContainText("Details");
  await expect(banner(page)).not.toContainText(/Register\s*→/);
  await context.close();
});

test("focus rechecks a background tab whose deadline elapsed", async ({ page }) => {
  await page.clock.install({ time: new Date("2026-11-13T16:59:30Z") });
  await page.goto(fixture);
  await expect(banner(page)).toContainText(/Register\s*→/);
  await page.clock.setSystemTime(new Date("2026-11-13T17:00:01Z"));
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(banner(page)).toContainText("Registration not open");
});

for (const width of [375, 820, 1024, 1280]) {
  test(`navigation fits and reaches tournaments at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    const nav = page.locator("nav");
    const logo = nav.locator('a[href="/"]').first();
    await expect(logo).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    // Below 1024px the bottom bar steers the site; Tournaments is behind More.
    const bar = page.getByRole("navigation", { name: "Main" });
    const toggle = bar.getByRole("button", { name: "More" });
    if (width < 1024) {
      await expect(toggle).toBeVisible();
      await toggle.click();
      const sheet = page.locator("#mobile-more");
      await expect(sheet).toBeVisible();
      await expect(sheet.getByRole("link", { name: "Tournaments", exact: true })).toHaveAttribute("href", "/mvf-junior-tournament");
      // Opening moves focus into the sheet, so Escape has something to give back.
      await expect(sheet.getByRole("link").first()).toBeFocused();
      await page.keyboard.press("Escape");
      await expect(sheet).toBeHidden();
      await expect(toggle).toBeFocused();
      // A tap outside the bar closes it too.
      await toggle.click();
      await expect(sheet).toBeVisible();
      await page.locator("h1").click({ position: { x: 5, y: 5 } });
      await expect(sheet).toBeHidden();
      await toggle.click();
    } else {
      await expect(page.locator('nav[aria-label="Main"]')).toHaveCount(1);
      await expect(bar).toBeHidden();
      const logoBox = await logo.boundingBox();
      const firstLink = await nav.getByRole("link", { name: "Start Here", exact: true }).filter({ visible: true }).boundingBox();
      expect(logoBox!.x + logoBox!.width).toBeLessThanOrEqual(firstLink!.x);
    }
    await nav.getByRole("link", { name: "Tournaments", exact: true }).filter({ visible: true }).click();
    await expect(page).toHaveURL(/\/mvf-junior-tournament$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("MVF Junior Tournaments");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}
