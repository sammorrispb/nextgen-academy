import { withCronAlert, type CronFailure } from "@/lib/cron-alert";
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

export const GET = withCronAlert("mark-passed-sessions", async () => {
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

  // Unparseable past rows used to be console.warn'd behind a 200 — they linger
  // invisibly forever (never hidden, never stamped) until someone reads logs.
  // Surface them so a typo'd time gets fixed instead of rotting.
  const failures: CronFailure[] = unparseable.map((s) => ({
    signature: "unparseable_end_time",
    ref: s.id,
    detail: `${s.date} end="${s.endTime}"`,
  }));

  let completed = 0;
  let passed = 0;
  for (const s of ended) {
    const status = lifecycleStatusFor(s.registeredCount);
    const note = `Auto-lifecycle ${todayEt}: end time ${s.endTime} ET passed. Registered count ${s.registeredCount} → ${status}${status === "Passed" ? " (no completion)" : ""}.`;
    // Only count a success when the Notion write actually stuck — a false
    // return used to be swallowed here, so a dead write path looked green
    // while the row lingered on the schedule.
    const wrote = await setSessionLifecycle(s.id, status, note);
    if (!wrote) {
      failures.push({
        signature: "lifecycle_write_failed",
        ref: s.id,
        detail: `status "${status}" did not stick; row stays on the schedule until the next tick`,
      });
      continue;
    }
    if (status === "Completed") completed += 1;
    else passed += 1;
  }

  return {
    attempted: ended.length,
    succeeded: completed + passed,
    failures,
    body: {
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
    },
  };
  // Hourly cron (vercel.json `0 * * * *`): cap alert EMAILS to 4 UTC windows a
  // day so a stuck dependency can't burn the shared Resend 100/day quota
  // (24–48 re-alerts/day). Every failing run still 500s + logs the full alert.
}, { alertEmailUtcHours: [0, 6, 12, 18] });
