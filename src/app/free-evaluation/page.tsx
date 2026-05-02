import Image from "next/image";
import type { Metadata } from "next";
import LeadForm from "@/components/LeadForm";
import { testimonials } from "@/data/testimonials";
import { site } from "@/data/site";

export const metadata: Metadata = {
  title: "Free 30-Minute Youth Pickleball Evaluation — Montgomery County, MD",
  description:
    "Book a free 30-minute evaluation for your child (ages 5–16) in Montgomery County, MD. Meet a coach, see where your child fits in our Red/Orange/Green/Yellow Ball pathway. No cost. No commitment.",
  alternates: { canonical: "/free-evaluation" },
  openGraph: {
    title: "Free 30-Minute Pickleball Evaluation for Kids — Montgomery County, MD",
    description:
      "Youth pickleball coaching for ages 5–16 in Montgomery County, MD. Your first 30 minutes are on us.",
    url: "https://nextgenpbacademy.com/free-evaluation",
  },
};

// Pull the first two testimonials — enough for trust, not enough to scroll past.
const topTestimonials = testimonials.slice(0, 2);

export default function FreeEvaluationPage() {
  return (
    <>
      {/* ─── Hero + Form (above the fold on desktop) ─────────────── */}
      <section className="relative overflow-hidden bg-ngpa-black">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(170,220,0,0.08)_0%,transparent_70%)]" />

        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-16">
          <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_1fr] gap-10 items-start">
            {/* Left: offer */}
            <div>
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-ngpa-lime text-ngpa-black text-xs font-bold tracking-wider uppercase mb-5">
                <span aria-hidden="true">🎾</span>
                Limited-Time Offer
              </div>

              <Image
                src="/images/logo.png"
                alt="Next Gen Pickleball Academy"
                width={400}
                height={115}
                className="w-48 sm:w-60 h-auto mb-5"
                priority
              />

              <h1 className="font-heading text-3xl sm:text-4xl lg:text-5xl font-900 text-ngpa-white leading-tight">
                Free 30-Minute{" "}
                <span className="text-ngpa-lime">Pickleball Evaluation</span>{" "}
                for Kids
              </h1>

              <p className="mt-5 text-base sm:text-lg text-ngpa-muted leading-relaxed">
                Ages 5&ndash;16. Meet a real coach on the court. We&rsquo;ll see
                where your child is at, recommend the right group, and answer
                every question you have. <strong className="text-ngpa-white">No pressure. No cost.</strong>
              </p>

              {/* Value bullets */}
              <ul className="mt-6 space-y-3">
                {[
                  "30 minutes one-on-one with a certified coach",
                  "On-court assessment — not a sales pitch",
                  "Skill-level placement so your child starts in the right group",
                  "All equipment provided — just show up",
                ].map((point) => (
                  <li key={point} className="flex items-start gap-3 text-ngpa-white">
                    <svg
                      className="w-5 h-5 text-ngpa-lime shrink-0 mt-0.5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2.5}
                      aria-hidden="true"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-sm sm:text-base leading-relaxed">{point}</span>
                  </li>
                ))}
              </ul>

              {/* Trust bar */}
              <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs sm:text-sm text-ngpa-muted">
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-ngpa-lime" aria-hidden="true" />
                  Locations rotate seasonally
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-ngpa-lime" aria-hidden="true" />
                  Small groups
                </span>
              </div>
            </div>

            {/* Right: form — sticky on desktop so it stays visible while they read */}
            <div id="contact-form" className="lg:sticky lg:top-24 scroll-mt-20">
              <div className="bg-ngpa-panel rounded-2xl p-1 border border-ngpa-lime/30 shadow-2xl shadow-ngpa-lime/5">
                <div className="px-5 pt-5 pb-2 text-center">
                  <p className="font-heading text-lg font-bold text-ngpa-white">
                    Reserve Your Free Spot
                  </p>
                  <p className="text-ngpa-muted text-sm mt-1">
                    We&rsquo;ll call or text within 24 hours to schedule.
                  </p>
                </div>
                <LeadForm />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Social Proof ─────────────────────────── */}
      <section className="bg-ngpa-navy py-12 sm:py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <h2 className="font-heading text-xl sm:text-2xl font-bold text-ngpa-white text-center mb-8">
            What Next Gen parents are saying
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {topTestimonials.map((t) => (
              <figure
                key={t.attribution}
                className="bg-ngpa-panel rounded-2xl border border-ngpa-slate p-6"
              >
                <div className="text-ngpa-lime text-3xl leading-none mb-2" aria-hidden="true">
                  &ldquo;
                </div>
                <blockquote className="text-ngpa-white text-sm sm:text-base leading-relaxed">
                  {t.quote}
                </blockquote>
                <figcaption className="mt-4 text-xs sm:text-sm text-ngpa-muted">
                  {t.attribution}
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Who you'll meet ─────────────────────── */}
      <section className="bg-ngpa-black py-12 sm:py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="font-heading text-xl sm:text-2xl font-bold text-ngpa-white mb-2">
            Built by parents, for parents
          </h2>
          <p className="text-ngpa-muted text-sm sm:text-base max-w-2xl mx-auto">
            Next Gen was started by{" "}
            <strong className="text-ngpa-white">Sam &amp; Amine</strong>&mdash;two dads
            who coach the program they wished existed for their own kids. Structured
            lessons, small ratios, and a clear path from curiosity to tournament play.
          </p>
        </div>
      </section>

      {/* ─── Where we play ───────────────────────── */}
      <section className="bg-ngpa-navy py-12 sm:py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto">
          <h2 className="font-heading text-xl sm:text-2xl font-bold text-ngpa-white text-center mb-8">
            Where we play
          </h2>
          <div className="max-w-2xl mx-auto bg-ngpa-panel rounded-2xl border border-ngpa-slate p-6 text-center">
            <h3 className="font-heading text-lg font-bold text-ngpa-white mb-2">
              Locations Rotate Seasonally
            </h3>
            <p className="text-sm text-ngpa-muted leading-relaxed">
              Sessions move between Montgomery County courts each season.
              Email or text us and we&rsquo;ll share the current location.
            </p>
          </div>
          <div className="mt-10 text-center text-sm text-ngpa-muted">
            Questions?{" "}
            <a
              href={`tel:${site.phone.replace(/\D/g, "")}`}
              className="text-ngpa-lime font-semibold hover:underline"
            >
              Call or text Sam at {site.phone}
            </a>
          </div>
        </div>
      </section>
    </>
  );
}
