import Image from "next/image";
import Link from "next/link";
import Hero from "@/components/Hero";
import HowItWorks, { HOW_IT_WORKS_TITLE } from "@/components/HowItWorks";
import HomeDisclosure from "@/components/HomeDisclosure";
import HomeDisclosureOpener from "@/components/HomeDisclosureOpener";
import LevelRows from "@/components/LevelRows";
import CoachStrip from "@/components/CoachStrip";
import IntentChooser from "@/components/IntentChooser";
import HomeMvfFeature from "@/components/HomeMvfFeature";
import UpcomingSessions from "@/components/UpcomingSessions";
import EaseValues from "@/components/EaseValues";
import TestimonialsSection from "@/components/TestimonialsSection";
import ContactForm from "@/components/ContactForm";
import FAQSection from "@/components/FAQSection";
import SectionHeading from "@/components/SectionHeading";
import CoachCard from "@/components/CoachCard";
import JsonLd from "@/components/JsonLd";
import CommunityGroupsCard from "@/components/CommunityGroupsCard";
import { coaches } from "@/data/coaches";
import { site } from "@/data/site";
import { faq } from "@/data/faq";
import { seo } from "@/data/seo";
import { testimonials } from "@/data/testimonials";
import LessonHandoffLink from "@/components/LessonHandoffLink";
import { coachLessonUrl } from "@/lib/urls";
import { fetchUpcomingSessions } from "@/lib/notion-sessions";
import { todayET } from "@/lib/fall-refund-policy";
import { homeFoldedIds, playCardLive } from "@/lib/home-structure";
import {
  orgRef,
  PERSON_IDS,
  PERSON_SAME_AS,
  SITE_URL,
  type CoachName,
} from "@/lib/seo";
import { sportsEventJsonLd } from "@/lib/sports-event-jsonld";

const trainingPhotos = [
  { src: "/images/training/training-3.jpg", alt: "A young player returning a ball in a gym" },
  { src: "/images/training/training-4.jpg", alt: "Young players playing doubles across a gym net" },
  { src: "/images/training/training-5.jpg", alt: "Two players exchanging shots on an outdoor court" },
  { src: "/images/training/training-6.jpg", alt: "Players sharing outdoor courts surrounded by trees" },
];

export const metadata = {
  alternates: { canonical: "/" },
  description: seo.home.description,
  openGraph: {
    title: "Next Gen Pickleball Academy",
    description: seo.home.description,
    url: SITE_URL,
    images: ["/opengraph-image"],
  },
};

export const revalidate = 300;

