import { NextRequest, NextResponse } from "next/server";
import { withCronAlert } from "@/lib/cron-alert";
import { ensureWeeklyTemplates, parseDryRunParam } from "@/lib/recurring-sessions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// The first live run after adding an evening is a burst of creates at the
// ~350ms Notion throttle — give it headroom past the default window. A run
// that still times out is safe: the seeder is idempotent, the next tick
// finishes the remainder.
export const maxDuration = 60;

// Phase 2a: this route now seeds ALL active weekly templates (Mon–Thu — see
// src/data/recurring-templates.ts), not just Tuesday. The path keeps its
// historical name so the vercel.json cron entry and dashboards stay stable.
//
// `?dryRun=1|true|yes` returns the would-create list without writing a single
// row — run it against the live Sessions DB before trusting a new template.
// Any OTHER non-empty dryRun value is a 400, never a silent live run (F6).

// Maintain a comfortable buffer past the 30-day registration window so a missed
// weekly run never leaves an evening un-seeded inside the bookable horizon.
const WEEKS_AHEAD = 8;

const handler = withCronAlert("seed-tuesday-sessions", async (req) => {
  const parsed = parseDryRunParam(new URL(req.url).searchParams.get("dryRun"));
  // Invalid values were already 400'd in GET below; this is the typed unwrap.
  const dryRun = parsed.ok ? parsed.dryRun : false;

  // ET calendar "today" (en-CA → YYYY-MM-DD) so the next-occurrence math
  // anchors to the operator's timezone, not the server's UTC.
  const todayEt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
  }).format(new Date());

  // A thrown error is caught by the wrapper (alert + 500). Per-row create
  // failures ride back as `seed_row_failed`; run-level problems (missing env,
  // invalid template config, live rows drifted from the template time) ride
  // back as their own signatures — none of them is ever a green no-op.
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
      failures: result.failures.map((f) => f.signature),
    }),
  );
  return {
    attempted: result.created.length + result.failed.length,
    succeeded: result.created.length,
    failures: [
      // Run-level entries (config_missing / config_invalid / time_drift) —
      // already PII-free: template names, dates, venue-titled rows.
      ...result.failures,
      // failed entries are "YYYY-MM-DD TitleBase — Level" strings — no PII.
      ...result.failed.map((f) => ({ signature: "seed_row_failed", ref: f })),
    ],
    body: { today: todayEt, ...result },
  };
});

export async function GET(req: NextRequest): Promise<NextResponse> {
  // Param-shape gate BEFORE the run: an unrecognized dryRun value must never
  // fall through to a live write (F6).
  const parsed = parseDryRunParam(new URL(req.url).searchParams.get("dryRun"));
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }
  return handler(req);
}
