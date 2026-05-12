import Image from "next/image";
import type { Metadata } from "next";
import { seo } from "@/data/seo";
import { seasons } from "@/data/schedule";
import SectionHeading from "@/components/SectionHeading";
import CTABanner from "@/components/CTABanner";
import RegistrationNotice from "@/components/RegistrationNotice";
import ReserveButton from "@/components/ReserveButton";
import ShareButton from "@/components/ShareButton";
import { fetchUpcomingSessions, type NgaSession } from "@/lib/notion-sessions";
import { sessionToSlug } from "@/lib/session-slug";

const SITE_ORIGIN =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.nextgenpbacademy.com";

export const metadata: Metadata = {
  title: seo.schedule.title,
  description: seo.schedule.description,
  alternates: { canonical: "/schedule" },
};

export const revalidate = 300;

const heroSeason = seasons[seasons.length - 1];

const LEVEL_COLOR: Record<string, string> = {
  Red: "bg-ngpa-skill-red text-white",
  Orange: "bg-ngpa-skill-orange text-white",
  Green: "bg-ngpa-skill-green text-white",
  Yellow: "bg-ngpa-skill-yellow text-ngpa-deep",
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

      {/* ─── Hero ─────────────────────────────── */}
      <section className="relative isolate overflow-hidden bg-ngpa-deep">
        <div className="absolute inset-0 -z-10">
          <Image
            src="/images/youth-indoor-player.jpeg"
            alt=""
            fill
            priority
            className="object-cover object-center opacity-30"
            sizes="100vw"
          />
          <div className="absolute inset-0 bg-photo-overlay" />
        </div>
        <div className="absolute inset-x-0 top-0 h-72 bg-teal-glow pointer-events-none" />

        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-10 pt-16 sm:pt-24 pb-20 sm:pb-24">
          <p className="text-xs sm:text-sm font-bold tracking-[0.2em] uppercase text-ngpa-teal mb-4">
            Schedule &amp; Registration
          </p>
          <h2 className="font-heading text-4xl sm:text-5xl lg:text-6xl font-black text-ngpa-white leading-[1.05] tracking-tight max-w-3xl">
            Drop-in sessions on rotating Montgomery County courts.
          </h2>
          <p className="mt-5 text-lg text-ngpa-white/80 leading-relaxed max-w-2xl">
            $40 per 1-hour slot ($80 for both slots in a session). Sessions
            split into Early and Late slots. Each pickleball court is capped
            at 4 players.
          </p>

          <div className="mt-7 inline-flex items-center gap-3 px-5 py-3 rounded-2xl bg-ngpa-panel/80 backdrop-blur-sm border border-ngpa-teal/30">
            <span className="w-2 h-2 rounded-full bg-ngpa-teal animate-pulse" aria-hidden="true" />
            <span className="font-mono text-sm sm:text-base font-bold text-ngpa-white">
              {heroSeason.label}
            </span>
            <span className="text-ngpa-white/50" aria-hidden="true">|</span>
            <span className="text-sm sm:text-base text-ngpa-white/80">{heroSeason.dates}</span>
          </div>
        </div>
      </section>

      {/* ─── Sessions ─────────────────────────── */}
      <section className="bg-ngpa-navy py-20 sm:py-24 px-4 sm:px-6 lg:px-10">
        <div className="max-w-3xl mx-auto">
          <SectionHeading
            eyebrow="Upcoming Sessions"
            title="Pick a date and reserve your spot."
            subtitle="$40 per 1-hour slot. Sessions split into Early and Late — pick one or both. Each pickleball court is capped at 4 players."
          />

          <RegistrationNotice />

          {sessions.length === 0 ? (
            <div className="bg-ngpa-panel/80 backdrop-blur-sm rounded-2xl border border-ngpa-slate/60 p-7 text-center">
              <h3 className="font-heading text-lg font-black text-ngpa-white mb-2 tracking-tight">
                No sessions open right now
              </h3>
              <p className="text-base text-ngpa-white/70 leading-relaxed">
                Sessions roll out as bookings confirm. Check back soon, or
                email us to be notified when a slot opens near you.
              </p>
            </div>
          ) : (
            <div className="space-y-7">
              {Array.from(grouped.entries()).map(([date, daySessions]) => (
                <div key={date}>
                  <h2 className="font-heading text-sm font-bold text-ngpa-teal uppercase tracking-[0.2em] mb-3">
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
        heading="Questions about registration?"
        description="Tell us about your child and we'll help you find the right group."
        buttonText="Get Started"
        buttonHref="/#contact-form"
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
        : "text-ngpa-white/65";

  return (
    <div className="bg-ngpa-panel/80 backdrop-blur-sm rounded-2xl border border-ngpa-slate/60 p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center gap-4 transition-colors hover:border-ngpa-teal/40">
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
          <span className="text-ngpa-white/65 font-normal"> · {session.location}</span>
        </p>
        {session.title && (
          <p className="text-sm text-ngpa-white/65 mt-0.5">{session.title}</p>
        )}
      </div>
      <div className="flex items-center gap-2 sm:flex-col sm:items-stretch">
        <ReserveButton session={session} />
        <ShareButton
          url={`${SITE_ORIGIN}/schedule/${sessionToSlug(session)}`}
          title={`${session.title} · ${session.startTime}`}
          text={`Reserve a $40 drop-in slot at NGA — ${session.title}`}
        />
      </div>
    </div>
  );
}
