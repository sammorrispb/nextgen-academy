import type { Metadata } from "next";
import Link from "next/link";
import JsonLd from "@/components/JsonLd";
import {
  PICKLPARK_INDOOR_NOTE,
  PICKLPARK_MAKEUP_DATES,
  PICKLPARK_SEASON_LABEL,
  PICKLPARK_SEASON_WEEKS,
  PICKLPARK_SATURDAYS,
  PICKLPARK_VENUE,
  PICKLPARK_PUBLIC_AREA,
  PICKLPARK_VENUE_SHORT,
} from "@/data/picklpark-2026";
import {
  PICKLPARK_LEAGUES,
  picklParkLeaguePriceLine,
  PICKLPARK_LEAGUE_COACH_EMAIL,
  PICKLPARK_LEAGUE_PLACEMENT_NOTE,
  picklParkLeagueSignupOpen,
  picklParkLeagueStartHour24,
} from "@/data/picklpark-leagues-2026";
import {
  FALL_PUBLIC_AREA,
  FALL_SEASON_LABEL,
  FALL_SUNDAYS,
  FALL_VENUE_SHORT,
} from "@/data/fall-2026";
import {
  picklParkLeaguesOpen,
  picklParkTodayET,
} from "@/lib/picklpark-registration-window";
import { orgRef } from "@/lib/seo";

// The Pickl Park Saturday — a REFERRAL page since 2026-09-07, not a checkout.
// The Pickl Park sells both leagues through podplay; NGA coaches them. So this
// page's whole job is to explain the two leagues honestly and hand the parent
// off to the right podplay event.
//
// THIS PAGE IS THE ONE SURFACE THAT PRINTS A PICKL PARK PRICE (Sam,
// 2026-09-20). The rule used to be "no price anywhere", because a second copy
// of The Pickl Park's number can only go stale — that reasoning still holds,
// which is why the exception is scoped to this page alone and every other
// surface stays price-free. Do NOT "tidy up" the price line below on the
// strength of the old rule; the reasoning and the guard live in
// picklpark-leagues-2026.ts and picklpark-leagues.spec.ts.
//
// The description is COMPOSED, never typed — the rule this page already
// followed. A hardcoded one is how /fall spent days telling search engines the
// season was in Rockville after it had moved.
const LEAGUE_SUMMARY = PICKLPARK_LEAGUES.map(
  (l) => `${l.title} ${l.timeLabel} (${l.ageLabel})`,
).join(", ");
/** "Kid's Drill and Play (ages 8–13) and Youth League (ages 10+)" — for the meta description. */
const LEAGUE_AGES = PICKLPARK_LEAGUES.map(
  (l) => `${l.title} (${l.ageLabel.toLowerCase()})`,
).join(" and ");

// Title carries the place and "league" — the audit found this page had neither,
// so "youth pickleball league Frederick" had nothing to match (2026-09-13).
const TITLE = "Youth Pickleball Leagues in Frederick, MD — The Pickl Park";

