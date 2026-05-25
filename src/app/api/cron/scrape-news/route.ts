import { NextRequest, NextResponse } from "next/server";
import { scrapeAll } from "@/lib/news-scraper";
import { createNewsRow, findNewsByUrl } from "@/lib/notion-news";

export const runtime = "nodejs";
// Cron path — never cache.
export const dynamic = "force-dynamic";

// Worst-case we'd try to write ~50 candidates × 2 Notion calls each. Default
// Vercel function timeout is 10s on Hobby; bump generously since news sources
// can be slow.
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    return NextResponse.json(
      { error: "CRON_SECRET not configured" },
      { status: 500 },
    );
  }
  const auth = req.headers.get("authorization") ?? "";
  if (auth !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const candidates = await scrapeAll(50);

  if (!process.env.NOTION_NEWS_DB_ID || !process.env.NOTION_API_KEY) {
    console.warn(
      "[cron/scrape-news] NOTION_NEWS_DB_ID or NOTION_API_KEY missing — dry run only",
    );
    return NextResponse.json({
      ok: true,
      dry_run: true,
      candidates: candidates.length,
      items: candidates.map((c) => ({
        title: c.title,
        url: c.url,
        source: c.source,
      })),
    });
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

  const summary = {
    ok: true,
    candidates: candidates.length,
    created,
    skipped_existing: skipped,
    failed,
  };
  console.log("[cron/scrape-news]", JSON.stringify(summary));
  return NextResponse.json(summary);
}