export default async function Home() {
  const sessions = await fetchUpcomingSessions();
  const upcomingForSchema = sessions.slice(0, 4);
  const today = todayET();
  const folded = homeFoldedIds({ testimonials });
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
            "@id": PERSON_IDS[coach.name as CoachName],
            url: `${SITE_URL}/#about`,
            ...(coach.photo ? { image: `${SITE_URL}${coach.photo}` } : {}),
            ...(PERSON_SAME_AS[coach.name as CoachName]?.length
              ? { sameAs: PERSON_SAME_AS[coach.name as CoachName] }
              : {}),
            worksFor: orgRef(),
            ...(coach.knowsAbout ? { knowsAbout: coach.knowsAbout } : {}),
          }}
        />
      ))}

      {/* Per-session Event schema — surfaces upcoming sessions to local search
         and AI assistants. */}
      {upcomingForSchema.map((session) => (
        <JsonLd key={`event-${session.id}`} data={sportsEventJsonLd(session)} />
      ))}

      <HomeDisclosureOpener folded={folded} />

      <Hero />

      {/* ─── Start Here: the three intents ───────── */}
      <IntentChooser showPlayCard={playCardLive(today)} />

      {/* ─── Coach Strip (above-the-fold trust) ──── */}
      <CoachStrip />

      {/* ─── This Week's Sessions (live from Notion) ── */}
      <UpcomingSessions sessions={sessions} omitOffers={["/free-evaluation"]} />

      {/* ─── Featured: MVF Fall Session II ───────── */}
      <HomeMvfFeature todayIso={todayET()} />

      {/* ─── Programs / Ball Pathway ─────────────── */}
      <section
        id="levels"
        data-home-block="levels"
        className="relative isolate overflow-hidden bg-ngpa-deep py-14 sm:py-20 px-4 sm:px-6 lg:px-10 scroll-mt-20"
      >
        <div aria-hidden="true" className="absolute inset-0 -z-10">
          <Image
            src="/images/kids-outdoor-play.jpeg"
            alt=""
            fill
            sizes="100vw"
            className="object-cover opacity-[0.12]"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-ngpa-deep via-ngpa-deep/85 to-ngpa-deep" />
        </div>
        <div className="relative max-w-7xl mx-auto">
          <SectionHeading
            eyebrow="The Pathway"
            title="We don't just teach pickleball. We develop athletes."
            subtitle="Four ball colors — Red, Orange, Green, and Yellow — guide athletes from first paddle touch to tournament play. Private lessons are available at every level; each group program lists its ages and levels. Placement starts with skill and follows the program's eligibility."
          />
          <LevelRows />
          <div className="mt-12 border-t border-ngpa-teal/20 pt-8">
            <h3 className="font-heading text-2xl sm:text-3xl font-bold text-ngpa-white mb-6">
              Next Gen on the court.
            </h3>
            <section
              aria-label="Next Gen photo gallery"
              tabIndex={0}
              className="min-w-0 overflow-x-auto snap-x snap-mandatory rounded-2xl pb-3 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ngpa-teal"
            >
              <ul className="grid grid-flow-col auto-cols-[70%] gap-4 sm:auto-cols-[32%] lg:grid-flow-row lg:grid-cols-4">
                {trainingPhotos.map((photo) => (
                  <li key={photo.src} className="aspect-[3/4] snap-start overflow-hidden rounded-2xl border border-ngpa-teal/20 bg-ngpa-panel">
                    <Image
                      src={photo.src}
                      alt={photo.alt}
                      width={2880}
                      height={3840}
                      sizes="(min-width: 1024px) 16vw, (min-width: 640px) 32vw, 70vw"
                      className="h-full w-full object-cover"
                    />
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </div>
      </section>

      {/* ─── Contact Form ────────────────────────── */}
      <section
        id="contact-form"
        data-home-block="contact-form"
        className="relative bg-ngpa-navy pt-14 pb-10 sm:pt-20 sm:pb-12 px-4 sm:px-6 lg:px-10 scroll-mt-20 overflow-hidden"
      >
        <div
          aria-hidden="true"
          className="absolute top-0 left-1/2 -translate-x-1/2 w-[36rem] h-[36rem] rounded-full bg-ngpa-teal/10 blur-3xl"
        />
        <div className="relative max-w-xl mx-auto">
          <SectionHeading
            eyebrow="Contact Us"
            title="Tell us how we can help."
            subtitle="Pick what you're interested in and we'll get back to you within 1 business day."
            centered
          />
          <ContactForm />
        </div>
      </section>

      {/* ─── Contact Strip ───────────────────────── */}
      <section
        id="contact"
        data-home-block="contact"
        className="bg-ngpa-navy pt-4 pb-14 sm:pb-20 px-4 sm:px-6 lg:px-10 scroll-mt-20"
      >
        <div className="max-w-5xl mx-auto">
          <SectionHeading
            eyebrow="Find Us"
            title="Reach out — we'd love to meet you."
            centered
          />

          <CommunityGroupsCard section="home_contact" className="mb-10" />

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
          </div>

          <div className="max-w-2xl mx-auto bg-ngpa-panel/80 backdrop-blur-sm rounded-2xl border border-ngpa-slate/60 p-7 text-center">
            <h3 className="font-heading text-xl font-black text-ngpa-white mb-2 tracking-tight">
              Your closest court, every week.
            </h3>
            <p className="text-base text-ngpa-white/70 leading-relaxed">
              Sessions rotate across Montgomery County Public Schools by demand
              &mdash; closer to more zip codes than a single fixed venue.
              Private lessons are also available at The Pickl Park in
              Frederick.{" "}
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

      {/* ─── Folded: the reference sections ──────── */}
      <section
        data-home-block="more"
        className="bg-ngpa-deep px-4 sm:px-6 lg:px-10 pb-16 sm:pb-20"
      >
        <div className="max-w-5xl mx-auto border-b border-ngpa-slate/40">
          <HomeDisclosure id="how-it-works" title={HOW_IT_WORKS_TITLE}>
            <HowItWorks />
          </HomeDisclosure>

          <HomeDisclosure id="ease" title="Four habits that travel beyond the court.">
            <p className="mb-8 text-base sm:text-lg text-ngpa-white/70 leading-relaxed max-w-2xl">
              Every drill, every cue, every reset is a chance to build EASE — the framework Sam and Amine teach every session.
            </p>
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
          </HomeDisclosure>

          {folded.includes("testimonials") && (
            <HomeDisclosure id="testimonials" title="What Next Gen families say.">
              <p className="mb-8 text-base sm:text-lg text-ngpa-white/70 leading-relaxed max-w-2xl">
                Real feedback from the parents who trust us with their kids.
              </p>
              <TestimonialsSection />
            </HomeDisclosure>
          )}

          <HomeDisclosure id="about" title="Two dads, one mission.">
            <p className="mb-8 text-base sm:text-lg text-ngpa-white/70 leading-relaxed max-w-2xl">
              Building the program we wished existed for our own kids.
            </p>
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
              <LessonHandoffLink
                href={coachLessonUrl("about_adults")}
                className="text-ngpa-teal hover:text-ngpa-teal-bright font-bold underline-offset-4 hover:underline transition-colors"
                noteClassName="mt-1 text-sm text-ngpa-white/65"
              >
                Request an adult lesson with Sam &rarr;
              </LessonHandoffLink>
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-7">
            {coaches.map((coach) => (
              <CoachCard key={coach.name} coach={coach} />
            ))}
          </div>
          </HomeDisclosure>

          <HomeDisclosure id="faq" title="Everything families need to know.">
            <FAQSection />
          </HomeDisclosure>

          {[
            { href: "/newsletter", label: "Free Newsletter" },
            { href: "/crew", label: "The Crew Pathway" },
          ].map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="flex min-h-12 items-center justify-between gap-4 border-t border-ngpa-slate/40 py-5 font-heading text-xl sm:text-2xl font-black text-ngpa-white tracking-tight transition-colors hover:text-ngpa-teal focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ngpa-teal"
            >
              {link.label}
              <span aria-hidden="true" className="text-ngpa-teal">&rarr;</span>
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}
