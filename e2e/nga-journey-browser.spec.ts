import { test, expect } from "@playwright/test";
import { writeFileSync, readFileSync } from "node:fs";
import { createHmac } from "node:crypto";
import { createSessionCookieValue } from "../src/lib/coach-auth";
const playerId = "00000000-0000-4000-8000-000000000001";
const statePath = process.env.NGA_SYNTHETIC_JOURNEY_STATE!;
const receiptPath = process.env.NGA_SYNTHETIC_JOURNEY_RECEIPTS!;
function state(value: object = {}) { writeFileSync(statePath, JSON.stringify(value)); }
process.env.COACH_SIGNING_SECRET = "synthetic-journey-coach-secret";
test.beforeEach(async ({ context }) => {
  state(); writeFileSync(receiptPath, "");
  // Forward local browser POSTs to the real built route with its configured
  // canonical Origin. No route result is fabricated or replaced.
  await context.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (!["127.0.0.1", "localhost"].includes(url.hostname)) return route.abort();
    if (url.pathname === "/api/coach/journey-preview") {
      const response = await route.fetch({ headers: { ...route.request().headers(), origin: "https://nextgenpbacademy.com" } });
      return route.fulfill({ response });
    }
    return route.continue();
  });
  await context.addCookies([{ name: "coach_session", value: createSessionCookieValue("synthetic-coach@example.invalid"), domain: "127.0.0.1", path: "/", httpOnly: true, sameSite: "Lax" }]);
});
test.afterEach(async ({}, info) => {
  await info.attach("synthetic-provider-receipts", { body: readFileSync(receiptPath), contentType: "application/x-ndjson" });
  await info.attach("synthetic-provider-state", { body: readFileSync(statePath), contentType: "application/json" });
});
async function load(page: import("@playwright/test").Page) {
  await page.goto("/coach/journey");
  await page.getByLabel("Player CRM record ID", { exact: true }).fill(playerId);
  await page.getByRole("button", { name: "Load recorded assessment" }).click();
  await expect(page.getByText("Green Ball. Recorded age: 10.")).toBeVisible();
  await page.getByLabel("Next focus", { exact: true }).selectOption("skill-6");
  await page.getByRole("checkbox", { name: /I confirmed the recorded age/ }).check();
  await page.getByRole("checkbox", { name: /I reviewed this recorded assessment/ }).check();
}
function noWrites() {
  const calls = readFileSync(receiptPath, "utf8").trim().split("\n").filter(Boolean).map((line) => JSON.parse(line));
  expect(calls.every((c) => c.method === "GET" || (c.method === "POST" && c.url.endsWith("/query")))).toBe(true);
  expect(calls.every((c) => c.url.startsWith("https://api.notion.com/"))).toBe(true);
}
test("NGA-C9 UI/API: reviewed next focus, current capacity and honest source failure", async ({ page }, info) => {
  await load(page);
  await page.getByRole("button", { name: "Preview next sessions" }).click();
  await expect(page.getByRole("heading", { name: "Coach confirmation needed" })).toBeVisible();
  await expect(page.getByText("Next focus for this preview:")).toContainText("Serve and Return");
  await expect(page.getByText("Confirm this program’s age range", { exact: false })).toBeVisible();
  await expect(page.getByRole("link", { name: "View session details" })).toHaveCount(0);
  expect(await page.locator("body").evaluate((el) => el.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath("reviewed-preview.png"), fullPage: true });
  state({ full: true });
  await page.getByRole("button", { name: "Preview next sessions" }).click();
  await expect(page.getByRole("heading", { name: "No matching sessions" })).toBeVisible();
  state({ inventoryFailure: true });
  await page.getByRole("button", { name: "Preview next sessions" }).click();
  await expect(page.getByRole("heading", { name: "Preview unavailable" })).toBeVisible();
  noWrites();
});
test("NGA-C9 UI/API: stale assessment requires a fresh coach review", async ({ page }) => {
  await load(page); state({ revision: "2026-10-24T12:00:00Z" });
  await page.getByRole("button", { name: "Preview next sessions" }).click();
  await expect(page.getByRole("heading", { name: "Assessment changed" })).toBeVisible();
  await expect(page.getByRole("checkbox", { name: /I reviewed this recorded assessment/ })).not.toBeChecked();
  await expect(page.getByRole("checkbox", { name: /I confirmed the recorded age/ })).not.toBeChecked();
  await expect(page.getByRole("button", { name: "Preview next sessions" })).toBeDisabled(); noWrites();
});
test("NGA-C9 UI/API: absent authority and foreign origin fail before family reads", async ({ browser, context }) => {
  const forbidden = await context.request.post("http://127.0.0.1:3197/api/coach/journey-preview", { headers: { origin: "https://foreign.invalid" }, data: { playerId } });
  expect(forbidden.status()).toBe(403); expect(readFileSync(receiptPath, "utf8")).toBe("");
  const anonymous = await browser.newContext(); const res = await anonymous.request.post("http://127.0.0.1:3197/api/coach/journey-preview", { data: { playerId } });
  expect(res.status()).toBe(401); expect(readFileSync(receiptPath, "utf8")).toBe(""); await anonymous.close();
});

