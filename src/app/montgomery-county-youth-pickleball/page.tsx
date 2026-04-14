import Link from "next/link";
import type { Metadata } from "next";
import { seo } from "@/data/seo";
import { site } from "@/data/site";
import { locations } from "@/data/locations";
import { levels } from "@/data/levels";
import { coaches } from "@/data/coaches";
import { faq } from "@/data/faq";
import { testimonials } from "@/data/testimonials";
import { yellowBallPricing } from "@/data/schedule";
import LocationMap from "@/components/LocationMap";
import JsonLd from "@/components/JsonLd";

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

// FAQ subset relevant to localized page (by question string for clarity)
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
      {/* ─── Breadcrumb schema ─────────────────── */}
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

      {/* ─── Localized FAQ schema ─────────────── */}
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
      <section className="bg-ngpa-black py-14 sm:py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <p className="text-xs font-bold tracking-wider uppercase text-ngpa-lime mb-3">
            Montgomery County, MD · Ages 5–16
          </p>
          <h1 className="font-heading text-3xl sm:text-5xl font-900 text-ngpa-white leading-tight">
            Youth Pickleball in{" "}
            <span className="text-ngpa-lime">Montgomery County</span>
          </h1>
          <p className="mt-5 text-base sm:text-lg text-ngpa-muted leading-relaxed max-w-2xl">
            Next Gen Pickleball Academy is a family-first youth pickleball
            academy for ages 5–16, based at Dill Dinkers in{" "}
            <strong className="text-ngpa-white">Rockville</strong> and{" "}
            <strong className="text-ngpa-white">North Bethesda</strong>. We
            serve families across Bethesda, Potomac, Chevy Chase, Kensington,
            Silver Spring, Gaithersburg, and the broader DMV — with a clear
            pathway from first rally to tournament play.
          </p>

          <div className="mt-7 flex flex-col sm:flex-row gap-3">
            <Link
              href="/free-evaluation"
              className="inline-flex items-center justify-center px-7 py-3 bg-ngpa-lime text-ngpa-black font-bold rounded-full hover:bg-ngpa-cyan transition-colors"
            >
              Book Free 30-Minute Evaluation
            </Link>
            <Link
              href="/schedule"
              className="inline-flex items-center justify-center px-7 py-3 bg-ngpa-slate text-ngpa-white font-bold rounded-full hover:bg-ngpa-panel transition-colors"
            >
              See Class Schedule
            </Link>
          </div>
        </div>
      </section>

      {/* ─── Where we serve ───────────────────── */}
      <section className="bg-ngpa-navy py-14 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <h2 className="font-heading text-2xl sm:text-3xl font-bold text-ngpa-white mb-3">
            Where Montgomery County families play with us
          </h2>
          <p className="text-ngpa-muted leading-relaxed mb-6">
            Our two locations sit within 15 minutes of most of Montgomery County.
            Both are inside <strong className="text-ngpa-white">Dill Dinkers</strong>,
            the DMV’s dedicated indoor pickleball facility — so sessions run
            year-round regardless of weather.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-8">
            {locations.map((loc) => (
              <LocationMap key={loc.name} location={loc} />
            ))}
          </div>

          <h3 className="font-heading text-lg font-bold text-ngpa-white mb-3">
            Families regularly drive in from:
          </h3>
          <ul className="flex flex-wrap gap-2">
            {SERVED_TOWNS.map((town) => (
              <li
                key={town}
                className="px-3 py-1.5 bg-ngpa-panel border border-ngpa-slate rounded-full text-sm text-ngpa-white"
              >
                {town}
              </li>
            ))}
          </ul>
          <p className="text-ngpa-muted text-sm mt-4">
            Rockville is minutes from Rockville Town Center and Twinbrook Metro.
            North Bethesda sits beside Pike &amp; Rose and Grosvenor-Strathmore Metro.
          </p>
        </div>
      </section>

      {/* ─── Pathway ──────────────────────────── */}
      <section className="bg-ngpa-black py-14 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <h2 className="font-heading text-2xl sm:text-3xl font-bold text-ngpa-white mb-3">
            The Red → Yellow Ball pathway
          </h2>
          <p className="text-ngpa-muted leading-relaxed mb-8 max-w-2xl">
            We follow USA Pickleball’s official youth progression — a proven
            system of color-coded balls with reduced bounce and compression.
            Every child is placed based on skill during a free evaluation, not
            age alone.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {levels.map((level) => (
              <div
                key={level.key}
                className="bg-ngpa-panel rounded-2xl p-5 border border-ngpa-slate"
              >
                <div className="flex items-center gap-3 mb-2">
                  <span
                    aria-hidden="true"
                    className="w-4 h-4 rounded-full"
                    style={{ backgroundColor: level.color }}
                  />
                  <h3 className="font-heading text-lg font-bold text-ngpa-white">
                    {level.label}{" "}
                    <span className="text-ngpa-muted font-medium text-sm">
                      · Ages {level.ages}
                    </span>
                  </h3>
                </div>
                <p className="text-sm text-ngpa-white mb-1">{level.focus}</p>
                <p className="text-xs text-ngpa-muted">{level.detail}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Coaches ──────────────────────────── */}
      <section className="bg-ngpa-navy py-14 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <h2 className="font-heading text-2xl sm:text-3xl font-bold text-ngpa-white mb-3">
            Built by Montgomery County parents, for Montgomery County parents
          </h2>
          <p className="text-ngpa-muted leading-relaxed mb-8 max-w-2xl">
            Next Gen was started by two dads who coach the program they wished
            existed for their own kids.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {coaches.map((coach) => (
              <div
                key={coach.name}
                className="bg-ngpa-panel rounded-2xl p-5 border border-ngpa-slate"
              >
                <h3 className="font-heading text-lg font-bold text-ngpa-white">
                  {coach.name}
                </h3>
                <p className="text-sm text-ngpa-lime font-medium mb-2">
                  {coach.role}
                </p>
                <p className="text-sm text-ngpa-muted leading-relaxed">
                  {coach.bio}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Testimonials ─────────────────────── */}
      <section className="bg-ngpa-black py-14 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <h2 className="font-heading text-2xl sm:text-3xl font-bold text-ngpa-white mb-8">
            What Montgomery County parents are saying
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {testimonials.slice(0, 2).map((t) => (
              <figure
                key={t.attribution}
                className="bg-ngpa-panel rounded-2xl border border-ngpa-slate p-6"
              >
                <div
                  className="text-ngpa-lime text-3xl leading-none mb-2"
                  aria-hidden="true"
                >
                  “
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

      {/* ─── Pricing snapshot ─────────────────── */}
      <section className="bg-ngpa-navy py-14 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto">
          <h2 className="font-heading text-2xl sm:text-3xl font-bold text-ngpa-white mb-3">
            Pricing
          </h2>
          <p className="text-ngpa-muted leading-relaxed mb-6">
            Group classes at the Red, Orange, and Green Ball levels are priced
            per season on CourtReserve —{" "}
            <Link href="/schedule" className="text-ngpa-lime hover:underline">
              view the current schedule
            </Link>
            . Our Yellow Ball small-group tournament track is priced by group
            size:
          </p>
          <div className="bg-ngpa-panel rounded-2xl border border-ngpa-slate overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-ngpa-black/50">
                <tr>
                  <th className="text-left px-5 py-3 font-heading font-bold text-ngpa-white">
                    Group size
                  </th>
                  <th className="text-left px-5 py-3 font-heading font-bold text-ngpa-white">
                    Yellow Ball price
                  </th>
                </tr>
              </thead>
              <tbody>
                {yellowBallPricing.map((row) => (
                  <tr
                    key={row.players}
                    className="border-t border-ngpa-slate/50"
                  >
                    <td className="px-5 py-3 text-ngpa-white">
                      {row.players} players
                    </td>
                    <td className="px-5 py-3 text-ngpa-muted">{row.price}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-sm text-ngpa-muted mt-4">
            The 30-minute evaluation that determines placement is always free.
          </p>
        </div>
      </section>

      {/* ─── FAQ ──────────────────────────────── */}
      <section className="bg-ngpa-black py-14 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto">
          <h2 className="font-heading text-2xl sm:text-3xl font-bold text-ngpa-white mb-8">
            Montgomery County parent FAQ
          </h2>
          <div className="space-y-5">
            {localFaq.map((item) => (
              <div key={item.question}>
                <h3 className="font-heading text-base font-bold text-ngpa-lime mb-2">
                  {item.question}
                </h3>
                <p className="text-sm text-ngpa-muted leading-relaxed">
                  {item.answer}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-10 text-center">
            <Link
              href="/free-evaluation"
              className="inline-flex items-center justify-center px-7 py-3 bg-ngpa-lime text-ngpa-black font-bold rounded-full hover:bg-ngpa-cyan transition-colors"
            >
              Book Free 30-Minute Evaluation
            </Link>
          </div>
          <p className="text-center text-sm text-ngpa-muted mt-4">
            Questions? Call or text Sam at{" "}
            <a
              href={`tel:${site.phone.replace(/\D/g, "")}`}
              className="text-ngpa-lime hover:underline"
            >
              {site.phone}
            </a>
            .
          </p>
        </div>
      </section>
    </>
  );
}
