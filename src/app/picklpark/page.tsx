import type { Metadata } from "next";
import PicklParkRegistrationForm from "@/components/PicklParkRegistrationForm";
import JsonLd from "@/components/JsonLd";
import {
  PICKLPARK_MAKEUP_DATES,
  PICKLPARK_SEASON_LABEL,
  PICKLPARK_SEASON_WEEKS,
  PICKLPARK_SATURDAYS,
  PICKLPARK_VENUE,
  PICKLPARK_PUBLIC_AREA,
  PICKLPARK_VENUE_SHORT,
} from "@/data/picklpark-2026";
import {
  PICKLPARK_SEASON_GROUPS,
  PICKLPARK_SEASON_PRICE_USD,
  PICKLPARK_SEASON_SPOTS_PER_GROUP,
  PICKLPARK_SEASON_TITLE,
  type PicklParkSeasonGroup,
} from "@/data/picklpark-season-2026";
import { countPicklParkRegistrations } from "@/lib/notion-picklpark-registrations";

// The Pickl Park Saturday season registration page — the fall-season pattern
// at NGA's first partner venue (Frederick, MD). One venue addition, not a
// market expansion: the site's SEO posture stays Montgomery County. A real
// Stripe price backs /api/checkout-picklpark, so quoting $175 here is within
// the pricing rule once that product exists — and the page holds the closed
// state (no form) until NEXT_PUBLIC_PICKLPARK_REGISTRATION_OPEN is "true".
export const metadata: Metadata = {
  title: "Pickl Park Saturday Season — Register | Next Gen Pickleball Academy",
  description:
    "Six Saturdays of youth pickleball at The Pickl Park in Frederick, Oct 3 – Nov 7. Green Ball 1:00–2:00 PM, Yellow Ball 2:00–3:00 PM. 8 spots per group, $175 per player for the full season.",
  alternates: { canonical: "https://nextgenpbacademy.com/picklpark" },
};

export const revalidate = 300;

const MONTH_DAY: Intl.DateTimeFormatOptions = {
  weekday: "long",
  month: "long",
  day: "numeric",
  timeZone: "UTC",
};

function saturdayLabel(iso: string): string {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", MONTH_DAY);
}

