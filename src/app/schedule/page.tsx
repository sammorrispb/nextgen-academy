import type { Metadata } from "next";
import { seo } from "@/data/seo";
import { LOCATIONS, fetchNextGenEvents, hasCredentials } from "@/lib/courtreserve";
import { transformEvents } from "@/lib/schedule-transform";
import type { LiveScheduleData } from "@/types/schedule";
import SectionHeading from "@/components/SectionHeading";
import LiveScheduleCard from "@/components/LiveScheduleCard";
import CTABanner from "@/components/CTABanner";
import RegistrationNotice from "@/components/RegistrationNotice";

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

function formatUpdatedAgo(fetchedAt: string): string {
  const diff = Date.now() - new Date(fetchedAt).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "Updated just now";
  if (mins === 1) return "Updated 1 minute ago";
  return `Updated ${mins} minutes ago`;
}

export default async function SchedulePage() {
  const schedule = await fetchLiveSchedule();

  return (
    <>
      <h1 className="sr-only">Class Schedule &amp; Registration</h1>

      <section className="bg-ngpa-navy py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <SectionHeading
            title="Upcoming Sessions"
            subtitle="Drop in anytime or commit to the full season. Tap a session to register on CourtReserve."
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
