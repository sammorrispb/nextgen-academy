import Image from "next/image";
import Link from "next/link";
import { site } from "@/data/site";
import { faq } from "@/data/faq";
import { levels } from "@/data/levels";
import { testimonials } from "@/data/testimonials";
import JsonLd from "@/components/JsonLd";
import LeadForm from "@/components/LeadForm";
import TrackedCTA from "@/components/TrackedCTA";
import {
  breadcrumbJsonLd,
  localBusinessJsonLd,
  SITE_URL,
  type ServiceCity,
} from "@/lib/seo";
import { getClusterForCity } from "@/lib/clusters";

interface CityLandingProps {
  /** Canonical city — must match an entry in SERVICE_AREAS. */
  city: ServiceCity;
  /** Route slug, e.g. "youth-pickleball-bethesda" — no leading slash. */
  slug: string;
  /** Localized blurb under the H1 — keep it generic-to-MoCo (no fabricated venue specifics). */
  intro: string;
  /** Shorter 1-paragraph "Where we play near {city}" — generic-to-MoCo. */
  whereWePlay: string;
}

const LOCAL_FAQ_QUESTIONS = new Set([
  "What ages do you accept?",
  "How much do youth pickleball lessons cost at Next Gen?",
  "Is pickleball safe for kids?",
  "Which Montgomery County towns do you serve?",
]);

// Reused across all 4 city pages. Same FAQ set as
// /montgomery-county-youth-pickleball — keeps answers in one place.
const localFaq = faq.filter((item) => LOCAL_FAQ_QUESTIONS.has(item.question));

/**
 * Shared frame for the per-city landing pages. Each page passes its own
 * city + slug + 1-2 paras of localized copy. We do NOT fabricate venue or
 * day-of-week specifics — claims stay generic-to-MoCo (per the brand-guide
 * "invent nothing, cite everything" + no-venue-specifics-in-lead-replies
 * rules). Lead with the free evaluation.
 */
// Static color mapping for the cluster callout — Tailwind purge requires
// class names to be statically discoverable. Lime stays dark-surface safe
// because the callout sits on bg-ngpa-deep.
const CLUSTER_ACCENT_CLASSES: Record<
  string,
  { ring: string; chip: string; link: string; linkHover: string }
> = {
  "down-county": {
    ring: "ring-[#00B4D8]/40",
    chip: "bg-[#00B4D8] text-ngpa-deep",
    link: "text-[#48CAE4]",
    linkHover: "hover:text-[#00D4FF]",
  },
  "up-county": {
    ring: "ring-[#AADC00]/40",
    chip: "bg-[#AADC00] text-ngpa-deep",
    link: "text-[#AADC00]",
    linkHover: "hover:text-[#BFE635]",
  },
  "east-county": {
    ring: "ring-[#FF6B2B]/40",
    chip: "bg-[#FF6B2B] text-ngpa-deep",
    link: "text-[#FF6B2B]",
    linkHover: "hover:text-[#FF8A52]",
  },
  "mid-county": {
    ring: "ring-[#00D4FF]/40",
    chip: "bg-[#00D4FF] text-ngpa-deep",
    link: "text-[#00D4FF]",
    linkHover: "hover:text-[#5BE3FF]",
  },
};

