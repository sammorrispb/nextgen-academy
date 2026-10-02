import { test, expect } from "@playwright/test";

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
    // A priced tournament banner outside the newsletter offer is legitimate.
    const banner = page.getByRole("link", { name: /MVF Junior Tournament/ }).first();
    await expect(banner).toHaveAttribute("href", "/mvf-junior-tournament");
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
