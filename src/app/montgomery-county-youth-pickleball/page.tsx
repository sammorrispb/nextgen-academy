import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { seo } from "@/data/seo";
import { site } from "@/data/site";
import { levels } from "@/data/levels";
import { coaches } from "@/data/coaches";
import { localFaq } from "@/data/faq";
import { testimonials } from "@/data/testimonials";
import JsonLd from "@/components/JsonLd";
import EvaluationSchedulingCard from "@/components/EvaluationSchedulingCard";
import { EVALUATION_SMS_URL } from "@/data/scheduling";
import TrackedCTA from "@/components/TrackedCTA";
import { CITY_LANDING_PAGES, orgRef } from "@/lib/seo";
import { buildLeagueHubCards } from "@/lib/league-hub";
import { picklParkTodayET } from "@/lib/picklpark-registration-window";

export const revalidate = 300;

export const metadata: Metadata = {
  // Absolute title so the rendered <title> stays inside Google's ~60-char
  // truncation budget (template would add "%s | Next Gen Pickleball Academy").
  title: { absolute: seo.montgomeryCounty.title },
  description: seo.montgomeryCounty.description,
  alternates: { canonical: "/montgomery-county-youth-pickleball" },
  openGraph: {
    title: seo.montgomeryCounty.title,
    description: seo.montgomeryCounty.description,
    url: "https://nextgenpbacademy.com/montgomery-county-youth-pickleball",
    images: ["/opengraph-image"],
  },
  twitter: {
    card: "summary_large_image",
    title: seo.montgomeryCounty.title,
    description: seo.montgomeryCounty.description,
  },
};

// The shared local FAQ subset lives in src/data/faq.ts (one copy).

