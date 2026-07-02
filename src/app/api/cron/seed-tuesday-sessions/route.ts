import { withCronAlert } from "@/lib/cron-alert";
import { ensureWeeklyTemplates } from "@/lib/recurring-sessions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Phase 2a: this route now seeds ALL active weekly templates (Mon–Thu — see
// src/data/recurring-templates.ts), not just Tuesday. The path keeps its
// historical name so the vercel.json cron entry and dashboards stay stable.
//
// `?dryRun=1` returns the would-create list without writing a single row —
// run it against the live Sessions DB before trusting a new template.

// Maintain a comfortable buffer past the 30-day registration window so a missed
// weekly run never leaves an evening un-seeded inside the bookable horizon.
const WEEKS_AHEAD = 8;

export const GET = withCronAlert("seed-tuesday-sessions", async (req) => {
  const dryRun = new URL(req.url).searchParams.get("dryRun") === "1";

  // ET calendar "today" (en-CA → YYYY-MM-DD) so the next-occurrence math
  // anchors to the operator's timezone, not the server's UTC.
  const todayEt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
  }).format(new Date());

  // A thrown error is caught by the wrapper (alert + 500). Per-row create
  // failures ride back as `seed_row_failed` failures below, so they alert too.
  const result = await ensureWeeklyTemplates(todayEt, WEEKS_AHEAD, { dryRun });
  console.log(
    "[cron/seed-tuesday-sessions]",
    JSON.stringify({
      today: todayEt,
      dryRun,
      created: result.created.length,
      wouldCreate: result.wouldCreate.length,
      skipped: result.skipped,
      failed: result.failed.length,
    }),
  );
  return {
    attempted: result.created.length + result.failed.length,
    succeeded: result.created.length,
    // failed entries are "YYYY-MM-DD TitleBase — Level" strings — no PII.
    failures: result.failed.map((f) => ({
      signature: "seed_row_failed",
      ref: f,
    })),
    body: { today: todayEt, ...result },
  };
});
