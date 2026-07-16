import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { seo } from "@/data/seo";
import { seasons } from "@/data/schedule";
import SectionHeading from "@/components/SectionHeading";
import CTABanner from "@/components/CTABanner";
import CrewPathway from "@/components/CrewPathway";
import RegistrationNotice from "@/components/RegistrationNotice";
import SessionCard from "@/components/SessionCard";
import SessionGroupCard from "@/components/SessionGroupCard";
import JsonLd from "@/components/JsonLd";
import { fetchUpcomingSessions, type NgaSession } from "@/lib/notion-sessions";
import { groupSessions, sortByLevel } from "@/lib/schedule-grouping";
import { sportsEventJsonLd } from "@/lib/sports-event-jsonld";
import EmptyStateWaitlist from "@/components/EmptyStateWaitlist";
import WeatherBar from "@/components/WeatherBar";
import { fetchWeatherForDates, upcomingDates } from "@/lib/weather";
import { breadcrumbJsonLd, courseJsonLd, SITE_URL } from "@/lib/seo";

const SITE_ORIGIN =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://nextgenpbacademy.com";

export const metadata: Metadata = {
  // Absolute title (skips "%s | Next Gen Pickleball Academy") to stay
  // inside Google's ~60-char title truncation budget.
  title: { absolute: seo.schedule.title },
  description: seo.schedule.description,
  alternates: { canonical: "/schedule" },
};

export const revalidate = 300;

const heroSeason = seasons[seasons.length - 1];

