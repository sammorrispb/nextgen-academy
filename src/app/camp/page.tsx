import type { Metadata } from "next";
import Link from "next/link";
import {
  CAMPS,
  CAMP_OPTIONS,
  CAMP_AGE_MIN,
  CAMP_AGE_MAX,
  SIBLING_DISCOUNT_PCT,
  MACARONI_KID_PROMO_CODE,
  MACARONI_KID_DISCOUNT_PCT,
} from "@/data/camps";

const SITE_ORIGIN =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://nextgenpbacademy.com";

export const metadata: Metadata = {
  title: `Summer Pickleball Camp | Ages ${CAMP_AGE_MIN}–${CAMP_AGE_MAX} | Next Gen Pickleball Academy`,
  description:
    "Next Gen Pickleball Academy summer day camp in Gaithersburg, MD. Two weeks this summer for ages 6–16 — full-day and half-day options, small groups, real coaching.",
  alternates: { canonical: `${SITE_ORIGIN}/camp` },
};

function formatLongDate(date: string): string {
  if (!date) return "";
  const d = new Date(`${date}T12:00:00Z`);
  return d.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export default function CampIndexPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": CAMPS.map((camp) => ({
      "@type": "SportsEvent",
      name: `${camp.title} — Next Gen Pickleball Academy`,
      sport: "Pickleball",
      startDate: camp.startDate,
      endDate: camp.endDate,
      eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
      location: {
        "@type": "Place",
        name: camp.publicArea,
        address: {
          "@type": "PostalAddress",
          addressLocality: "Gaithersburg",
          addressRegion: "MD",
        },
      },
      organizer: {
        "@type": "Organization",
        name: "Next Gen Pickleball Academy",
        url: SITE_ORIGIN,
      },
      offers: CAMP_OPTIONS.map((o) => ({
        "@type": "Offer",
        name: o.label,
        price: o.priceUsd,
        priceCurrency: "USD",
        url: `${SITE_ORIGIN}/camp/${camp.slug}`,
        availability: "https://schema.org/InStock",
      })),
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <section className="bg-ngpa-navy py-16 sm:py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto">
          <div className="text-center">
            <p className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-ngpa-teal/15 text-ngpa-teal-bright text-xs font-bold tracking-wider uppercase mb-4">
              Summer 2026 · Gaithersburg
            </p>
            <h1 className="font-heading text-3xl sm:text-5xl font-extrabold text-ngpa-white tracking-tight">
              Next Gen Summer Pickleball Camp
            </h1>
            <p className="mt-4 text-lg text-ngpa-muted max-w-2xl mx-auto leading-relaxed">
              Two weeks of high-energy pickleball for ages {CAMP_AGE_MIN}–
              {CAMP_AGE_MAX} in Gaithersburg. Small groups, real coaching, and a
              ton of fun — campers leave more confident than they arrived.
            </p>
          </div>

          {/* What a day looks like */}
          <div className="mt-10 bg-ngpa-panel rounded-2xl border border-ngpa-slate p-6">
            <h2 className="font-heading text-xl font-bold text-ngpa-white mb-3">
              What a day looks like
            </h2>
            <p className="text-sm text-ngpa-muted leading-relaxed">
              Athleticism games, pickleball drills, snack breaks, real game play,
              and an end-of-day tournament. Grouped by age and skill so every
              camper gets real reps and real feedback.
            </p>
            <ul className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
              {CAMP_OPTIONS.map((o) => (
                <li
                  key={o.key}
                  className="bg-ngpa-deep/60 rounded-xl border border-ngpa-slate/60 p-4"
                >
                  <p className="font-heading font-bold text-ngpa-white">
                    {o.label}
                  </p>
                  <p className="text-ngpa-muted text-xs mt-0.5">{o.hours}</p>
                  <p className="font-mono font-bold text-ngpa-white mt-2">
                    ${o.priceUsd}
                    <span className="text-ngpa-muted text-xs">/week</span>
                  </p>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-xs text-ngpa-muted">
              {SIBLING_DISCOUNT_PCT}% sibling discount · Macaroni Kid families use
              code{" "}
              <span className="font-mono font-bold text-ngpa-teal-bright">
                {MACARONI_KID_PROMO_CODE}
              </span>{" "}
              for {MACARONI_KID_DISCOUNT_PCT}% off · rain plan with a built-in
              Friday makeup day.
            </p>
          </div>

          {/* Weeks */}
          <h2 className="font-heading text-2xl font-bold text-ngpa-white mt-12 mb-4">
            Pick your week
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {CAMPS.map((camp) => (
              <Link
                key={camp.slug}
                href={`/camp/${camp.slug}`}
                className="group block bg-ngpa-panel rounded-2xl border border-ngpa-slate p-6 hover:border-ngpa-teal transition-colors"
              >
                <p className="text-xs font-bold uppercase tracking-wider text-ngpa-teal-bright">
                  {camp.title.replace("Summer Camp — ", "")}
                </p>
                <p className="font-heading text-xl font-bold text-ngpa-white mt-1">
                  {formatLongDate(camp.startDate)} –{" "}
                  {formatLongDate(camp.endDate)}
                </p>
                <p className="text-sm text-ngpa-muted mt-1">
                  Mon–Thu · Gaithersburg, MD
                </p>
                <span className="inline-flex items-center gap-1 mt-4 font-heading font-bold text-ngpa-teal group-hover:text-ngpa-teal-bright">
                  Register →
                </span>
              </Link>
            ))}
          </div>

          <p className="mt-8 text-center text-sm text-ngpa-muted">
            Not sure it&rsquo;s the right fit?{" "}
            <Link
              href="/free-evaluation"
              className="text-ngpa-teal-bright font-semibold hover:underline"
            >
              Start with a free evaluation
            </Link>{" "}
            and we&rsquo;ll place your child at the right level.
          </p>
          <p className="mt-6 text-center text-xs text-ngpa-muted/80">
            See you on the court — better than yesterday, together.
          </p>
        </div>
      </section>
    </>
  );
}
