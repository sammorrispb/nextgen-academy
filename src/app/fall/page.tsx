import type { Metadata } from "next";
import FallInterestForm from "@/components/FallInterestForm";
import {
  FALL_END_TIME,
  FALL_NO_HOLD_NOTE,
  FALL_PROGRAMS,
  FALL_PUBLIC_AREA,
  FALL_SEASON_LABEL,
  FALL_SEASON_WEEKS,
  FALL_START_TIME,
  FALL_VENUE,
  FALL_VENUE_SHORT,
  SLOTS_PER_GROUP,
} from "@/data/fall-2026";

// Noindex on purpose. This is the landing page for one email campaign about a
// season that isn't bookable — it must not compete with /schedule in search, and
// it goes stale the moment the season is decided either way. Same posture as
// /poll/[slug].
export const metadata: Metadata = {
  title: "Fall 2026 — does this schedule work? | Next Gen Pickleball Academy",
  description:
    "Six Sundays of youth pickleball at Wood Middle School this fall — Green Ball 1:00–2:30 PM, Yellow Ball 2:30–4:00 PM — plus an adult round robin track. Tell us what works for your family.",
  robots: { index: false, follow: false },
};

export default function FallPage() {
  return (
    <div className="bg-ngpa-navy">
      <section className="relative bg-ngpa-deep border-b border-ngpa-slate/40">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-14 sm:py-20">
          <p className="font-heading text-xs font-bold text-ngpa-lime uppercase tracking-[0.2em] mb-4">
            Fall 2026 — we need your read
          </p>
          <h1 className="font-heading text-3xl sm:text-5xl font-black text-ngpa-white tracking-tight mb-5">
            Would this fall work for you?
          </h1>
          <p className="text-lg text-ngpa-white/80 leading-relaxed mb-6">
            We&rsquo;re running {FALL_SEASON_WEEKS} weeks at {FALL_VENUE_SHORT}{" "}
            in {FALL_PUBLIC_AREA} —{" "}
            <strong className="text-ngpa-white">
              Sundays, {FALL_START_TIME}&ndash;{FALL_END_TIME}: Green Ball
              1:00&ndash;2:30 PM, Yellow Ball 2:30&ndash;4:00 PM
            </strong>
            , running <time dateTime="2026-09-20">{FALL_SEASON_LABEL}</time>{" "}
            (rain dates Nov 1 and Nov 8). Plus an adult round robin track, so a
            family can come together and everybody plays.
          </p>
          <p className="text-sm text-ngpa-white/60 leading-relaxed">
            {FALL_NO_HOLD_NOTE}
          </p>
        </div>
      </section>

      <section className="bg-ngpa-navy">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
          <h2 className="font-heading text-2xl sm:text-3xl font-black text-ngpa-white tracking-tight mb-6">
            What we&rsquo;re planning
          </h2>

          <div className="grid grid-cols-1 gap-5">
            {FALL_PROGRAMS.map((program) => (
              <article
                key={program.track}
                className="bg-ngpa-panel rounded-2xl border border-ngpa-slate/60 p-6 sm:p-7"
              >
                <p className="text-xs font-bold text-ngpa-lime uppercase tracking-[0.18em] mb-2">
                  {program.who}
                </p>
                <h3 className="font-heading text-xl sm:text-2xl font-black text-ngpa-white tracking-tight mb-3">
                  {program.name}
                </h3>
                <p className="text-ngpa-white/80 leading-relaxed mb-4">
                  {program.format}
                </p>
                <div className="flex flex-wrap gap-2">
                  {program.groups.map((group) => (
                    <span
                      key={group}
                      className="inline-flex items-center px-3 py-1.5 rounded-full bg-ngpa-deep/60 border border-ngpa-slate/60 text-sm text-ngpa-white/85"
                    >
                      {group}
                    </span>
                  ))}
                </div>
                <p className="text-sm text-ngpa-white/60 mt-4">
                  {SLOTS_PER_GROUP} spots in each {program.groupNoun}, first
                  come first serve.
                </p>
              </article>
            ))}
          </div>

          <div className="mt-6 bg-ngpa-slate/40 rounded-2xl border border-ngpa-slate/60 p-6 sm:p-7">
            <h3 className="font-heading text-lg font-black text-ngpa-white tracking-tight mb-4">
              How it would work
            </h3>
            <ul className="space-y-3 text-ngpa-white/80 leading-relaxed">
              <li>
                <strong className="text-ngpa-white">
                  {SLOTS_PER_GROUP} spots per group, first come first serve.
                </strong>{" "}
                Small on purpose — everybody gets real reps and real games.
              </li>
              <li>
                <strong className="text-ngpa-white">
                  It&rsquo;s a full season.
                </strong>{" "}
                You&rsquo;d commit to all {FALL_SEASON_WEEKS} weeks and pay for
                the season up front. That&rsquo;s what keeps a group together
                and keeps the round robin worth showing up for.
              </li>
              <li>
                <strong className="text-ngpa-white">
                  Can&rsquo;t commit to all {FALL_SEASON_WEEKS} weeks?
                </strong>{" "}
                There&rsquo;s a sub list — tell us below and we&rsquo;ll call
                you when a spot opens week to week.
              </li>
              <li>
                <strong className="text-ngpa-white">
                  We haven&rsquo;t set a price.
                </strong>{" "}
                The form asks what a season like this would be worth to you.
                That&rsquo;s a real question, not a sales move.
              </li>
            </ul>
            <p className="text-sm text-ngpa-white/55 mt-5">
              Venue: {FALL_VENUE}. Rain dates: Sundays November 1 and
              November 8.
            </p>
          </div>
        </div>
      </section>

      <section className="bg-ngpa-black">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
          <h2 className="font-heading text-2xl sm:text-3xl font-black text-ngpa-white tracking-tight mb-3">
            Tell us what works
          </h2>
          <p className="text-ngpa-white/70 leading-relaxed mb-8">
            About a minute. Every answer changes what we book.
          </p>
          <FallInterestForm />
        </div>
      </section>
    </div>
  );
}