export default function MontgomeryCountyPage() {
  const programs = buildLeagueHubCards(picklParkTodayET(), {
    fallRegistrationOpen: process.env.NEXT_PUBLIC_FALL_REGISTRATION_OPEN === "true",
  }).filter((card) => card.key === "fall" || card.key.startsWith("mvf-"));

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

      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Service",
          "@id": "https://nextgenpbacademy.com/montgomery-county-youth-pickleball#service",
          name: "Youth pickleball coaching in Montgomery County",
          serviceType: "Youth pickleball coaching",
          description: seo.montgomeryCounty.description,
          url: "https://nextgenpbacademy.com/montgomery-county-youth-pickleball",
          areaServed: { "@type": "AdministrativeArea", name: "Montgomery County, MD" },
          provider: orgRef(),
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
            Montgomery County, MD &middot; Ages 6&ndash;16
          </p>
          <h1 className="font-heading text-4xl sm:text-5xl lg:text-6xl font-black text-ngpa-white leading-[1.05] tracking-tight">
            Youth pickleball in{" "}
            <span className="text-ngpa-teal">Montgomery County</span>.
          </h1>
          <p className="mt-6 text-lg text-ngpa-white/80 leading-relaxed max-w-2xl">
            Find your child&rsquo;s next step on the Red, Orange, Green and
            Yellow Ball pathway. Compare Montgomery County seasons and partner
            classes below. Start with a free evaluation, or request a private lesson.
            Each program has its own ages, levels, dates and venue &mdash; we&rsquo;ll
            help you find the right fit for your player.
          </p>

          <div className="mt-9 flex flex-col sm:flex-row gap-3">
            <TrackedCTA
              href={EVALUATION_SMS_URL}
              label="moco_hero_book_eval"
              section="moco_hero"
              asNextLink
              className="inline-flex items-center gap-2 px-7 py-3.5 bg-ngpa-teal text-ngpa-deep font-bold rounded-full hover:bg-ngpa-teal-bright transition-colors min-h-[48px] shadow-xl shadow-ngpa-teal/20"
            >
              Text for a Free 30-Minute Evaluation
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </TrackedCTA>
            <TrackedCTA
              href="#programs"
              label="moco_hero_view_programs"
              section="moco_hero"
              asNextLink
              className="inline-flex items-center justify-center px-7 py-3.5 bg-white/10 ring-1 ring-white/30 text-ngpa-white font-bold rounded-full hover:bg-white/15 hover:ring-white/50 transition-all min-h-[48px]"
            >
              See programs &amp; locations
            </TrackedCTA>
          </div>
        </div>
      </section>

      {/* ─── Current county programs ───────────── */}
      <section id="programs" className="bg-ngpa-navy py-16 sm:py-20 px-4 sm:px-6 lg:px-10 scroll-mt-24">
        <div className="max-w-5xl mx-auto">
          <p className="text-xs font-bold tracking-[0.2em] uppercase text-ngpa-teal mb-3">
            Programs &amp; locations
          </p>
          <h2 className="font-heading text-3xl sm:text-4xl font-black text-ngpa-white mb-4 tracking-tight">
            Find a program that fits your family.
          </h2>
          <p className="text-lg text-ngpa-white/75 leading-relaxed mb-10 max-w-2xl">
            Compare each program&rsquo;s venue, dates and eligibility before you
            register. A listed season may already be underway or closed to new
            registrations; its details page has the current availability and terms.
          </p>

          {programs.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-10">
              {programs.map((program) => (
                <article key={program.key} className="bg-ngpa-panel rounded-2xl border border-ngpa-slate/60 p-6">
                  <h3 className="font-heading text-xl font-black text-ngpa-white mb-5 tracking-tight">
                    {program.title}
                  </h3>
                  <dl className="space-y-4 text-base leading-relaxed">
                    <div>
                      <dt className="font-bold text-ngpa-teal">Venue</dt>
                      <dd className="text-ngpa-white/80">{program.where}</dd>
                    </div>
                    <div>
                      <dt className="font-bold text-ngpa-teal">Dates</dt>
                      <dd className="text-ngpa-white/80">
                        <time dateTime={program.startsOn}>{program.when}</time>
                        {program.key.startsWith("mvf-") ? " ET" : ""}
                      </dd>
                    </div>
                    <div>
                      <dt className="font-bold text-ngpa-teal">Who it fits</dt>
                      <dd className="text-ngpa-white/80">{program.ages} &middot; {program.levels}</dd>
                    </div>
                    <div>
                      <dt className="font-bold text-ngpa-teal">Registration</dt>
                      <dd className="text-ngpa-white/80">{program.registrar}</dd>
                    </div>
                  </dl>
                  <Link href={program.href} className="inline-flex items-center min-h-[48px] mt-5 text-base font-bold text-ngpa-teal hover:text-ngpa-teal-bright underline-offset-4 hover:underline">
                    {program.key === "fall" ? "See Bethesda season details" : "See MVF class details"}
                  </Link>
                </article>
              ))}
            </div>
          ) : (
            <p className="rounded-2xl border border-ngpa-slate/60 bg-ngpa-panel p-6 mb-10 text-base text-ngpa-white/80 leading-relaxed">
              No season or partner classes are listed for Montgomery County
              right now. Text Coach Sam for a free evaluation, request a private
              lesson, or check the drop-in schedule for separately listed sessions.
            </p>
          )}

          <div className="bg-ngpa-panel rounded-2xl border border-ngpa-slate/60 p-7 mb-10">
            <h3 className="font-heading text-xl font-black text-ngpa-white mb-2 tracking-tight">
              Start with an evaluation or a private lesson.
            </h3>
            <p className="text-base text-ngpa-white/70 leading-relaxed">
              Your child can start at any step of the pathway. Text Coach Sam
              with the days and area that work for you; you&rsquo;ll confirm the
              evaluation&rsquo;s time and court together. For a private lesson,
              request a time first. Sam confirms the court before sending your invoice.
            </p>
            <div className="mt-4 flex flex-col sm:flex-row gap-x-6">
              <a href={EVALUATION_SMS_URL} className="inline-flex items-center min-h-[48px] text-base font-bold text-ngpa-teal hover:underline">
                Text for a free evaluation
              </a>
              <Link href="/lessons" className="inline-flex items-center min-h-[48px] text-base font-bold text-ngpa-teal hover:underline">
                Explore private lessons
              </Link>
              <Link href="/schedule" className="inline-flex items-center min-h-[48px] text-base font-bold text-ngpa-teal hover:underline">
                Check drop-in sessions
              </Link>
            </div>
          </div>

          <h3 className="font-heading text-base font-bold text-ngpa-white uppercase tracking-[0.15em] mb-4">
            Explore your local guide
          </h3>
          <p className="text-base text-ngpa-white/75 leading-relaxed mb-5">
            Your home town and the program&rsquo;s venue can be different.
            These guides help you explore options at named program venues.
            Check the program&rsquo;s listed venue
            and confirm partner locations before heading out.
          </p>
          <ul className="flex flex-wrap gap-2">
            {CITY_LANDING_PAGES.map((cityPage) => (
              <li
                key={cityPage.slug}
                className="bg-ngpa-panel border border-ngpa-slate/60 rounded-full text-base font-medium text-ngpa-white/85"
              >
                <Link
                  href={`/${cityPage.slug}`}
                  className="inline-flex items-center min-h-[48px] px-4 py-2 hover:text-ngpa-teal transition-colors"
                >
                  {cityPage.city}
                </Link>
              </li>
            ))}
          </ul>
          <p className="mt-8 text-base text-ngpa-white/75 leading-relaxed">
            Looking in Frederick County?{" "}
            <Link href="/youth-pickleball-frederick" className="inline-flex items-center min-h-[48px] font-bold text-ngpa-teal hover:underline">
              See youth programs at The Pickl Park in Frederick
            </Link>
            . That venue has its own programs, age requirements and registration.
          </p>
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
            Your child progresses through NGA&rsquo;s Red, Orange, Green and
            Yellow Ball pathway as their skills develop. A free evaluation helps
            us recommend a next step within the program&rsquo;s age requirements.
            Check each listing for its available levels, group size and current
            dates. Private lessons are available at any level.
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
                {/* `data-age-guard="exempt"` opts this biographical text out
                    of the seo.spec.ts "no 5-anchored age copy" regression —
                    Sam's bio cites his son starting pickleball at age 5 as a
                    real historical fact, not an NGA service-age claim. */}
                <p
                  className="text-sm text-ngpa-white/75 leading-relaxed"
                  data-age-guard="exempt"
                >
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
            Know what you&rsquo;re signing up for.
          </h2>
          <p className="text-lg text-ngpa-white/75 leading-relaxed mb-8">
            Season registrations cover a block of sessions, paid up front.
            Partner classes are booked and paid through the organization named
            on the listing. Drop-in sessions are single bookings when listed,
            with the rate shown at checkout. Check the program&rsquo;s dates,
            eligibility, availability and cancellation terms before you pay.{" "}
            <Link
              href="/schedule"
              className="text-ngpa-teal hover:text-ngpa-teal-bright font-bold underline-offset-4 hover:underline transition-colors"
            >
              Check separately listed drop-ins
            </Link>
            .
          </p>
          <div className="bg-ngpa-panel/80 backdrop-blur-sm rounded-2xl border border-ngpa-slate/60 p-7">
            <div className="flex items-baseline gap-2 mb-2">
              <span className="font-mono font-bold text-4xl text-ngpa-teal">Free</span>
              <span className="text-ngpa-white/65">30-minute evaluation</span>
            </div>
            <p className="text-base text-ngpa-white/70 leading-relaxed">
              Start there &mdash; your coach watches your child play and helps
              you find the right next step. There&rsquo;s no cost or commitment.
              You&rsquo;ll confirm the time and court with Coach Sam by text.
            </p>
          </div>
          <p className="text-sm text-ngpa-white/60 mt-5">
            <strong className="text-ngpa-white/80">Private lessons</strong> are
            available at any level. The{" "}
            <Link href="/lessons" className="font-bold text-ngpa-teal hover:underline">Lessons page</Link>{" "}
            lists coaching options and rates. Request a time first; Coach Sam
            confirms your court before sending an invoice.
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
              Arrange your free evaluation.
            </h2>
            <p className="text-ngpa-white/70 mt-3 text-lg">
              Text Coach Sam to find a time and court for your family.
            </p>
          </div>
          <EvaluationSchedulingCard />
        </div>
      </section>
    </>
  );
}
