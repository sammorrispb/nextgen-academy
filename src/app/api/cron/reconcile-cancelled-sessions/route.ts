import { withCronAlert, type CronFailure } from "@/lib/cron-alert";
import { REGISTRATION_WINDOW_DAYS } from "@/data/schedule";
import { fetchUpcomingDropIns } from "@/lib/notion-dropins";
import { fetchCancelledSessionsInWindow } from "@/lib/notion-sessions";
import { executeSessionCancel } from "@/lib/session-cancel";
import {
  normalizeCancelReason,
  rosterForSession,
  sessionNeedsCancelFanout,
} from "@/lib/reconcile-cancelled";

export const runtime = "nodejs";
// Cron path — never cache.
export const dynamic = "force-dynamic";

/**
 * Reconcile sessions cancelled BY HAND in Notion: refund + notify the
 * registrants that the coach "Cancel session, notify all" button would have.
 *
 * Flipping a session row to `Cancelled` in Notion (the common weather pull)
 * fires no refunds and no parent comms — only executeSessionCancel does. This
 * cron sweeps upcoming Cancelled rows and, for any that still have un-refunded
 * Confirmed registrants, fires that same idempotent engine. Self-healing: once
 * everyone is refunded + notified, later ticks read the roster and skip, so no
 * duplicate refund or email. Bounded to upcoming sessions (today ET forward) so
 * it can NEVER retroactively refund a past session marked Cancelled for
 * bookkeeping.
 */

/** Today's ISO date (YYYY-MM-DD) in America/New_York. The lower bound of the
 * sweep window — past sessions are intentionally excluded. */
function todayEtIso(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const y = parts.find((p) => p.type === "year")?.value ?? "";
  const m = parts.find((p) => p.type === "month")?.value ?? "";
  const d = parts.find((p) => p.type === "day")?.value ?? "";
  return `${y}-${m}-${d}`;
}

/** toIso = today ET + REGISTRATION_WINDOW_DAYS, matching the schedule horizon. */
function windowEndIso(fromIso: string): string {
  const [y, mo, d] = fromIso.split("-").map(Number);
  const ms = Date.UTC(y, mo - 1, d) + REGISTRATION_WINDOW_DAYS * 86_400_000;
  return new Date(ms).toISOString().slice(0, 10);
}

export const GET = withCronAlert("reconcile-cancelled-sessions", async () => {
  const fromIso = todayEtIso();
  const toIso = windowEndIso(fromIso);

  const cancelled = await fetchCancelledSessionsInWindow(fromIso, toIso);
  if (cancelled.length === 0) {
    const summary = { window: { fromIso, toIso }, cancelled: 0, acted: 0 };
    console.log("[cron/reconcile-cancelled-sessions]", JSON.stringify(summary));
    return {
      attempted: 0,
      succeeded: 0,
      failures: [],
      body: { ...summary, outcomes: [] },
    };
  }

  // One roster read per distinct cancelled date covers every level on that day.
  const drops = await fetchUpcomingDropIns(fromIso, toIso, { revalidate: 0 });

  const outcomes: Array<Record<string, unknown>> = [];
  // A failed refund/notify fan-out used to be a count behind ok:true — money
  // movement for a cancelled session stalled with no signal to Sam.
  const failures: CronFailure[] = [];
  let acted = 0;
  let fanoutOk = 0;
  for (const session of cancelled) {
    const roster = rosterForSession(drops, {
      title: session.title,
      date: session.date,
    });
    if (!sessionNeedsCancelFanout(roster)) {
      outcomes.push({
        sessionRowId: session.id,
        title: session.title,
        date: session.date,
        action: "skipped",
        reason: roster.length === 0 ? "no_confirmed_roster" : "already_notified",
        roster: roster.length,
      });
      continue;
    }

    acted += 1;
    const result = await executeSessionCancel({
      sessionRowId: session.id,
      sessionTitle: session.title,
      sessionDate: session.date,
      sessionStartTime: session.startTime,
      reason: normalizeCancelReason(session.cancelReason),
      note: session.cancelNote || undefined,
    });
    outcomes.push({
      sessionRowId: session.id,
      title: session.title,
      date: session.date,
      action: "fan_out",
      ok: result.ok,
      message: result.message,
      refunded: result.refunded ?? 0,
      emailSent: result.emailSent ?? 0,
      smsSent: result.smsSent ?? 0,
      errors: result.errors ?? 0,
    });
    if (!result.ok) {
      failures.push({
        signature: "session_cancel_fanout_failed",
        ref: session.id,
        detail: result.message,
      });
    } else {
      fanoutOk += 1;
      if ((result.errors ?? 0) > 0) {
        failures.push({
          signature: "session_cancel_partial_errors",
          ref: session.id,
          detail: `${result.errors} registrant-level error(s) during refund/notify fan-out`,
        });
      }
    }
  }

  const summary = {
    window: { fromIso, toIso },
    cancelled: cancelled.length,
    acted,
    errors: outcomes.filter((o) => o.action === "fan_out" && !o.ok).length,
  };
  console.log("[cron/reconcile-cancelled-sessions]", JSON.stringify(summary));

  return {
    attempted: acted,
    succeeded: fanoutOk,
    failures,
    body: { ...summary, outcomes },
  };
  // Every-2h cron (vercel.json `0 */2 * * *`): cap alert EMAILS to 4 UTC
  // windows a day so a stuck dependency can't burn 12 re-alerts/day from the
  // shared Resend 100/day quota — same stateless throttle as the two hourly
  // crons. Every failing run still 500s + logs the full alert body.
}, { alertEmailUtcHours: [0, 6, 12, 18] });
