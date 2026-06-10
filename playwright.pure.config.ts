import { defineConfig } from "@playwright/test";

// Pure-function spec run — everything in e2e/ that doesn't drive a browser
// page, so it needs no dev server and can run in CI on every PR. The ignored
// specs use page.goto/page.locator and still run locally against `npm run dev`
// (see playwright.config.ts). If you add a new browser-driven spec, add it to
// this ignore list or CI will fail on connection-refused.
export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  testIgnore: [
    "**/cluster-attribution.spec.ts",
    "**/clusters-pages.spec.ts",
    "**/contact-form.spec.ts",
    "**/homepage.spec.ts",
    "**/newsletter.spec.ts",
    "**/reserve-modal.spec.ts",
    "**/seo.spec.ts",
    // Hits the LIVE site over the network (www→apex redirects) — GitHub
    // runners get the Vercel security checkpoint, not the 301s. Run locally
    // or as a post-deploy smoke check, never in PR CI.
    "**/redirects.spec.ts",
  ],
  projects: [{ name: "desktop", use: { viewport: { width: 1280, height: 800 } } }],
});
