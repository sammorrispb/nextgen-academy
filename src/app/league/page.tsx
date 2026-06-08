import type { Metadata } from "next";
import Link from "next/link";
import LeagueInterestForm from "@/components/LeagueInterestForm";
import JsonLd from "@/components/JsonLd";
import { site } from "@/data/site";
import { LEAGUE_BANDS } from "@/data/leagues";
import { breadcrumbJsonLd, SITE_URL } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Youth Pickleball League — Next Gen, Montgomery County, MD",
  description:
    "A structured, growth-only youth pickleball league for ages 6–16 in Montgomery County. Fixed-roster 8-session seasons, age divisions (7U/10U/14U/16U), real progress you can see — your kid vs. yesterday, never a leaderboard.",
  alternates: { canonical: "/league" },
  openGraph: {
    title: "Youth Pickleball League — Next Gen Pickleball Academy",
    description:
      "Fixed-roster, 8-session seasons by age division. Growth-only — every season tracks your kid's own progress, not a ranking.",
    url: `${SITE_URL}/league`,
  },
  twitter: {
    card: "summary_large_image",
    title: "Youth Pickleball League — Next Gen Pickleball Academy",
    description:
      "Fixed-roster, 8-session seasons by age division. Growth-only — your kid vs. yesterday.",
  },
};

// Static class maps — Tailwind needs literal class names, so the ball-color
// accent per band is resolved from a record rather than interpolated.
const BAND_ACCENT: Record<
  string,
  { ring: string; text: string; dot: string }
> = {
  Red: { ring: "ring-ngpa-skill-red/40", text: "text-ngpa-skill-red", dot: "bg-ngpa-skill-red" },
  Orange: {
    ring: "ring-ngpa-skill-orange/40",
    text: "text-ngpa-skill-orange",
    dot: "bg-ngpa-skill-orange",
  },
  Green: {
    ring: "ring-ngpa-skill-green/40",
    text: "text-ngpa-skill-green",
    dot: "bg-ngpa-skill-green",
  },
  Yellow: {
    ring: "ring-ngpa-skill-yellow/40",
    text: "text-ngpa-skill-yellow",
    dot: "bg-ngpa-skill-yellow",
  },
};

const HOW_IT_WORKS = [
  {
    title: "Same crew, every week",
    body: "A fixed roster of 8 sessions across 9–10 weeks (weather make-ups built in). The same kids show up each week, so chemistry — and skills — actually compound.",
  },
  {
    title: "Built on EASE",
    body: "Every session runs on a single objective and a rotating Word of the Day from our values — Ethics, Attitude, Skills, Excellence. Kids compete hard and stay kind.",
  },
  {
    title: "Maximize touches, minimize talk",
    body: "Partner drilling for reps, then constraint games that teach strategy, then rotating-partner gameplay where every kid partners every other kid. More hits, more growth.",
  },
  {
    title: "Your kid vs. yesterday",
    body: "Every season tracks your own child's progress — touches, personal bests, skills unlocked, level-ups. No child-vs-child leaderboard, ever. Just better than yesterday, together.",
  },
];

const LEAGUE_APP_URL = process.env.NEXT_PUBLIC_LEAGUE_APP_URL;

