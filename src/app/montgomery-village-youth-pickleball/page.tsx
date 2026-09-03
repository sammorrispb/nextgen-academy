import Link from "next/link";
import type { Metadata } from "next";
import { seo } from "@/data/seo";
import {
  MVF_PROGRAMS,
  MVF_AGE_MIN,
  MVF_AGE_MAX,
  MVF_REGISTRATION_NOTE,
  MVF_REGISTRATION_SEARCH_URL,
  MVF_VENUE_FOOTNOTE,
  type MvfProgram,
  type MvfVenue,
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

function placeJsonLd(venue: MvfVenue) {
  return {
    "@type": "Place",
    name: venue.name,
    address: {
      "@type": "PostalAddress",
      streetAddress: venue.streetAddress,
      addressLocality: venue.locality,
      addressRegion: venue.region,
      postalCode: venue.postalCode,
      addressCountry: "US",
    },
  } as const;
}

function sportsEventJsonLd(program: MvfProgram) {
  return {
    "@context": "https://schema.org",
    "@type": "SportsEvent",
    name: `${program.activityName} — by Next Gen Pickleball Academy`,
    sport: "Pickleball",
    description: program.description,
    startDate: program.startDate,
    endDate: program.endDate,
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    eventStatus: "https://schema.org/EventScheduled",
    location: placeJsonLd(program.venue),
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
      name: `${program.activityName} — ${price.label}`,
      price: price.usd,
      priceCurrency: "USD",
      // Registration is open on MVF's portal — point the offer at the actual
      // activity, not back at this marketing page.
      url: program.registerUrl,
      availability: "https://schema.org/InStock",
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

/**
 * Red/Orange vs Green/Yellow only — the intro class is "All levels" and gets no
 * chip color, so a missing entry is a deliberate fall-through, not a gap.
 */
const LEVEL_CHIP: Record<string, string> = {
  "Red / Orange":
    "bg-ngpa-skill-red/15 text-ngpa-skill-orange ring-1 ring-ngpa-skill-orange/40",
  "Green / Yellow":
    "bg-ngpa-skill-green/15 text-ngpa-skill-yellow ring-1 ring-ngpa-skill-yellow/40",
};

function ProgramCard({ program }: { program: MvfProgram }) {
  const chip =
    LEVEL_CHIP[program.levelLabel] ??
    "bg-ngpa-teal/15 text-ngpa-teal-bright ring-1 ring-ngpa-teal/40";

  return (
    <div
      className="bg-ngpa-panel rounded-2xl border border-ngpa-slate p-6 sm:p-7"
      data-testid={`mvf-program-${program.key}`}
    >
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <span
          className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${chip}`}
        >
          {program.levelLabel}
        </span>
        <span className="font-mono text-xs text-ngpa-muted">
          MVF #{program.activityNumber}
        </span>
      </div>

      <h3 className="font-heading text-xl font-bold text-ngpa-white tracking-tight">
        {program.title}
      </h3>

      {/* MVF's own activity title, verbatim. We label by ball color everywhere
          else, but this is the string a parent has to find in MVF's portal —
          showing our name only would leave them hunting. */}
      <p className="text-sm text-ngpa-muted mt-1">
        On MVF&rsquo;s site: &ldquo;{program.activityName}&rdquo;
      </p>

      <p className="text-sm font-semibold text-ngpa-teal-bright mt-2">
        {program.classCount === 1 ? (
          <>
            <time dateTime={program.startDate}>{program.dateLabel}</time>
            {" "}&middot; {program.timeLabel} &middot; 1 class
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
            &middot; {program.timeLabel} &middot; {program.classCount} classes
          </>
        )}
      </p>

      <p className="text-sm text-ngpa-white/70 mt-1">
        {program.venue.name} &middot; {program.venue.streetAddress},{" "}
        {program.venue.locality}, {program.venue.region}{" "}
        {program.venue.postalCode}
      </p>

      <p className="font-mono font-bold text-2xl text-ngpa-white mt-4">
        {program.prices.map((price, i) => (
          <span key={price.label}>
            {i > 0 && (
              <span
                className="text-ngpa-muted text-base font-normal"
                aria-hidden="true"
              >
                {" "}&middot;{" "}
              </span>
            )}
            <span itemProp="price" content={String(price.usd)}>
              ${price.usd}
            </span>
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

      <p className="text-xs text-ngpa-muted mt-3">
        Small-group classes &middot; ages {MVF_AGE_MIN}&ndash;{MVF_AGE_MAX}
        &middot; live availability on MVF&rsquo;s site
      </p>

      <TrackedCTA
        href={program.registerUrl}
        label={`mvf_register_${program.key}`}
        section="mvf_programs"
        target="_blank"
        rel="noopener noreferrer"
        data-testid={`mvf-register-${program.key}`}
        className="mt-5 inline-flex items-center gap-2 px-6 py-3 bg-ngpa-teal text-ngpa-deep font-bold rounded-full hover:bg-ngpa-teal-bright transition-colors min-h-[48px]"
      >
        Register on MVF&rsquo;s site
        <svg
          className="w-4 h-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.5}
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9 5l7 7-7 7"
          />
        </svg>
      </TrackedCTA>
    </div>
  );
}

export default function MontgomeryVillagePage() {
  const intro = MVF_PROGRAMS.filter((p) => p.classCount === 1);
  const fallOne = MVF_PROGRAMS.filter((p) => p.key.startsWith("fall-1"));
  const fallTwo = MVF_PROGRAMS.filter((p) => p.key.startsWith("fall-2"));

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
            Next Gen is running youth classes in Montgomery Village this fall
            &mdash; an intro class in August, then two six-week Thursday
            sessions for kids and teens ages {MVF_AGE_MIN}&ndash;{MVF_AGE_MAX}.
            Every level is welcome: each session runs a Red/Orange class and a
            Green/Yellow class back to back, so your child gets real reps with
            like-skilled players.
          </p>
          <p
            className="mt-5 inline-flex items-center gap-2 rounded-full bg-ngpa-teal/15 px-4 py-2 text-sm font-bold text-ngpa-teal-bright ring-1 ring-ngpa-teal/40"
            data-testid="mvf-registration-open-badge"
          >
            <span
              className="h-2 w-2 rounded-full bg-ngpa-teal-bright"
              aria-hidden="true"
            />
            Registration is open now through MVF
          </p>
          <p className="mt-4 text-sm font-bold text-ngpa-teal-bright">
            In partnership with the Montgomery Village Foundation.
          </p>

          <div className="mt-9 flex flex-col sm:flex-row gap-3">
            <TrackedCTA
              href="#programs"
              label="mvf_hero_register"
              section="mvf_hero"
              className="inline-flex items-center gap-2 px-7 py-3.5 bg-ngpa-teal text-ngpa-deep font-bold rounded-full hover:bg-ngpa-teal-bright transition-colors min-h-[48px] shadow-xl shadow-ngpa-teal/20"
            >
              See classes &amp; register
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
      <section
        id="programs"
        className="bg-ngpa-navy py-16 sm:py-20 px-4 sm:px-6 lg:px-10 scroll-mt-20"
      >
        <div className="max-w-3xl mx-auto">
          <p className="text-xs font-bold tracking-[0.2em] uppercase text-ngpa-teal mb-3">
            Fall 2026 Programs
          </p>
          <h2 className="font-heading text-3xl sm:text-4xl font-black text-ngpa-white mb-4 tracking-tight">
            One intro class. Two six-week sessions.
          </h2>
          <p className="text-lg text-ngpa-white/75 leading-relaxed mb-10 max-w-2xl">
            Start with the one-evening intro class, roll into the fall sessions,
            or do both. Each session runs a Red/Orange class and a Green/Yellow
            class, registered separately &mdash; pick the one that fits your
            child, or ask us and we&rsquo;ll place them.
          </p>

          {/* Registration note */}
          <div
            className="rounded-2xl border border-ngpa-teal/40 bg-ngpa-teal/10 p-6"
            data-testid="mvf-registration-note"
          >
            <p className="text-base text-ngpa-white/90 leading-relaxed">
              <strong className="font-bold text-ngpa-white">
                How registration works:
              </strong>{" "}
              {MVF_REGISTRATION_NOTE}
            </p>
            <TrackedCTA
              href={MVF_REGISTRATION_SEARCH_URL}
              label="mvf_browse_all_activities"
              section="mvf_registration_note"
              target="_blank"
              rel="noopener noreferrer"
              data-testid="mvf-browse-all"
              className="mt-4 inline-flex items-center gap-2 text-ngpa-teal hover:text-ngpa-teal-bright font-bold underline-offset-4 hover:underline transition-colors min-h-[48px]"
            >
              Browse all MVF youth pickleball activities &rarr;
            </TrackedCTA>
          </div>

          <h3 className="font-heading text-2xl font-black text-ngpa-white mt-12 mb-5 tracking-tight">
            Start here &mdash; the intro class
          </h3>
          <div className="space-y-5">
            {intro.map((program) => (
              <ProgramCard key={program.key} program={program} />
            ))}
          </div>

          <h3 className="font-heading text-2xl font-black text-ngpa-white mt-12 mb-2 tracking-tight">
            Fall Session I &mdash; North Creek
          </h3>
          <p className="text-ngpa-white/70 mb-5">
            Six Thursdays, Sept 3 &ndash; Oct 8. Red/Orange plays first,
            Green/Yellow follows. MVF may move Thursday classes to Watkins Mill
            if the North Creek court renovation starts mid-session &mdash;
            they&rsquo;ll let registered families know.
          </p>
          <div className="space-y-5">
            {fallOne.map((program) => (
              <ProgramCard key={program.key} program={program} />
            ))}
          </div>

          <h3 className="font-heading text-2xl font-black text-ngpa-white mt-12 mb-2 tracking-tight">
            Fall Session II &mdash; North Creek
          </h3>
          <p className="text-ngpa-white/70 mb-5">
            Six Thursdays, Oct 15 &ndash; Nov 19, at a different venue &mdash;
            same format, same coaches.
          </p>
          <div className="space-y-5">
            {fallTwo.map((program) => (
              <ProgramCard key={program.key} program={program} />
            ))}
          </div>

          <p
            className="mt-8 text-sm text-ngpa-white/70"
            data-testid="mvf-venue-footnote"
          >
            {MVF_VENUE_FOOTNOTE}
          </p>
        </div>
      </section>

      {/* ─── Brackets ─────────────────────────── */}
      <section className="bg-ngpa-deep py-16 sm:py-20 px-4 sm:px-6 lg:px-10">
        <div className="max-w-3xl mx-auto">
          <p className="text-xs font-bold tracking-[0.2em] uppercase text-ngpa-teal mb-3">
            Skill Brackets
          </p>
          <h2 className="font-heading text-3xl sm:text-4xl font-black text-ngpa-white mb-4 tracking-tight">
            Not sure which class to pick?
          </h2>
          <p className="text-lg text-ngpa-white/75 leading-relaxed">
            We coach the same Red &rarr; Orange &rarr; Green &rarr; Yellow
            pathway we use across the academy. Red and Orange players are still
            learning to rally and get into games; Green and Yellow players play
            games and focus on strategy. If you&rsquo;re between the two, start
            at the intro class &mdash; we assess every kid there and tell you
            which fall class to register for. No tryout, no pressure, just
            placement.{" "}
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
              Stay in the Loop
            </p>
            <h2 className="font-heading text-3xl sm:text-4xl font-black text-ngpa-white tracking-tight">
              More than Montgomery Village.
            </h2>
            {/* Deliberately promises only what we actually send: MVF seat counts
                live in MVF's portal, not ours, so we cannot alert on a filling
                class and must not imply we will. */}
            <p className="text-ngpa-white/70 mt-3 text-lg">
              The free weekly newsletter carries open sessions across Montgomery
              County, a coach tip, and what&rsquo;s coming next &mdash; including
              future MVF sessions. For seats in the classes above, MVF&rsquo;s
              site is the live count.
            </p>
          </div>
          <div className="rounded-3xl border-2 border-ngpa-teal/30 bg-ngpa-deep/60 backdrop-blur-md p-1 shadow-2xl shadow-ngpa-teal/10">
            <NewsletterForm submitLabel="Keep Me Posted →" />
          </div>
        </div>
      </section>

      {/* ─── Tournament cross-promo ───────────── */}
      <section className="bg-ngpa-deep py-16 sm:py-20 px-4 sm:px-6 lg:px-10">
        <div className="max-w-3xl mx-auto">
          <p className="text-xs font-bold tracking-[0.2em] uppercase text-ngpa-teal mb-3">
            More in Montgomery Village
          </p>
          <h2 className="font-heading text-3xl sm:text-4xl font-black text-ngpa-white mb-6 tracking-tight">
            Want game day too?
          </h2>
          <MvfTournamentCard />
        </div>
      </section>
    </>
  );
}
