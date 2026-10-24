import { defineConfig } from "@playwright/test";
import { join } from "node:path";
const state = process.env.NGA_SYNTHETIC_JOURNEY_STATE;
const receipts = process.env.NGA_SYNTHETIC_JOURNEY_RECEIPTS;
const negativeTransport = process.env.NGA_JOURNEY_TRANSPORT_NEGATIVE === "1";
if (!state || !receipts) throw new Error("Set synthetic state and receipt paths before running NGA journey browser tests");
// Playwright failure aria snapshots can expose values even when traces are off.
process.env.PLAYWRIGHT_NO_COPY_PROMPT = "1";
export default defineConfig({
  testDir: "./e2e", testMatch: negativeTransport ? "fixtures/nga-parent-transport-negative.fixture.ts" : ["nga-journey-browser.spec.ts", "nga-parent-preview-browser.spec.ts"], workers: 1, fullyParallel: false,
  timeout: 30_000,
  // The built server retains its canonical configured CSRF origin. Tests
  // forward that origin over loopback; application CSRF behavior is unchanged.
  // Tokens are credentials. Never retain HAR, trace or automatic screenshots
  // from this harness, including failed acceptance runs.
  use: { baseURL: "http://127.0.0.1:3197", headless: true, extraHTTPHeaders: { Origin: "https://nextgenpbacademy.com" }, trace: "off", screenshot: "off", video: "off" },
  projects: [ { name: "desktop", use: { viewport: { width: 1280, height: 800 } } }, { name: "mobile", use: { viewport: { width: 375, height: 812 } } } ],
  webServer: negativeTransport ? undefined : {
    command: "node ./node_modules/next/dist/bin/next start -p 3197 -H 127.0.0.1",
    url: "http://127.0.0.1:3197/coach/login", reuseExistingServer: false,
    env: { NODE_OPTIONS: `--import=${join(process.cwd(), "e2e/fixtures/nga-journey-fetch.mjs")}`, NGA_SYNTHETIC_JOURNEY_FIXTURES: "1", NGA_SYNTHETIC_JOURNEY_STATE: state, NGA_SYNTHETIC_JOURNEY_RECEIPTS: receipts, NOTION_API_KEY: "synthetic-notion-key", NOTION_DROPINS_DB_ID: "synthetic-dropin-db", NGA_JOURNEY_PREVIEW_SIGNING_SECRET: "synthetic-dedicated-parent-preview-signing-key-20261023", NOTION_PLAYER_CRM_DB_ID: "synthetic-player-db", NOTION_SESSIONS_DB_ID: "synthetic-session-db", COACH_SIGNING_SECRET: "synthetic-journey-coach-secret", COACH_ALLOWED_EMAILS: "synthetic-coach@example.invalid" },
  },
});
