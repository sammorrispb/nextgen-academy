import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { seo } from "@/data/seo";
import { site } from "@/data/site";
import { levels } from "@/data/levels";
import { coaches } from "@/data/coaches";
import { faq } from "@/data/faq";
import { testimonials } from "@/data/testimonials";
import JsonLd from "@/components/JsonLd";
import LeadForm from "@/components/LeadForm";
import TrackedCTA from "@/components/TrackedCTA";

export const metadata: Metadata = {
  title: seo.montgomeryCounty.title,
  description: seo.montgomeryCounty.description,
  alternates: { canonical: "/montgomery-county-youth-pickleball" },
  openGraph: {
    title: seo.montgomeryCounty.title,
    description: seo.montgomeryCounty.description,
    url: "https://nextgenpbacademy.com/montgomery-county-youth-pickleball",
  },
};

const SERVED_TOWNS = [
  "Rockville",
  "North Bethesda",
  "Bethesda",
  "Potomac",
  "Chevy Chase",
  "Kensington",
  "Silver Spring",
  "Gaithersburg",
  "Derwood",
  "Aspen Hill",
];

const LOCAL_FAQ_QUESTIONS = new Set([
  "What ages do you accept?",
  "How much do youth pickleball lessons cost at Next Gen?",
  "Is pickleball safe for kids?",
  "Which Montgomery County towns do you serve?",
]);

const localFaq = faq.filter((item) => LOCAL_FAQ_QUESTIONS.has(item.question));

