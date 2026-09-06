import type { Metadata } from "next";
import Link from "next/link";
import PicklParkRegistrationForm from "@/components/PicklParkRegistrationForm";
import JsonLd from "@/components/JsonLd";
import {
  PICKLPARK_INDOOR_NOTE,
  PICKLPARK_MAKEUP_DATES,
  PICKLPARK_OPEN_COURT_END_TIME,
  PICKLPARK_OPEN_COURT_START_TIME,
  PICKLPARK_SEASON_LABEL,
  PICKLPARK_SEASON_WEEKS,
  PICKLPARK_SATURDAYS,
  PICKLPARK_SESSION_FORMAT,
  PICKLPARK_VENUE,
  PICKLPARK_PUBLIC_AREA,
  PICKLPARK_VENUE_SHORT,
} from "@/data/picklpark-2026";
import {
  FALL_PUBLIC_AREA,
  FALL_SEASON_LABEL,
  FALL_SUNDAYS,
  FALL_VENUE_SHORT,
} from "@/data/fall-2026";
import {
  picklParkRegistrationOpen,
  picklParkTodayET,
} from "@/lib/picklpark-registration-window";
import {
  PICKLPARK_SEASON_GROUPS,
  PICKLPARK_SEASON_PRICE_USD,
  PICKLPARK_SEASON_TITLE,
  type PicklParkSeasonGroup,
} from "@/data/picklpark-season-2026";
import { countPicklParkRegistrations } from "@/lib/notion-picklpark-registrations";

// The Pickl Park Saturday season registration page — the fall-season pattern
// at NGA's first partner venue (Frederick, MD). One venue addition, not a
// market expansion: the site's SEO posture stays Montgomery County. A real
// Stripe price backs /api/checkout-picklpark, so quoting the price here is
// within the pricing rule. Registration is OPEN by default through the season's
// last Saturday (Sam, 2026-09-05) — NEXT_PUBLIC_PICKLPARK_REGISTRATION_OPEN is
// a kill switch, not a launch flag; see lib/picklpark-registration-window.ts.
//
// The description is COMPOSED, never typed. A hardcoded one is how /fall spent
// days telling search engines the season was in Rockville after it had moved,
// and the literal this replaced still advertised the old times, the old price,
// and a seat count no public surface is allowed to publish.
const GROUP_SUMMARY = PICKLPARK_SEASON_GROUPS.map(
  (g) => `${g.label} ${g.timeLabel}`,
).join(", ");

