import Link from "next/link";
import type { NgaSession } from "@/lib/notion-sessions";
import { sessionToSlug } from "@/lib/session-slug";
import { inferCity } from "@/lib/venue-lookup";
import EmptyStateWaitlist from "@/components/EmptyStateWaitlist";

interface UpcomingSessionsProps {
  sessions: NgaSession[];
}

const LEVEL_COLOR: Record<string, string> = {
  Red: "bg-ngpa-skill-red text-white",
  Orange: "bg-ngpa-skill-orange text-white",
  Green: "bg-ngpa-skill-green text-white",
  Yellow: "bg-ngpa-skill-yellow text-ngpa-deep",
};

function formatDay(date: string): string {
  const d = new Date(`${date}T12:00:00Z`);
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export default function UpcomingSessions({ sessions }: UpcomingSessionsProps) {
  const upcoming = sessions.slice(0, 4);

  return (
    <section
      aria-labelledby="upcoming-sessions-heading"
      className="relative bg-ngpa-navy py-16 sm:py-20 px-4 sm:px-6 lg:px-10 border-t border-ngpa-slate/40"
    >
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-8 sm:mb-10">
          <p className="font-heading text-xs font-bold text-ngpa-teal uppercase tracking-[0.2em] mb-3">
            This week
          </p>
          <h2
            id="upcoming-sessions-heading"
            className="font-heading text-3xl sm:text-4xl font-black text-ngpa-white tracking-tight"
          >
            We coach across Montgomery County Public Schools.
          </h2>
          <p className="mt-3 text-base sm:text-lg text-ngpa-white/70 max-w-2xl mx-auto">
            Sessions rotate by demand &mdash; closer to more zip codes than a
            single fixed venue.
          </p>
        </div>

        {upcoming.length === 0 ? (
          <div className="max-w-xl mx-auto">
            <EmptyStateWaitlist
              heading="No sessions open this week."
              source="home_upcoming_empty"
            />
          </div>
        ) : (
          <>
            <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
              {upcoming.map((session) => {
                const city = inferCity(session.location);
                const levelClass =
                  (session.level && LEVEL_COLOR[session.level]) ??
                  "bg-ngpa-slate text-ngpa-white";
                const spotsBadge =
                  session.spotsLeft === 0
                    ? { text: "Full", cls: "text-red-400" }
                    : session.spotsLeft <= 2
                      ? {
                          text: `${session.spotsLeft} spot${session.spotsLeft === 1 ? "" : "s"} left`,
                          cls: "text-ngpa-skill-orange",
                        }
                      : {
                          text: `${session.spotsLeft} spots`,
                          cls: "text-ngpa-white/60",
                        };

                return (
                  <li key={session.id}>
                    <Link
                      href={`/schedule/${sessionToSlug(session)}`}
                      className="block h-full rounded-2xl bg-ngpa-panel/80 backdrop-blur-sm border border-ngpa-slate/60 p-5 hover:border-ngpa-teal/50 hover:bg-ngpa-panel transition-all min-h-[48px]"
                    >
                      <div className="flex items-center gap-2 mb-3 flex-wrap">
                        {session.level && (
                          <span
                            className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${levelClass}`}
                          >
                            {session.level} Ball
                          </span>
                        )}
                        <span className={`text-xs font-bold ${spotsBadge.cls}`}>
                          {spotsBadge.text}
                        </span>
                      </div>
                      <p className="font-heading text-base font-bold text-ngpa-white mb-1">
                        <time dateTime={session.date}>
                          {formatDay(session.date)}
                        </time>
                        {session.startTime ? (
                          <span className="text-ngpa-white/70 font-normal">
                            {" "}
                            &middot; {session.startTime}
                          </span>
                        ) : null}
                      </p>
                      <p className="text-sm text-ngpa-white/80 leading-snug">
                        {session.location}
                      </p>
                      {city && (
                        <p className="text-xs text-ngpa-white/55 mt-1">
                          {city}, MD
                        </p>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
            <div className="mt-8 text-center">
              <Link
                href="/schedule"
                className="inline-flex items-center justify-center gap-2 text-base font-bold text-ngpa-teal hover:text-ngpa-teal-bright transition-colors min-h-[48px]"
              >
                See all upcoming sessions
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </Link>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
