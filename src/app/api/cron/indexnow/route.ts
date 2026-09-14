import { withCronAlert } from "@/lib/cron-alert";
import {
  INDEXNOW_ENDPOINT,
  buildIndexNowPayload,
  sitemapUrls,
} from "@/lib/indexnow";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Weekly IndexNow submission of every sitemap URL (AEO audit, 2026-09-13).
 *
 * Ships dark: INDEXNOW_KEY unset is reported as dark, not as a failure — a
 * weekly config_missing alert before Sam mints the key would be noise. Auth =
 * Bearer CRON_SECRET via withCronAlert. IndexNow answers 200 or 202 on success;
 * anything else is one controlled-vocabulary failure (no response body in the
 * alert). The payload is public URLs only — no PII can ride it.
 */
export const GET = withCronAlert("indexnow", async () => {
  const key = process.env.INDEXNOW_KEY?.trim();
  if (!key) {
    return { attempted: 0, succeeded: 0, failures: [], body: { dark: true } };
  }

  const payload = buildIndexNowPayload(sitemapUrls(), key);
  const res = await fetch(INDEXNOW_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify(payload),
  });

  const ok = res.status === 200 || res.status === 202;
  return {
    attempted: payload.urlList.length,
    succeeded: ok ? payload.urlList.length : 0,
    failures: ok ? [] : [{ signature: "indexnow_rejected", detail: `http ${res.status}` }],
    body: { dark: false, submitted: payload.urlList.length, status: res.status },
  };
});