export default function LeaguePage() {
  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", url: SITE_URL },
          { name: "Youth League", url: `${SITE_URL}/league` },
        ])}
      />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Course",
          name: "Next Gen Youth Pickleball League",
          description:
            "A structured, growth-only youth pickleball league for ages 6–16 in Montgomery County, MD. Fixed-roster 8-session seasons banded by age (7U/10U/14U/16U), tracking each child's own progress rather than a ranking.",
          educationalLevel: "Youth (ages 6–16)",
          audience: {
            "@type": "PeopleAudience",
            audienceType: "Children",
            suggestedMinAge: 6,
            suggestedMaxAge: 16,
          },
          provider: {
            "@type": "SportsOrganization",
            name: "Next Gen Pickleball Academy",
            url: SITE_URL,
          },
          teaches:
            "Youth pickleball — technical skills, game strategy, and sportsmanship across a fixed-roster season",
        }}
      />

      {/* ── Hero + interest form ─────────────────────────────────────── */}
      <section className="relative isolate overflow-hidden bg-ngpa-deep">
        <div className="absolute inset-x-0 top-0 h-96 bg-teal-glow pointer-events-none" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 py-16 sm:py-24 lg:py-28">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
            <div className="lg:col-span-7">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-ngpa-teal/15 ring-1 ring-ngpa-teal/40 backdrop-blur-sm text-ngpa-teal text-xs font-bold tracking-[0.18em] uppercase mb-5">
                <span
                  aria-hidden="true"
                  className="w-1.5 h-1.5 rounded-full bg-ngpa-teal animate-pulse"
                />
                Youth League · Coming Seasons
              </div>

              <h1 className="font-heading text-4xl sm:text-5xl lg:text-6xl font-black text-ngpa-white leading-[1.02] tracking-tight">
                A season, not a one-off.{" "}
                <span className="text-ngpa-teal">Watch your kid grow.</span>
              </h1>

              <p className="mt-6 text-lg sm:text-xl text-ngpa-white/85 leading-relaxed max-w-xl">
                The Next Gen league turns drop-ins into a real season &mdash;
                fixed-roster, eight sessions, the same crew every week. Kids play
                in age divisions, level up Red &rarr; Orange &rarr; Green &rarr;
                Yellow, and earn badges along the way. We&rsquo;re building it
                now &mdash; tell us your kid&rsquo;s division and you&rsquo;ll be
                first to enroll.
              </p>

              <div className="mt-8 flex flex-wrap gap-4">
                <a
                  href="#interest"
                  className="inline-flex items-center justify-center gap-2 px-7 py-4 bg-ngpa-teal text-ngpa-deep font-heading font-bold text-lg rounded-full hover:bg-ngpa-teal-bright transition-colors shadow-xl shadow-ngpa-teal/20 min-h-[48px]"
                >
                  Save your spot
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2.5}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </a>
                <Link
                  href="/schedule"
                  className="inline-flex items-center justify-center gap-2 px-7 py-4 border-2 border-ngpa-slate text-ngpa-white font-bold text-lg rounded-full hover:border-ngpa-teal hover:text-ngpa-teal transition-colors min-h-[48px]"
                >
                  Play a drop-in first
                </Link>
              </div>

              <div className="mt-9 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-ngpa-white/70">
                <span className="inline-flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-ngpa-teal" aria-hidden="true" />
                  Ages 6–16
                </span>
                <span className="inline-flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-ngpa-teal" aria-hidden="true" />
                  8 sessions / season
                </span>
                <span className="inline-flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-ngpa-teal" aria-hidden="true" />
                  Growth-only — no leaderboards
                </span>
              </div>
            </div>

            <div
              id="interest"
              className="lg:col-span-5 lg:sticky lg:top-28 scroll-mt-24"
            >
              <div className="rounded-3xl border-2 border-ngpa-teal/30 bg-ngpa-deep/60 backdrop-blur-md p-1 shadow-2xl shadow-ngpa-teal/10">
                <div className="px-5 pt-6 pb-3 text-center">
                  <p className="font-heading text-xl font-black text-ngpa-white tracking-tight">
                    Get on the league list
                  </p>
                  <p className="text-ngpa-white/65 text-sm mt-1.5">
                    No commitment &mdash; this just tells us which divisions to
                    open first. We&rsquo;ll email you when a season near you is
                    set.
                  </p>
                </div>
                <LeagueInterestForm source="Web" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────────────────── */}
      <section className="relative bg-ngpa-navy py-16 sm:py-20 px-4 sm:px-6 lg:px-10">
        <div className="max-w-6xl mx-auto">
          <div className="max-w-2xl">
            <p className="text-xs sm:text-sm font-bold tracking-[0.2em] uppercase text-ngpa-teal mb-3">
              How a season works
            </p>
            <h2 className="font-heading text-3xl sm:text-4xl font-black text-ngpa-white mb-4 tracking-tight">
              Structured enough to grow. Fun enough to come back.
            </h2>
            <p className="text-lg text-ngpa-white/75 leading-relaxed">
              A league is the next step up from a drop-in: same kids, same court,
              a coach running every session against a clear objective. Here&rsquo;s
              what that looks like.
            </p>
          </div>

          <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 gap-6">
            {HOW_IT_WORKS.map((item) => (
              <div
                key={item.title}
                className="rounded-2xl bg-ngpa-panel border border-ngpa-slate/60 p-6 sm:p-7"
              >
                <h3 className="font-heading text-lg sm:text-xl font-bold text-ngpa-white mb-2.5">
                  {item.title}
                </h3>
                <p className="text-ngpa-white/75 leading-relaxed">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Age divisions ────────────────────────────────────────────── */}
      <section className="relative bg-ngpa-black py-16 sm:py-20 px-4 sm:px-6 lg:px-10">
        <div className="max-w-6xl mx-auto">
          <div className="max-w-2xl">
            <p className="text-xs sm:text-sm font-bold tracking-[0.2em] uppercase text-ngpa-teal mb-3">
              Age divisions
            </p>
            <h2 className="font-heading text-3xl sm:text-4xl font-black text-ngpa-white mb-4 tracking-tight">
              Kids play with their own age &mdash; and their own level.
            </h2>
            <p className="text-lg text-ngpa-white/75 leading-relaxed">
              Four age bands, each playing the ball color that fits. A child
              plays the division their age fits; moving up is by coach approval.
            </p>
          </div>

          <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {LEAGUE_BANDS.map((band) => {
              const accent = BAND_ACCENT[band.ballColor];
              return (
                <div
                  key={band.band}
                  className={`rounded-2xl bg-ngpa-panel border border-ngpa-slate/60 ring-1 ${accent.ring} p-6 flex flex-col`}
                >
                  <div className="flex items-baseline justify-between mb-3">
                    <span className="font-heading text-2xl font-black text-ngpa-white tracking-tight">
                      {band.label}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider ${accent.text}`}
                    >
                      <span
                        aria-hidden="true"
                        className={`w-2 h-2 rounded-full ${accent.dot}`}
                      />
                      {band.ballColor}
                    </span>
                  </div>
                  <p className="text-sm text-ngpa-white/60 font-mono mb-3">
                    Ages {band.minAge}–{band.maxAge}
                  </p>
                  <p className="text-ngpa-white/75 leading-relaxed text-sm">
                    {band.blurb}
                  </p>
                </div>
              );
            })}
          </div>

          <p className="mt-8 text-sm text-ngpa-white/60 max-w-2xl">
            The 16U Yellow division is the feeder into our invite-only Yellow Ball
            tournament track &mdash;{" "}
            <Link
              href="/yellowball/inquiry"
              className="text-ngpa-teal font-semibold hover:text-ngpa-teal-bright underline-offset-4 hover:underline"
            >
              learn about Yellow Ball
            </Link>
            . Invitations come from coach evaluation, never a public ranking.
          </p>
        </div>
      </section>

      {/* ── Growth-only / progression ────────────────────────────────── */}
      <section className="relative bg-ngpa-navy py-16 sm:py-20 px-4 sm:px-6 lg:px-10 overflow-hidden">
        <div
          aria-hidden="true"
          className="absolute -top-32 right-0 w-[36rem] h-[36rem] rounded-full bg-ngpa-teal/8 blur-3xl"
        />
        <div className="relative max-w-5xl mx-auto">
          <div className="max-w-2xl">
            <p className="text-xs sm:text-sm font-bold tracking-[0.2em] uppercase text-ngpa-teal mb-3">
              Growth-only
            </p>
            <h2 className="font-heading text-3xl sm:text-4xl font-black text-ngpa-white mb-4 tracking-tight">
              Progress you can actually see.
            </h2>
            <p className="text-lg text-ngpa-white/75 leading-relaxed">
              Buy-in for kids doesn&rsquo;t come from beating other kids &mdash;
              it comes from personal milestones. Every season builds a record of
              your own child&rsquo;s growth: skills unlocked, personal bests,
              level-ups, and badges earned in the debrief.
            </p>
          </div>

          <div className="mt-10 grid grid-cols-1 sm:grid-cols-3 gap-5">
            <div className="rounded-2xl bg-ngpa-panel border border-ngpa-slate/60 p-6">
              <h3 className="font-heading text-lg font-bold text-ngpa-white mb-2">
                Levels
              </h3>
              <p className="text-ngpa-white/75 text-sm leading-relaxed">
                Red &rarr; Orange &rarr; Green &rarr; Yellow. Coach-confirmed and
                values-gated &mdash; a kid can&rsquo;t level up on skills alone.
              </p>
            </div>
            <div className="rounded-2xl bg-ngpa-panel border border-ngpa-slate/60 p-6">
              <h3 className="font-heading text-lg font-bold text-ngpa-white mb-2">
                Badges
              </h3>
              <p className="text-ngpa-white/75 text-sm leading-relaxed">
                Skill, habit, and values badges &mdash; from &ldquo;Honest
                Call&rdquo; to a lifetime-touch milestone. Young kids get a
                physical stamp passport.
              </p>
            </div>
            <div className="rounded-2xl bg-ngpa-panel border border-ngpa-slate/60 p-6">
              <h3 className="font-heading text-lg font-bold text-ngpa-white mb-2">
                Your kid only
              </h3>
              <p className="text-ngpa-white/75 text-sm leading-relaxed">
                The growth view shows your child&rsquo;s own curve &mdash; never
                a ranking against other families. Their stakes are them vs.
                yesterday.
              </p>
            </div>
          </div>

          {LEAGUE_APP_URL && (
            <div className="mt-8 rounded-2xl border-2 border-ngpa-teal/30 bg-ngpa-deep/60 p-6 sm:p-7 flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
              <div>
                <p className="font-heading text-lg font-bold text-ngpa-white">
                  Already in a season?
                </p>
                <p className="text-ngpa-white/70 text-sm mt-1">
                  Log in to the growth dashboard to follow your kid&rsquo;s
                  progress between sessions.
                </p>
              </div>
              <a
                href={LEAGUE_APP_URL}
                className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-ngpa-teal text-ngpa-deep font-bold rounded-full hover:bg-ngpa-teal-bright transition-colors min-h-[48px] shrink-0"
              >
                Open the dashboard
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </a>
            </div>
          )}
        </div>
      </section>

      {/* ── Season terms / refund policy ─────────────────────────────── */}
      <section className="relative bg-ngpa-black py-16 sm:py-20 px-4 sm:px-6 lg:px-10">
        <div className="max-w-3xl mx-auto">
          <p className="text-xs sm:text-sm font-bold tracking-[0.2em] uppercase text-ngpa-teal mb-3">
            Season terms
          </p>
          <h2 className="font-heading text-3xl sm:text-4xl font-black text-ngpa-white mb-6 tracking-tight">
            Fair, weatherproofed, no surprises.
          </h2>
          <ul className="space-y-4 text-ngpa-white/80">
            <li className="flex items-start gap-3">
              <span aria-hidden="true" className="shrink-0 mt-1.5 w-2 h-2 rounded-full bg-ngpa-teal" />
              <span>
                <strong className="text-ngpa-white">Eight sessions across 9–10 weeks.</strong>{" "}
                The extra calendar room is a built-in buffer so a rained-out or
                heat-advisory night gets a make-up, not a refund fight.
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span aria-hidden="true" className="shrink-0 mt-1.5 w-2 h-2 rounded-full bg-ngpa-teal" />
              <span>
                <strong className="text-ngpa-white">Cancellation:</strong> $25 is
                retained if you cancel with at least 10 business days&rsquo;
                notice before the season starts. Under 10 days&rsquo; notice, the
                season fee is non-refundable (our court reservations are committed
                by then).
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span aria-hidden="true" className="shrink-0 mt-1.5 w-2 h-2 rounded-full bg-ngpa-teal" />
              <span>
                <strong className="text-ngpa-white">Eyewear required</strong> for
                every player, every session &mdash; and a signed waiver + medical
                and photo consent at enrollment.
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span aria-hidden="true" className="shrink-0 mt-1.5 w-2 h-2 rounded-full bg-ngpa-teal" />
              <span>
                <strong className="text-ngpa-white">Pricing shared at enrollment.</strong>{" "}
                We&rsquo;ll confirm the season fee with you directly when your
                division&rsquo;s dates and venue are set &mdash; no surprises
                before you commit.
              </span>
            </li>
          </ul>
        </div>
      </section>

      {/* ── Closing CTA ──────────────────────────────────────────────── */}
      <section className="relative bg-ngpa-navy py-16 sm:py-20 px-4 sm:px-6 lg:px-10 overflow-hidden">
        <div
          aria-hidden="true"
          className="absolute -top-32 left-1/2 -translate-x-1/2 w-[36rem] h-[36rem] rounded-full bg-ngpa-teal/8 blur-3xl"
        />
        <div className="relative max-w-3xl mx-auto text-center">
          <h2 className="font-heading text-3xl sm:text-4xl font-black text-ngpa-white mb-4 tracking-tight">
            Help us open your kid&rsquo;s division first.
          </h2>
          <p className="text-lg text-ngpa-white/75 leading-relaxed mb-8">
            The more families who raise their hand for a division, the sooner we
            run it. Two minutes now puts you at the front of the line.
          </p>
          <a
            href="#interest"
            className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-ngpa-teal text-ngpa-deep font-heading font-bold text-lg rounded-full hover:bg-ngpa-teal-bright transition-colors shadow-xl shadow-ngpa-teal/20 min-h-[48px]"
          >
            Get on the league list
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </a>
          <p className="mt-8 text-base text-ngpa-white/65">
            Questions?{" "}
            <a
              href={`tel:${site.phone.replace(/\D/g, "")}`}
              className="text-ngpa-teal font-bold hover:text-ngpa-teal-bright underline-offset-4 hover:underline transition-colors"
            >
              Call or text Sam at {site.phone}
            </a>
          </p>
        </div>
      </section>
    </>
  );
}
