import Image from "next/image";
import type { Metadata } from "next";
import LeadForm from "@/components/LeadForm";
import { testimonials } from "@/data/testimonials";
import { site } from "@/data/site";

export const metadata: Metadata = {
  title: "Free 30-Minute Youth Pickleball Evaluation — Montgomery County, MD",
  description:
    "Book a free 30-minute evaluation for your child (ages 8–16) in Montgomery County, MD. Meet a coach, see where your child fits in our Orange/Green/Yellow Ball pathway — or whether private lessons are the right starting point. No cost. No commitment.",
  alternates: { canonical: "/free-evaluation" },
  openGraph: {
    title: "Free 30-Minute Pickleball Evaluation for Kids — Montgomery County, MD",
    description:
      "Youth pickleball coaching for ages 8–16 in Montgomery County, MD. Your first 30 minutes are on us.",
    url: "https://nextgenpbacademy.com/free-evaluation",
  },
};

const topTestimonials = testimonials.slice(0, 2);

const VALUE_BULLETS = [
  "30 minutes one-on-one with Coach Sam or Coach Amine",
  "Your coach watches your child play, then recommends a level",
  "Skill-level placement so your child starts in the right group",
  "All equipment provided — just show up",
];

export default function FreeEvaluationPage() {
  return (
    <>
      {/* ─── Hero + Form ─────────────── */}
      <section className="relative isolate overflow-hidden bg-ngpa-deep">
        {/* Photo backdrop */}
        <div className="absolute inset-0 -z-10">
          <Image
            src="/images/multi-court-outdoor.jpeg"
            alt=""
            fill
            priority
            className="object-cover object-center opacity-50 lg:opacity-75"
            sizes="100vw"
          />
          <div className="absolute inset-0 lg:hidden bg-photo-overlay" />
          <div className="absolute inset-0 hidden lg:block bg-photo-overlay-side" />
        </div>
        <div className="absolute inset-x-0 top-0 h-96 bg-teal-glow pointer-events-none" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 py-16 sm:py-24 lg:py-28">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
            {/* Left: offer */}
            <div className="lg:col-span-7">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-ngpa-teal/15 ring-1 ring-ngpa-teal/40 backdrop-blur-sm text-ngpa-teal text-xs font-bold tracking-[0.18em] uppercase mb-5">
                <span aria-hidden="true" className="w-1.5 h-1.5 rounded-full bg-ngpa-teal animate-pulse" />
                Limited-Time Offer
              </div>

              <h1 className="font-heading text-4xl sm:text-5xl lg:text-6xl font-black text-ngpa-white leading-[1.02] tracking-tight">
                Your first 30 minutes
                <br />
                <span className="text-ngpa-teal">on the court — free.</span>
              </h1>

              <p className="mt-6 text-lg sm:text-xl text-ngpa-white/85 leading-relaxed max-w-xl">
                Ages 8&ndash;16. Meet a real coach on the court. We&rsquo;ll see
                where your child is at, recommend the right group &mdash; or, if
                they&rsquo;re still learning to rally, a private-lesson plan to
                get them there. Every question answered.{" "}
                <strong className="text-ngpa-white font-bold">No pressure. No cost.</strong>
              </p>

              <ul className="mt-8 space-y-3.5">
                {VALUE_BULLETS.map((point) => (
                  <li
                    key={point}
                    className="flex items-start gap-3 text-ngpa-white text-base sm:text-lg"
                  >
                    <span
                      aria-hidden="true"
                      className="shrink-0 mt-1 w-6 h-6 rounded-full bg-ngpa-teal flex items-center justify-center"
                    >
                      <svg
                        className="w-3.5 h-3.5 text-ngpa-deep"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={3}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    </span>
                    <span className="leading-relaxed">{point}</span>
                  </li>
                ))}
              </ul>

              {/* Trust bar */}
              <div className="mt-9 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-ngpa-white/70">
                <span className="inline-flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-ngpa-teal" aria-hidden="true" />
                  MCPS venues across MoCo
                </span>
                <span className="inline-flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-ngpa-teal" aria-hidden="true" />
                  Small groups
                </span>
                <span className="inline-flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-ngpa-teal" aria-hidden="true" />
                  Built by parents
                </span>
              </div>
            </div>

            {/* Right: form */}
            <div
              id="contact-form"
              className="lg:col-span-5 lg:sticky lg:top-28 scroll-mt-24"
            >
              <div className="rounded-3xl border-2 border-ngpa-teal/30 bg-ngpa-deep/60 backdrop-blur-md p-1 shadow-2xl shadow-ngpa-teal/10">
                <div className="px-5 pt-6 pb-3 text-center">
                  <p className="font-heading text-xl font-black text-ngpa-white tracking-tight">
                    Schedule your free evaluation
                  </p>
                  <p className="text-ngpa-white/65 text-sm mt-1.5">
                    We&rsquo;ll call or text within 24 hours to schedule.
                  </p>
                  <p className="text-ngpa-white/55 text-xs mt-2.5 leading-relaxed">
                    After the eval, group sessions are{" "}
                    <span className="text-ngpa-white/80 font-bold">
                      $40 each
                    </span>{" "}
                    &mdash; drop in anytime. No contracts. Private-lesson rates
                    quoted after we see your child play.
                  </p>
                </div>
                <LeadForm submitLabel="Schedule my free evaluation" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Social proof ─────────────────────────── */}
      <section className="bg-ngpa-navy py-16 sm:py-20 px-4 sm:px-6 lg:px-10">
        <div className="max-w-5xl mx-auto">
          <p className="text-xs sm:text-sm font-bold tracking-[0.2em] uppercase text-ngpa-teal text-center mb-3">
            Parent Stories
          </p>
          <h2 className="font-heading text-3xl sm:text-4xl font-black text-ngpa-white text-center mb-12 tracking-tight">
            What Next Gen parents are saying
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {topTestimonials.map((t) => (
              <figure
                key={t.attribution}
                className="relative bg-ngpa-panel/80 backdrop-blur-sm rounded-2xl border border-ngpa-slate/60 p-7 overflow-hidden"
              >
                <span
                  aria-hidden="true"
                  className="absolute -top-2 left-4 text-7xl font-heading font-black text-ngpa-teal/30 leading-none select-none"
                >
                  &ldquo;
                </span>
                <blockquote className="relative z-10 pt-5">
                  <p className="text-ngpa-white text-base sm:text-lg leading-relaxed">
                    {t.quote}
                  </p>
                  <figcaption className="mt-5 pt-4 border-t border-ngpa-slate/50 text-sm text-ngpa-white/60">
                    {t.attribution}
                  </figcaption>
                </blockquote>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* ─── About strip ───────────────────────── */}
      <section className="relative bg-ngpa-deep py-16 sm:py-20 px-4 sm:px-6 lg:px-10 overflow-hidden">
        <div
          aria-hidden="true"
          className="absolute -top-32 left-1/2 -translate-x-1/2 w-[36rem] h-[36rem] rounded-full bg-ngpa-teal/8 blur-3xl"
        />
        <div className="relative max-w-3xl mx-auto text-center">
          <p className="text-xs sm:text-sm font-bold tracking-[0.2em] uppercase text-ngpa-teal mb-3">
            Why Next Gen
          </p>
          <h2 className="font-heading text-3xl sm:text-4xl font-black text-ngpa-white mb-4 tracking-tight">
            Built by parents, for parents.
          </h2>
          <p className="text-lg text-ngpa-white/75 leading-relaxed">
            Next Gen was started by{" "}
            <strong className="text-ngpa-white font-bold">Sam &amp; Amine</strong>&mdash;two dads
            who coach the program they wished existed for their own kids. Structured
            lessons, small ratios, and a clear path from curiosity to tournament play.
          </p>
        </div>
      </section>

      {/* ─── Where we play ───────────────────────── */}
      <section className="bg-ngpa-navy py-16 sm:py-20 px-4 sm:px-6 lg:px-10">
        <div className="max-w-3xl mx-auto">
          <h2 className="font-heading text-3xl sm:text-4xl font-black text-ngpa-white text-center mb-10 tracking-tight">
            Where we play
          </h2>
          <div className="bg-ngpa-panel/80 backdrop-blur-sm rounded-2xl border border-ngpa-slate/60 p-7 text-center">
            <h3 className="font-heading text-xl font-black text-ngpa-white mb-2 tracking-tight">
              MCPS courts across Montgomery County.
            </h3>
            <p className="text-base text-ngpa-white/70 leading-relaxed">
              Sessions rotate by demand &mdash; closer to more zip codes than a
              single fixed venue. We&rsquo;ll share the venue when we confirm
              your evaluation.
            </p>
          </div>
          <p className="mt-10 text-center text-base text-ngpa-white/65">
            Questions?{" "}
            <a
              href={`tel:${site.phone.replace(/\D/g, "")}`}
              className="text-ngpa-teal font-bold hover:text-ngpa-teal-bright underline-offset-4 hover:underline transition-colors"
            >
              Call or text Sam at {site.phone}
            </a>
          </p>
        </div>
      </section>
    </>
  );
}
