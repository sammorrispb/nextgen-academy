import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  INDEXNOW_ENDPOINT,
  buildIndexNowPayload,
  indexNowKeyResponse,
  sitemapUrls,
} from "../src/lib/indexnow";

/**
 * IndexNow (AEO audit, 2026-09-13): Bing's index feeds ChatGPT search and
 * Copilot, and the site had no fast path to it. A weekly cron submits every
 * sitemap URL. It ships dark — no INDEXNOW_KEY, no submission — and rides the
 * shared withCronAlert Bearer gate like every other cron.
 */

const root = (...p: string[]) => join(__dirname, "..", ...p);

test.describe("IndexNow", () => {
  test("payload names the host, key, key location and every sitemap URL", () => {
    const urls = sitemapUrls();
    expect(urls.length).toBeGreaterThan(20);
    const p = buildIndexNowPayload(urls, "abc123");
    expect(INDEXNOW_ENDPOINT).toBe("https://api.indexnow.org/indexnow");
    expect(p).toEqual({
      host: "nextgenpbacademy.com",
      key: "abc123",
      keyLocation: "https://nextgenpbacademy.com/indexnow-key.txt",
      urlList: urls,
    });
  });

  test("the cron is scheduled weekly and gated by withCronAlert", () => {
    const vercel = JSON.parse(readFileSync(root("vercel.json"), "utf8")) as {
      crons: { path: string; schedule: string }[];
    };
    const cron = vercel.crons.find((c) => c.path === "/api/cron/indexnow");
    expect(cron, "cron registered").toBeTruthy();
    expect(cron!.schedule.split(" ")[4]).not.toBe("*");
    const route = readFileSync(root("src", "app", "api", "cron", "indexnow", "route.ts"), "utf8");
    expect(route).toContain('withCronAlert("indexnow"');
  });

  test("the key file 404s when the key is unset, and serves it when set", async () => {
    expect(indexNowKeyResponse(undefined).status).toBe(404);
    expect(indexNowKeyResponse("   ").status).toBe(404);
    const ok = indexNowKeyResponse(" k-test ");
    expect(ok.status).toBe(200);
    expect(await ok.text()).toBe("k-test");
    const route = readFileSync(root("src", "app", "indexnow-key.txt", "route.ts"), "utf8");
    expect(route).toContain("indexNowKeyResponse()");
  });
});