export const metadata: Metadata = {
  title: { absolute: TITLE },
  // ≤160 chars (e2e/seo.spec.ts). Times and dates live on the page and in the
  // SportsEvent nodes; the description carries place, format, ages, registrar.
  description: `Indoor youth pickleball leagues in ${PICKLPARK_PUBLIC_AREA}, coached by Next Gen: ${LEAGUE_AGES}. Sign up at ${PICKLPARK_VENUE_SHORT}.`,
  alternates: { canonical: "https://nextgenpbacademy.com/picklpark" },
  openGraph: {
    title: TITLE,
    description: `${PICKLPARK_SEASON_WEEKS} indoor Saturdays in ${PICKLPARK_PUBLIC_AREA}, ${PICKLPARK_SEASON_LABEL}. ${LEAGUE_SUMMARY}.`,
    url: "https://nextgenpbacademy.com/picklpark",
    images: ["/opengraph-image"],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: `${PICKLPARK_SEASON_WEEKS} indoor Saturdays in ${PICKLPARK_PUBLIC_AREA}. ${LEAGUE_SUMMARY}.`,
  },
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

/** "September 9" — for the not-yet-open signup note. */
function shortDate(iso: string): string {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

export default async function PicklParkPage() {
  const todayIso = picklParkTodayET();
  const leaguesOpen = picklParkLeaguesOpen(todayIso);
  // The other fall option. The Sunday season is still on its ships-dark flag,
  // so the cross-link reads the same gate /fall does plus that season's own
  // last Sunday — it retires with the season instead of pointing at a closed
  // page.
  const fallOpen =
    process.env.NEXT_PUBLIC_FALL_REGISTRATION_OPEN === "true" &&
    todayIso <= FALL_SUNDAYS[FALL_SUNDAYS.length - 1];

  // One SportsEvent per league, each with its OWN podplay registration URL —
  // a single event carrying one offer would send every structured-data reader
  // to whichever league happened to be first.
  const eventJsonLd = PICKLPARK_LEAGUES.map((league) => ({
    "@context": "https://schema.org",
    "@type": "SportsEvent",
    name: `${league.podplayTitle} — ${PICKLPARK_SEASON_LABEL}`,
    description: league.blurb,
    // Hour PARSED from startTime, never pattern-matched against one literal:
    // a ternary on "2:00 PM" silently publishes the wrong hour the day a
    // league moves. -04:00 is correct for every Saturday of the season,
    // including the Oct 31 finale (US DST ends 2026-11-01).
    startDate: `${PICKLPARK_SATURDAYS[0]}T${picklParkLeagueStartHour24(league)}:00-04:00`,
    endDate: PICKLPARK_SATURDAYS[PICKLPARK_SATURDAYS.length - 1],
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    organizer: orgRef(),
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
    audience: {
      "@type": "PeopleAudience",
      audienceType: "Children",
      suggestedMinAge: league.minAge,
      suggestedMaxAge: league.maxAge,
    },
    // No `price` — The Pickl Park sets and shows it. `url` points at the
    // podplay listing because that is genuinely where a family registers.
    offers: {
      "@type": "Offer",
      availability: leaguesOpen
        ? "https://schema.org/InStock"
        : "https://schema.org/SoldOut",
      url: league.signupUrl,
    },
  }));

  return (
    <div className="bg-ngpa-navy">
      {eventJsonLd.map((data, i) => (
        <JsonLd key={PICKLPARK_LEAGUES[i].slug} data={data} />
      ))}

      <section className="relative bg-ngpa-deep border-b border-ngpa-slate/40">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-14 sm:py-20">
          <p className="font-heading text-xs font-bold text-ngpa-lime uppercase tracking-[0.2em] mb-4">
            Fall 2026 Saturdays &middot; {PICKLPARK_PUBLIC_AREA}
          </p>
          <h1 className="font-heading text-3xl sm:text-5xl font-black text-ngpa-white tracking-tight mb-5">
            Youth pickleball leagues in Frederick, MD &mdash; six Saturdays
            indoors, whatever the weather.
          </h1>
          <p className="text-lg text-ngpa-white/80 leading-relaxed mb-6">
            Next Gen coaches two six-week youth leagues at{" "}
            {PICKLPARK_VENUE_SHORT} in {PICKLPARK_PUBLIC_AREA} — our first
            Frederick location, on dedicated indoor pickleball courts —{" "}
            <time dateTime={PICKLPARK_SATURDAYS[0]}>
              {PICKLPARK_SEASON_LABEL}
            </time>
            . One is for players brand new to the sport, the other for players
            who already keep a rally going.
          </p>
          <p className="text-ngpa-white/80 leading-relaxed">
            <strong className="text-ngpa-white">
              Both leagues are run and registered by The Pickl Park.
            </strong>{" "}
            Coach Sam and the Next Gen staff run every session on court; you
            sign up and pay on The Pickl Park&rsquo;s site.
          </p>
          <p className="mt-3 text-ngpa-white/80 leading-relaxed">
            {PICKLPARK_INDOOR_NOTE}
          </p>
        </div>
      </section>

      <section className="bg-ngpa-navy" id="leagues">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
          <h2 className="font-heading text-2xl sm:text-3xl font-black text-ngpa-white tracking-tight mb-6">
            Two leagues, back to back
          </h2>

          <div className="grid grid-cols-1 gap-5 mb-4">
            {PICKLPARK_LEAGUES.map((league) => {
              const signupOpen = picklParkLeagueSignupOpen(league, todayIso);
              return (
                <article
                  key={league.slug}
                  className="bg-ngpa-panel rounded-2xl border border-ngpa-slate/60 p-6 sm:p-7"
                >
                  <p className="text-xs font-bold text-ngpa-lime uppercase tracking-[0.18em] mb-2">
                    Saturdays {league.timeLabel} &middot; {league.ageLabel}
                  </p>
                  <h3 className="font-heading text-xl sm:text-2xl font-black text-ngpa-white tracking-tight mb-1">
                    {league.title}
                  </h3>
                  <p className="text-sm text-ngpa-muted mb-3">
                    <Link
                      href="/levels"
                      className="hover:text-ngpa-teal transition-colors underline decoration-ngpa-slate underline-offset-4"
                    >
                      {league.levelLabel}
                    </Link>
                  </p>
                  <p className="text-ngpa-white/80 leading-relaxed mb-2">
                    {league.blurb}
                  </p>
                  <p className="text-sm text-ngpa-muted mb-1">
                    Each session: {league.sessionFormat}.
                  </p>
                  {/* The only surface on this site that prints a Pickl Park
                      price. It sits here, beside the format, because this is
                      the page a parent decides on — and because podplay shows
                      the non-member figure in its price box while quoting the
                      member one in its description, which is how a family got
                      to checkout expecting $225 and met $250. */}
                  <p className="text-sm text-ngpa-muted mb-5">
                    Season: {picklParkLeaguePriceLine(league)}.
                  </p>

                  {leaguesOpen ? (
                    signupOpen ? (
                      <a
                        href={league.signupUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center px-6 py-3 bg-ngpa-lime text-ngpa-deep font-heading font-bold rounded-full hover:bg-ngpa-lime/90 transition-colors min-h-[48px]"
                      >
                        Register at The Pickl Park →
                      </a>
                    ) : (
                      <>
                        <a
                          href={league.signupUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center justify-center px-6 py-3 border-2 border-ngpa-lime text-ngpa-lime font-heading font-bold rounded-full hover:bg-ngpa-lime/10 transition-colors min-h-[48px]"
                        >
                          See the listing →
                        </a>
                        <p className="mt-3 text-sm text-ngpa-white/70">
                          Signups open{" "}
                          <time dateTime={league.signupOpensOn}>
                            {shortDate(league.signupOpensOn as string)}
                          </time>
                          . Until then The Pickl Park&rsquo;s listing is open to
                          its members only, so you may see a membership prompt.
                        </p>
                      </>
                    )
                  ) : (
                    <p className="text-sm text-ngpa-white/60">
                      This season has finished.{" "}
                      <Link
                        href="/newsletter"
                        className="text-ngpa-teal-bright underline hover:text-ngpa-teal"
                      >
                        Join the newsletter
                      </Link>{" "}
                      to hear about the next one.
                    </p>
                  )}
                </article>
              );
            })}
          </div>

          <p className="text-sm text-ngpa-white/60 leading-relaxed mb-6">
            {PICKLPARK_LEAGUE_PLACEMENT_NOTE}{" "}
            <Link
              href="/levels"
              className="text-ngpa-teal-bright underline hover:text-ngpa-teal"
            >
              See what each ball color means
            </Link>
            .
          </p>

          <div className="bg-ngpa-slate/40 rounded-2xl border border-ngpa-slate/60 p-6 sm:p-7">
            <h3 className="font-heading text-lg font-black text-ngpa-white tracking-tight mb-4">
              How it works
            </h3>
            <ul className="space-y-3 text-ngpa-white/80 leading-relaxed">
              <li>
                <strong className="text-ngpa-white">
                  You register with The Pickl Park.
                </strong>{" "}
                Both leagues are sold on The Pickl Park&rsquo;s site, and
                they&rsquo;re the ones to ask about payment, spots and
                cancellations. Next Gen coaches the sessions.
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
              {/* Only when a date is actually held. An empty list used to
                  render "we make it up on ." — a promise with the promise
                  missing, which reads worse than saying nothing. */}
              {PICKLPARK_MAKEUP_DATES.length > 0 && (
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
              )}
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
                  Not sure your player is ready?
                </strong>{" "}
                Email Coach Sam at{" "}
                <a
                  href={`mailto:${PICKLPARK_LEAGUE_COACH_EMAIL}`}
                  className="text-ngpa-teal-bright underline hover:text-ngpa-teal"
                >
                  {PICKLPARK_LEAGUE_COACH_EMAIL}
                </a>{" "}
                and he&rsquo;ll tell you which league fits &mdash; or book a{" "}
                <Link
                  href="/free-evaluation"
                  className="text-ngpa-teal-bright underline hover:text-ngpa-teal"
                >
                  free evaluation
                </Link>{" "}
                first.
              </li>
            </ul>
            <p className="text-sm text-ngpa-white/55 mt-5">
              Venue: {PICKLPARK_VENUE}.
            </p>
          </div>

          <p className="mt-6 text-sm text-ngpa-white/65">
            Live in Frederick County?{" "}
            <Link
              href="/youth-pickleball-frederick"
              className="text-ngpa-teal-bright underline hover:text-ngpa-teal"
            >
              See everything Next Gen runs in Frederick
            </Link>
            .
          </p>

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
                  &middot; Green Ball and Yellow Ball, registered right here.
                </p>
              </div>
              <span className="shrink-0 inline-flex items-center justify-center px-5 py-3 rounded-full bg-ngpa-teal text-ngpa-deep font-heading font-bold group-hover:brightness-110 transition-all min-h-[48px]">
                See the Sunday season &rarr;
              </span>
            </Link>
          )}
        </div>
      </section>
    </div>
  );
}
