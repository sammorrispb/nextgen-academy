import { test, expect } from "@playwright/test";
import { runInNewContext } from "node:vm";
import { access, mkdir, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
type HarnessModule = typeof import("../scripts/run-browser-tests.mjs");
let buildTestEnvironment: HarnessModule["buildTestEnvironment"];
let requestAllowed: HarnessModule["requestAllowed"];
let networkGuardSource: HarnessModule["networkGuardSource"];
let prepareWorkspace: HarnessModule["prepareWorkspace"];

const browserHarness = process.env.NGA_BROWSER_ISOLATED === "1";

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
  test.beforeEach(() => {
    expect(browserHarness, "Use playwright.browser.config.ts: invalid-input API checks need its isolated dummy email configuration").toBe(true);
  });
  test("rejects empty body with 400 + validation errors", async ({
    request,
  }, testInfo) => {
    if (testInfo.project.name !== "desktop") test.skip();
    const res = await request.post("/api/contact", {
      data: {},
      headers: { "Content-Type": "application/json", "x-forwarded-for": `192.0.2.${testInfo.line % 250 + 1}` },
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
      headers: { "Content-Type": "application/json", "x-forwarded-for": `192.0.2.${testInfo.line % 250 + 1}` },
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
      headers: { "Content-Type": "application/json", "x-forwarded-for": `192.0.2.${testInfo.line % 250 + 1}` },
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
      headers: { "Content-Type": "application/json", "x-forwarded-for": `192.0.2.${testInfo.line % 250 + 1}` },
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
      headers: { "Content-Type": "application/json", "x-forwarded-for": `192.0.2.${testInfo.line % 250 + 1}` },
    });
    expect(res.status()).toBe(400);
    const json = await res.json();
    expect(json.errors.childAge).toBeTruthy();
  });
});

