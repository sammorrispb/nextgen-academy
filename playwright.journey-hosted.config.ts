import { defineConfig } from "@playwright/test";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { checkConfigEnvironment, privateOutput } from "./e2e/fixtures/player-journey-hosted-adapter";

// This dedicated config registers hosted cases; ordinary configs register none.
process.env.NGA_HOSTED_ACCEPTANCE ??= "1";
process.env.PLAYWRIGHT_NO_COPY_PROMPT = "1";
if (process.argv.some((arg) => arg === "--reporter" || arg.startsWith("--reporter=")))
  throw new Error("nga_hosted_reporter_override_refused");
const listing = process.argv.includes("--list");
const root = resolve(__dirname);
const origin = checkConfigEnvironment(process.env, listing);
const output = listing ? join(tmpdir(), "nga-hosted-discovery-only") : privateOutput(process.env.NGA_HOSTED_OUTPUT_DIR!, root);
if (!listing && process.env.PLAYER_JOURNEY_LD_CHECKOUT) privateOutput(output, process.env.PLAYER_JOURNEY_LD_CHECKOUT);

export default defineConfig({
  testDir: "./e2e", testMatch: "player-journey-hosted.spec.ts", workers: 1,
  fullyParallel: false, retries: 0, forbidOnly: true, maxFailures: 0, timeout: 60000,
  outputDir: join(output, "playwright"),
  reporter: [["./e2e/fixtures/player-journey-hosted-adapter.ts", { listing, reportPath: listing ? undefined : process.env.PLAYER_JOURNEY_HOSTED_REPORT_PATH }]],
  use: { baseURL: origin, headless: true, trace: "off", screenshot: "off", video: "off", serviceWorkers: "block" },
  projects: [
    { name: "desktop", use: { viewport: { width: 1280, height: 800 } } },
    { name: "mobile", use: { viewport: { width: 375, height: 812 } } },
  ],
  // No webServer, local fetch preload, mock business route or resource creation.
});
