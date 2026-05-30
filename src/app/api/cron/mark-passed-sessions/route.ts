import { NextRequest, NextResponse } from "next/server";
import {
  fetchActiveSessionsOnOrBefore,
  setSessionLifecycle,
} from "@/lib/notion-sessions";
import {
  isSessionEnded,
  lifecycleStatusFor,
  sessionEndUtcMs,
} from "@/lib/session-time";

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

  // Past-dated rows whose end time can't be parsed: isSessionEnded fails open,
  // so these never hide from the schedule AND never get auto-stamped — they'd
  // linger invisibly forever. Surface them (logs + response) so a typo'd time
  // gets caught instead of rotting. Lexical compare is safe for YYYY-MM-DD.
  const unparseable = candidates.filter(
    (s) => s.date < todayEt && sessionEndUtcMs(s.date, s.endTime) == null,
  );
  for (const s of unparseable) {
    console.warn(
      `[cron/mark-passed-sessions] unparseable end time on past row: ${s.id} "${s.title}" ${s.date} "${s.endTime}"`,
    );
  }

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
    unparseable: unparseable.map((s) => ({
      id: s.id,
      title: s.title,
      date: s.date,
      endTime: s.endTime,
    })),
  });
}
