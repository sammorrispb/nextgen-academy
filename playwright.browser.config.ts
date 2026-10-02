import { defineConfig } from "@playwright/test";

// npx playwright test --config=playwright.browser.config.ts
// Run only browser specs, with a separately built credential-free app copy.
// No existing dev server is reused and no fixture can reach production.
const port = 3191;
// The specs include direct route/function checks as well as browser requests.
// Strip inherited service configuration from their workers too. Inspect only
// names, never secret values; preserve browser/runtime paths and coverage.
const runtimeKeys = new Set([
  "PATH", "HOME", "TMPDIR", "TEMP", "TMP", "SystemRoot", "CI", "TZ",
  "PLAYWRIGHT_BROWSERS_PATH", "NODE_V8_COVERAGE",
]);
for (const name of Object.keys(process.env)) {
  if (!runtimeKeys.has(name)) delete process.env[name];
}
process.env.TZ = "UTC";
process.env.NGA_BROWSER_ISOLATED = "1";
process.env.RESEND_API_KEY = "re_browser_test_dummy";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  workers: 4,
  testMatch: [
    "**/cluster-attribution.spec.ts", "**/clusters-pages.spec.ts",
    "**/contact-form.spec.ts", "**/fall-waiver-inline.spec.ts",
    "**/homepage.spec.ts", "**/mvf-page.spec.ts", "**/newsletter.spec.ts",
    "**/reserve-modal.spec.ts", "**/seo.spec.ts",
  ],
  outputDir: "test-results/browser",
  use: { baseURL: `http://127.0.0.1:${port}`, headless: true },
  projects: [
    { name: "desktop", use: { viewport: { width: 1280, height: 800 } } },
    { name: "mobile", use: { viewport: { width: 375, height: 812 } } },
  ],
  webServer: {
    command: `node scripts/run-browser-tests.mjs ${port}`,
    url: `http://127.0.0.1:${port}/browser-test-fixture/reservation`,
    timeout: 180_000,
    reuseExistingServer: false,
    gracefulShutdown: { signal: "SIGTERM", timeout: 10_000 },
  },
});
