import Link from "next/link";
import { seasonLabel, seasonDates } from "@/data/schedule";

export default function Hero() {
  return (
    <section className="relative overflow-hidden bg-ngpa-black">
      {/* Subtle radial gradient accent */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(170,220,0,0.06)_0%,transparent_70%)]" />

      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-28">
        {/* Season badge */}
        <div className="inline-block px-4 py-1.5 rounded-full bg-ngpa-slate text-ngpa-lime text-xs font-bold tracking-wider uppercase mb-6">
          {seasonLabel} &middot; {seasonDates}
        </div>

        <h1 className="font-heading text-4xl sm:text-5xl lg:text-6xl font-900 text-ngpa-white leading-tight max-w-3xl">
          Better than yesterday
          <span className="text-ngpa-lime">&mdash;</span>together.
        </h1>

        <p className="mt-6 text-lg sm:text-xl text-ngpa-muted leading-relaxed max-w-2xl">
          Structured pickleball coaching for ages 5&ndash;16. We build confident
          players through competitive play, real strategy, and a growth mindset
          that lasts beyond the court.
        </p>

        <div className="mt-8 flex flex-col sm:flex-row gap-4">
          <Link
            href="/schedule"
            className="inline-flex items-center justify-center px-8 py-3.5 bg-ngpa-lime text-ngpa-black font-bold rounded-full hover:bg-ngpa-cyan transition-colors text-base"
          >
            See Schedule & Register
          </Link>
          <Link
            href="/programs"
            className="inline-flex items-center justify-center px-8 py-3.5 border-2 border-ngpa-lime text-ngpa-lime font-bold rounded-full hover:bg-ngpa-lime hover:text-ngpa-black transition-colors text-base"
          >
            Explore Programs
          </Link>
        </div>
      </div>
    </section>
  );
}
