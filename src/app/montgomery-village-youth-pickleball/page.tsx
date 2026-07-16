import Link from "next/link";
import type { Metadata } from "next";
import { seo } from "@/data/seo";
import {
  MVF_PROGRAMS,
  MVF_AGE_MIN,
  MVF_AGE_MAX,
  MVF_VENUE,
  MVF_VENUE_LOCALITY,
  MVF_VENUE_REGION,
  MVF_REGISTRATION_NOTE,
  MVF_REC_GUIDE_FOOTNOTE,
  type MvfProgram,
} from "@/data/mvf";
import JsonLd from "@/components/JsonLd";
import NewsletterForm from "@/components/NewsletterForm";
import MvfTournamentCard from "@/components/MvfTournamentCard";
import TrackedCTA from "@/components/TrackedCTA";
import { breadcrumbJsonLd, SITE_URL } from "@/lib/seo";

const PAGE_URL = `${SITE_URL}/montgomery-village-youth-pickleball`;

export const metadata: Metadata = {
  // Absolute title so the rendered <title> stays inside Google's ~60-char
  // truncation budget (template would add "%s | Next Gen Pickleball Academy").
  title: { absolute: seo.mvf.title },
  description: seo.mvf.description,
  alternates: { canonical: "/montgomery-village-youth-pickleball" },
  openGraph: {
    title: seo.mvf.title,
    description: seo.mvf.description,
    url: PAGE_URL,
    images: ["/opengraph-image"],
  },
  twitter: {
    card: "summary_large_image",
    title: seo.mvf.title,
    description: seo.mvf.description,
  },
};

const APPLE_RIDGE_PLACE = {
  "@type": "Place",
  name: MVF_VENUE,
  address: {
    "@type": "PostalAddress",
    addressLocality: MVF_VENUE_LOCALITY,
    addressRegion: MVF_VENUE_REGION,
    addressCountry: "US",
  },
} as const;

function sportsEventJsonLd(program: MvfProgram) {
  return {
    "@context": "https://schema.org",
    "@type": "SportsEvent",
    name: program.title,
    sport: "Pickleball",
    description: program.description,
    startDate: program.startDate,
    endDate: program.endDate,
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    location: APPLE_RIDGE_PLACE,
    organizer: [
      { "@type": "Organization", name: "Montgomery Village Foundation" },
      {
        "@type": "SportsOrganization",
        name: "Next Gen Pickleball Academy",
        url: SITE_URL,
      },
    ],
    audience: {
      "@type": "PeopleAudience",
      audienceType: "Children",
      suggestedMinAge: MVF_AGE_MIN,
      suggestedMaxAge: MVF_AGE_MAX,
    },
    offers: program.prices.map((price) => ({
      "@type": "Offer",
      name: `${program.title} — ${price.label}`,
      price: price.usd,
      priceCurrency: "USD",
      url: PAGE_URL,
      // Registration hasn't opened yet — it comes with the MVF Fall Rec Guide.
      availability: "https://schema.org/PreOrder",
    })),
  };
}