export default function MontgomeryCountyPage() {
  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Home", item: "https://nextgenpbacademy.com/" },
            {
              "@type": "ListItem",
              position: 2,
              name: "Youth Pickleball in Montgomery County",
              item: "https://nextgenpbacademy.com/montgomery-county-youth-pickleball",
            },
          ],
        }}
      />

      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: localFaq.map((item) => ({
            "@type": "Question",
            name: item.question,
            acceptedAnswer: { "@type": "Answer", text: item.answer },
          })),
        }}
      />

      {/* ─── Hero ─────────────────────────────── */}
      <section className="relative isolate overflow-hidden bg-ngpa-deep">
        <div className="absolute inset-0 -z-10">
          <Image
            src="/images/outdoor-courts.jpeg"
            alt=""
            fill
            priority
            className="object-cover object-center opacity-30"
            sizes="100vw"
          />
          <div className="absolute inset-0 bg-photo-overlay" />
        </div>
        <div className="absolute inset-x-0 top-0 h-96 bg-teal-glow pointer-events-none" />

        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-10 pt-16 sm:pt-24 pb-20 sm:pb-24">
          <p className="text-xs sm:text-sm font-bold tracking-[0.2em] uppercase text-ngpa-teal mb-4">
            Montgomery County, MD &middot; Ages 5&ndash;16
          </p>
          <h1 className="font-heading text-4xl sm:text-5xl lg:text-6xl font-black text-ngpa-white leading-[1.05] tracking-tight">
            Youth pickleball in{" "}
            <span className="text-ngpa-teal">Montgomery County</span>.
          </h1>
          <p className="mt-6 text-lg text-ngpa-white/80 leading-relaxed max-w-2xl">
            Next Gen Pickleball Academy is a family-first youth pickleball academy
            for ages 5&ndash;16, serving families across Montgomery County. We
            reach families in Bethesda, Potomac, Chevy Chase, Kensington, Silver
            Spring, Gaithersburg, and the broader DMV — with a clear pathway from
            first rally to tournament play.
          </p>

          <div className="mt-9 flex flex-col sm:flex-row gap-3">
            <TrackedCTA
              href="#contact-form"
              label="moco_hero_book_eval"
              section="moco_hero"
              asNextLink
              className="inline-flex items-center gap-2 px-7 py-3.5 bg-ngpa-teal text-ngpa-deep font-bold rounded-full hover:bg-ngpa-teal-bright transition-colors min-h-[48px] shadow-xl shadow-ngpa-teal/20"
            >
              Book Free 30-Minute Evaluation
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </TrackedCTA>
            <TrackedCTA
              href="/schedule"
              label="moco_hero_view_schedule"
              section="moco_hero"
              asNextLink
              className="inline-flex items-center justify-center px-7 py-3.5 bg-white/10 ring-1 ring-white/30 text-ngpa-white font-bold rounded-full hover:bg-white/15 hover:ring-white/50 transition-all min-h-[48px]"
            >
              See Class Schedule
            </TrackedCTA>
          </div>
        </div>
      </section>

      {/* ─── Where we serve ───────────────────── */}
      <section className="bg-ngpa-navy py-16 sm:py-20 px-4 sm:px-6 lg:px-10">
        <div className="max-w-5xl mx-auto">
          <p className="text-xs font-bold tracking-[0.2em] uppercase text-ngpa-teal mb-3">
            Service Area
          </p>
          <h2 className="font-heading text-3xl sm:text-4xl font-black text-ngpa-white mb-4 tracking-tight">
            Where Montgomery County families play with us.
          </h2>
          <p className="text-lg text-ngpa-white/75 leading-relaxed mb-10 max-w-2xl">
            We coach across Montgomery County Public Schools. Sessions rotate by
            demand &mdash; closer to more zip codes than a single fixed venue.
          </p>

          <div className="bg-ngpa-panel/80 backdrop-blur-sm rounded-2xl border border-ngpa-slate/60 p-7 mb-10">
            <h3 className="font-heading text-xl font-black text-ngpa-white mb-2 tracking-tight">
              MCPS courts across Montgomery County.
            </h3>
            <p className="text-base text-ngpa-white/70 leading-relaxed">
              Sessions rotate weekly based on court availability. Check the
              schedule for this week&rsquo;s location, or book a free evaluation
              and we&rsquo;ll confirm the venue when we schedule.
            </p>
          </div>

          <h3 className="font-heading text-base font-bold text-ngpa-white uppercase tracking-[0.15em] mb-4">
            Families regularly drive in from
          </h3>
          <ul className="flex flex-wrap gap-2">
            {SERVED_TOWNS.map((town) => (
              <li
                key={town}
                className="px-4 py-2 bg-ngpa-panel/80 border border-ngpa-slate/60 rounded-full text-sm font-medium text-ngpa-white/85"
              >
                {town}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ─── Pathway ──────────────────────────── */}
      <section className="relative bg-ngpa-deep py-16 sm:py-20 px-4 sm:px-6 lg:px-10 overflow-hidden">
        <div
          aria-hidden="true"
          className="absolute -top-32 -right-32 w-[28rem] h-[28rem] rounded-full bg-ngpa-teal/10 blur-3xl"
        />
        <div className="relative max-w-5xl mx-auto">
          <p className="text-xs font-bold tracking-[0.2em] uppercase text-ngpa-teal mb-3">
            The Pathway
          </p>
          <h2 className="font-heading text-3xl sm:text-4xl font-black text-ngpa-white mb-4 tracking-tight">
            The Red &rarr; Yellow Ball pathway.
          </h2>
          <p className="text-lg text-ngpa-white/75 leading-relaxed mb-10 max-w-2xl">
            We follow USA Pickleball&rsquo;s official youth progression — a proven
            system of color-coded balls with reduced bounce and compression. Every
            child is placed based on skill during a free evaluation, not age alone.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {levels.map((level) => (
              <div
                key={level.key}
                className="relative bg-ngpa-panel/80 backdrop-blur-sm rounded-2xl p-6 border border-ngpa-slate/60 overflow-hidden"
              >
                <div
                  aria-hidden="true"
                  className="absolute inset-x-0 top-0 h-1"
                  style={{ backgroundColor: level.color }}
                />
                <div className="flex items-center gap-3 mb-3">
                  <span
                    aria-hidden="true"
                    className="w-4 h-4 rounded-full"
                    style={{ backgroundColor: level.color }}
                  />
                  <h3 className="font-heading text-lg font-black text-ngpa-white tracking-tight">
                    {level.label}{" "}
                    <span className="text-ngpa-white/55 font-medium text-sm">
                      &middot; Ages {level.ages}
                    </span>
                  </h3>
                </div>
                <p className="text-base text-ngpa-white/90 mb-1 font-medium">
                  {level.focus}
                </p>
                <p className="text-sm text-ngpa-white/65">{level.detail}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Coaches ──────────────────────────── */}
      <section className="bg-ngpa-navy py-16 sm:py-20 px-4 sm:px-6 lg:px-10">
        <div className="max-w-5xl mx-auto">
          <p className="text-xs font-bold tracking-[0.2em] uppercase text-ngpa-teal mb-3">
            The Team
          </p>
          <h2 className="font-heading text-3xl sm:text-4xl font-black text-ngpa-white mb-4 tracking-tight">
            Built by Montgomery County parents, for Montgomery County parents.
          </h2>
          <p className="text-lg text-ngpa-white/75 leading-relaxed mb-10 max-w-2xl">
            Next Gen was started by two dads who coach the program they wished
            existed for their own kids.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {coaches.map((coach) => (
              <div
                key={coach.name}
                className="bg-ngpa-panel/80 backdrop-blur-sm rounded-2xl p-6 border border-ngpa-slate/60"
              >
                <h3 className="font-heading text-xl font-black text-ngpa-white tracking-tight">
                  {coach.name}
                </h3>
                <p className="text-sm text-ngpa-teal font-bold uppercase tracking-wider mt-1 mb-3">
                  {coach.role}
                </p>
                <p className="text-sm text-ngpa-white/75 leading-relaxed">
                  {coach.bio}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Testimonials ─────────────────────── */}
      <section className="bg-ngpa-deep py-16 sm:py-20 px-4 sm:px-6 lg:px-10">
        <div className="max-w-5xl mx-auto">
          <h2 className="font-heading text-3xl sm:text-4xl font-black text-ngpa-white mb-10 tracking-tight">
            What Montgomery County parents are saying.
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {testimonials.slice(0, 2).map((t) => (
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

      {/* ─── Pricing snapshot ─────────────────── */}
      <section className="bg-ngpa-navy py-16 sm:py-20 px-4 sm:px-6 lg:px-10">
        <div className="max-w-3xl mx-auto">
          <p className="text-xs font-bold tracking-[0.2em] uppercase text-ngpa-teal mb-3">
            Pricing
          </p>
          <h2 className="font-heading text-3xl sm:text-4xl font-black text-ngpa-white mb-4 tracking-tight">
            Transparent, drop-in pricing.
          </h2>
          <p className="text-lg text-ngpa-white/75 leading-relaxed mb-8">
            All group classes are{" "}
            <strong className="text-ngpa-white font-bold">$40 per 1-hour slot</strong>{" "}
            ($80 for both slots in a session), drop-in only — no subscription,
            no commitment. Sessions split into Early and Late slots. Each
            pickleball court is capped at 4 players. Payments are
            non-refundable.{" "}
            <Link
              href="/schedule"
              className="text-ngpa-teal hover:text-ngpa-teal-bright font-bold underline-offset-4 hover:underline transition-colors"
            >
              View the current schedule
            </Link>
            .
          </p>
          <div className="bg-ngpa-panel/80 backdrop-blur-sm rounded-2xl border border-ngpa-slate/60 p-7">
            <div className="flex items-baseline gap-2 mb-2">
              <span className="font-mono font-bold text-4xl text-ngpa-teal">$40</span>
              <span className="text-ngpa-white/65">per 1-hour slot</span>
            </div>
            <p className="text-base text-ngpa-white/70 leading-relaxed">
              Same rate across all levels — Red, Orange, Green, Yellow.
              Drop-in only. No monthly subscription. Non-refundable.
            </p>
          </div>
          <p className="text-sm text-ngpa-white/60 mt-5">
            The 30-minute evaluation that determines placement is always free.
          </p>
        </div>
      </section>

      {/* ─── FAQ ──────────────────────────────── */}
      <section className="bg-ngpa-deep py-16 sm:py-20 px-4 sm:px-6 lg:px-10">
        <div className="max-w-3xl mx-auto">
          <p className="text-xs font-bold tracking-[0.2em] uppercase text-ngpa-teal mb-3">
            Parent FAQ
          </p>
          <h2 className="font-heading text-3xl sm:text-4xl font-black text-ngpa-white mb-10 tracking-tight">
            Montgomery County parent FAQ.
          </h2>
          <div className="space-y-7">
            {localFaq.map((item) => (
              <div
                key={item.question}
                className="bg-ngpa-panel/60 backdrop-blur-sm rounded-2xl border border-ngpa-slate/60 p-6"
              >
                <h3 className="font-heading text-base font-bold text-ngpa-teal mb-2">
                  {item.question}
                </h3>
                <p className="text-base text-ngpa-white/75 leading-relaxed">
                  {item.answer}
                </p>
              </div>
            ))}
          </div>

          <p className="text-center text-base text-ngpa-white/65 mt-12">
            Questions? Call or text Sam at{" "}
            <a
              href={`tel:${site.phone.replace(/\D/g, "")}`}
              className="text-ngpa-teal font-bold hover:text-ngpa-teal-bright underline-offset-4 hover:underline transition-colors"
            >
              {site.phone}
            </a>
            .
          </p>
        </div>
      </section>

      {/* ─── Lead form ────────────────────────── */}
      <section
        id="contact-form"
        className="relative bg-ngpa-navy py-16 sm:py-20 px-4 sm:px-6 lg:px-10 scroll-mt-20 overflow-hidden"
      >
        <div
          aria-hidden="true"
          className="absolute top-0 left-1/2 -translate-x-1/2 w-[36rem] h-[36rem] rounded-full bg-ngpa-teal/10 blur-3xl"
        />
        <div className="relative max-w-xl mx-auto">
          <div className="text-center mb-10">
            <p className="text-xs font-bold tracking-[0.2em] uppercase text-ngpa-teal mb-3">
              Free 30-min Evaluation
            </p>
            <h2 className="font-heading text-3xl sm:text-4xl font-black text-ngpa-white tracking-tight">
              Book your free evaluation.
            </h2>
            <p className="text-ngpa-white/70 mt-3 text-lg">
              We&rsquo;ll call or text within 24 hours to schedule.
            </p>
          </div>
          <div className="rounded-3xl border-2 border-ngpa-teal/30 bg-ngpa-deep/60 backdrop-blur-md p-1 shadow-2xl shadow-ngpa-teal/10">
            <LeadForm />
          </div>
        </div>
      </section>
    </>
  );
}
