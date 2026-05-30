import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { verifyCommitToken } from "@/lib/commit-token";
import { fetchUpcomingSessions } from "@/lib/notion-sessions";
import { buildCrewId } from "@/lib/commit-token";
import { findCommitByEmailChildCrew } from "@/lib/notion-crew-commits";
import CommitForm from "@/components/CommitForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Lock in 4 weeks — Next Gen Pickleball Academy",
  description: "Auto-reserve the next 4 weekly crew sessions.",
  robots: { index: false, follow: false },
};

interface PageProps {
  params: Promise<{ token: string }>;
}

function formatLongDate(date: string): string {
  if (!date) return "";
  const d = new Date(`${date}T12:00:00Z`);
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

export default async function CommitPage({ params }: PageProps) {
  const { token } = await params;
  const payload = verifyCommitToken(token);
  if (!payload) notFound();

  const [sessions, existing] = await Promise.all([
    fetchUpcomingSessions(),
    findCommitByEmailChildCrew(
      payload.parentEmail,
      payload.childFirstName,
      payload.crewId,
    ),
  ]);

  // Match the parent's crew-id against upcoming open sessions and show the
  // next 4 — that's what will get auto-reserved as space opens.
  const matching = sessions
    .filter((s) => {
      if (s.status === "Cancelled") return false;
      const sid = buildCrewId({
        level: s.level ?? "",
        date: s.date,
        startTime: s.startTime,
        location: s.location,
      });
      return sid === payload.crewId;
    })
    .slice(0, 4);

  const isAlreadyActive = existing?.status === "Active";
  const isCompleted = existing?.status === "Completed";

  return (
    <div className="min-h-screen bg-ngpa-navy text-ngpa-white">
      <section className="relative isolate overflow-hidden bg-ngpa-deep">
        <div className="absolute inset-x-0 top-0 h-72 bg-teal-glow pointer-events-none" />
        <div className="relative max-w-3xl mx-auto px-4 sm:px-6 lg:px-10 pt-16 sm:pt-20 pb-10">
          <p className="text-xs sm:text-sm font-bold tracking-[0.2em] uppercase text-ngpa-teal mb-4">
            4-Week Commit
          </p>
          <h1 className="font-heading text-3xl sm:text-4xl lg:text-5xl font-black text-ngpa-white leading-[1.05] tracking-tight">
            Lock in {payload.childFirstName}&rsquo;s next 4 weeks.
          </h1>
          <p className="mt-5 text-lg text-ngpa-white/80 leading-relaxed max-w-2xl">
            Same time, same court, same crew. We&rsquo;ll auto-reserve {payload.childFirstName}&rsquo;s
            spot each week and charge $20 to your card only when their seat actually
            opens. Skip any week with one tap &mdash; we&rsquo;ll refund automatically.
          </p>
        </div>
      </section>

      <section className="bg-ngpa-navy py-10 sm:py-14 px-4 sm:px-6 lg:px-10">
        <div className="max-w-2xl mx-auto space-y-8">
          <div className="bg-ngpa-panel/80 backdrop-blur rounded-2xl p-6 border border-ngpa-slate/60">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-ngpa-teal mb-3">
              Your crew
            </p>
            <p className="font-mono text-ngpa-white/85 break-words">
              {payload.crewId.split("|").filter(Boolean).join(" · ") || "Crew details forthcoming"}
            </p>
            {matching.length > 0 ? (
              <>
                <p className="mt-5 text-xs font-bold uppercase tracking-[0.18em] text-ngpa-teal mb-2">
                  Next {matching.length} session{matching.length === 1 ? "" : "s"} we&rsquo;ll auto-reserve
                </p>
                <ul className="space-y-1.5 text-sm text-ngpa-white/85">
                  {matching.map((s) => (
                    <li key={s.id} className="font-mono">
                      {formatLongDate(s.date)} · {s.startTime} · {s.location}
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="mt-5 text-sm text-ngpa-white/65">
                No matching sessions on the schedule yet. Coach Sam adds them
                weekly; we&rsquo;ll auto-reserve {payload.childFirstName}&rsquo;s spot
                the morning each one opens.
              </p>
            )}
          </div>

          {isCompleted ? (
            <div className="bg-ngpa-panel/80 backdrop-blur rounded-2xl p-8 border border-ngpa-slate/60 text-center">
              <h2 className="font-heading text-2xl font-black text-ngpa-white mb-3 tracking-tight">
                Your 4-week run is complete.
              </h2>
              <p className="text-ngpa-white/75 mb-4">
                {payload.childFirstName} finished the crew. To start another
                4-week block, ask Coach Sam for a fresh link.
              </p>
            </div>
          ) : isAlreadyActive ? (
            <div className="bg-ngpa-panel/80 backdrop-blur rounded-2xl p-8 border border-ngpa-slate/60 text-center">
              <h2 className="font-heading text-2xl font-black text-ngpa-white mb-3 tracking-tight">
                You&rsquo;re already locked in.
              </h2>
              <p className="text-ngpa-white/75">
                Reserved {existing!.weeksReserved} of {existing!.weeksCommitted} so far.
                Need to change your card or stop the auto-reserve? Email{" "}
                <a
                  href="mailto:nextgenacademypb@gmail.com"
                  className="text-ngpa-teal hover:underline"
                >
                  nextgenacademypb@gmail.com
                </a>
                .
              </p>
            </div>
          ) : (
            <CommitForm
              token={token}
              parentEmail={payload.parentEmail}
              childFirstName={payload.childFirstName}
            />
          )}
        </div>
      </section>
    </div>
  );
}
