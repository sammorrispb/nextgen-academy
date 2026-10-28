import { test, expect } from "@playwright/test";

test.describe("retired tournament promotion", () => {
  for (const path of ["/", "/schedule", "/newsletter", "/blog", "/terms", "/admin/fall"]) {
    test(`${path} has no tournament banner or public entry`, async ({ page }) => {
      await page.goto(path);
      await expect(page.locator('a[href="/mvf-junior-tournament"]')).toHaveCount(0);
      await expect(page.locator('a[href="/blog/mvf-junior-tournament-october-24-2026"]')).toHaveCount(0);
      await expect(page.getByText("See tournament details", { exact: false })).toHaveCount(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    });
  }

  test("desktop and mobile menus still reach the schedule", async ({ page }, testInfo) => {
    await page.goto("/");
    await expect(page.locator("h1")).toBeVisible();
    if (testInfo.project.name === "mobile") {
      await page.getByRole("button", { name: "Toggle menu" }).click();
      await expect(page.getByRole("dialog", { name: "Navigation menu" })).toBeVisible();
    }
    const nav = page.locator("nav");
    await expect(nav.getByRole("link", { name: /tournament/i })).toHaveCount(0);
    await nav.getByRole("link", { name: "Schedule", exact: true }).filter({ visible: true }).click();
    await expect(page).toHaveURL(/\/schedule$/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Youth Pickleball Schedule");
    await expect(page.getByRole("link", { name: "See both leagues" })).toBeVisible();
    await expect(page.locator('a[href="/mvf-junior-tournament"]')).toHaveCount(0);
    if (testInfo.project.name === "mobile") {
      await expect(page.getByRole("button", { name: "Toggle menu" })).toHaveAttribute("aria-expanded", "false");
    }
  });

  for (const path of ["/mvf-junior-tournament", "/blog/mvf-junior-tournament-october-24-2026"]) {
    test(`${path} remains available by historical URL and is noindex`, async ({ page }) => {
      const response = await page.goto(path);
      expect(response?.status()).toBe(200);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
    });
  }
});

// ─── /newsletter landing page ─────────────────────

test.describe("Newsletter page", () => {
  test("renders the headline and the signup form fields", async ({ page }) => {
    await page.goto("/newsletter");
    await expect(
      page.getByRole("heading", {
        name: /Montgomery County.s youth pickleball crew is growing/,
      }),
    ).toBeVisible();
    await expect(page.getByLabel("Your Name")).toBeVisible();
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByLabel(/Child.s Age/)).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Join the Free Newsletter/ }),
    ).toBeVisible();
  });

  test("newsletter signup stays free independently of event announcements", async ({
    page,
  }) => {
    await page.goto("/newsletter");
    const offer = page.locator("main");
    await expect(offer).toContainText("Free Newsletter");
    await expect(offer.getByRole("button", { name: "Join the Free Newsletter" })).toBeVisible();
    expect(await offer.innerText()).not.toMatch(/\$\d/);
    await expect(page.locator('a[href="/mvf-junior-tournament"]')).toHaveCount(0);
  });
});

// ─── Home #newsletter section ─────────────────────

test.describe("Home newsletter section", () => {
  test("renders the #newsletter section with the form", async ({ page }) => {
    await page.goto("/");
    const section = page.locator("#newsletter");
    await expect(section).toBeVisible();
    await expect(
      section.getByRole("button", { name: /Join the Free Newsletter/ }),
    ).toBeVisible();
  });
});

// ─── Newsletter API ───────────────────────────────

test.describe("Newsletter API", () => {
  test("rejects empty body with 400 + validation errors", async ({
    request,
  }) => {
    const res = await request.post("/api/newsletter", {
      data: {},
      headers: { "Content-Type": "application/json" },
    });
    expect(res.status()).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("Validation failed");
    expect(json.errors.parentName).toBeTruthy();
    expect(json.errors.email).toBeTruthy();
    expect(json.errors.childAge).toBeTruthy();
  });

  test("rejects a malformed email", async ({ request }) => {
    const res = await request.post("/api/newsletter", {
      data: {
        parentName: "Test Parent",
        email: "not-an-email",
        childAge: "10",
      },
      headers: { "Content-Type": "application/json" },
    });
    expect(res.status()).toBe(400);
    const json = await res.json();
    expect(json.errors.email).toBeTruthy();
  });
});
