import { test, expect } from "@playwright/test";

test.describe("Contact Form — homepage #contact-form", () => {
  test("renders name, email, phone, interest, and message fields", async ({
    page,
  }) => {
    await page.goto("/");
    const form = page.locator("#contact-form form");
    await expect(form.locator("#name")).toBeVisible();
    await expect(form.locator("#email")).toBeVisible();
    await expect(form.locator("#phone")).toBeVisible();
    await expect(form.locator("#interest")).toBeVisible();
    await expect(form.locator("#message")).toBeVisible();
  });

  test("defaults to Free evaluation and shows child age", async ({ page }) => {
    await page.goto("/");
    const form = page.locator("#contact-form form");
    await expect(form.locator("#interest")).toHaveValue("free-evaluation");
    await expect(form.locator("#childAge")).toBeVisible();
  });

  test("interest dropdown contains all expected options", async ({ page }) => {
    await page.goto("/");
    const options = page.locator("#contact-form #interest option");
    // 1 placeholder + 6 interest options
    await expect(options).toHaveCount(7);
    for (const label of [
      "Free evaluation",
      /Drop-in group sessions/,
      /Private lessons/,
      /Yellow Ball tournament track/,
      /Partnership/,
      /General question/,
    ]) {
      await expect(
        page.locator("#contact-form #interest option", { hasText: label }),
      ).toHaveCount(1);
    }
  });

  test("hides child age when a non-program interest is picked", async ({
    page,
  }) => {
    await page.goto("/");
    const form = page.locator("#contact-form form");
    await form.locator("#interest").selectOption("partnership");
    await expect(form.locator("#childAge")).toHaveCount(0);

    await form.locator("#interest").selectOption("general");
    await expect(form.locator("#childAge")).toHaveCount(0);

    await form.locator("#interest").selectOption("private-lessons");
    await expect(form.locator("#childAge")).toBeVisible();
  });

  test("shows validation errors on empty submit", async ({ page }) => {
    await page.goto("/");
    const form = page.locator("#contact-form form");
    // Clear the default-selected interest so the interest error fires too.
    await form.locator("#interest").selectOption("");
    await form.getByRole("button", { name: "Send message" }).click();

    await expect(form.getByText("Your name is required")).toBeVisible();
    await expect(form.getByText("A valid email is required")).toBeVisible();
    await expect(
      form.getByText("Please choose what you're interested in"),
    ).toBeVisible();
  });

  test("rejects invalid email format", async ({ page }) => {
    await page.goto("/");
    const form = page.locator("#contact-form form");
    await form.locator("#name").fill("Test Parent");
    await form.locator("#email").fill("not-an-email");
    await form.locator("#interest").selectOption("partnership");
    await form.getByRole("button", { name: "Send message" }).click();
    await expect(
      form.getByText("Please enter a valid email address"),
    ).toBeVisible();
  });

  test("successful submit shows the success card", async ({ page }) => {
    await page.route("**/api/contact", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true }),
      }),
    );

    await page.goto("/");
    const form = page.locator("#contact-form form");
    await form.locator("#name").fill("Avery Parent");
    await form.locator("#email").fill("avery@example.com");
    await form.locator("#interest").selectOption("partnership");
    await form.locator("#message").fill("Interested in school partnership.");
    await form.getByRole("button", { name: "Send message" }).click();

    await expect(page.getByText("Thanks, Avery!")).toBeVisible();
    await expect(
      page.getByRole("link", { name: /Call or Text Sam/ }),
    ).toBeVisible();
  });

  test("server validation error keeps the form usable", async ({ page }) => {
    await page.route("**/api/contact", (route) =>
      route.fulfill({
        status: 400,
        contentType: "application/json",
        body: JSON.stringify({
          error: "Validation failed",
          errors: { email: "A valid email is required" },
        }),
      }),
    );

    await page.goto("/");
    const form = page.locator("#contact-form form");
    await form.locator("#name").fill("Avery Parent");
    await form.locator("#email").fill("avery@example.com");
    await form.locator("#interest").selectOption("general");
    await form.getByRole("button", { name: "Send message" }).click();

    await expect(form.getByText("A valid email is required")).toBeVisible();
    await expect(
      form.getByRole("button", { name: "Send message" }),
    ).toBeEnabled();
  });

  test("micro-copy mentions 1 business day reply", async ({ page }) => {
    await page.goto("/");
    await expect(
      page
        .locator("#contact-form")
        .getByText(/reply within 1 business day/i),
    ).toBeVisible();
  });

  test("first-kid name + age fields render side-by-side for program interest", async ({
    page,
  }) => {
    await page.goto("/");
    const form = page.locator("#contact-form form");
    // Default interest is free-evaluation → first kid block visible.
    await expect(form.locator("#kid0name")).toBeVisible();
    await expect(form.locator("#childAge")).toBeVisible(); // legacy alias = first kid's age
    // The label switches from "About your child" (1 kid) → "Child 1" (N>=2).
    await expect(form.getByText("About your child")).toBeVisible();
  });

  test("'+ Add another child' reveals a second kid row + remove button", async ({
    page,
  }) => {
    await page.goto("/");
    const form = page.locator("#contact-form form");
    await expect(form.locator("#kid1name")).toHaveCount(0);

    await form.getByRole("button", { name: /Add another child/ }).click();

    await expect(form.locator("#kid1name")).toBeVisible();
    await expect(form.locator("#kid1age")).toBeVisible();
    await expect(form.getByText("Child 1")).toBeVisible();
    await expect(form.getByText("Child 2")).toBeVisible();
    await expect(form.getByRole("button", { name: "Remove" })).toBeVisible();

    // Removing collapses back to a single "About your child" block.
    await form.getByRole("button", { name: "Remove" }).click();
    await expect(form.locator("#kid1name")).toHaveCount(0);
    await expect(form.getByText("About your child")).toBeVisible();
  });

  test("kids inputs disappear when a non-program interest is selected", async ({
    page,
  }) => {
    await page.goto("/");
    const form = page.locator("#contact-form form");
    await form.locator("#interest").selectOption("partnership");
    await expect(form.locator("#kid0name")).toHaveCount(0);
    await expect(form.locator("#childAge")).toHaveCount(0);

    await form.locator("#interest").selectOption("free-evaluation");
    await expect(form.locator("#kid0name")).toBeVisible();
    await expect(form.locator("#childAge")).toBeVisible();
  });
});

