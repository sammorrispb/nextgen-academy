import Hero from "@/components/Hero";
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
import { hubUrl } from "@/lib/urls";

export const metadata = {
  alternates: { canonical: "/" },
};

export default function Home() {
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

      <Hero />

      {/* ─── Programs / Ball Pathway ─────────────── */}
      <section
        id="levels"
        className="bg-ngpa-navy py-16 px-4 sm:px-6 lg:px-8 scroll-mt-20"
      >
        <div className="max-w-6xl mx-auto">
          <SectionHeading
            title="Find Your Level"
            subtitle="Four color-coded levels guide your child from first paddle to tournament play."
          />
          <BallPathway />
          <LevelGrid />
          <div className="mt-8">
            <YellowBallCTA />
          </div>
        </div>
      </section>

      {/* ─── Coaching Philosophy (EASE) ──────────── */}
      <section
        id="ease"
        className="bg-ngpa-black py-16 px-4 sm:px-6 lg:px-8 scroll-mt-20"
      >
        <div className="max-w-6xl mx-auto">
          <SectionHeading
            title="Our Coaching Philosophy"
            subtitle="We don't just teach pickleball. We develop athletes."
          />
          <EaseValues />
          <div className="mt-8 border-l-4 border-ngpa-lime bg-ngpa-slate/50 rounded-r-xl p-5">
            <div className="font-heading text-base font-bold text-ngpa-white mb-1">
              Define &rarr; Demonstrate &rarr; Drill
            </div>
            <p className="text-sm text-ngpa-muted leading-relaxed">
              We explain the why, show the how, then practice until it&rsquo;s
              second nature.
            </p>
          </div>
        </div>
      </section>

      {/* ─── Testimonials ────────────────────────── */}
      <section
        id="testimonials"
        className="bg-ngpa-navy py-16 px-4 sm:px-6 lg:px-8 scroll-mt-20"
      >
        <div className="max-w-6xl mx-auto">
          <SectionHeading
            title="What Parents Say"
            subtitle="Real feedback from Next Gen families."
            centered
          />
          <TestimonialsSection />
        </div>
      </section>

      {/* ─── About / Coaches ─────────────────────── */}
      <section
        id="about"
        className="bg-ngpa-black py-16 px-4 sm:px-6 lg:px-8 scroll-mt-20"
      >
        <div className="max-w-6xl mx-auto">
          <SectionHeading
            title="Meet the Team"
            subtitle="Two dads building the program they wished existed for their own kids."
          />
          <div className="max-w-3xl mb-10">
            <p className="text-ngpa-muted leading-relaxed mb-4">
              Next Gen was started by <strong className="text-ngpa-white">Sam and Amine</strong>,
              building a roadmap for our own kids: structured lessons, a positive
              culture, and a clear path from curiosity to competition.
            </p>
            <p className="text-ngpa-muted leading-relaxed">
              Our approach is built on the{" "}
              <strong className="text-ngpa-white">Parent&ndash;Coach&ndash;Kid Triangle</strong>&mdash;parents
              aren&rsquo;t spectators, they&rsquo;re partners. Families learn the
              game together so everyone grows through the sport.
            </p>
            <p className="text-ngpa-muted leading-relaxed mt-4">
              Want to play too?{" "}
              <a
                href={hubUrl("/")}
                target="_blank"
                rel="noopener noreferrer"
                className="text-ngpa-lime hover:underline"
              >
                Link &amp; Dink
              </a>{" "}
              connects adult players across Montgomery County with groups, events, and
              community&mdash;built by the same team behind Next Gen.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {coaches.map((coach) => (
              <CoachCard key={coach.name} coach={coach} />
            ))}
          </div>
        </div>
      </section>

      {/* ─── Lead Form ───────────────────────────── */}
      <section
        id="contact-form"
        className="bg-ngpa-navy py-16 px-4 sm:px-6 lg:px-8 scroll-mt-20"
      >
        <div className="max-w-xl mx-auto">
          <SectionHeading
            title="Let's Find the Right Fit"
            subtitle="Tell us about your child and we'll follow up within 24 hours."
            centered
          />
          <LeadForm />
        </div>
      </section>

      {/* ─── FAQ ─────────────────────────────────── */}
      <section
        id="faq"
        className="bg-ngpa-black py-16 px-4 sm:px-6 lg:px-8 scroll-mt-20"
      >
        <div className="max-w-3xl mx-auto">
          <SectionHeading
            title="Frequently Asked Questions"
            subtitle="Everything families need to know."
          />
          <FAQSection />
        </div>
      </section>

      {/* ─── Contact Strip + Maps ────────────────── */}
      <section
        id="contact"
        className="bg-ngpa-navy py-16 px-4 sm:px-6 lg:px-8 scroll-mt-20"
      >
        <div className="max-w-6xl mx-auto">
          <SectionHeading title="Find Us" centered />

          {/* Contact methods */}
          <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6 mb-10">
            <a
              href={`mailto:${site.email}`}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-ngpa-panel rounded-full border border-ngpa-slate hover:border-ngpa-lime text-sm text-ngpa-white hover:text-ngpa-lime transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              Email
            </a>
            <a
              href={`tel:${site.phone.replace(/\D/g, "")}`}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-ngpa-panel rounded-full border border-ngpa-slate hover:border-ngpa-lime text-sm text-ngpa-white hover:text-ngpa-lime transition-colors"
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
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-ngpa-panel rounded-full border border-ngpa-slate hover:border-ngpa-lime text-sm text-ngpa-white hover:text-ngpa-lime transition-colors"
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
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-ngpa-panel rounded-full border border-ngpa-slate hover:border-ngpa-lime text-sm text-ngpa-white hover:text-ngpa-lime transition-colors"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
              </svg>
              WhatsApp
            </a>
          </div>

          {/* Locations rotate seasonally — no fixed venue */}
          <div className="max-w-2xl mx-auto bg-ngpa-panel rounded-2xl border border-ngpa-slate p-6 text-center">
            <h3 className="font-heading text-lg font-bold text-ngpa-white mb-2">
              Locations Rotate Seasonally
            </h3>
            <p className="text-sm text-ngpa-muted leading-relaxed">
              Sessions move between Montgomery County courts each season.
              Email or text us and we&rsquo;ll share the current location.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
