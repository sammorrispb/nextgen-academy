import { NextRequest, NextResponse } from "next/server";
import { ensureAllLevelsTuesdays } from "@/lib/recurring-sessions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Maintain a comfortable buffer past the 30-day registration window so a missed
// weekly run never leaves a Tuesday un-seeded inside the bookable horizon.
const WEEKS_AHEAD = 8;

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

  // ET calendar "today" (en-CA → YYYY-MM-DD) so the next-Tuesday math anchors
  // to the operator's timezone, not the server's UTC.
  const todayEt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
  }).format(new Date());

  try {
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
    return NextResponse.json({ ok: true, today: todayEt, ...result });
  } catch (err) {
    console.error("[cron/seed-tuesday-sessions] failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 },
    );
  }
}
