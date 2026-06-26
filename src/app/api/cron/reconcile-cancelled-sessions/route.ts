import { secretEquals } from "@/lib/secret-compare";
import { NextRequest, NextResponse } from "next/server";
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

  const fromIso = todayEtIso();
  const toIso = windowEndIso(fromIso);

  const cancelled = await fetchCancelledSessionsInWindow(fromIso, toIso);
  if (cancelled.length === 0) {
    const summary = { window: { fromIso, toIso }, cancelled: 0, acted: 0 };
    console.log("[cron/reconcile-cancelled-sessions]", JSON.stringify(summary));
    return NextResponse.json({ ok: true, ...summary, outcomes: [] });
  }

  // One roster read per distinct cancelled date covers every level on that day.
  const drops = await fetchUpcomingDropIns(fromIso, toIso, { revalidate: 0 });

  const outcomes: Array<Record<string, unknown>> = [];
  let acted = 0;
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
  }

  const summary = {
    window: { fromIso, toIso },
    cancelled: cancelled.length,
    acted,
    errors: outcomes.filter((o) => o.action === "fan_out" && !o.ok).length,
  };
  console.log("[cron/reconcile-cancelled-sessions]", JSON.stringify(summary));

  return NextResponse.json({ ok: true, ...summary, outcomes });
}
