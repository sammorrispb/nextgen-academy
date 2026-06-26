import { secretEquals } from "@/lib/secret-compare";
import { NextRequest, NextResponse } from "next/server";
import { runCampChecklistReminder } from "@/lib/camp-checklist-reminder";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * 7am-ET coach checklist nudge. Vercel cron fires daily (0 11 * * * UTC = 7am
 * EDT; summer camps run on EDT) and no-ops on days with no scheduled camp.
 * Emails the coach allowlist a link to /coach/camp-checklist before drop-off.
 * Auth = Bearer CRON_SECRET (Vercel injects it; a manual curl needs the header).
 *
 * Query params (manual runs):
 *   ?dryRun=1          preview recipients + rendered sample, no send
 *   ?date=2026-06-29   override ET "today" (test a specific camp day)
 *
 * No parent/child data is involved — recipients are coaches only.
 */
export async function GET(req: NextRequest) {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    return NextResponse.json(
      { error: "CRON_SECRET not configured" },
      { status: 500 },
    );
  }
  const auth = req.headers.get("authorization") ?? "";
  if (!secretEquals(auth, `Bearer ${expected}`)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const params = req.nextUrl.searchParams;
  const dryRun = params.get("dryRun") === "1";
  const today = params.get("date") ?? undefined;

  try {
    const result = await runCampChecklistReminder({ today, dryRun });
    const status = result.ok ? 200 : 500;
    return NextResponse.json(result, { status });
  } catch (err) {
    console.error("[camp-checklist-reminder] run threw", err);
    return NextResponse.json(
      { ok: false, error: "camp checklist reminder run failed" },
      { status: 500 },
    );
  }
}
