import Link from "next/link";
import {
  fetchUpcomingSessions,
  type NgaSession,
} from "@/lib/notion-sessions";
import {
  fetchUpcomingDropIns,
  type DropInRegistration,
} from "@/lib/notion-dropins";
import { sessionToSlug } from "@/lib/session-slug";
import { isSessionEnded } from "@/lib/session-time";

export const dynamic = "force-dynamic";

// Match the check-in page: a finished session stays reachable for this many
// days so attendance can still be recorded after the slot ends.
const CHECKIN_LOOKBACK_DAYS = 14;

function formatLongDate(date: string): string {
  if (!date) return "";
  const d = new Date(`${date}T12:00:00Z`);
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function groupBySessionKey(
  drops: DropInRegistration[],
): Map<string, DropInRegistration[]> {
  const map = new Map<string, DropInRegistration[]>();
  for (const r of drops) {
    const key = `${r.sessionDate}|${r.sessionTitle}`;
    const arr = map.get(key) ?? [];
    arr.push(r);
    map.set(key, arr);
  }
  return map;
}

function sessionKey(s: NgaSession): string {
  return `${s.date}|${s.title}`;
}

export default async function CoachDashboard() {
  const now = new Date();
  const start = new Date(now);
  start.setDate(start.getDate() - CHECKIN_LOOKBACK_DAYS);
  const end = new Date(now);
  end.setDate(end.getDate() + 60); // 60-day window — wider than /schedule

  const [allSessions, drops] = await Promise.all([
    fetchUpcomingSessions(now, {
      lookbackDays: CHECKIN_LOOKBACK_DAYS,
      includeTerminal: true,
      includeEnded: true,
    }),
    fetchUpcomingDropIns(isoDate(start), isoDate(end)),
  ]);

  const dropsByKey = groupBySessionKey(drops);

  // Split finished slots out so they don't masquerade as "upcoming". A finished
  // session with un-recorded attendance is surfaced as an action item up top;
  // its check-in page stays reachable for CHECKIN_LOOKBACK_DAYS.
  const endedSessions = allSessions
    .filter((s) => isSessionEnded(s.date, s.endTime, now))
    .reverse(); // most recently ended first
  const sessions = allSessions.filter(
    (s) => !isSessionEnded(s.date, s.endTime, now),
  );

  return (
    <>
      <p className="text-xs font-bold tracking-[0.2em] uppercase text-ngpa-teal mb-3">
        Dashboard
      </p>
      <h1 className="font-heading text-3xl sm:text-4xl font-black text-ngpa-white tracking-tight mb-2">
        Upcoming sessions
      </h1>
      <p className="text-base text-ngpa-white/70 leading-relaxed mb-6 max-w-2xl">
        {sessions.length} session{sessions.length === 1 ? "" : "s"} in the next
        30 days · {drops.length} paid registration
        {drops.length === 1 ? "" : "s"} total.
      </p>
      <div className="flex flex-wrap gap-3 mb-8">
        <Link
          href="/coach/eval"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-ngpa-teal/15 border border-ngpa-teal/50 text-ngpa-teal hover:bg-ngpa-teal/25 text-sm font-bold transition-colors"
        >
          Confirm an eval →
        </Link>
        <Link
          href="/coach/players"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-ngpa-slate/60 hover:border-ngpa-teal hover:text-ngpa-teal text-sm font-bold transition-colors"
        >
          View families &amp; profiles →
        </Link>
        <Link
          href="/coach/polls"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-ngpa-slate/60 hover:border-ngpa-teal hover:text-ngpa-teal text-sm font-bold transition-colors"
        >
          Crew polls →
        </Link>
        <Link
          href="/coach/camp-checklist"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-ngpa-slate/60 hover:border-ngpa-teal hover:text-ngpa-teal text-sm font-bold transition-colors"
        >
          Camp checklist →
        </Link>
        <Link
          href="/coach/camps"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-ngpa-slate/60 hover:border-ngpa-teal hover:text-ngpa-teal text-sm font-bold transition-colors"
        >
          Camps →
        </Link>
      </div>

      {endedSessions.length > 0 && (
        <div className="mb-10">
          <h2 className="font-heading text-xl font-black text-ngpa-white tracking-tight mb-1">
            Recently ended
          </h2>
          <p className="text-sm text-ngpa-white/65 mb-4">
            Tap a session to record who showed up.
          </p>
          <div className="space-y-3">
            {endedSessions.map((s) => {
              const roster = dropsByKey.get(sessionKey(s)) ?? [];
              const unrecorded = roster.filter((r) => r.attendance === "");
              const slug = sessionToSlug(s);
              return (
                <Link
                  key={s.id}
                  href={`/coach/${slug}`}
                  className="block bg-ngpa-panel/60 backdrop-blur-sm rounded-2xl border border-ngpa-slate/60 px-5 py-5 sm:px-6 hover:border-ngpa-teal/60 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold uppercase tracking-wider text-ngpa-white/55 mb-1">
                        {formatLongDate(s.date)} · {s.startTime}
                      </p>
                      <p className="font-heading text-lg font-black text-ngpa-white tracking-tight">
                        {s.title}
                      </p>
                      <p className="text-sm text-ngpa-white/65 mt-0.5">
                        {s.location}
                      </p>
                    </div>
                    <div className="shrink-0">
                      {roster.length === 0 ? (
                        <span className="inline-block px-3 py-1 rounded-full bg-ngpa-slate/30 text-ngpa-white/55 text-xs font-bold">
                          No reservations
                        </span>
                      ) : unrecorded.length > 0 ? (
                        <span className="inline-block px-3 py-1 rounded-full bg-amber-400/15 border border-amber-400/40 text-amber-300 text-xs font-bold">
                          {unrecorded.length} to check in →
                        </span>
                      ) : (
                        <span className="inline-block px-3 py-1 rounded-full bg-emerald-400/15 border border-emerald-400/40 text-emerald-300 text-xs font-bold">
                          ✓ All checked in
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {sessions.length === 0 ? (
        <div className="px-5 py-6 rounded-2xl border border-ngpa-slate/60 bg-ngpa-panel/60 text-ngpa-white/70">
          No upcoming sessions in Notion. Add rows to the NGA Sessions Schedule
          DB.
        </div>
      ) : (
        <div className="space-y-3">
          {sessions.map((s) => {
            const roster = dropsByKey.get(sessionKey(s)) ?? [];
            const slug = sessionToSlug(s);
            return (
              <Link
                key={s.id}
                href={`/coach/${slug}`}
                className="block bg-ngpa-panel/80 backdrop-blur-sm rounded-2xl border border-ngpa-slate/60 px-5 py-5 sm:px-6 hover:border-ngpa-teal/60 transition-colors"
              >
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold uppercase tracking-wider text-ngpa-teal mb-1">
                      {formatLongDate(s.date)} · {s.startTime}
                    </p>
                    <p className="font-heading text-lg font-black text-ngpa-white tracking-tight">
                      {s.title}
                    </p>
                    <p className="text-sm text-ngpa-white/65 mt-0.5">
                      {s.location}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-mono font-bold text-2xl text-ngpa-teal leading-none">
                      {roster.length}
                      <span className="text-sm text-ngpa-white/60">
                        {" "}
                        / {s.capacity}
                      </span>
                    </p>
                    <p className="text-xs text-ngpa-white/60 mt-1">
                      reserved
                    </p>
                  </div>
                </div>
                {roster.length > 0 && (
                  <p className="mt-3 text-sm text-ngpa-white/70 truncate">
                    {roster
                      .map((r) => r.childFirstName || r.parentName)
                      .join(", ")}
                  </p>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
