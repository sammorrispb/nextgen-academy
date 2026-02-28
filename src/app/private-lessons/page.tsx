import type { Metadata } from "next";
import { seo } from "@/data/seo";
import { privateLessons } from "@/data/private-lessons";
import { site } from "@/data/site";
import SectionHeading from "@/components/SectionHeading";
import CTABanner from "@/components/CTABanner";

export const metadata: Metadata = {
  title: seo.privateLessons.title,
  description: seo.privateLessons.description,
};

const icons: Record<string, React.ReactNode> = {
  target: (
    <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  ),
  rocket: (
    <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.59 14.37a6 6 0 01-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 006.16-12.12A14.98 14.98 0 009.63 8.41m5.96 5.96a14.93 14.93 0 01-5.96 2.58m0 0a6 6 0 01-7.38-5.84h4.8" />
    </svg>
  ),
  brain: (
    <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714a2.25 2.25 0 00.659 1.591L19 14.5m-4.75-11.396c.251.023.501.05.75.082M12 21a8.966 8.966 0 005.982-2.275M12 21a8.966 8.966 0 01-5.982-2.275" />
    </svg>
  ),
  calendar: (
    <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
    </svg>
  ),
};

export default function PrivateLessonsPage() {
  return (
    <>
      {/* Hero */}
      <section className="bg-ngpa-navy py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto text-center">
          <span className="inline-block px-4 py-1.5 bg-ngpa-lime/10 text-ngpa-lime text-sm font-bold rounded-full mb-6 tracking-wide">
            1-on-1 Coaching
          </span>
          <h1 className="font-heading text-4xl sm:text-5xl lg:text-6xl font-bold text-ngpa-white mb-6">
            {privateLessons.headline}
          </h1>
          <p className="text-xl sm:text-2xl text-ngpa-muted max-w-2xl mx-auto mb-8 leading-relaxed">
            {privateLessons.tagline}
          </p>
          <p className="text-lg text-ngpa-muted max-w-3xl mx-auto leading-relaxed">
            {privateLessons.intro}
          </p>
        </div>
      </section>

      {/* Benefits */}
      <section className="bg-ngpa-black py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <SectionHeading
            title="Why Private Lessons?"
            subtitle="Focused attention, faster results, and a plan built around your child."
            centered
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mt-10">
            {privateLessons.benefits.map((benefit) => (
              <div
                key={benefit.title}
                className="bg-ngpa-panel rounded-xl p-6 border border-ngpa-slate"
              >
                <div className="text-ngpa-lime mb-4">
                  {icons[benefit.icon]}
                </div>
                <h3 className="font-heading text-lg font-bold text-ngpa-white mb-2">
                  {benefit.title}
                </h3>
                <p className="text-ngpa-muted text-sm leading-relaxed">
                  {benefit.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Player Profiles */}
      <section className="bg-ngpa-navy py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <SectionHeading
            title="For Every Experience Level"
            subtitle="From first-timers to tournament competitors — private lessons meet your child where they are."
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-10">
            {privateLessons.playerProfiles.map((profile) => (
              <div
                key={profile.label}
                className="bg-ngpa-panel rounded-xl p-6 border-l-4"
                style={{ borderColor: profile.color }}
              >
                <div className="flex items-center gap-3 mb-3">
                  <span
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ backgroundColor: profile.color }}
                  />
                  <h3 className="font-heading text-lg font-bold text-ngpa-white">
                    {profile.label}
                  </h3>
                </div>
                <p className="text-ngpa-muted text-sm leading-relaxed">
                  {profile.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* What to Expect */}
      <section className="bg-ngpa-black py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="max-w-3xl">
            <SectionHeading title={privateLessons.sessionDetails.heading} />
            <ol className="space-y-4 mt-8">
              {privateLessons.sessionDetails.items.map((item, i) => (
                <li key={i} className="flex items-start gap-4">
                  <span className="flex items-center justify-center w-8 h-8 bg-ngpa-lime text-ngpa-black font-mono text-sm font-bold rounded-full shrink-0">
                    {i + 1}
                  </span>
                  <span className="text-ngpa-muted text-base leading-relaxed pt-1">
                    {item}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="bg-ngpa-navy py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <SectionHeading title={privateLessons.pricing.heading} centered />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-2xl mx-auto mt-10">
            {privateLessons.pricing.options.map((option) => (
              <div
                key={option.label}
                className="bg-ngpa-panel rounded-xl p-6 border border-ngpa-slate text-center"
              >
                <h3 className="font-heading text-lg font-bold text-ngpa-white mb-1">
                  {option.label}
                </h3>
                <p className="text-ngpa-muted text-sm mb-4">{option.duration}</p>
                <p className="font-mono text-3xl font-bold text-ngpa-lime">
                  {option.price}
                </p>
                {"note" in option && option.note && (
                  <p className="text-ngpa-cyan text-sm font-medium mt-2">
                    {option.note}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      <CTABanner
        heading="Ready to Get Started?"
        description={`Email us at ${site.email} or call ${site.phone} to schedule your first private lesson.`}
        buttonText="Contact Us"
        buttonHref="/contact"
      />
    </>
  );
}
