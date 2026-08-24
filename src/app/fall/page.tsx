import type { Metadata } from "next";
import FallRegistrationForm from "@/components/FallRegistrationForm";
import JsonLd from "@/components/JsonLd";
import {
  FALL_RAIN_DATES,
  FALL_SEASON_LABEL,
  FALL_SEASON_WEEKS,
  FALL_SUNDAYS,
  FALL_VENUE,
  FALL_PUBLIC_AREA,
  FALL_VENUE_SHORT,
} from "@/data/fall-2026";
import {
  FALL_SEASON_GROUPS,
  FALL_SEASON_PRICE_USD,
  FALL_SEASON_SPOTS_PER_GROUP,
  FALL_SEASON_TITLE,
  type FallSeasonGroup,
} from "@/data/fall-season-2026";
import { countFallRegistrations } from "@/lib/notion-fall-registrations";
import { familySiteUrl } from "@/lib/urls";

// Converted from the demand-sizing survey to the season REGISTRATION page once
// Sam confirmed the terms (2026-08-14) and a real Stripe price backs checkout —
// so the noindex posture and the no-price rule both lift here. The survey
// (FallInterestForm) retired with the conversion.
export const metadata: Metadata = {
  title: "Fall 2026 Season — Register | Next Gen Pickleball Academy",
  description:
    "Six Sundays of youth pickleball at Earle B. Wood Middle School in Rockville, Sept 20 – Oct 25. Green Ball 1:00–2:30 PM, Yellow Ball 2:30–4:00 PM. 8 spots per group, $225 per player for the full season.",
  alternates: { canonical: "https://nextgenpbacademy.com/fall" },
};

export const revalidate = 300;

const MONTH_DAY: Intl.DateTimeFormatOptions = {
  weekday: "long",
  month: "long",
  day: "numeric",
  timeZone: "UTC",
};

function sundayLabel(iso: string): string {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", MONTH_DAY);
}

