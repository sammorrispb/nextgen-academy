import Image from "next/image";
import { seasons } from "@/data/schedule";
import TrackedCTA from "@/components/TrackedCTA";

const heroSeason = seasons[seasons.length - 1];

export default function Hero() {
  return (
    <section className="relative overflow-hidden bg-ngpa-black">
      {/* Subtle radial gradient accent */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(170,220,0,0.06)_0%,transparent_70%)]" />

      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
          {/* Left: text */}
          <div>
            {/* Offer badge — primary signal for ad traffic */}
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-ngpa-lime text-ngpa-black text-xs font-bold tracking-wider uppercase mb-3">
              <span aria-hidden="true">🎾</span>
              Free 30-Minute Evaluation
            </div>

            {/* Season sub-badge */}
            <div className="block text-ngpa-muted text-xs font-bold tracking-wider uppercase mb-6">
              {heroSeason.label} &middot; {heroSeason.dates}
            </div>

            <Image src="/images/logo.png" alt="Next Gen Pickleball Academy" width={400} height={115} className="w-56 sm:w-72 lg:w-80 h-auto mb-6" priority />

            <h1 className="font-heading text-3xl sm:text-4xl lg:text-5xl font-900 text-ngpa-white leading-tight">
              Better than yesterday
              <span className="text-ngpa-lime">&mdash;</span>together.
            </h1>

            <p className="mt-5 text-base sm:text-lg text-ngpa-muted leading-relaxed max-w-lg">
              Structured pickleball coaching for ages 5&ndash;16. We build confident
              players through competitive play, real strategy, and a growth mindset
              that lasts beyond the court.
            </p>

            <p className="mt-4 text-sm sm:text-base text-ngpa-white leading-relaxed max-w-lg">
              <span className="font-bold text-ngpa-lime">Meet a coach on the court for 30 minutes — free.</span>{" "}
              We&rsquo;ll see where your child is at and recommend the right group. No commitment.
            </p>

            <div className="mt-7 flex flex-col sm:flex-row gap-4">
              <TrackedCTA
                href="#contact-form"
                label="hero_book_eval"
                section="hero"
                className="inline-flex items-center justify-center px-8 py-3.5 bg-ngpa-lime text-ngpa-black font-bold rounded-full hover:bg-ngpa-cyan transition-colors text-base"
              >
                Book Free Evaluation
              </TrackedCTA>
              <TrackedCTA
                href="/schedule"
                label="hero_view_schedule"
                section="hero"
                asNextLink
                className="inline-flex items-center justify-center px-8 py-3.5 border-2 border-ngpa-lime text-ngpa-lime font-bold rounded-full hover:bg-ngpa-lime hover:text-ngpa-black transition-colors text-base"
              >
                View Schedule
              </TrackedCTA>
            </div>
          </div>

          {/* Right: hero photo */}
          <div className="relative hidden lg:block">
            <div className="rounded-2xl overflow-hidden border-2 border-ngpa-slate shadow-2xl">
              <Image
                src="/images/hero-action.jpeg"
                alt="Next Gen Academy player on the tournament podium with medal and prize money"
                width={600}
                height={750}
                className="w-full h-auto object-cover"
                priority
              />
            </div>
            {/* Decorative accent */}
            <div className="absolute -bottom-4 -left-4 w-24 h-24 rounded-full bg-ngpa-lime/10 blur-2xl" />
            <div className="absolute -top-4 -right-4 w-32 h-32 rounded-full bg-ngpa-cyan/10 blur-2xl" />
          </div>
        </div>
      </div>
    </section>
  );
}