export const metadata: Metadata = {
  title: "Pickl Park Saturday Season — Register | Next Gen Pickleball Academy",
  description: `${PICKLPARK_SEASON_WEEKS} Saturdays of indoor youth pickleball at ${PICKLPARK_VENUE_SHORT} in ${PICKLPARK_PUBLIC_AREA}, ${PICKLPARK_SEASON_LABEL}. ${GROUP_SUMMARY}. Small groups, $${PICKLPARK_SEASON_PRICE_USD} per player for the full season.`,
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
  const todayIso = picklParkTodayET();
  const registrationOpen = picklParkRegistrationOpen(
    todayIso,
    process.env.NEXT_PUBLIC_PICKLPARK_REGISTRATION_OPEN,
  );
  // The other fall option. The Sunday season is still on its ships-dark flag,
  // so the cross-link reads the same gate /fall does plus that season's own
  // last Sunday — it retires with the season instead of pointing at a closed
  // page.
  const fallOpen =
    process.env.NEXT_PUBLIC_FALL_REGISTRATION_OPEN === "true" &&
    todayIso <= FALL_SUNDAYS[FALL_SUNDAYS.length - 1];

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
      // Closed now means closed (kill switch or season over), never "not yet".
      availability: registrationOpen
        ? "https://schema.org/InStock"
        : "https://schema.org/SoldOut",
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
            {registrationOpen ? "open" : "closed"}
          </p>
          <h1 className="font-heading text-3xl sm:text-5xl font-black text-ngpa-white tracking-tight mb-5">
            Six Saturdays indoors, whatever the weather.
          </h1>
          <p className="text-lg text-ngpa-white/80 leading-relaxed mb-6">
            The Next Gen Pickl Park Saturday Season runs {PICKLPARK_SEASON_WEEKS}{" "}
            Saturdays at {PICKLPARK_VENUE_SHORT} in {PICKLPARK_PUBLIC_AREA} —
            our first Frederick location, on dedicated indoor pickleball courts
            —{" "}
            <time dateTime={PICKLPARK_SATURDAYS[0]}>{PICKLPARK_SEASON_LABEL}</time>
            :{" "}
            <strong className="text-ngpa-white">
              {PICKLPARK_SEASON_GROUPS.map((g, i) => (
                <span key={g.group}>
                  {i > 0 && ", "}
                  {g.label} {g.timeLabel}
                </span>
              ))}
            </strong>
            . Each hour is {PICKLPARK_SESSION_FORMAT} &mdash; the games run as
            a rotating-partner round robin, so every kid partners with everyone
            in the group across the season.
          </p>
          <p className="text-ngpa-white/80 leading-relaxed">
            <strong className="text-ngpa-white">
              $<span itemProp="price" content={String(PICKLPARK_SEASON_PRICE_USD)}>{PICKLPARK_SEASON_PRICE_USD}</span>{" "}
              per player for the full season
            </strong>{" "}
            &middot; small groups, first come first serve.
          </p>
          <p className="mt-3 text-ngpa-white/80 leading-relaxed">
            {PICKLPARK_INDOOR_NOTE}
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-3">
            {PICKLPARK_SEASON_GROUPS.map((option) => (
              <article
                key={option.group}
                className="bg-ngpa-panel rounded-2xl border border-ngpa-slate/60 p-6 sm:p-7"
              >
                <p className="text-xs font-bold text-ngpa-lime uppercase tracking-[0.18em] mb-2">
                  Saturdays {option.timeLabel}
                </p>
                <h3 className="font-heading text-xl sm:text-2xl font-black text-ngpa-white tracking-tight mb-3">
                  <a
                    href="/levels"
                    className="hover:text-ngpa-teal transition-colors"
                  >
                    {option.label}
                  </a>
                </h3>
                <p className="text-ngpa-white/80 leading-relaxed">
                  A full hour &mdash; {PICKLPARK_SESSION_FORMAT}. Small group.
                </p>
              </article>
            ))}
          </div>
          <p className="text-sm text-ngpa-white/60 leading-relaxed mb-6">
            Not sure which group fits your player?{" "}
            <a
              href="/levels"
              className="text-ngpa-teal-bright underline hover:text-ngpa-teal"
            >
              See what each ball color means
            </a>
            , or come to Open Court first — details below.
          </p>

          <div className="bg-ngpa-panel rounded-2xl border border-ngpa-lime/40 p-6 sm:p-7 mb-6">
            <p className="text-xs font-bold text-ngpa-lime uppercase tracking-[0.18em] mb-2">
              Saturdays {PICKLPARK_OPEN_COURT_START_TIME}&ndash;
              {PICKLPARK_OPEN_COURT_END_TIME.replace(" PM", "")} PM &middot; drop
              in, no season required
            </p>
            <h3 className="font-heading text-xl sm:text-2xl font-black text-ngpa-white tracking-tight mb-3">
              New to this? Start with Open Court.
            </h3>
            <p className="text-ngpa-white/80 leading-relaxed mb-4">
              Every level welcome, ages 6&ndash;16, one hour, book it week by
              week. Coach Sam will tell you which group your player fits before
              you commit to a season &mdash; and it runs right before the season
              groups, so you can stay and watch what you&rsquo;d be signing up
              for.
            </p>
            <Link
              href="/schedule"
              className="inline-flex items-center justify-center px-6 py-3 bg-ngpa-lime text-ngpa-deep font-heading font-bold rounded-full hover:bg-ngpa-lime/90 transition-colors min-h-[48px]"
            >
              See Open Court dates →
            </Link>
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
                  A held date, just in case.
                </strong>{" "}
                Weather never takes a week indoors, but if a Saturday
                can&rsquo;t run we make it up on{" "}
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
                  Real pickleball courts, indoors.
                </strong>{" "}
                The Pickl Park is a dedicated indoor pickleball club &mdash;
                permanent nets, real lines, cushioned courts, no gym-floor tape
                and no weather.
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

          {fallOpen && (
            <Link
              href="/fall"
              className="group mt-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 rounded-2xl border border-ngpa-teal/40 bg-ngpa-teal/10 p-5 sm:p-6 hover:border-ngpa-teal transition-colors"
            >
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-ngpa-teal-bright">
                  Also this fall &middot; Sundays in {FALL_PUBLIC_AREA}
                </p>
                <p className="font-heading text-lg sm:text-xl font-bold text-ngpa-white mt-1">
                  Closer to Montgomery County? There&rsquo;s a Sunday season
                  too.
                </p>
                <p className="text-sm text-ngpa-muted mt-0.5">
                  Six Sundays at {FALL_VENUE_SHORT}, {FALL_SEASON_LABEL}{" "}
                  &middot; Green Ball and Yellow Ball, same price for the
                  season.
                </p>
              </div>
              <span className="shrink-0 inline-flex items-center justify-center px-5 py-3 rounded-full bg-ngpa-teal text-ngpa-deep font-heading font-bold group-hover:brightness-110 transition-all min-h-[48px]">
                See the Sunday season &rarr;
              </span>
            </Link>
          )}
        </div>
      </section>

      <section className="bg-ngpa-black" id="register">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
          <h2 className="font-heading text-2xl sm:text-3xl font-black text-ngpa-white tracking-tight mb-3">
            {registrationOpen ? "Grab your spot" : "Registration is closed"}
          </h2>
          <p className="text-ngpa-white/70 leading-relaxed mb-8">
            {registrationOpen
              ? "Pick your player's group, register, and pay for the season in one go — you'll get a confirmation email with every date."
              : "Registration for this season has closed. Join the newsletter and you'll be first to hear when the next one opens."}
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
