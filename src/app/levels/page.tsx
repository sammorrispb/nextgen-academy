import type { Metadata } from "next";
import Link from "next/link";
import { levels } from "@/data/levels";

// The standalone "find your level" page. The four ball colors were only
// defined inside the home page's #levels section, but the season registration
// pages (/fall, /picklpark) ask a parent to pick Green vs Yellow with no
// explainer nearby — this page is the link target for that moment. Renders
// from src/data/levels.ts (the same source the home page uses) so the two
// surfaces can't drift.
export const metadata: Metadata = {
  title: "Find Your Player's Level | Next Gen Pickleball Academy",
  description:
    "Red, Orange, Green, and Yellow Ball explained — how Next Gen places young players by skill, never age alone, and how to find the right group for your kid.",
  alternates: { canonical: "https://nextgenpbacademy.com/levels" },
};

// One "sounds like your kid" cue per color — placement guidance for parents,
// keyed to the same ladder the levels data describes. A level is a step on one
// ladder, never a ceiling; the free evaluation is where placement actually
// happens, so these stay cues, not gates.
const SOUNDS_LIKE: Record<string, string> = {
  red: "Brand new to pickleball, or still working on keeping a rally going. Every player starts somewhere — this is the fun start.",
  orange:
    "Can rally a little and knows the basic idea of the game — now building serves, rules mastery, and moving the whole court.",
  green:
    "Rallies consistently and is hungry for the next layer: shot selection, positioning, and real doubles with a partner.",
  yellow:
    "Competing seriously and ready for tournament-track training in a small, coach-curated group.",
};

export default function LevelsPage() {
  return (
    <div className="bg-ngpa-navy">
      <section className="relative bg-ngpa-deep border-b border-ngpa-slate/40">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-14 sm:py-20">
          <p className="font-heading text-xs font-bold text-ngpa-lime uppercase tracking-[0.2em] mb-4">
            The pathway
          </p>
          <h1 className="font-heading text-3xl sm:text-5xl font-black text-ngpa-white tracking-tight mb-5">
            Find your player&rsquo;s level.
          </h1>
          <p className="text-lg text-ngpa-white/80 leading-relaxed mb-4">
            Every Next Gen player is placed on one ladder of four ball colors —{" "}
            <strong className="text-ngpa-white">
              Red, Orange, Green, and Yellow
            </strong>{" "}
            — by skill, never age alone. A color is a step, not a ceiling: kids
            move up as their game grows, and every level gets its own court.
          </p>
          <p className="text-sm text-ngpa-white/60 leading-relaxed">
            Not sure where your kid fits? That&rsquo;s exactly what the free
            evaluation is for — Coach Sam watches them play and places them, no
            guessing required.
          </p>
        </div>
      </section>

      <section className="bg-ngpa-navy">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
          <div className="space-y-5">
            {levels.map((level) => (
              <article
                key={level.key}
                className="bg-ngpa-panel rounded-2xl border border-ngpa-slate/60 p-6 sm:p-7"
              >
                <div className="flex items-center gap-3 mb-3">
                  <span
                    aria-hidden="true"
                    className="h-4 w-4 rounded-full shrink-0"
                    style={{ backgroundColor: level.color }}
                  />
                  <h2 className="font-heading text-xl sm:text-2xl font-black text-ngpa-white tracking-tight">
                    {level.label}
                  </h2>
                  <span className="ml-auto text-xs font-bold text-ngpa-white/60 uppercase tracking-[0.14em]">
                    Ages {level.ages}
                  </span>
                </div>
                <p className="font-heading text-base font-bold text-ngpa-white mb-2">
                  {level.focus}
                </p>
                <p className="text-ngpa-white/80 leading-relaxed mb-4">
                  {level.detail}
                </p>
                <p className="text-sm text-ngpa-white/70 leading-relaxed border-t border-ngpa-slate/50 pt-4">
                  <strong className="text-ngpa-white">
                    Sounds like your kid if:
                  </strong>{" "}
                  {SOUNDS_LIKE[level.key]}
                </p>
                {level.key === "yellow" && (
                  <p className="text-sm text-ngpa-white/70 leading-relaxed mt-3">
                    Yellow Ball is invite-only —{" "}
                    <Link
                      href="/yellowball/inquiry"
                      className="text-ngpa-teal-bright underline hover:text-ngpa-teal"
                    >
                      tell us about your player
                    </Link>{" "}
                    and we&rsquo;ll take it from there.
                  </p>
                )}
              </article>
            ))}
          </div>

          <div className="mt-8 bg-ngpa-slate/40 rounded-2xl border border-ngpa-slate/60 p-6 sm:p-7">
            <h2 className="font-heading text-lg font-black text-ngpa-white tracking-tight mb-3">
              How placement works
            </h2>
            <p className="text-ngpa-white/80 leading-relaxed mb-3">
              Book a free evaluation and Coach Sam places your player in the
              right color — it takes one session, and there&rsquo;s no
              &ldquo;not ready&rdquo;: every level from the first paddle touch
              has a group to join.
            </p>
            <p className="text-sm text-ngpa-white/60 leading-relaxed">
              Already know the color? Head to the{" "}
              <Link
                href="/schedule"
                className="text-ngpa-teal-bright underline hover:text-ngpa-teal"
              >
                schedule
              </Link>{" "}
              or a season page and pick the matching group.
            </p>
          </div>

          <div className="mt-8 flex flex-col sm:flex-row gap-3">
            <Link
              href="/free-evaluation"
              className="inline-flex items-center justify-center px-8 py-4 bg-ngpa-teal text-ngpa-deep font-heading font-bold text-lg rounded-full hover:bg-ngpa-teal-bright transition-colors min-h-[48px]"
            >
              Book a Free Evaluation →
            </Link>
            <Link
              href="/schedule"
              className="inline-flex items-center justify-center px-8 py-4 border-2 border-ngpa-slate text-ngpa-white font-heading font-bold text-lg rounded-full hover:border-ngpa-teal hover:text-ngpa-teal transition-colors min-h-[48px]"
            >
              See the schedule
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
