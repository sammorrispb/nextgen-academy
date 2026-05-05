import type { Metadata } from "next";
import { seo } from "@/data/seo";
import SectionHeading from "@/components/SectionHeading";
import CTABanner from "@/components/CTABanner";
import RegistrationNotice from "@/components/RegistrationNotice";
import ReserveButton from "@/components/ReserveButton";
import { fetchUpcomingSessions, type NgaSession } from "@/lib/notion-sessions";

export const metadata: Metadata = {
  title: seo.schedule.title,
  description: seo.schedule.description,
  alternates: { canonical: "/schedule" },
};

export const revalidate = 300;

const LEVEL_COLOR: Record<string, string> = {
  Red: "bg-ngpa-skill-red text-white",
  Orange: "bg-ngpa-skill-orange text-white",
  Green: "bg-ngpa-skill-green text-white",
  Yellow: "bg-ngpa-skill-yellow text-ngpa-black",
};

function groupByDate(sessions: NgaSession[]): Map<string, NgaSession[]> {
  const map = new Map<string, NgaSession[]>();
  for (const s of sessions) {
    const arr = map.get(s.date) ?? [];
    arr.push(s);
    map.set(s.date, arr);
  }
  return map;
}

function formatDayHeading(date: string): string {
  const d = new Date(`${date}T12:00:00Z`);
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

export default async function SchedulePage() {
  const sessions = await fetchUpcomingSessions();
  const grouped = groupByDate(sessions);

  return (
    <>
      <h1 className="sr-only">Class Schedule &amp; Registration</h1>

      <section className="bg-ngpa-navy py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto">
          <SectionHeading
            title="Upcoming Sessions"
            subtitle="Drop-in only — $35 per session. Sessions open for registration 7 days ahead. Each court is capped at 4 players."
          />

          <RegistrationNotice />

          {sessions.length === 0 ? (
            <div className="bg-ngpa-panel rounded-2xl border border-ngpa-slate p-6 text-center">
              <h3 className="font-heading text-lg font-bold text-ngpa-white mb-2">
                No sessions open right now
              </h3>
              <p className="text-sm text-ngpa-muted leading-relaxed">
                Sessions open for registration 7 days before they happen.
                Check back soon, or email us to be notified when a slot opens
                near you.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {Array.from(grouped.entries()).map(([date, daySessions]) => (
                <div key={date}>
                  <h2 className="font-heading text-sm font-bold text-ngpa-muted uppercase tracking-wider mb-3">
                    {formatDayHeading(date)}
                  </h2>
                  <div className="space-y-3">
                    {daySessions.map((s) => (
                      <SessionCard key={s.id} session={s} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <CTABanner
        heading="Questions About Registration?"
        description="Tell us about your child and we'll help you find the right group."
        buttonText="Get Started"
        buttonHref="/#contact-form"
        variant="dark"
        trackingSection="schedule_cta_banner"
      />
    </>
  );
}

function SessionCard({ session }: { session: NgaSession }) {
  const levelClass =
    (session.level && LEVEL_COLOR[session.level]) ?? "bg-ngpa-slate text-ngpa-white";

  const seatsText =
    session.status === "Cancelled"
      ? "Cancelled"
      : session.spotsLeft === 0
        ? "Full"
        : `${session.spotsLeft} / ${session.capacity} seats left`;

  const seatsClass =
    session.status === "Cancelled" || session.spotsLeft === 0
      ? "text-red-400"
      : session.spotsLeft <= 2
        ? "text-ngpa-skill-orange"
        : "text-ngpa-muted";

  return (
    <div className="bg-ngpa-panel rounded-xl border border-ngpa-slate p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-4">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          {session.level && (
            <span
              className={`text-xs font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full ${levelClass}`}
            >
              {session.level} Ball
            </span>
          )}
          <span className={`text-xs font-bold ${seatsClass}`}>{seatsText}</span>
        </div>
        <p className="text-base font-bold text-ngpa-white">
          <time dateTime={session.date}>
            {session.startTime}
            {session.endTime ? `–${session.endTime}` : ""}
          </time>
          <span className="text-ngpa-muted font-normal"> · {session.location}</span>
        </p>
        {session.title && (
          <p className="text-sm text-ngpa-muted mt-0.5">{session.title}</p>
        )}
      </div>
      <ReserveButton session={session} />
    </div>
  );
}
