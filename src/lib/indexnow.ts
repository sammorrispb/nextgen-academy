// IndexNow submission (AEO audit, 2026-09-13).
//
// Bing's index feeds ChatGPT search and Microsoft Copilot, and this site had no
// fast path into it — a changed page waited for an organic recrawl. IndexNow is
// the protocol Bing (and Yandex, Seznam, Naver) accept: POST the URL list plus a
// key that the site proves it owns by serving it at `keyLocation`.
//
// Pure: builds the payload from the sitemap. The weekly cron in
// src/app/api/cron/indexnow/route.ts does the network call.

import sitemap from "@/app/sitemap";
import { SITE_URL } from "@/lib/seo";

export const INDEXNOW_ENDPOINT = "https://api.indexnow.org/indexnow";
export const INDEXNOW_HOST = new URL(SITE_URL).host;
export const INDEXNOW_KEY_PATH = "/indexnow-key.txt";

export interface IndexNowPayload {
  host: string;
  key: string;
  keyLocation: string;
  urlList: string[];
}

export function sitemapUrls(): string[] {
  return sitemap().map((entry) => entry.url);
}

export function buildIndexNowPayload(urls: string[], key: string): IndexNowPayload {
  return {
    host: INDEXNOW_HOST,
    key,
    keyLocation: `${SITE_URL}${INDEXNOW_KEY_PATH}`,
    urlList: urls,
  };
}

/**
 * The /indexnow-key.txt response. The key is not a secret — IndexNow requires
 * it to be publicly readable — but it lives in env so it can be minted and
 * rotated without a code change. Unset → 404, which also keeps the cron dark.
 */
export function indexNowKeyResponse(key: string | undefined = process.env.INDEXNOW_KEY): Response {
  const trimmed = key?.trim();
  if (!trimmed) return new Response("Not found", { status: 404 });
  return new Response(trimmed, {
    status: 200,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