export default async function FallPage() {
  const registrationOpen =
    process.env.NEXT_PUBLIC_FALL_REGISTRATION_OPEN === "true";

  const spotsTaken: Partial<Record<FallSeasonGroup, number | null>> = {};
  if (registrationOpen) {
    for (const option of FALL_SEASON_GROUPS) {
      spotsTaken[option.group] = await countFallRegistrations(option.group);
    }
  }

  const eventJsonLd = {
    "@context": "https://schema.org",
    "@type": "SportsEvent",
    name: `${FALL_SEASON_TITLE} — ${FALL_SEASON_LABEL}`,
    startDate: FALL_SUNDAYS[0],
    endDate: FALL_SUNDAYS[FALL_SUNDAYS.length - 1],
    location: {
      "@type": "Place",
      name: FALL_VENUE_SHORT,
      address: FALL_VENUE,
    },
    offers: {
      "@type": "Offer",
      price: String(FALL_SEASON_PRICE_USD),
      priceCurrency: "USD",
      availability: registrationOpen
        ? "https://schema.org/InStock"
        : "https://schema.org/PreOrder",
      url: "https://nextgenpbacademy.com/fall",
    },
  };

  return (
    <div className="bg-ngpa-navy">
      <JsonLd data={eventJsonLd} />
      <section className="relative bg-ngpa-deep border-b border-ngpa-slate/40">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-14 sm:py-20">
          <p className="font-heading text-xs font-bold text-ngpa-lime uppercase tracking-[0.2em] mb-4">
            Fall 2026 — registration {registrationOpen ? "open" : "opening soon"}
          </p>
          <h1 className="font-heading text-3xl sm:text-5xl font-black text-ngpa-white tracking-tight mb-5">
            Six Sundays. One crew. Real games every week.
          </h1>
          <p className="text-lg text-ngpa-white/80 leading-relaxed mb-6">
            The Next Gen Youth Fall Season runs {FALL_SEASON_WEEKS} Sundays at{" "}
            {FALL_VENUE_SHORT} in {FALL_PUBLIC_AREA},{" "}
            <time dateTime={FALL_SUNDAYS[0]}>{FALL_SEASON_LABEL}</time> —{" "}
            <strong className="text-ngpa-white">
              Green Ball 1:00&ndash;2:30 PM, Yellow Ball 2:30&ndash;4:00 PM
            </strong>
            . Coached practice first, then a rotating-partner round robin, so
            every kid partners with everyone in the group across the season.
          </p>
          <p className="text-ngpa-white/80 leading-relaxed">
            <strong className="text-ngpa-white">
              $<span itemProp="price" content={String(FALL_SEASON_PRICE_USD)}>{FALL_SEASON_PRICE_USD}</span>{" "}
              per player for the full season
            </strong>{" "}
            &middot; {FALL_SEASON_SPOTS_PER_GROUP} spots per group, first come
            first serve.
          </p>
          <p className="mt-3 text-sm text-ngpa-white/60 leading-relaxed">
            The season is a full-season commitment paid up front, and it&rsquo;s
            non-refundable once you register &mdash; your player&rsquo;s spot is
            held for all six Sundays. If a Sunday washes out we use the rain
            dates, and if we ever have to cancel sessions outright, we refund
            what we didn&rsquo;t run.
          </p>
        </div>
      </section>

      <section className="bg-ngpa-navy">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
          <h2 className="font-heading text-2xl sm:text-3xl font-black text-ngpa-white tracking-tight mb-6">
            The season at a glance
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-6">
            {FALL_SEASON_GROUPS.map((option) => (
              <article
                key={option.group}
                className="bg-ngpa-panel rounded-2xl border border-ngpa-slate/60 p-6 sm:p-7"
              >
                <p className="text-xs font-bold text-ngpa-lime uppercase tracking-[0.18em] mb-2">
                  Sundays {option.timeLabel}
                </p>
                <h3 className="font-heading text-xl sm:text-2xl font-black text-ngpa-white tracking-tight mb-3">
                  {option.label}
                </h3>
                <p className="text-ngpa-white/80 leading-relaxed">
                  Ninety minutes — coached practice, then the round robin.{" "}
                  {FALL_SEASON_SPOTS_PER_GROUP} spots.
                </p>
              </article>
            ))}
          </div>

          <div className="bg-ngpa-slate/40 rounded-2xl border border-ngpa-slate/60 p-6 sm:p-7">
            <h3 className="font-heading text-lg font-black text-ngpa-white tracking-tight mb-4">
              How it works
            </h3>
            <ul className="space-y-3 text-ngpa-white/80 leading-relaxed">
              <li>
                <strong className="text-ngpa-white">
                  It&rsquo;s a full season.
                </strong>{" "}
                One registration covers all {FALL_SEASON_WEEKS} Sundays, paid up
                front. That&rsquo;s what keeps a group together and keeps the
                round robin worth showing up for.
              </li>
              <li>
                <strong className="text-ngpa-white">Your Sundays:</strong>{" "}
                {FALL_SUNDAYS.map((d, i) => (
                  <span key={d}>
                    {i > 0 && " · "}
                    <time dateTime={d}>{sundayLabel(d)}</time>
                  </span>
                ))}
                .
              </li>
              <li>
                <strong className="text-ngpa-white">Rain dates built in.</strong>{" "}
                If a Sunday washes out we make it up on{" "}
                {FALL_RAIN_DATES.map((d, i) => (
                  <span key={d}>
                    {i > 0 && " or "}
                    <time dateTime={d}>{sundayLabel(d)}</time>
                  </span>
                ))}
                .
              </li>
              <li>
                <strong className="text-ngpa-white">
                  Can&rsquo;t commit to all {FALL_SEASON_WEEKS} weeks?
                </strong>{" "}
                There&rsquo;s a sub list — reply to any of our emails or text
                Coach Sam at 301-325-4731 and we&rsquo;ll call you when a spot
                opens week to week.
              </li>
              <li>
                <strong className="text-ngpa-white">
                  Parents — you play too.
                </strong>{" "}
                The adult round robin track runs through Link &amp; Dink —{" "}
                <a
                  href={familySiteUrl("linkanddink", "/play/popup", "fall_page")}
                  className="text-ngpa-teal-bright underline hover:text-ngpa-teal"
                >
                  see the adult schedule
                </a>
                .
              </li>
            </ul>
            <p className="text-sm text-ngpa-white/55 mt-5">
              Venue: {FALL_VENUE}.
            </p>
          </div>
        </div>
      </section>

      <section className="bg-ngpa-black" id="register">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
          <h2 className="font-heading text-2xl sm:text-3xl font-black text-ngpa-white tracking-tight mb-3">
            {registrationOpen ? "Grab your spot" : "Registration opens soon"}
          </h2>
          <p className="text-ngpa-white/70 leading-relaxed mb-8">
            {registrationOpen
              ? "Pick your player's color group, register, and pay for the season in one go — you'll get a confirmation email with every date."
              : "We're finishing the season setup. Join the newsletter and you'll be first to know the moment registration opens."}
          </p>
          {registrationOpen ? (
            <FallRegistrationForm spotsTaken={spotsTaken} />
          ) : (
            <a
              href="/newsletter"
              className="inline-flex items-center justify-center px-8 py-4 bg-ngpa-teal text-ngpa-deep font-heading font-bold text-lg rounded-full hover:bg-ngpa-teal-bright transition-colors min-h-[48px]"
            >
              Join the newsletter →
            </a>
          )}
        </div>
      </section>
    </div>
  );
}