// Schedule page Course tiers — same canonical list as /schools; surfaced
// here too so the schedule page can answer "what's the tier ladder" for AI.
const SCHEDULE_COURSE_TIERS = [
  {
    name: "NGA Red Ball — Youth Pickleball Group Lessons (Pre-Rally)",
    description:
      "Foam-ball group sessions for kids ages 6–16 new to the court — its own court at the Red level. Builds paddle control, footwork, and sustained back-and-forth. Private lessons available to fast-track.",
    educationalLevel: "Beginner / Rookie",
    minAge: 6,
    ballColor: "Red" as const,
  },
  {
    name: "NGA Orange Ball — Youth Pickleball Group Lessons (Building)",
    description:
      "Group pickleball sessions that layer in rules mastery and full-court movement — the bridge from rallying into Green Ball play. Its own court at the Orange level; private lessons available to fast-track.",
    educationalLevel: "Pro",
    minAge: 8,
    ballColor: "Orange" as const,
  },
  {
    name: "NGA Green Ball — Youth Pickleball Group Lessons",
    description:
      "Small-group pickleball sessions for kids 10+ — shot selection, court positioning, and doubles teamwork.",
    educationalLevel: "Vet",
    minAge: 10,
    ballColor: "Green" as const,
  },
  {
    name: "NGA Yellow Ball — Tournament-Track Youth Pickleball",
    description:
      "Coach-curated competitive track for kids 12+ — small groups of 3–5 athletes with custom scheduling and focused tournament prep. Invite-only.",
    educationalLevel: "Boss",
    minAge: 12,
    ballColor: "Yellow" as const,
  },
];

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
  // Always show today + the next seven days, regardless of which days have
  // sessions. Days with sessions are windowed to the worst session; other days
  // use the daylight outdoor-play window.
  const weatherDates = upcomingDates(8);
  const weather = await fetchWeatherForDates(sessions, weatherDates);

  return (
    <>
      <h1 className="sr-only">
        Youth Pickleball Schedule &mdash; Montgomery County, MD
      </h1>

      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", url: `${SITE_URL}/` },
          { name: "Schedule", url: `${SITE_URL}/schedule` },
        ])}
      />

      {SCHEDULE_COURSE_TIERS.map((tier) => (
        <JsonLd key={`schedule-course-${tier.ballColor}`} data={courseJsonLd(tier)} />
      ))}

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
            $20 per 1-hour drop-in slot. Each pickleball court is capped at 4
            players.
          </p>
          <p className="mt-3 text-sm text-ngpa-white/60 leading-relaxed max-w-2xl">
            Sessions are outdoors &mdash; if we cancel for weather, you get an
            automatic full refund. Otherwise registrations are non-refundable,
            so please register only when you&rsquo;re confident you can attend.
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
      {/* ─── Summer Camp callout ─────────────── */}
      <section className="bg-ngpa-navy px-4 sm:px-6 lg:px-10 pt-12 sm:pt-16">
        <div className="max-w-3xl mx-auto">
          <Link
            href="/camp"
            className="group flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 rounded-2xl border border-ngpa-teal/40 bg-ngpa-teal/10 p-5 sm:p-6 hover:border-ngpa-teal transition-colors"
          >
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-ngpa-teal-bright">
                New · Summer 2026
              </p>
              <p className="font-heading text-lg sm:text-xl font-bold text-ngpa-white mt-1">
                Summer Pickleball Camp in Gaithersburg
              </p>
              <p className="text-sm text-ngpa-muted mt-0.5">
                Two weeks (Jun 29 &amp; Jul 20), ages 8 &amp; up &middot; full &amp;
                half-day options &middot; small groups.
              </p>
            </div>
            <span className="shrink-0 inline-flex items-center justify-center px-5 py-3 rounded-full bg-ngpa-teal text-ngpa-deep font-heading font-bold group-hover:bg-ngpa-teal-bright transition-colors min-h-[48px]">
              See camp &rarr;
            </span>
          </Link>
        </div>
      </section>

      {/* ─── MVF Montgomery Village callout ──── */}
      <section className="bg-ngpa-navy px-4 sm:px-6 lg:px-10 pt-6">
        <div className="max-w-3xl mx-auto">
          <Link
            href="/montgomery-village-youth-pickleball"
            className="group flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 rounded-2xl border border-ngpa-teal/40 bg-ngpa-teal/10 p-5 sm:p-6 hover:border-ngpa-teal transition-colors"
          >
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-ngpa-teal-bright">
                New &middot; Fall 2026
              </p>
              <p className="font-heading text-lg sm:text-xl font-bold text-ngpa-white mt-1">
                MVF Youth Pickleball in Montgomery Village
              </p>
              <p className="text-sm text-ngpa-muted mt-0.5">
                Intro class Aug 27 + two fall Thursday sessions at Apple Ridge,
                ages 8&ndash;16 &middot; registration through the Montgomery
                Village Foundation.
              </p>
            </div>
            <span className="shrink-0 inline-flex items-center justify-center px-5 py-3 rounded-full bg-ngpa-teal text-ngpa-deep font-heading font-bold group-hover:bg-ngpa-teal-bright transition-colors min-h-[48px]">
              See MVF classes &rarr;
            </span>
          </Link>
        </div>
      </section>

      {/* ─── Sessions ─────────────────────────── */}
      <section className="bg-ngpa-navy py-20 sm:py-24 px-4 sm:px-6 lg:px-10">
        <div className="max-w-3xl mx-auto">
          <SectionHeading
            eyebrow="Upcoming Sessions"
            title="Pick a date and reserve your spot."
            subtitle="$20 per 1-hour drop-in slot. Each pickleball court is capped at 4 players."
          />

          <RegistrationNotice />

          <WeatherBar dates={weatherDates} weather={weather} />

          {sessions.length === 0 && (
            <EmptyStateWaitlist source="schedule_empty" />
          )}

          {sessions.length > 0 && (
            <div className="space-y-7">
              {/* Server-rendered per-session schema — independent of the
                 client-side collapse state, so grouped sessions stay visible
                 to crawlers. */}
              {sessions.map((s) => (
                <JsonLd key={`event-${s.id}`} data={sportsEventJsonLd(s)} />
              ))}
              {Array.from(grouped.entries()).map(([date, daySessions], dayIdx) => {
                const items = groupSessions(sortByLevel(daySessions));
                return (
                  <div key={date}>
                    <h2 className="font-heading text-sm font-bold text-ngpa-teal uppercase tracking-[0.2em] mb-3">
                      {formatDayHeading(date)}
                    </h2>
                    <div className="space-y-3">
                      {items.map((item, itemIdx) =>
                        item.kind === "single" ? (
                          <SessionCard
                            key={item.session.id}
                            session={item.session}
                            siteOrigin={SITE_ORIGIN}
                            highlighted={dayIdx === 0 && itemIdx === 0}
                          />
                        ) : (
                          <SessionGroupCard
                            key={item.key}
                            sessions={item.sessions}
                            highlighted={dayIdx === 0 && itemIdx === 0}
                          />
                        ),
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* ─── Crew Pathway pitch ─────────────────── */}
      <section
        id="crew"
        className="bg-ngpa-deep py-20 sm:py-24 px-4 sm:px-6 lg:px-10 scroll-mt-20"
      >
        <div className="max-w-5xl mx-auto">
          <SectionHeading
            eyebrow="The Crew Pathway"
            title="From drop-in to your own 4-week crew."
            subtitle="Most parents start with one drop-in. After that we find your kid a crew of 3 others at the same level — same court, same time, every week."
          />
          <CrewPathway />
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

