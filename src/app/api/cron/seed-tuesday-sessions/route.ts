import { withCronAlert } from "@/lib/cron-alert";
import { ensureAllLevelsTuesdays } from "@/lib/recurring-sessions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Maintain a comfortable buffer past the 30-day registration window so a missed
// weekly run never leaves a Tuesday un-seeded inside the bookable horizon.
const WEEKS_AHEAD = 8;

export const GET = withCronAlert("seed-tuesday-sessions", async () => {
  // ET calendar "today" (en-CA → YYYY-MM-DD) so the next-Tuesday math anchors
  // to the operator's timezone, not the server's UTC.
  const todayEt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
  }).format(new Date());

  // A thrown error is caught by the wrapper (alert + 500), matching the old
  // catch block. Per-row failures used to ride back as 200 — now they alert.
  const result = await ensureAllLevelsTuesdays(todayEt, WEEKS_AHEAD);
  console.log(
    "[cron/seed-tuesday-sessions]",
    JSON.stringify({
      today: todayEt,
      created: result.created.length,
      skipped: result.skipped,
      failed: result.failed.length,
    }),
  );
  return {
    ok: result.failed.length === 0,
    attempted: result.created.length + result.failed.length,
    succeeded: result.created.length,
    // failed entries are "YYYY-MM-DD Level" strings — no PII.
    failures: result.failed.map((f) => ({
      signature: "seed_row_failed",
      ref: f,
    })),
    body: { today: todayEt, ...result },
  };
});