// These checks run in Node and cannot contact a service. They pin the test
// server's isolation, including the guard actually installed in child servers.
test.describe("Browser runner guarantees", () => {
  // Match the existing script-test convention: static imports become require,
  // while a dynamic import preserves this runner's native ES module exports.
  test.beforeAll(async () => {
    ({ buildTestEnvironment, requestAllowed, networkGuardSource, prepareWorkspace } = await import("../scripts/run-browser-tests.mjs"));
  });
  test("only deliberate dummy configuration reaches the server", () => {
    if (browserHarness) {
      expect(process.env.RESEND_API_KEY === "re_browser_test_dummy").toBe(true);
      for (const name of ["NOTION_API_KEY", "STRIPE_SECRET_KEY", "NODE_OPTIONS"]) {
        expect(Object.hasOwn(process.env, name)).toBe(false);
      }
    }
    const env = buildTestEnvironment({ PATH: "/synthetic/bin", RESEND_API_KEY: "synthetic-production-key", NOTION_API_KEY: "synthetic-notion", STRIPE_SECRET_KEY: "synthetic-stripe", NODE_OPTIONS: "--require unwanted.js" }, "/isolated/home", 3191);
    expect(env.PATH).toBe("/synthetic/bin");
    expect(env.HOME).toBe("/isolated/home");
    expect(env.RESEND_API_KEY).toBe("re_browser_test_dummy");
    expect(env).not.toHaveProperty("NOTION_API_KEY");
    expect(env).not.toHaveProperty("STRIPE_SECRET_KEY");
    expect(env).not.toHaveProperty("NODE_OPTIONS");
    expect(env.NEXT_PUBLIC_SITE_URL).toBe("http://127.0.0.1:3191");
  });

  test("invalid ports fail before starting any server", () => {
    for (const port of [0, -1, 1023, 65536, NaN, 3191.5]) {
      expect(() => buildTestEnvironment({}, "/unused", port)).toThrow("Invalid isolated browser port");
    }
    expect(buildTestEnvironment({}, "/unused", 3191).PATH).toBe("");
  });

  test("the fixture enters only a private copy, excluding root credentials and workflows", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "nga-runner-check-"));
    let workspace: string | undefined;
    try {
      for (const dir of ["src/app", "public", "node_modules", "e2e/fixtures"]) {
        await mkdir(path.join(root, dir), { recursive: true });
      }
      for (const file of ["package.json", "tsconfig.json", "postcss.config.mjs"]) {
        await writeFile(path.join(root, file), "{}");
      }
      await writeFile(path.join(root, "next.config.ts"), "export default { turbopack: { root: __dirname } }");
      await writeFile(path.join(root, "e2e/fixtures/reservation-page.tsx"), "export default function Fixture() { return null; }");
      // Empty sentinels: never read or copy any real private configuration.
      await writeFile(path.join(root, ".env.local"), "");
      await writeFile(path.join(root, "src/.env.local"), "");
      await writeFile(path.join(root, "public/private.key"), "");
      await mkdir(path.join(root, ".github"));
      const result = await prepareWorkspace(root, 3191);
      workspace = result.workspace;
      await access(path.join(workspace, "src/app/browser-test-fixture/reservation/page.tsx"));
      await expect(access(path.join(root, "src/app/browser-test-fixture"))).rejects.toThrow();
      await expect(access(path.join(workspace, ".env.local"))).rejects.toThrow();
      await expect(access(path.join(workspace, ".github"))).rejects.toThrow();
      await expect(access(path.join(workspace, "src/.env.local"))).rejects.toThrow();
      await expect(access(path.join(workspace, "public/private.key"))).rejects.toThrow();
      expect(result.env.NODE_OPTIONS).toContain("network-guard.cjs");
      expect(result.env.RESEND_API_KEY).toBe("re_browser_test_dummy");
      // A changed root convention fails explicitly and cleans its partial copy.
      await writeFile(path.join(root, "next.config.ts"), "export default {}");
      await expect(prepareWorkspace(root, 3191)).rejects.toThrow("Unrecognized Next filesystem-root configuration");
      expect(await readdir(path.join(root, "src/app"))).toEqual([]);
    } finally {
      if (workspace) await rm(workspace, { recursive: true, force: true });
      await rm(root, { recursive: true, force: true });
    }
  });

  test("requests are confined to the test server or read-only font assets", () => {
    expect(requestAllowed("http://127.0.0.1:3191/api/contact", "POST", 3191)).toBe(true);
    expect(requestAllowed("https://fonts.googleapis.com/css2?family=Inter", "GET", 3191)).toBe(true);
    for (const url of ["", "invalid", "file:///etc/passwd", "https://api.resend.com/emails", "https://api.stripe.com/v1/charges", "https://api.notion.com/v1/pages", "http://127.0.0.1:3000/api/contact", "http://user:password@127.0.0.1:3191", "https://fonts.googleapis.com.evil.example/css", "https://fonts.googleapis.com@evil.example/css"]) {
      expect(requestAllowed(url, "GET", 3191), url).toBe(false);
    }
    expect(requestAllowed("https://fonts.googleapis.com/css", "POST", 3191)).toBe(false);
    expect(requestAllowed("http://fonts.googleapis.com/css", "GET", 3191)).toBe(false);
  });

  test("the installed network guard blocks fetch and native HTTP writes", async () => {
    const calls: string[] = [];
    const modules = {
      "node:http": { request: (...args: unknown[]) => { void args; return calls.push("http"); }, get: (...args: unknown[]) => { void args; return calls.push("http-get"); } },
      "node:https": { request: (...args: unknown[]) => { void args; return calls.push("https"); }, get: (...args: unknown[]) => { void args; return calls.push("https-get"); } },
    };
    const context = { URL, Request, fetch: async (...args: unknown[]) => { void args; calls.push("fetch"); return "local"; }, require: (name: keyof typeof modules) => modules[name] };
    runInNewContext(networkGuardSource(3191), context);
    await expect(context.fetch("https://api.resend.com/emails", { method: "POST" })).rejects.toThrow(/blocked/i);
    await expect(context.fetch(new Request("https://fonts.googleapis.com/css", { method: "POST" }))).rejects.toThrow(/blocked/i);
    expect(() => modules["node:https"].request("https://api.stripe.com/v1/charges")).toThrow(/blocked/i);
    expect(() => modules["node:http"].get({ hostname: "api.notion.com", path: "/v1/pages" })).toThrow(/blocked/i);
    expect(() => modules["node:https"].get("https://fonts.gstatic.com/font", { hostname: "api.resend.com" })).toThrow(/blocked/i);
    expect(() => modules["node:https"].get({ hostname: "fonts.gstatic.com", method: "POST" })).toThrow(/blocked/i);
    expect(() => modules["node:http"].get({ hostname: "127.0.0.1", port: 3000, path: "/" })).toThrow(/blocked/i);
    expect(calls).toEqual([]);
    expect(await context.fetch("http://127.0.0.1:3191/", {})).toBe("local");
    modules["node:https"].get("https://fonts.gstatic.com/font.woff2");
    expect(calls).toEqual(["fetch", "https-get"]);
  });
});
