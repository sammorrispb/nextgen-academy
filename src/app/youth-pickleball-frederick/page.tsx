import type { Metadata } from "next";
import Link from "next/link";
import JsonLd from "@/components/JsonLd";
import { site } from "@/data/site";
import { FREDERICK_PAGE, frederickPageFaq } from "@/data/frederick";
import {
  PICKLPARK_LEAGUES,
  picklParkLeagueSignupOpen,
} from "@/data/picklpark-leagues-2026";
import {
  PICKLPARK_SATURDAYS,
  PICKLPARK_SEASON_LABEL,
  PICKLPARK_VENUE_SHORT,
} from "@/data/picklpark-2026";
import {
  picklParkLeaguesOpen,
  picklParkTodayET,
} from "@/lib/picklpark-registration-window";
import {
  EXTENDED_SERVICE_AREAS,
  SITE_URL,
  breadcrumbJsonLd,
  cityPageForCity,
  extendedAreaLocalBusinessJsonLd,
} from "@/lib/seo";

// NGA's first out-of-county landing page (AEO audit, 2026-09-13). Hand-rolled
// rather than CityLanding: that template is typed to MoCo cities, renders MoCo
// testimonials and the 6–16 ladder, and promises a free evaluation — none of
// which is true in Frederick. For the same reason the contact block is direct
// email/text rather than LeadForm, whose success message schedules a free
// evaluation. Every claim here comes from src/data/frederick.ts
// and the Pickl Park data files; see that file's honesty rules.

const AREA = EXTENDED_SERVICE_AREAS.find((a) => a.slug === "youth-pickleball-frederick")!;
const URL = `${SITE_URL}/${AREA.slug}`;

export const metadata: Metadata = {
  title: { absolute: FREDERICK_PAGE.title },
  description: FREDERICK_PAGE.description,
  alternates: { canonical: `/${AREA.slug}` },
  openGraph: {
    title: FREDERICK_PAGE.title,
    description: FREDERICK_PAGE.description,
    url: URL,
    images: ["/opengraph-image"],
  },
  twitter: {
    card: "summary_large_image",
    title: FREDERICK_PAGE.title,
    description: FREDERICK_PAGE.description,
  },
};

export const revalidate = 300;

