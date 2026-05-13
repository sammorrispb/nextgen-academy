import Image from "next/image";
import { seasons } from "@/data/schedule";
import TrackedCTA from "@/components/TrackedCTA";

const heroSeason = seasons[seasons.length - 1];

export default function Hero() {
  return (
    <section className="relative isolate overflow-hidden bg-ngpa-deep">
      {/* Photo backdrop — full bleed on mobile, side-card on desktop */}
      <div className="absolute inset-0 -z-10">
        <Image
          src="/images/hero-action.jpeg"
          alt=""
          fill
          priority
          className="object-cover object-center opacity-60 lg:opacity-95"
          sizes="100vw"
        />
        {/* Mobile: full overlay so text reads */}
        <div className="absolute inset-0 lg:hidden bg-photo-overlay" />
        {/* Desktop: side-fade overlay */}
        <div className="absolute inset-0 hidden lg:block bg-photo-overlay-side" />
      </div>

      {/* Subtle teal radial accent on top */}
      <div className="absolute inset-x-0 top-0 h-96 bg-teal-glow pointer-events-none" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 pt-12 sm:pt-20 pb-20 sm:pb-28 lg:py-32">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
          <div className="lg:col-span-7 max-w-2xl">
            {/* Offer pill */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-ngpa-teal/15 ring-1 ring-ngpa-teal/40 backdrop-blur-sm text-ngpa-teal text-xs font-bold tracking-[0.18em] uppercase mb-5">
              <span aria-hidden="true" className="w-1.5 h-1.5 rounded-full bg-ngpa-teal animate-pulse" />
              Free 30-minute evaluation
            </div>

            <h1 className="font-heading text-4xl sm:text-5xl lg:text-7xl font-black text-ngpa-white leading-[1.02] tracking-tight">
              Real coaching for
              <br />
              <span className="text-ngpa-teal">kids 8&ndash;16</span>
              <br />
              who can rally.
            </h1>

            <p className="mt-7 text-lg sm:text-xl text-ngpa-white/85 leading-relaxed max-w-xl">
              Small groups, real strategy, and a clear pathway to tournament
              play &mdash; across Montgomery County, MD. Still learning to
              rally? Start with a private lesson.
            </p>

            <p className="mt-5 text-base sm:text-lg text-ngpa-white/95 leading-relaxed max-w-xl">
              <span className="font-bold text-ngpa-teal">Meet a coach on the court for 30 minutes &mdash; free.</span>{" "}
              We&rsquo;ll see where your child is at and recommend a group &mdash;
              or a private-lesson plan to get them group-ready. No commitment.
            </p>

            <div className="mt-9 flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6">
              <TrackedCTA
                href="#contact-form"
                label="hero_book_eval"
                section="hero"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-ngpa-teal text-ngpa-deep font-bold rounded-full hover:bg-ngpa-teal-bright transition-colors text-base shadow-xl shadow-ngpa-teal/20 min-h-[48px]"
              >
                Book a free 30-min evaluation
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </TrackedCTA>
              <TrackedCTA
                href="/schedule"
                label="hero_view_schedule"
                section="hero"
                asNextLink
                className="inline-flex items-center justify-center text-base font-semibold text-ngpa-white/85 hover:text-ngpa-teal transition-colors min-h-[48px]"
              >
                Already evaluated? See the schedule &rarr;
              </TrackedCTA>
            </div>

            {/* Season + trust line */}
            <div className="mt-9 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs sm:text-sm text-ngpa-white/70">
              <span className="inline-flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-ngpa-teal" aria-hidden="true" />
                {heroSeason.label} &middot; {heroSeason.dates}
              </span>
              <span className="inline-flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-ngpa-teal" aria-hidden="true" />
                Small groups
              </span>
              <span className="inline-flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-ngpa-teal" aria-hidden="true" />
                MCPS venues
              </span>
            </div>
          </div>

          {/* Right column — empty on desktop so the photo shines through */}
          <div className="hidden lg:block lg:col-span-5" aria-hidden="true" />
        </div>
      </div>

      {/* Bottom fade into next section */}
      <div className="absolute bottom-0 inset-x-0 h-24 bg-gradient-to-b from-transparent to-ngpa-navy pointer-events-none" />
    </section>
  );
}