test("NGA-C9 UI/API: lost preview response can be retried without writes", async ({ page }) => {
  await load(page); let lost = false;
  await page.route("**/api/coach/journey-preview", async (route) => {
    if (!lost) { lost = true; await route.fetch({ headers: { ...route.request().headers(), origin: "https://nextgenpbacademy.com" } }); await route.abort(); } else { const response = await route.fetch({ headers: { ...route.request().headers(), origin: "https://nextgenpbacademy.com" } }); await route.fulfill({ response }); }
  });
  await page.getByRole("button", { name: "Preview next sessions" }).click();
  await expect(page.getByText("The response was lost. You can safely retry this read-only preview.", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Preview next sessions" }).click();
  await expect(page.getByRole("heading", { name: "Coach confirmation needed" })).toBeVisible(); noWrites();
});

test("NGA-C9 UI/API: authority expires during inventory read and no child result escapes", async ({ context }) => {
  state({ delayInventory: true });
  const loaded = await context.request.post("/api/coach/journey-preview", { data: { playerId } });
  const assessment = (await loaded.json()).assessment;
  const payload = Buffer.from(JSON.stringify({ email: "synthetic-coach@example.invalid", exp: Math.floor(Date.now() / 1000) + 2 })).toString("base64url");
  const signature = createHmac("sha256", "synthetic-journey-coach-secret").update(payload).digest("base64url");
  await context.addCookies([{ name: "coach_session", value: `${payload}.${signature}`, domain: "127.0.0.1", path: "/", httpOnly: true, sameSite: "Lax" }]);
  const response = await context.request.post("/api/coach/journey-preview", { data: { playerId, review: { assessmentRevision: assessment.revision, focusId: "skill-6", confirmed: true, ageConfirmed: true }, preferences: {} } });
  expect(response.status()).toBe(401); expect(await response.json()).toEqual({ error: "Unauthorized", code: "coach_access_revoked" });
  expect(readFileSync(receiptPath, "utf8")).toContain("/databases/synthetic-session-db/query"); noWrites();
});


test("NGA-C9 UI/API: changing review during a pending response clears busy and permits a fresh preview", async ({ page }) => {
  await load(page);
  let releaseResponse!: () => void;
  let held = false;
  const released = new Promise<void>((resolve) => { releaseResponse = resolve; });
  await page.route("**/api/coach/journey-preview", async (route) => {
    const response = await route.fetch({ headers: { ...route.request().headers(), origin: "https://nextgenpbacademy.com" } });
    if (!held) { held = true; await released; }
    await route.fulfill({ response });
  });
  try {
    await page.getByRole("button", { name: "Preview next sessions" }).click();
    await expect(page.getByText("Checking the assessment and upcoming sessions.", { exact: true })).toBeVisible();
    await page.getByRole("checkbox", { name: /I reviewed this recorded assessment/ }).uncheck();
    await expect(page.getByText("Checking the assessment and upcoming sessions.", { exact: true })).toHaveCount(0);
    releaseResponse();
    await page.getByRole("checkbox", { name: /I reviewed this recorded assessment/ }).check();
    await expect(page.getByRole("button", { name: "Preview next sessions" })).toBeEnabled();
    await page.getByRole("button", { name: "Preview next sessions" }).click();
    await expect(page.getByRole("heading", { name: "Coach confirmation needed" })).toBeVisible();
    noWrites();
  } finally { releaseResponse(); }
});
