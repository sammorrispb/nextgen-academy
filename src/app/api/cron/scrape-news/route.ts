import { withCronAlert, type CronFailure } from "@/lib/cron-alert";
import { scrapeAll } from "@/lib/news-scraper";
import { createNewsRow, findNewsByUrl } from "@/lib/notion-news";

export const runtime = "nodejs";
// Cron path — never cache.
export const dynamic = "force-dynamic";

// Worst-case we'd try to write ~50 candidates × 2 Notion calls each. Default
// Vercel function timeout is 10s on Hobby; bump generously since news sources
// can be slow.
export const maxDuration = 60;

export const GET = withCronAlert("scrape-news", async () => {
  const candidates = await scrapeAll(50);

  if (!process.env.NOTION_NEWS_DB_ID || !process.env.NOTION_API_KEY) {
    console.warn(
      "[cron/scrape-news] NOTION_NEWS_DB_ID or NOTION_API_KEY missing — dry run only",
    );
    return {
      attempted: 0,
      succeeded: 0,
      failures: [],
      body: {
        dry_run: true,
        candidates: candidates.length,
        items: candidates.map((c) => ({
          title: c.title,
          url: c.url,
          source: c.source,
        })),
      },
    };
  }

  let created = 0;
  let skipped = 0;
  let failed = 0;
  for (const item of candidates) {
    const existing = await findNewsByUrl(item.url);
    if (existing) {
      skipped++;
      continue;
    }
    const ok = await createNewsRow(item);
    if (ok) created++;
    else failed++;
  }

  // Row-create failures used to be a count behind ok:true — a dead Notion key
  // would silently empty the news queue for weeks. One rolled-up failure entry
  // (public news URLs only, but counts are all the alert needs).
  const failures: CronFailure[] =
    failed > 0
      ? [
          {
            signature: "news_row_create_failed",
            detail: `${failed} of ${candidates.length} candidate row(s) failed to create in Notion`,
          },
        ]
      : [];

  const summary = {
    candidates: candidates.length,
    created,
    skipped_existing: skipped,
    failed,
  };
  console.log("[cron/scrape-news]", JSON.stringify(summary));
  return {
    attempted: candidates.length,
    succeeded: created + skipped,
    failures,
    body: summary,
  };
});
