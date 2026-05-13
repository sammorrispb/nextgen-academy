import Image from "next/image";
import Link from "next/link";
import Hero from "@/components/Hero";
import HowItWorks from "@/components/HowItWorks";
import CoachStrip from "@/components/CoachStrip";
import UpcomingSessions from "@/components/UpcomingSessions";
import BallPathway from "@/components/BallPathway";
import LevelGrid from "@/components/LevelGrid";
import YellowBallCTA from "@/components/YellowBallCTA";
import EaseValues from "@/components/EaseValues";
import TestimonialsSection from "@/components/TestimonialsSection";
import LeadForm from "@/components/LeadForm";
import FAQSection from "@/components/FAQSection";
import SectionHeading from "@/components/SectionHeading";
import CoachCard from "@/components/CoachCard";
import JsonLd from "@/components/JsonLd";
import { coaches } from "@/data/coaches";
import { site } from "@/data/site";
import { faq } from "@/data/faq";
import { familySiteUrl } from "@/lib/urls";
import { fetchUpcomingSessions } from "@/lib/notion-sessions";
import { inferCity } from "@/lib/venue-lookup";

export const metadata = {
  alternates: { canonical: "/" },
};

export const revalidate = 300;

export default async function Home() {
  const sessions = await fetchUpcomingSessions();
  const upcomingForSchema = sessions.slice(0, 4);
  return (
    <>
      {/* FAQ Schema */}
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: faq.map((item) => ({
            "@type": "Question",
            name: item.question,
            acceptedAnswer: {
              "@type": "Answer",
              text: item.answer,
            },
          })),
        }}
      />

      {/* Coach Person Schema (E-E-A-T signals for AI citation) */}
      {coaches.map((coach) => (
        <JsonLd
          key={`person-${coach.name}`}
          data={{
            "@context": "https://schema.org",
            "@type": "Person",
            name: coach.name,
            jobTitle: coach.role,
            description: coach.bio,
            ...(coach.photo ? { image: `https://nextgenpbacademy.com${coach.photo}` } : {}),
            worksFor: {
              "@type": "SportsOrganization",
              name: "Next Gen Pickleball Academy",
              url: "https://nextgenpbacademy.com",
            },
            ...(coach.knowsAbout ? { knowsAbout: coach.knowsAbout } : {}),
          }}
        />
      ))}

      {/* Per-session Event schema — surfaces upcoming sessions to local search
         and AI assistants. Address city is inferred from the location string
         when recognized; falls back to "Montgomery County" otherwise. */}
      {upcomingForSchema.map((session) => {
        const city = inferCity(session.location) ?? "Montgomery County";
        return (
          <JsonLd
            key={`event-${session.id}`}
            data={{
              "@context": "https://schema.org",
              "@type": "SportsEvent",
              name: session.title || `NGA Drop-in${session.level ? ` (${session.level} Ball)` : ""}`,
              startDate: session.startTime
                ? `${session.date}T${session.startTime}`
                : session.date,
              ...(session.endTime
                ? { endDate: `${session.date}T${session.endTime}` }
                : {}),
              eventStatus:
                session.status === "Cancelled"
                  ? "https://schema.org/EventCancelled"
                  : "https://schema.org/EventScheduled",
              eventAttendanceMode:
                "https://schema.org/OfflineEventAttendanceMode",
              location: {
                "@type": "Place",
                name: session.location,
                address: {
                  "@type": "PostalAddress",
                  addressLocality: city,
                  addressRegion: "MD",
                  addressCountry: "US",
                },
              },
              organizer: {
                "@type": "SportsOrganization",
                name: "Next Gen Pickleball Academy",
                url: "https://nextgenpbacademy.com",
              },
              offers: {
                "@type": "Offer",
                price: "40",
                priceCurrency: "USD",
                availability:
                  session.spotsLeft > 0
                    ? "https://schema.org/InStock"
                    : "https://schema.org/SoldOut",
                url: "https://nextgenpbacademy.com/schedule",
              },
            }}
          />
        );
      })}

      <Hero />

      {/* ─── How It Works ────────────────────────── */}
      <HowItWorks />

      {/* ─── Coach Strip (above-the-fold trust) ──── */}
      <CoachStrip />

      {/* ─── This Week's Sessions (live from Notion) ── */}
      <UpcomingSessions sessions={sessions} />

      {/* ─── Programs / Ball Pathway ─────────────── */}
      <section
        id="levels"
        className="relative isolate overflow-hidden bg-ngpa-navy py-20 sm:py-28 px-4 sm:px-6 lg:px-10 scroll-mt-20"
      >
        <div aria-hidden="true" className="absolute inset-0 -z-10">
          <Image
            src="/images/kids-outdoor-play.jpeg"
            alt=""
            fill
            sizes="100vw"
            className="object-cover opacity-[0.12]"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-ngpa-navy via-ngpa-navy/85 to-ngpa-navy" />
        </div>
        <div className="relative max-w-7xl mx-auto">
          <SectionHeading
            eyebrow="The Pathway"
            title="We don't just teach pickleball. We develop athletes."
            subtitle="A private-lesson bridge for pre-rally kids, then three color-coded group levels guiding rally-ready athletes to tournament play — placed by skill, never age alone."
          />
          <BallPathway />
          <LevelGrid />
          <div className="mt-10">
            <YellowBallCTA />
          </div>
        </div>
      </section>

      {/* ─── Coaching Philosophy (EASE) ──────────── */}
      <section
        id="ease"
        className="relative bg-ngpa-deep py-20 sm:py-28 px-4 sm:px-6 lg:px-10 scroll-mt-20 overflow-hidden"
      >
        {/* Subtle teal accent backdrop */}
        <div
          aria-hidden="true"
          className="absolute -top-32 -right-32 w-[28rem] h-[28rem] rounded-full bg-ngpa-teal/10 blur-3xl"
        />
        <div className="relative max-w-7xl mx-auto">
          <SectionHeading
            eyebrow="Our Philosophy"
            title="Four habits that travel beyond the court."
            subtitle="Every drill, every cue, every reset is a chance to build EASE — the framework Sam and Amine teach every session."
          />
          <EaseValues />
          <div className="mt-10 max-w-3xl">
            <div className="relative rounded-2xl bg-ngpa-panel/80 backdrop-blur-sm border border-ngpa-teal/30 p-6 sm:p-7">
              <div
                aria-hidden="true"
                className="absolute left-0 top-6 bottom-6 w-1 rounded-r-full bg-ngpa-teal"
              />
              <div className="font-heading text-base sm:text-lg font-bold text-ngpa-white mb-1.5">
                Define &rarr; Demonstrate &rarr; Drill
              </div>
              <p className="text-sm sm:text-base text-ngpa-white/70 leading-relaxed">
                We explain the why, show the how, then practice until it&rsquo;s
                second nature.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Testimonials ────────────────────────── */}
      <section
        id="testimonials"
        className="relative isolate overflow-hidden bg-ngpa-navy py-20 sm:py-28 px-4 sm:px-6 lg:px-10 scroll-mt-20"
      >
        <div aria-hidden="true" className="absolute inset-0 -z-10">
          <Image
            src="/images/outdoor-action-shot.jpeg"
            alt=""
            fill
            sizes="100vw"
            className="object-cover object-center opacity-[0.10]"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-ngpa-navy via-ngpa-navy/92 to-ngpa-navy" />
        </div>
        <div className="relative max-w-7xl mx-auto">
          <SectionHeading
            eyebrow="Parent Stories"
            title="What Next Gen families say."
            subtitle="Real feedback from the parents who trust us with their kids."
            centered
          />
          <TestimonialsSection />
        </div>
      </section>

      {/* ─── About / Coaches ─────────────────────── */}
      <section
        id="about"
        className="relative bg-ngpa-deep py-20 sm:py-28 px-4 sm:px-6 lg:px-10 scroll-mt-20 overflow-hidden"
      >
        <div
          aria-hidden="true"
          className="absolute -bottom-32 -left-32 w-[28rem] h-[28rem] rounded-full bg-ngpa-teal/8 blur-3xl"
        />
        <div className="relative max-w-7xl mx-auto">
          <SectionHeading
            eyebrow="The Team"
            title="Two dads, one mission."
            subtitle="Building the program we wished existed for our own kids."
          />
          <div className="max-w-3xl mb-12">
            <p className="text-lg text-ngpa-white/80 leading-relaxed mb-5">
              Next Gen was started by{" "}
              <strong className="text-ngpa-white font-bold">Sam and Amine</strong>, two
              dads building a roadmap for our own kids: structured lessons, a
              positive culture, and a clear path from curiosity to competition.
            </p>
            <p className="text-lg text-ngpa-white/80 leading-relaxed mb-5">
              Our approach is built on the{" "}
              <strong className="text-ngpa-teal font-bold">Parent&ndash;Coach&ndash;Kid Triangle</strong>&mdash;
              parents aren&rsquo;t spectators, they&rsquo;re partners. Families learn
              the game together so everyone grows through the sport.
            </p>
            <p className="text-lg text-ngpa-white/80 leading-relaxed">
              And if you&rsquo;re wondering &mdash; yes, Sam coaches adults too,
              separately from NGA.{" "}
              <a
                href={familySiteUrl("sammorrispb", "/evaluation", "about_adults")}
                target="_blank"
                rel="noopener noreferrer"
                className="text-ngpa-teal hover:text-ngpa-teal-bright font-bold underline-offset-4 hover:underline transition-colors"
              >
                Book a free 30-minute skill evaluation &rarr;
              </a>
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-7">
            {coaches.map((coach) => (
              <CoachCard key={coach.name} coach={coach} />
            ))}
          </div>
        </div>
      </section>

      {/* ─── Lead Form ───────────────────────────── */}
      <section
        id="contact-form"
        className="relative bg-ngpa-navy py-20 sm:py-28 px-4 sm:px-6 lg:px-10 scroll-mt-20 overflow-hidden"
      >
        <div
          aria-hidden="true"
          className="absolute top-0 left-1/2 -translate-x-1/2 w-[36rem] h-[36rem] rounded-full bg-ngpa-teal/10 blur-3xl"
        />
        <div className="relative max-w-xl mx-auto">
          <SectionHeading
            eyebrow="Free 30-min Evaluation"
            title="Let's find the right fit."
            subtitle="Tell us about your child and we'll follow up within 24 hours."
            centered
          />
          <LeadForm />
        </div>
      </section>

      {/* ─── FAQ ─────────────────────────────────── */}
      <section
        id="faq"
        className="bg-ngpa-deep py-20 sm:py-28 px-4 sm:px-6 lg:px-10 scroll-mt-20"
      >
        <div className="max-w-3xl mx-auto">
          <SectionHeading
            eyebrow="FAQ"
            title="Everything families need to know."
          />
          <FAQSection />
        </div>
      </section>

      {/* ─── Contact Strip ───────────────────────── */}
      <section
        id="contact"
        className="bg-ngpa-navy py-20 sm:py-24 px-4 sm:px-6 lg:px-10 scroll-mt-20"
      >
        <div className="max-w-5xl mx-auto">
          <SectionHeading
            eyebrow="Find Us"
            title="Reach out — we'd love to meet you."
            centered
          />

          <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4 mb-10">
            <a
              href={`mailto:${site.email}`}
              className="inline-flex items-center gap-2 px-5 py-3 bg-ngpa-panel/80 rounded-full border border-ngpa-slate/60 hover:border-ngpa-teal hover:text-ngpa-teal text-sm font-semibold text-ngpa-white transition-colors min-h-[48px]"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              Email
            </a>
            <a
              href={`tel:${site.phone.replace(/\D/g, "")}`}
              className="inline-flex items-center gap-2 px-5 py-3 bg-ngpa-panel/80 rounded-full border border-ngpa-slate/60 hover:border-ngpa-teal hover:text-ngpa-teal text-sm font-semibold text-ngpa-white transition-colors min-h-[48px]"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
              </svg>
              {site.phone}
            </a>
            <a
              href={site.instagram}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-5 py-3 bg-ngpa-panel/80 rounded-full border border-ngpa-slate/60 hover:border-ngpa-teal hover:text-ngpa-teal text-sm font-semibold text-ngpa-white transition-colors min-h-[48px]"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
              </svg>
              Instagram
            </a>
            <a
              href={site.whatsapp}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-5 py-3 bg-ngpa-panel/80 rounded-full border border-ngpa-slate/60 hover:border-ngpa-teal hover:text-ngpa-teal text-sm font-semibold text-ngpa-white transition-colors min-h-[48px]"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
              </svg>
              WhatsApp
            </a>
          </div>

          <div className="max-w-2xl mx-auto bg-ngpa-panel/80 backdrop-blur-sm rounded-2xl border border-ngpa-slate/60 p-7 text-center">
            <h3 className="font-heading text-xl font-black text-ngpa-white mb-2 tracking-tight">
              Your closest court, every week.
            </h3>
            <p className="text-base text-ngpa-white/70 leading-relaxed">
              Sessions rotate across Montgomery County Public Schools by demand
              &mdash; closer to more zip codes than a single fixed venue.{" "}
              <Link
                href="/schedule"
                className="text-ngpa-teal font-bold hover:text-ngpa-teal-bright underline-offset-4 hover:underline transition-colors"
              >
                See this week&rsquo;s locations &rarr;
              </Link>
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