export default function FrederickPage() {
  const todayIso = picklParkTodayET();
  const leaguesOpen = picklParkLeaguesOpen(todayIso);
  const pageFaq = frederickPageFaq();
  const crossLinks = AREA.crossLinkCities
    .map(cityPageForCity)
    .filter((p): p is NonNullable<typeof p> => Boolean(p));

  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", url: `${SITE_URL}/` },
          { name: "Youth Pickleball in Frederick County", url: URL },
        ])}
      />
      <JsonLd
        data={extendedAreaLocalBusinessJsonLd({
          area: AREA,
          url: URL,
          description: FREDERICK_PAGE.description,
        })}
      />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: pageFaq.map((item) => ({
            "@type": "Question",
            name: item.question,
            acceptedAnswer: { "@type": "Answer", text: item.answer },
          })),
        }}
      />

      {/* ─── Hero ─────────────────────────────── */}
      <section className="relative isolate overflow-hidden bg-ngpa-deep">
        <div className="absolute inset-x-0 top-0 h-96 bg-teal-glow pointer-events-none" />
        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-10 pt-16 sm:pt-24 pb-16 sm:pb-20">
          <p className="text-xs sm:text-sm font-bold tracking-[0.2em] uppercase text-ngpa-teal mb-4">
            {FREDERICK_PAGE.eyebrow}
          </p>
          <h1 className="font-heading text-4xl sm:text-5xl lg:text-6xl font-black text-ngpa-white leading-[1.05] tracking-tight">
            {FREDERICK_PAGE.h1}
          </h1>
          <p className="mt-6 text-lg text-ngpa-white/80 leading-relaxed max-w-2xl">
            {FREDERICK_PAGE.intro}
          </p>
          <div className="mt-9 flex flex-col sm:flex-row gap-3">
            <a
              href="#leagues"
              className="inline-flex items-center justify-center gap-2 px-7 py-3.5 bg-ngpa-teal text-ngpa-deep font-bold rounded-full hover:bg-ngpa-teal-bright transition-colors min-h-[48px] shadow-xl shadow-ngpa-teal/20"
            >
              See the Saturday leagues
            </a>
            <Link
              href="/picklpark"
              className="inline-flex items-center justify-center px-7 py-3.5 bg-white/10 ring-1 ring-white/30 text-ngpa-white font-bold rounded-full hover:bg-white/15 hover:ring-white/50 transition-all min-h-[48px]"
            >
              Full season details
            </Link>
          </div>
        </div>
      </section>

      {/* ─── What runs in Frederick ───────────── */}
      <section id="leagues" className="bg-ngpa-navy py-16 sm:py-20 px-4 sm:px-6 lg:px-10 scroll-mt-20">
        <div className="max-w-5xl mx-auto">
          <p className="text-xs font-bold tracking-[0.2em] uppercase text-ngpa-teal mb-3">
            What runs in Frederick
          </p>
          <h2 className="font-heading text-3xl sm:text-4xl font-black text-ngpa-white mb-4 tracking-tight">
            Two Saturday youth leagues at {PICKLPARK_VENUE_SHORT}.
          </h2>
          <p className="text-lg text-ngpa-white/75 leading-relaxed mb-10 max-w-2xl">
            {FREDERICK_PAGE.whereWePlay}
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {PICKLPARK_LEAGUES.map((league) => {
              const signupOpen = leaguesOpen && picklParkLeagueSignupOpen(league, todayIso);
              return (
                <article
                  key={league.slug}
                  className="bg-ngpa-panel/80 rounded-2xl border border-ngpa-slate/60 p-6 sm:p-7 flex flex-col"
                >
                  <h3 className="font-heading text-xl font-black text-ngpa-white tracking-tight">
                    {league.title}
                  </h3>
                  <p className="mt-1 text-sm font-bold text-ngpa-teal">
                    {league.ageLabel} &middot; Saturdays {league.timeLabel}
                  </p>
                  <p className="mt-1 text-sm text-ngpa-white/60">
                    <time dateTime={PICKLPARK_SATURDAYS[0]}>{PICKLPARK_SEASON_LABEL}</time>
                  </p>
                  <p className="mt-4 text-ngpa-white/75 leading-relaxed flex-1">
                    {league.blurb}
                  </p>
                  {leaguesOpen ? (
                    <a
                      href={league.signupUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-6 inline-flex items-center justify-center px-6 py-3 bg-ngpa-teal text-ngpa-deep font-bold rounded-full hover:bg-ngpa-teal-bright transition-colors min-h-[48px]"
                    >
                      {signupOpen ? "Register with The Pickl Park" : "See the listing at The Pickl Park"}
                    </a>
                  ) : (
                    <Link
                      href="/newsletter"
                      className="mt-6 inline-flex items-center justify-center px-6 py-3 border-2 border-ngpa-slate text-ngpa-white font-bold rounded-full hover:border-ngpa-teal hover:text-ngpa-teal transition-colors min-h-[48px]"
                    >
                      This season has finished — get the next one by email
                    </Link>
                  )}
                </article>
              );
            })}
          </div>

          <p className="mt-6 text-sm text-ngpa-white/60">
            Registered and priced by The Pickl Park. Curious how kids move up?{" "}
            <Link href="/levels" className="text-ngpa-teal-bright underline hover:text-ngpa-teal">
              See the Red, Orange, Green, Yellow ladder
            </Link>
            .
          </p>
        </div>
      </section>

      {/* ─── Nearby ───────────────────────────── */}
      <section className="bg-ngpa-deep py-12 sm:py-14 px-4 sm:px-6 lg:px-10">
        <div className="max-w-3xl mx-auto">
          <h2 className="font-heading text-xs font-bold text-ngpa-white uppercase tracking-[0.2em] mb-4">
            Nearby
          </h2>
          <p className="text-ngpa-white/75 leading-relaxed mb-4">
            {FREDERICK_PAGE.nearbyIntro} Frederick County towns close to The
            Pickl Park include {AREA.nearbyTowns.join(", ")}.
          </p>
          <ul className="flex flex-wrap gap-x-5 gap-y-2.5 text-sm text-ngpa-white/70">
            {crossLinks.map((page) => (
              <li key={page.slug}>
                <Link href={`/${page.slug}`} className="hover:text-ngpa-teal transition-colors underline-offset-4 hover:underline">
                  Youth pickleball in {page.city}
                </Link>
              </li>
            ))}
            <li>
              <Link href="/montgomery-county-youth-pickleball" className="hover:text-ngpa-teal transition-colors underline-offset-4 hover:underline">
                All of Montgomery County
              </Link>
            </li>
            <li>
              <Link href="/league" className="hover:text-ngpa-teal transition-colors underline-offset-4 hover:underline">
                Every youth league and season
              </Link>
            </li>
          </ul>
        </div>
      </section>

      {/* ─── FAQ ──────────────────────────────── */}
      <section className="bg-ngpa-navy py-16 sm:py-20 px-4 sm:px-6 lg:px-10">
        <div className="max-w-3xl mx-auto">
          <p className="text-xs font-bold tracking-[0.2em] uppercase text-ngpa-teal mb-3">
            Parent FAQ
          </p>
          <h2 className="font-heading text-3xl sm:text-4xl font-black text-ngpa-white mb-10 tracking-tight">
            Frederick parent FAQ.
          </h2>
          <div className="space-y-7">
            {pageFaq.map((item) => (
              <div key={item.question} className="bg-ngpa-panel/60 rounded-2xl border border-ngpa-slate/60 p-6">
                <h3 className="font-heading text-base font-bold text-ngpa-teal mb-2">{item.question}</h3>
                <p className="text-base text-ngpa-white/75 leading-relaxed">{item.answer}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Private lessons + contact ────────── */}
      <section
        id="contact-form"
        className="relative bg-ngpa-deep py-16 sm:py-20 px-4 sm:px-6 lg:px-10 scroll-mt-20 overflow-hidden"
      >
        <div className="relative max-w-xl mx-auto">
          <div className="text-center mb-10">
            <p className="text-xs font-bold tracking-[0.2em] uppercase text-ngpa-teal mb-3">
              Private lessons in Frederick
            </p>
            <h2 className="font-heading text-3xl sm:text-4xl font-black text-ngpa-white tracking-tight">
              Talk to Coach Sam.
            </h2>
            <p className="text-ngpa-white/70 mt-3 text-lg">{FREDERICK_PAGE.privateLessonsNote}</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <a
              href={`sms:${site.phone.replace(/\D/g, "")}`}
              className="inline-flex items-center justify-center px-7 py-3.5 bg-ngpa-teal text-ngpa-deep font-bold rounded-full hover:bg-ngpa-teal-bright transition-colors min-h-[48px]"
            >
              Text Coach Sam
            </a>
            <a
              href={`mailto:${site.email}?subject=${encodeURIComponent("Frederick private lessons")}`}
              className="inline-flex items-center justify-center px-7 py-3.5 bg-white/10 ring-1 ring-white/30 text-ngpa-white font-bold rounded-full hover:bg-white/15 hover:ring-white/50 transition-all min-h-[48px]"
            >
              Email us
            </a>
          </div>
          <p className="mt-8 text-center text-base text-ngpa-white/65">
            Questions?{" "}
            <a
              href={`tel:${site.phone.replace(/\D/g, "")}`}
              className="text-ngpa-teal font-bold hover:text-ngpa-teal-bright underline-offset-4 hover:underline transition-colors"
            >
              Call or text Coach Sam at {site.phone}
            </a>
          </p>
        </div>
      </section>
    </>
  );
}