export default async function PicklParkPage() {
  const registrationOpen =
    process.env.NEXT_PUBLIC_PICKLPARK_REGISTRATION_OPEN === "true";

  const spotsTaken: Partial<Record<PicklParkSeasonGroup, number | null>> = {};
  if (registrationOpen) {
    for (const option of PICKLPARK_SEASON_GROUPS) {
      spotsTaken[option.group] = await countPicklParkRegistrations(option.group);
    }
  }

  const eventJsonLd = {
    "@context": "https://schema.org",
    "@type": "SportsEvent",
    name: `${PICKLPARK_SEASON_TITLE} — ${PICKLPARK_SEASON_LABEL}`,
    startDate: PICKLPARK_SATURDAYS[0],
    endDate: PICKLPARK_SATURDAYS[PICKLPARK_SATURDAYS.length - 1],
    location: {
      "@type": "Place",
      name: PICKLPARK_VENUE_SHORT,
      address: {
        "@type": "PostalAddress",
        streetAddress: "355 Ballenger Center Dr",
        addressLocality: "Frederick",
        addressRegion: "MD",
        postalCode: "21703",
      },
    },
    offers: {
      "@type": "Offer",
      price: String(PICKLPARK_SEASON_PRICE_USD),
      priceCurrency: "USD",
      availability: registrationOpen
        ? "https://schema.org/InStock"
        : "https://schema.org/PreOrder",
      url: "https://nextgenpbacademy.com/picklpark",
    },
  };

  return (
    <div className="bg-ngpa-navy">
      <JsonLd data={eventJsonLd} />
      <section className="relative bg-ngpa-deep border-b border-ngpa-slate/40">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-14 sm:py-20">
          <p className="font-heading text-xs font-bold text-ngpa-lime uppercase tracking-[0.2em] mb-4">
            Fall 2026 Saturdays — registration{" "}
            {registrationOpen ? "open" : "opening soon"}
          </p>
          <h1 className="font-heading text-3xl sm:text-5xl font-black text-ngpa-white tracking-tight mb-5">
            Six Saturdays on real pickleball courts.
          </h1>
          <p className="text-lg text-ngpa-white/80 leading-relaxed mb-6">
            The Next Gen Pickl Park Saturday Season runs {PICKLPARK_SEASON_WEEKS}{" "}
            Saturdays at {PICKLPARK_VENUE_SHORT} in {PICKLPARK_PUBLIC_AREA} —
            our first Frederick location, on dedicated pickleball courts —{" "}
            <time dateTime={PICKLPARK_SATURDAYS[0]}>{PICKLPARK_SEASON_LABEL}</time>:{" "}
            <strong className="text-ngpa-white">
              Green Ball 1:00&ndash;2:00 PM, Yellow Ball 2:00&ndash;3:00 PM
            </strong>
            . Coached practice first, then a rotating-partner round robin, so
            every kid partners with everyone in the group across the season.
          </p>
          <p className="text-ngpa-white/80 leading-relaxed">
            <strong className="text-ngpa-white">
              $<span itemProp="price" content={String(PICKLPARK_SEASON_PRICE_USD)}>{PICKLPARK_SEASON_PRICE_USD}</span>{" "}
              per player for the full season
            </strong>{" "}
            &middot; {PICKLPARK_SEASON_SPOTS_PER_GROUP} spots per group, first
            come first serve.
          </p>
          <p className="mt-3 text-sm text-ngpa-white/60 leading-relaxed">
            The season is a full-season commitment paid up front, and it&rsquo;s
            non-refundable once you register &mdash; your player&rsquo;s spot is
            held for all six Saturdays. If a Saturday can&rsquo;t run we use the
            makeup date, and if we ever have to cancel sessions outright, we
            refund what we didn&rsquo;t run.
          </p>
        </div>
      </section>

      <section className="bg-ngpa-navy">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
          <h2 className="font-heading text-2xl sm:text-3xl font-black text-ngpa-white tracking-tight mb-6">
            The season at a glance
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-6">
            {PICKLPARK_SEASON_GROUPS.map((option) => (
              <article
                key={option.group}
                className="bg-ngpa-panel rounded-2xl border border-ngpa-slate/60 p-6 sm:p-7"
              >
                <p className="text-xs font-bold text-ngpa-lime uppercase tracking-[0.18em] mb-2">
                  Saturdays {option.timeLabel}
                </p>
                <h3 className="font-heading text-xl sm:text-2xl font-black text-ngpa-white tracking-tight mb-3">
                  {option.label}
                </h3>
                <p className="text-ngpa-white/80 leading-relaxed">
                  A full hour — coached practice, then the round robin.{" "}
                  {PICKLPARK_SEASON_SPOTS_PER_GROUP} spots.
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
                One registration covers all {PICKLPARK_SEASON_WEEKS} Saturdays,
                paid up front. That&rsquo;s what keeps a group together and
                keeps the round robin worth showing up for.
              </li>
              <li>
                <strong className="text-ngpa-white">Your Saturdays:</strong>{" "}
                {PICKLPARK_SATURDAYS.map((d, i) => (
                  <span key={d}>
                    {i > 0 && " · "}
                    <time dateTime={d}>{saturdayLabel(d)}</time>
                  </span>
                ))}
                .
              </li>
              <li>
                <strong className="text-ngpa-white">
                  A makeup date built in.
                </strong>{" "}
                If a Saturday can&rsquo;t run we make it up on{" "}
                {PICKLPARK_MAKEUP_DATES.map((d, i) => (
                  <span key={d}>
                    {i > 0 && " or "}
                    <time dateTime={d}>{saturdayLabel(d)}</time>
                  </span>
                ))}
                .
              </li>
              <li>
                <strong className="text-ngpa-white">
                  Real pickleball courts.
                </strong>{" "}
                The Pickl Park is a dedicated pickleball facility &mdash;
                permanent nets, real lines, no gym-floor tape.
              </li>
              <li>
                <strong className="text-ngpa-white">
                  Can&rsquo;t commit to all {PICKLPARK_SEASON_WEEKS} weeks?
                </strong>{" "}
                There&rsquo;s a sub list — reply to any of our emails or text
                Coach Sam at 301-325-4731 and we&rsquo;ll call you when a spot
                opens week to week.
              </li>
            </ul>
            <p className="text-sm text-ngpa-white/55 mt-5">
              Venue: {PICKLPARK_VENUE}.
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
            <PicklParkRegistrationForm spotsTaken={spotsTaken} />
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
