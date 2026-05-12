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

export const dynamic = "force-dynamic";

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
  const end = new Date(now);
  end.setDate(end.getDate() + 60); // 60-day window — wider than /schedule

  const [sessions, drops] = await Promise.all([
    fetchUpcomingSessions(now),
    fetchUpcomingDropIns(isoDate(now), isoDate(end)),
  ]);

  const dropsByKey = groupBySessionKey(drops);

  return (
    <>
      <p className="text-xs font-bold tracking-[0.2em] uppercase text-ngpa-teal mb-3">
        Dashboard
      </p>
      <h1 className="font-heading text-3xl sm:text-4xl font-black text-ngpa-white tracking-tight mb-2">
        Upcoming sessions
      </h1>
      <p className="text-base text-ngpa-white/70 leading-relaxed mb-8 max-w-2xl">
        {sessions.length} session{sessions.length === 1 ? "" : "s"} in the next
        30 days · {drops.length} paid registration
        {drops.length === 1 ? "" : "s"} total.
      </p>

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
