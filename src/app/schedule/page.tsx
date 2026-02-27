import type { Metadata } from "next";
import { seo } from "@/data/seo";
import { seasons } from "@/data/schedule";
import { levels } from "@/data/levels";
import SectionHeading from "@/components/SectionHeading";
import ScheduleLocationCard from "@/components/ScheduleLocation";
import CTABanner from "@/components/CTABanner";

export const metadata: Metadata = {
  title: seo.schedule.title,
  description: seo.schedule.description,
};

export default function SchedulePage() {
  return (
    <>
      {seasons.map((season) => (
        <section key={season.label} className="bg-ngpa-navy py-16 px-4 sm:px-6 lg:px-8">
          <div className="max-w-6xl mx-auto">
            <div className="flex flex-col items-center gap-3 mb-2">
              <SectionHeading
                title={`${season.label} Schedule`}
                subtitle={`${season.dates}${season.weeks ? ` \u00b7 ${season.weeks} weeks` : ""} \u00b7 Drop in anytime or commit to the full season.`}
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
                      <span className="font-bold">{l.dropIn}</span>
                      <span className="mx-2 text-ngpa-muted">|</span>
                      <span className="font-bold">{l.season}</span>
                    </div>
                  </div>
                ))}
            </div>

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