// API tests run desktop-only — the route has no viewport-dependent behavior
// and the in-memory rate limiter (5 req/hr/IP) would trip if both Playwright
// projects hit the same endpoint from the same IP.
test.describe("Contact API — /api/contact", () => {
  test("rejects empty body with 400 + validation errors", async ({
    request,
  }, testInfo) => {
    if (testInfo.project.name !== "desktop") test.skip();
    const res = await request.post("/api/contact", {
      data: {},
      headers: { "Content-Type": "application/json" },
    });
    expect(res.status()).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("Validation failed");
    expect(json.errors.name).toBeTruthy();
    expect(json.errors.email).toBeTruthy();
    expect(json.errors.interest).toBeTruthy();
  });

  test("rejects unknown interest value", async ({ request }, testInfo) => {
    if (testInfo.project.name !== "desktop") test.skip();
    const res = await request.post("/api/contact", {
      data: {
        name: "Test Parent",
        email: "test@example.com",
        interest: "spaghetti",
      },
      headers: { "Content-Type": "application/json" },
    });
    expect(res.status()).toBe(400);
    const json = await res.json();
    expect(json.errors.interest).toBeTruthy();
  });

  test("rejects a kids[] entry missing a first name", async ({
    request,
  }, testInfo) => {
    if (testInfo.project.name !== "desktop") test.skip();
    const res = await request.post("/api/contact", {
      data: {
        name: "Test Parent",
        email: "test+missingname@example.com",
        interest: "free-evaluation",
        kids: [{ name: "", age: 9 }],
      },
      headers: { "Content-Type": "application/json" },
    });
    expect(res.status()).toBe(400);
    const json = await res.json();
    expect(json.errors["kids.0.name"]).toBeTruthy();
  });

  test("rejects a kids[] entry with an out-of-range age", async ({
    request,
  }, testInfo) => {
    if (testInfo.project.name !== "desktop") test.skip();
    const res = await request.post("/api/contact", {
      data: {
        name: "Test Parent",
        email: "test+badage@example.com",
        interest: "drop-in",
        kids: [
          { name: "Riley", age: 9 },
          { name: "Sam", age: 5 },
        ],
      },
      headers: { "Content-Type": "application/json" },
    });
    expect(res.status()).toBe(400);
    const json = await res.json();
    expect(json.errors["kids.1.age"]).toBeTruthy();
  });

  test("requires child age when interest is a program option", async ({
    request,
  }, testInfo) => {
    if (testInfo.project.name !== "desktop") test.skip();
    const res = await request.post("/api/contact", {
      data: {
        name: "Test Parent",
        email: "test@example.com",
        interest: "drop-in",
      },
      headers: { "Content-Type": "application/json" },
    });
    expect(res.status()).toBe(400);
    const json = await res.json();
    expect(json.errors.childAge).toBeTruthy();
  });
});