function formatLongDate(date: string): string {
  const d = new Date(`${date}T12:00:00Z`);
  return d.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

export default function MontgomeryVillagePage() {
  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", url: `${SITE_URL}/` },
          { name: "MVF Youth Pickleball in Montgomery Village", url: PAGE_URL },
        ])}
      />
      {MVF_PROGRAMS.map((program) => (
        <JsonLd key={`mvf-event-${program.key}`} data={sportsEventJsonLd(program)} />
      ))}

      {/* ─── Hero ─────────────────────────────── */}
      <section className="relative isolate overflow-hidden bg-ngpa-deep">
        <div className="absolute inset-x-0 top-0 h-96 bg-teal-glow pointer-events-none" />

        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-10 pt-16 sm:pt-24 pb-20 sm:pb-24">
          <p className="text-xs sm:text-sm font-bold tracking-[0.2em] uppercase text-ngpa-teal mb-4">
            Montgomery Village, MD &middot; Ages {MVF_AGE_MIN}&ndash;{MVF_AGE_MAX}
          </p>
          <h1 className="font-heading text-4xl sm:text-5xl lg:text-6xl font-black text-ngpa-white leading-[1.05] tracking-tight">
            Youth pickleball in{" "}
            <span className="text-ngpa-teal">Montgomery Village</span>.
          </h1>
          <p className="mt-6 text-lg text-ngpa-white/80 leading-relaxed max-w-2xl">
            This fall, Next Gen Pickleball Academy brings its coaching to the{" "}
            {MVF_VENUE} — an intro class in August, then two six-week Thursday
            sessions for kids and teens ages {MVF_AGE_MIN}&ndash;{MVF_AGE_MAX}.
            Every level is welcome; courts are grouped by skill and age so every
            kid gets real reps.
          </p>
          <p className="mt-4 text-sm font-bold text-ngpa-teal-bright">
            In partnership with the Montgomery Village Foundation.
          </p>

          <div className="mt-9 flex flex-col sm:flex-row gap-3">
            <TrackedCTA
              href="#newsletter"
              label="mvf_hero_newsletter"
              section="mvf_hero"
              className="inline-flex items-center gap-2 px-7 py-3.5 bg-ngpa-teal text-ngpa-deep font-bold rounded-full hover:bg-ngpa-teal-bright transition-colors min-h-[48px] shadow-xl shadow-ngpa-teal/20"
            >
              Get notified when registration opens
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </TrackedCTA>
            <TrackedCTA
              href="/free-evaluation"
              label="mvf_hero_free_eval"
              section="mvf_hero"
              asNextLink
              className="inline-flex items-center justify-center px-7 py-3.5 bg-white/10 ring-1 ring-white/30 text-ngpa-white font-bold rounded-full hover:bg-white/15 hover:ring-white/50 transition-all min-h-[48px]"
            >
              Book a Free Evaluation
            </TrackedCTA>
          </div>
        </div>
      </section>

      {/* ─── Programs ─────────────────────────── */}
      <section className="bg-ngpa-navy py-16 sm:py-20 px-4 sm:px-6 lg:px-10">
        <div className="max-w-3xl mx-auto">
          <p className="text-xs font-bold tracking-[0.2em] uppercase text-ngpa-teal mb-3">
            Fall 2026 Programs
          </p>
          <h2 className="font-heading text-3xl sm:text-4xl font-black text-ngpa-white mb-4 tracking-tight">
            Two ways to jump in at Apple Ridge.
          </h2>
          <p className="text-lg text-ngpa-white/75 leading-relaxed mb-10 max-w-2xl">
            Start with the one-evening intro class, roll into the fall sessions,
            or do both. All classes run at the {MVF_VENUE} in Montgomery
            Village, MD.
          </p>

          <div className="space-y-5">
            {MVF_PROGRAMS.map((program) => (
              <div
                key={program.key}
                className="bg-ngpa-panel rounded-2xl border border-ngpa-slate p-6 sm:p-7"
                data-testid={`mvf-program-${program.key}`}
              >
                <h3 className="font-heading text-xl font-bold text-ngpa-white tracking-tight">
                  {program.title}
                </h3>
                <p className="text-sm font-semibold text-ngpa-teal-bright mt-2">
                  {program.classCount === 1 ? (
                    <>
                      <time dateTime={program.startDate}>{program.dateLabel}</time>
                      {program.timeLabel && <> &middot; {program.timeLabel}</>}
                      {" "}&middot; 1 class
                    </>
                  ) : (
                    <>
                      Thursdays,{" "}
                      <time dateTime={program.startDate}>
                        {formatLongDate(program.startDate)}
                      </time>{" "}
                      &ndash;{" "}
                      <time dateTime={program.endDate}>
                        {formatLongDate(program.endDate)}
                      </time>{" "}
                      &middot; {program.classCount} classes
                    </>
                  )}
                </p>
                {program.timeLabel === null && (
                  <p className="text-xs text-ngpa-muted mt-1">
                    Thursdays &mdash; exact times announced in the MVF Fall Rec
                    Guide.
                  </p>
                )}
                <p className="font-mono font-bold text-2xl text-ngpa-white mt-4">
                  {program.prices.map((price, i) => (
                    <span key={price.label}>
                      {i > 0 && (
                        <span className="text-ngpa-muted text-base font-normal" aria-hidden="true">
                          {" "}&middot;{" "}
                        </span>
                      )}
                      ${price.usd}
                      <span className="text-ngpa-muted text-sm font-normal">
                        {" "}
                        {price.label === "per class"
                          ? "per class"
                          : `${price.label}, per ${program.priceUnit}`}
                      </span>
                    </span>
                  ))}
                </p>
                <p className="text-base text-ngpa-white/75 leading-relaxed mt-4">
                  {program.description}
                </p>
              </div>
            ))}
          </div>

          {/* Registration note */}
          <div
            className="mt-8 rounded-2xl border border-ngpa-teal/40 bg-ngpa-teal/10 p-6"
            data-testid="mvf-registration-note"
          >
            <p className="text-base text-ngpa-white/90 leading-relaxed">
              <strong className="font-bold text-ngpa-white">
                How registration works:
              </strong>{" "}
              {MVF_REGISTRATION_NOTE} Join the newsletter below and we&rsquo;ll
              email you the moment MVF registration opens.
            </p>
          </div>
        </div>
      </section>

      {/* ─── Brackets ─────────────────────────── */}
      <section className="bg-ngpa-deep py-16 sm:py-20 px-4 sm:px-6 lg:px-10">
        <div className="max-w-3xl mx-auto">
          <p className="text-xs font-bold tracking-[0.2em] uppercase text-ngpa-teal mb-3">
            Skill Brackets
          </p>
          <h2 className="font-heading text-3xl sm:text-4xl font-black text-ngpa-white mb-4 tracking-tight">
            Every kid on the right court.
          </h2>
          <p className="text-lg text-ngpa-white/75 leading-relaxed">
            We coach the same Red &rarr; Orange &rarr; Green &rarr; Yellow
            pathway we use across the academy. Red and Orange players are still
            learning to rally and get into games; Green and Yellow players play
            games and focus on strategy. Your child is assessed in the first
            class &mdash; no tryout, no pressure, just placement.{" "}
            <Link
              href="/#levels"
              className="text-ngpa-teal hover:text-ngpa-teal-bright font-bold underline-offset-4 hover:underline transition-colors"
            >
              See the full pathway
            </Link>
            , or{" "}
            <Link
              href="/free-evaluation"
              className="text-ngpa-teal hover:text-ngpa-teal-bright font-bold underline-offset-4 hover:underline transition-colors"
            >
              book a free evaluation
            </Link>{" "}
            and we&rsquo;ll place your child before day one.
          </p>
        </div>
      </section>

      {/* ─── Newsletter CTA ───────────────────── */}
      <section
        id="newsletter"
        className="relative bg-ngpa-navy py-16 sm:py-20 px-4 sm:px-6 lg:px-10 scroll-mt-20 overflow-hidden"
      >
        <div
          aria-hidden="true"
          className="absolute top-0 left-1/2 -translate-x-1/2 w-[36rem] h-[36rem] rounded-full bg-ngpa-teal/10 blur-3xl"
        />
        <div className="relative max-w-xl mx-auto">
          <div className="text-center mb-10">
            <p className="text-xs font-bold tracking-[0.2em] uppercase text-ngpa-teal mb-3">
              First to Know
            </p>
            <h2 className="font-heading text-3xl sm:text-4xl font-black text-ngpa-white tracking-tight">
              We&rsquo;ll email you the moment MVF registration opens.
            </h2>
            <p className="text-ngpa-white/70 mt-3 text-lg">
              Join the free weekly newsletter — MVF registration news first,
              plus open sessions and coach tips every Thursday.
            </p>
          </div>
          <div className="rounded-3xl border-2 border-ngpa-teal/30 bg-ngpa-deep/60 backdrop-blur-md p-1 shadow-2xl shadow-ngpa-teal/10">
            <NewsletterForm submitLabel="Notify Me When Registration Opens →" />
          </div>
        </div>
      </section>

      {/* ─── Tournament cross-promo ───────────── */}
      <section className="bg-ngpa-deep py-16 sm:py-20 px-4 sm:px-6 lg:px-10">
        <div className="max-w-3xl mx-auto">
          <p className="text-xs font-bold tracking-[0.2em] uppercase text-ngpa-teal mb-3">
            More at Apple Ridge
          </p>
          <h2 className="font-heading text-3xl sm:text-4xl font-black text-ngpa-white mb-6 tracking-tight">
            Want game day too?
          </h2>
          <MvfTournamentCard />

          <p className="mt-10 text-xs text-ngpa-muted/80 text-center">
            {MVF_REC_GUIDE_FOOTNOTE}
          </p>
        </div>
      </section>
    </>
  );
}
