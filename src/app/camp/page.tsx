import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  CAMPS,
  CAMP_OPTIONS,
  CAMP_AGE_MIN,
  CAMP_AGE_MAX,
} from "@/data/camps";

const SITE_ORIGIN =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://nextgenpbacademy.com";

// Re-render on a timer so the past-week filter below stays current without a
// manual redeploy (a fully-static page would freeze "today" at build time).
export const revalidate = 43200; // 12h

export const metadata: Metadata = {
  title: `Summer Pickleball Camp | Ages ${CAMP_AGE_MIN}–${CAMP_AGE_MAX} | Next Gen Pickleball Academy`,
  description:
    "Next Gen Pickleball Academy summer morning camp in Gaithersburg, MD, for ages 8 and up — small groups, real coaching. $50 a morning, or $150 for the full week.",
  alternates: { canonical: `${SITE_ORIGIN}/camp` },
};

// Today (America/New_York) as YYYY-MM-DD — ISO strings sort lexicographically,
// so a camp is "past" once its makeup/rain Friday is behind us.
function todayET(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
}

function formatLongDate(date: string): string {
  if (!date) return "";
  const d = new Date(`${date}T12:00:00Z`);
  return d.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

// Day before camp starts, as an ISO date-only string. Noon-UTC anchored and
// stepped by whole days so it never off-by-ones on Vercel's UTC build servers.
// Static (derived from the camp's own start date), so it's correct whenever the
// page renders — no live countdown to go stale under static generation.
function registerByDate(startDate: string): string {
  const ms = new Date(`${startDate}T12:00:00Z`).getTime() - 86_400_000;
  return new Date(ms).toISOString().slice(0, 10);
}

function weekdayLong(date: string): string {
  const d = new Date(`${date}T12:00:00Z`);
  return d.toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" });
}

function formatShortDate(date: string): string {
  const d = new Date(`${date}T12:00:00Z`);
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export default function CampIndexPage() {
  // Hide weeks that are already over (past their makeup/rain Friday) from the
  // public page. The camp data itself stays in `camps.ts` so coach rosters and
  // reminder history for a finished week remain intact.
  const today = todayET();
  const upcomingCamps = CAMPS.filter((camp) => camp.makeupDate >= today);

  const weeksLeft = upcomingCamps.length;
  const countWord =
    weeksLeft === 1 ? "One" : weeksLeft === 2 ? "Two" : String(weeksLeft);
  const weekWord = weeksLeft === 1 ? "week" : "weeks";

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": upcomingCamps.map((camp) => ({
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
              High-energy pickleball for ages {CAMP_AGE_MIN}–{CAMP_AGE_MAX} in
              Gaithersburg. Small groups, real coaching, and a ton of fun —
              campers leave more confident than they arrived.
              {weeksLeft > 0 && (
                <>
                  {" "}
                  {countWord} {weekWord} left this summer — register before{" "}
                  {weeksLeft === 1 ? "it begins" : "each week begins"}.
                </>
              )}
            </p>
          </div>

          {/* Camp action photo */}
          <div className="mt-8 overflow-hidden rounded-2xl border border-ngpa-slate">
            <div className="relative aspect-[16/10]">
              <Image
                src="/images/camp-action.jpeg"
                alt="Players rallying on the courts at a Next Gen Pickleball Academy summer camp in Gaithersburg."
                fill
                className="object-cover object-center"
                sizes="(max-width: 768px) 100vw, 768px"
              />
            </div>
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
            <ul className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
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
                    <span className="text-ngpa-muted text-xs">
                      {o.key === "day" ? "/morning" : " · full week"}
                    </span>
                  </p>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-xs text-ngpa-muted">
              Small groups · grouped by age &amp; skill · rain or shine.
            </p>
          </div>

          {/* Weeks */}
          <h2 className="font-heading text-2xl font-bold text-ngpa-white mt-12 mb-4">
            {weeksLeft > 0 ? "Pick your week" : "Summer camp"}
          </h2>
          {weeksLeft === 0 && (
            <div className="bg-ngpa-panel rounded-2xl border border-ngpa-slate p-6 text-center">
              <p className="text-ngpa-muted leading-relaxed">
                This summer&rsquo;s camp weeks have wrapped up. Want first dibs on
                next season&rsquo;s dates?{" "}
                <Link
                  href="/newsletter"
                  className="text-ngpa-teal-bright font-semibold hover:underline"
                >
                  Join the newsletter
                </Link>{" "}
                or{" "}
                <Link
                  href="/free-evaluation"
                  className="text-ngpa-teal-bright font-semibold hover:underline"
                >
                  book a free evaluation
                </Link>{" "}
                to get your child on the court now.
              </p>
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {upcomingCamps.map((camp) => (
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
                <p className="text-xs font-semibold text-ngpa-teal-bright mt-2">
                  Starts {weekdayLong(camp.startDate)} · register by{" "}
                  <time dateTime={registerByDate(camp.startDate)}>
                    {formatShortDate(registerByDate(camp.startDate))}
                  </time>
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
