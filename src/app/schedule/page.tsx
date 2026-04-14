import type { Metadata } from "next";
import { seo } from "@/data/seo";
import { LOCATIONS, fetchNextGenEvents, hasCredentials } from "@/lib/courtreserve";
import { transformEvents } from "@/lib/schedule-transform";
import type { LiveScheduleData, LiveLocation } from "@/types/schedule";
import { levels } from "@/data/levels";
import SectionHeading from "@/components/SectionHeading";
import LiveScheduleCard from "@/components/LiveScheduleCard";
import CTABanner from "@/components/CTABanner";
import RegistrationNotice from "@/components/RegistrationNotice";
import JsonLd from "@/components/JsonLd";

export const revalidate = 300;

export const metadata: Metadata = {
  title: seo.schedule.title,
  description: seo.schedule.description,
  alternates: { canonical: "/schedule" },
};

async function fetchLiveSchedule(): Promise<LiveScheduleData> {
  if (!hasCredentials()) {
    return { locations: [], fetchedAt: new Date().toISOString(), isLive: false };
  }

  const today = new Date();
  const endDate = new Date(today);
  endDate.setDate(endDate.getDate() + 60);

  const startStr = today.toISOString().slice(0, 10);
  const endStr = endDate.toISOString().slice(0, 10);

  const results = await Promise.allSettled(
    LOCATIONS.map(async (loc) => {
      const events = await fetchNextGenEvents(loc, startStr, endStr);
      return transformEvents(events, loc);
    }),
  );

  const locations = results
    .filter((r): r is PromiseFulfilledResult<ReturnType<typeof transformEvents>> => r.status === "fulfilled")
    .map((r) => r.value)
    .filter((loc) => loc.slots.length > 0);

  return {
    locations,
    fetchedAt: new Date().toISOString(),
    isLive: locations.length > 0,
  };
}

const LEVEL_LABELS: Record<string, string> = Object.fromEntries(
  levels.map((l) => [l.key, l.label]),
);

// Parse "5+" or "12+" into a numeric min age. Returns undefined on miss.
function parseMinAge(ages: string): number | undefined {
  const m = ages.match(/(\d+)/);
  return m ? Number(m[1]) : undefined;
}

const LEVEL_MIN_AGE: Record<string, number | undefined> = Object.fromEntries(
  levels.map((l) => [l.key, parseMinAge(l.ages)]),
);

/** Build schema.org SportsEvent JSON-LD for every upcoming session across locations. */
function buildSportsEventSchemas(locations: LiveLocation[]) {
  const today = new Date().toISOString().slice(0, 10);
  const events: Record<string, unknown>[] = [];

  for (const loc of locations) {
    for (const slot of loc.slots) {
      for (const session of slot.sessions) {
        if (session.date < today) continue;
        const levelLabel = LEVEL_LABELS[session.level] ?? session.level;
        const minAge = LEVEL_MIN_AGE[session.level];
        const spotsRemaining = session.spotsRemaining;

        events.push({
          "@context": "https://schema.org",
          "@type": "SportsEvent",
          name: `${levelLabel} Youth Pickleball — ${loc.location}`,
          description: `${levelLabel} pickleball session for kids at Next Gen Pickleball Academy, ${loc.venue} ${loc.location}.`,
          startDate: session.startIso,
          endDate: session.endIso,
          eventStatus: "https://schema.org/EventScheduled",
          eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
          sport: "Pickleball",
          location: {
            "@type": "SportsActivityLocation",
            name: `${loc.venue} ${loc.location}`,
            address: {
              "@type": "PostalAddress",
              streetAddress: loc.address,
              addressLocality: loc.location,
              addressRegion: "MD",
              addressCountry: "US",
            },
          },
          organizer: {
            "@type": "SportsOrganization",
            name: "Next Gen Pickleball Academy",
            url: "https://nextgenpbacademy.com",
          },
          offers: {
            "@type": "Offer",
            url: session.registrationUrl,
            availability:
              spotsRemaining > 0
                ? "https://schema.org/InStock"
                : "https://schema.org/SoldOut",
            category: "Youth Pickleball Class",
          },
          ...(minAge
            ? {
                audience: {
                  "@type": "PeopleAudience",
                  suggestedMinAge: minAge,
                  suggestedMaxAge: 16,
                },
              }
            : {}),
        });
      }
    }
  }

  return events;
}

function formatUpdatedAgo(fetchedAt: string): string {
  const diff = Date.now() - new Date(fetchedAt).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "Updated just now";
  if (mins === 1) return "Updated 1 minute ago";
  return `Updated ${mins} minutes ago`;
}

export default async function SchedulePage() {
  const schedule = await fetchLiveSchedule();
  const eventSchemas = buildSportsEventSchemas(schedule.locations);

  return (
    <>
      {eventSchemas.map((e, i) => (
        <JsonLd key={`sports-event-${i}`} data={e} />
      ))}

      <h1 className="sr-only">Class Schedule &amp; Registration</h1>

      <section className="bg-ngpa-navy py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <SectionHeading
            title="Upcoming Sessions"
            subtitle="Tap Register to sign up for a session."
          />

          {/* Registration instructions */}
          <RegistrationNotice />

          {/* Live schedule or fallback */}
          {schedule.isLive ? (
            <>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {schedule.locations.map((loc) => (
                  <LiveScheduleCard key={loc.location} location={loc} />
                ))}
              </div>

              {/* Last updated */}
              <p className="text-center text-xs text-ngpa-muted mt-8">
                {formatUpdatedAgo(schedule.fetchedAt)} &middot; Live from CourtReserve
              </p>
            </>
          ) : (
            <div className="bg-ngpa-panel rounded-2xl p-8 border border-ngpa-slate text-center">
              <p className="text-ngpa-white font-medium mb-2">
                Schedule is loading from CourtReserve.
              </p>
              <p className="text-sm text-ngpa-muted mb-4">
                View the full schedule and register directly on CourtReserve.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                {LOCATIONS.map((loc) => (
                  <a
                    key={loc.key}
                    href={loc.widgetUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`inline-flex items-center justify-center px-5 py-2.5 rounded-full text-ngpa-navy text-sm font-bold hover:scale-105 transition-transform min-h-[44px] ${
                      loc.key === "rockville" ? "bg-ngpa-lime" : "bg-ngpa-cyan"
                    }`}
                  >
                    {loc.location} Schedule
                  </a>
                ))}
              </div>
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
      />
    </>
  );
}