export default function CityLanding({
  city,
  slug,
  intro,
  whereWePlay,
}: CityLandingProps) {
  const url = `${SITE_URL}/${slug}`;
  const description = `Youth pickleball coaching for kids ages 6–16 in ${city}, MD — and across Montgomery County. Free evaluations, small-group sessions, and private lessons with Next Gen Pickleball Academy.`;
  const cluster = getClusterForCity(city);
  const clusterClasses = cluster ? CLUSTER_ACCENT_CLASSES[cluster.slug] : null;

  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", url: `${SITE_URL}/` },
          {
            name: "Youth Pickleball in Montgomery County",
            url: `${SITE_URL}/montgomery-county-youth-pickleball`,
          },
          { name: `Youth Pickleball in ${city}`, url },
        ])}
      />

      <JsonLd
        data={localBusinessJsonLd({
          city,
          url,
          description,
        })}
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
            {city}, MD &middot; Ages 6&ndash;16
          </p>
          <h1 className="font-heading text-4xl sm:text-5xl lg:text-6xl font-black text-ngpa-white leading-[1.05] tracking-tight">
            Youth pickleball in{" "}
            <span className="text-ngpa-teal">{city}, MD</span> &mdash; Next Gen
            Academy.
          </h1>
          <p className="mt-6 text-lg text-ngpa-white/80 leading-relaxed max-w-2xl">
            {intro}
          </p>

          <div className="mt-9 flex flex-col sm:flex-row gap-3">
            <TrackedCTA
              href="#contact-form"
              label={`city_${slug}_hero_book_eval`}
              section={`city_${slug}_hero`}
              asNextLink
              className="inline-flex items-center gap-2 px-7 py-3.5 bg-ngpa-teal text-ngpa-deep font-bold rounded-full hover:bg-ngpa-teal-bright transition-colors min-h-[48px] shadow-xl shadow-ngpa-teal/20"
            >
              Book Free 30-Minute Evaluation
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </TrackedCTA>
            <TrackedCTA
              href="/schedule"
              label={`city_${slug}_hero_view_schedule`}
              section={`city_${slug}_hero`}
              asNextLink
              className="inline-flex items-center justify-center px-7 py-3.5 bg-white/10 ring-1 ring-white/30 text-ngpa-white font-bold rounded-full hover:bg-white/15 hover:ring-white/50 transition-all min-h-[48px]"
            >
              See Class Schedule
            </TrackedCTA>
          </div>
        </div>
      </section>

      {/* ─── Where we play near {city} ────────── */}
      <section className="bg-ngpa-navy py-16 sm:py-20 px-4 sm:px-6 lg:px-10">
        <div className="max-w-5xl mx-auto">
          <p className="text-xs font-bold tracking-[0.2em] uppercase text-ngpa-teal mb-3">
            Where We Play
          </p>
          <h2 className="font-heading text-3xl sm:text-4xl font-black text-ngpa-white mb-4 tracking-tight">
            For families in {city} and across MoCo.
          </h2>
          <p className="text-lg text-ngpa-white/75 leading-relaxed mb-8 max-w-2xl">
            {whereWePlay}
          </p>
          <p className="text-sm text-ngpa-white/60 leading-relaxed max-w-2xl">
            Sessions rotate weekly based on court availability across Montgomery
            County Public Schools. Check the{" "}
            <Link
              href="/schedule"
              className="text-ngpa-teal hover:text-ngpa-teal-bright font-bold underline-offset-4 hover:underline transition-colors"
            >
              schedule
            </Link>{" "}
            for the current week, or book a free evaluation and we&rsquo;ll
            confirm the venue when we schedule.
          </p>
        </div>
      </section>

      {/* ─── Cluster Callout (when this city maps to a cluster) ─────── */}
      {cluster && clusterClasses && (
        <section
          data-testid="cluster-callout"
          className="bg-ngpa-deep py-12 sm:py-16 px-4 sm:px-6 lg:px-10"
        >
          <div className="max-w-5xl mx-auto">
            <div
              className={`relative rounded-3xl bg-ngpa-panel/80 backdrop-blur p-8 sm:p-10 ring-1 ${clusterClasses.ring}`}
            >
              <div className="flex flex-wrap items-center gap-3 mb-4">
                <span
                  aria-hidden="true"
                  className={`inline-block h-8 w-8 rounded-full ${clusterClasses.chip}`}
                />
                <span
                  className={`rounded-full ${clusterClasses.chip} px-3 py-1 text-xs font-bold uppercase tracking-wider`}
                >
                  {cluster.name}
                </span>
                <span className="rounded-full border border-ngpa-lime/40 px-3 py-1 text-xs font-semibold text-ngpa-lime">
                  Coming Fall 2026
                </span>
              </div>
              <h2 className="font-heading text-2xl sm:text-3xl font-black text-ngpa-white tracking-tight mb-3">
                {city} families train with the {cluster.name}.
              </h2>
              <p className="text-base sm:text-lg text-ngpa-white/85 leading-relaxed mb-5 max-w-2xl">
                {cluster.blurb}
              </p>
              <Link
                href={`/clusters/${cluster.slug}`}
                data-testid="cluster-callout-link"
                className={`inline-flex items-center gap-2 font-bold ${clusterClasses.link} ${clusterClasses.linkHover} underline-offset-4 hover:underline transition-colors`}
              >
                See what {cluster.name} families get →
              </Link>
            </div>
          </div>
        </section>
      )}

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
            We follow USA Pickleball&rsquo;s official youth progression &mdash;
            a proven system of color-coded balls with reduced bounce and
            compression. Every child is placed by skill during a free
            evaluation, not age alone. Group sessions start at Green Ball;
            private lessons cover Red and Orange.
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

      {/* ─── Testimonials ─────────────────────── */}
      <section className="bg-ngpa-navy py-16 sm:py-20 px-4 sm:px-6 lg:px-10">
        <div className="max-w-5xl mx-auto">
          <h2 className="font-heading text-3xl sm:text-4xl font-black text-ngpa-white mb-10 tracking-tight">
            What MoCo parents are saying.
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

      {/* ─── FAQ ──────────────────────────────── */}
      <section className="bg-ngpa-deep py-16 sm:py-20 px-4 sm:px-6 lg:px-10">
        <div className="max-w-3xl mx-auto">
          <p className="text-xs font-bold tracking-[0.2em] uppercase text-ngpa-teal mb-3">
            Parent FAQ
          </p>
          <h2 className="font-heading text-3xl sm:text-4xl font-black text-ngpa-white mb-10 tracking-tight">
            {city} parent FAQ.
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
