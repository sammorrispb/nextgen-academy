import { NextRequest, NextResponse } from "next/server";
import {
  fetchActiveSessionsOnOrBefore,
  setSessionLifecycle,
} from "@/lib/notion-sessions";
import { isSessionEnded, lifecycleStatusFor } from "@/lib/session-time";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

  const now = new Date();
  // ET calendar date "today" (en-CA → YYYY-MM-DD) — the upper bound for the
  // active-sessions query.
  const todayEt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
  }).format(now);

  const candidates = await fetchActiveSessionsOnOrBefore(todayEt, 3);
  const ended = candidates.filter((s) =>
    isSessionEnded(s.date, s.endTime, now),
  );

  let completed = 0;
  let passed = 0;
  for (const s of ended) {
    const status = lifecycleStatusFor(s.registeredCount);
    const note = `Auto-lifecycle ${todayEt}: end time ${s.endTime} ET passed. Registered count ${s.registeredCount} → ${status}${status === "Passed" ? " (no completion)" : ""}.`;
    await setSessionLifecycle(s.id, status, note);
    if (status === "Completed") completed += 1;
    else passed += 1;
  }

  return NextResponse.json({
    scanned: candidates.length,
    ended: ended.length,
    completed,
    passed,
  });
}
