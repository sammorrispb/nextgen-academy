import type { Metadata } from "next";
import { seo } from "@/data/seo";
import { seasons } from "@/data/schedule";
import { levels } from "@/data/levels";
import SectionHeading from "@/components/SectionHeading";
import ScheduleLocationCard from "@/components/ScheduleLocation";
import CTABanner from "@/components/CTABanner";
import RegistrationNotice from "@/components/RegistrationNotice";

export const metadata: Metadata = {
  title: seo.schedule.title,
  description: seo.schedule.description,
  alternates: { canonical: "/schedule" },
};

export default function SchedulePage() {
  return (
    <>
      <h1 className="sr-only">Class Schedule &amp; Registration</h1>
      {seasons.map((season) => (
        <section key={season.label} className="bg-ngpa-navy py-16 px-4 sm:px-6 lg:px-8">
          <div className="max-w-6xl mx-auto">
            <div className="flex flex-col items-center gap-3 mb-2">
              <SectionHeading
                title={`${season.label} Schedule`}
                subtitle={`${season.dates}${season.weeks ? ` \u00b7 ${season.weeks} weeks` : ""}${season.showSeasonRate !== false ? " \u00b7 Drop in anytime or commit to the full season." : " \u00b7 Drop-in sessions only."}`}
              />
              {season.status && (
                <span
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide ${
                    season.status === "active"
                      ? "bg-ngpa-green/15 text-ngpa-green"
                      : "bg-ngpa-lime/15 text-ngpa-lime"
                  }`}
                >
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{
                      backgroundColor: season.status === "active" ? "var(--color-ngpa-green)" : "var(--color-ngpa-lime)",
                    }}
                  />
                  {season.status === "active" ? "In Progress" : "Registration Open"}
                </span>
              )}
            </div>

            {/* Color legend */}
            <div className="flex flex-wrap gap-4 mb-8">
              {levels
                .filter((l) => l.dropIn)
                .map((l) => (
                  <div key={l.key} className="flex items-center gap-2 text-sm">
                    <span
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: l.color }}
                    />
                    <span className="font-medium text-ngpa-white">{l.label}</span>
                  </div>
                ))}
            </div>

            {/* Pricing summary */}
            {season.dropInPrice && season.showSeasonRate === false ? (
              <div className="bg-ngpa-panel rounded-xl p-4 border border-ngpa-slate mb-10 text-center">
                <span className="font-heading font-bold text-sm text-ngpa-white">
                  All Levels
                </span>
                <span className="mx-3 text-ngpa-muted">&mdash;</span>
                <span className="text-sm font-mono font-bold text-ngpa-lime">
                  {season.dropInPrice}/drop-in
                </span>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-10">
                {levels
                  .filter((l) => l.dropIn)
                  .map((l) => (
                    <div
                      key={l.key}
                      className="bg-ngpa-panel rounded-xl p-4 border"
                      style={{
                        borderColor: `${l.color}30`,
                      }}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <span
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: l.color }}
                        />
                        <span className="font-heading font-bold text-sm text-ngpa-white">
                          {l.label}
                        </span>
                      </div>
                      <div className="text-sm font-mono" style={{ color: l.color }}>
                        <span className="font-bold">{season.dropInPrice ? `${season.dropInPrice}/drop-in` : l.dropIn}</span>
                        {season.showSeasonRate !== false && (
                          <>
                            <span className="mx-2 text-ngpa-muted">|</span>
                            <span className="font-bold">{l.season}</span>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
            )}

            {/* Registration instructions */}
            <RegistrationNotice />

            {/* Spring Preseason Meetup — renders only for Spring season */}
            {season.label === "Spring 2026" && (
              <div className="bg-ngpa-panel border border-ngpa-slate rounded-2xl p-6 sm:p-8 border-l-4 border-l-ngpa-lime mb-10">
                <div className="flex items-start gap-3 mb-3">
                  <span className="text-2xl shrink-0">&#127992;</span>
                  <div>
                    <h3 className="font-heading text-lg font-bold text-ngpa-white">
                      Spring Preseason Meetup
                    </h3>
                    <p className="text-sm text-ngpa-lime font-medium mt-1">
                      Saturday, April 11 &middot; 11:00 AM &ndash; 12:30 PM
                    </p>
                    <p className="text-sm text-ngpa-muted mt-0.5">
                      Dill Dinkers North Bethesda
                    </p>
                  </div>
                </div>
                <p className="text-sm text-ngpa-muted leading-relaxed">
                  Kick off the season &mdash; hit the courts with your kids and meet other Next Gen families.
                </p>
              </div>
            )}

            {/* Locations */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {season.locations.map((loc) => (
                <ScheduleLocationCard key={loc.location} location={loc} />
              ))}
            </div>
          </div>
        </section>
      ))}

      <CTABanner
        heading="Questions About Registration?"
        description="Email us for help choosing the right session or to schedule a free evaluation for your child."
        buttonText="Contact Us"
        buttonHref="/contact"
        variant="dark"
      />
    </>
  );
}
