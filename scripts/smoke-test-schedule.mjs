#!/usr/bin/env node
// One-off Playwright smoke test for the live drop-in flow.
// Stops at the Stripe Checkout page (does NOT spend money).
//
// Usage: node scripts/smoke-test-schedule.mjs
//
// Set BASE_URL to override (default: production).

import { chromium } from "@playwright/test";

const BASE_URL = process.env.BASE_URL ?? "https://nextgenpbacademy.com";
const HEADLESS = process.env.HEADLESS !== "0";

const log = (...args) => console.log("·", ...args);
const ok = (msg) => console.log(`✅ ${msg}`);
const fail = (msg) => {
  console.error(`❌ ${msg}`);
  process.exit(1);
};

const browser = await chromium.launch({ headless: HEADLESS });
const ctx = await browser.newContext({
  viewport: { width: 1280, height: 800 },
  serviceWorkers: "block",
});
const page = await ctx.newPage();
page.on("console", (m) => {
  if (m.type() === "error") console.log("[browser console error]", m.text());
});

try {
  // 1 — schedule page renders the test session
  log(`open ${BASE_URL}/schedule`);
  await page.goto(`${BASE_URL}/schedule`, { waitUntil: "domcontentloaded" });

  await page.waitForSelector("text=Upcoming Sessions", { timeout: 15_000 });
  ok("schedule page loaded");

  const sessionCard = page
    .getByText(/Red Ball.*Olney.*TEST/, { exact: false })
    .or(page.getByText(/Olney/))
    .first();
  await sessionCard.waitFor({ timeout: 10_000 });
  ok("test session visible");

  const seatsBadge = page.getByText(/seats left/i).first();
  await seatsBadge.waitFor();
  ok(`capacity badge: "${(await seatsBadge.textContent())?.trim()}"`);

  // 2 — Reserve button opens the modal
  const reserveBtn = page.getByRole("button", { name: /Reserve · \$35/i }).first();
  await reserveBtn.waitFor({ timeout: 5_000 });
  await reserveBtn.click();
  ok("reserve modal opened");

  // 3 — Fill the form
  await page.getByLabel(/parent name/i).fill("Smoke Test");
  await page.getByLabel(/^email$/i).fill("sam.morris2131@gmail.com");
  await page.getByLabel(/^phone$/i).fill("3013254731");
  await page.getByLabel(/child.s first name/i).fill("Tester");
  await page.getByLabel(/child.s age/i).fill("10");
  ok("form filled");

  // 4 — Submit → expect navigation to checkout.stripe.com
  const stripeNav = page.waitForURL(/checkout\.stripe\.com/, { timeout: 15_000 });
  await page.getByRole("button", { name: /continue to payment/i }).click();
  await stripeNav;
  ok(`landed on Stripe Checkout: ${page.url().slice(0, 60)}…`);

  // 5 — Verify $35 + product line item shown on Stripe
  await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
  const bodyText = (await page.textContent("body")) ?? "";
  if (!/\$35/.test(bodyText)) fail("Stripe page didn't show $35");
  ok("Stripe Checkout shows $35");
  if (!/Drop-in/i.test(bodyText)) {
    log("(no 'Drop-in' product name visible — might be hidden by Stripe layout, not fatal)");
  } else {
    ok("Stripe Checkout shows Drop-in product name");
  }

  console.log("\n🎾 Smoke test passed — Stripe Checkout reached without payment.");
  console.log("Manual e2e (webhook chain) requires actually paying $35.");
} catch (err) {
  console.error("\n❌ Smoke test failed:", err.message);
  await page.screenshot({ path: "/tmp/smoke-fail.png" }).catch(() => {});
  console.error("   Screenshot: /tmp/smoke-fail.png");
  process.exitCode = 1;
} finally {
  await ctx.close();
  await browser.close();
}
