import type { Metadata } from "next";

import { LEVEL_COLOR, LEVEL_COLOR_FALLBACK } from "@/lib/level-colors";
import {
  AGE_BANDS,
  BALL_RULES,
  CAPTAIN_KIT,
  CAPTAIN_NEVER,
  CAPTAIN_RUN_OF_SHOW,
  CAPTAIN_SCRIPT,
  COACHING_MANTRA,
  CURRICULUM_AGE_MAX,
  CURRICULUM_AGE_MIN,
  CUTTABLE_BLOCK_ORDER,
  GENEROSITY_RULE,
  IDEAL_COACH_RATIO,
  MODIFIED_GAMES,
  NGA_TAGLINE,
  PILLAR_ACTIVE_HEART_RATE,
  PILLAR_FEEDBACK_DENSITY,
  SESSION_ARC_90,
  SKILL_STACK,
  phaseClock,
} from "@/data/session-curriculum";
import {
  FALL_SEASON_LABEL,
  FALL_SUNDAYS,
  FALL_RAIN_DATES,
  FALL_VENUE,
  FALL_YOUTH_BLOCKS,
  SLOTS_PER_GROUP,
} from "@/data/fall-2026";
import {
  FALL_SEASON_PLAN,
  focusBlockFor,
  gamesFor,
  ritualFor,
} from "@/data/fall-season-plan-2026";
import PrintButton from "./PrintButton";

// Internal coach ops tool — not a marketing page, not linked from public nav,
// kept out of search. The fall venue IS already public (it ships on the events
// feed and in every confirmation email), so printing it here reveals nothing;
// no roster, no child name, and no parent contact appears on this page, which
// keeps it off the minor-PII egress surface entirely.
export const metadata: Metadata = {
  title: "Fall Season Coach Playbook · NGA",
  description:
    "Run-of-show, curriculum, and court-captain playbook for the Next Gen Youth Fall Season.",
  robots: { index: false, follow: false },
};

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

/** "2026-09-20" → "Sun, September 20" — pure string math, never Date. */
function formatSunday(iso: string): string {
  const [, month, day] = iso.split("-");
  return `Sun, ${MONTHS[Number(month) - 1]} ${Number(day)}`;
}

function levelChip(color: string) {
  return LEVEL_COLOR[color] ?? LEVEL_COLOR_FALLBACK;
}

function Section({
  num,
  title,
  subtitle,
  children,
  breakBefore,
}: {
  num: number;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  breakBefore?: boolean;
}) {
  return (
    <section
      className={`rounded-xl bg-ngpa-panel print:bg-white border border-ngpa-slate/40 print:border-gray-300 p-5 sm:p-6 ${
        breakBefore ? "print:break-before-page" : ""
      }`}
    >
      <div className="flex items-baseline gap-3 mb-1">
        <span className="font-mono text-sm font-bold text-ngpa-teal print:text-black">
          {String(num).padStart(2, "0")}
        </span>
        <h2 className="font-heading text-xl sm:text-2xl font-black text-ngpa-white print:text-black tracking-tight">
          {title}
        </h2>
      </div>
      {subtitle && (
        <p className="text-sm text-ngpa-muted print:text-gray-600 mb-4 ml-8 leading-relaxed">
          {subtitle}
        </p>
      )}
      {children}
    </section>
  );
}

export default function FallPlaybookPage() {
  const greenStart = FALL_YOUTH_BLOCKS[0].startTime;
  const yellowStart = FALL_YOUTH_BLOCKS[1].startTime;

  return (
    <main className="min-h-screen bg-ngpa-deep print:bg-white px-4 sm:px-6 lg:px-10 py-12 sm:py-16">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-start justify-between gap-4 mb-2">
          <p className="text-xs font-bold tracking-[0.2em] uppercase text-ngpa-teal print:text-black">
            Coach Operations
          </p>
          <PrintButton label="Print playbook" />
        </div>
        <h1 className="font-heading text-3xl sm:text-4xl font-black text-ngpa-white print:text-black tracking-tight">
          Fall season coach playbook
        </h1>
        <p className="mt-3 text-base text-ngpa-white/70 print:text-gray-700 leading-relaxed">
          {FALL_SEASON_LABEL} · {FALL_YOUTH_BLOCKS.length} groups ·{" "}
          {SLOTS_PER_GROUP} kids per group on 2 courts · ages{" "}
          {CURRICULUM_AGE_MIN}–{CURRICULUM_AGE_MAX}. One court captain per
          court, so the coach coaches.
        </p>
        <p className="mt-2 text-sm text-ngpa-muted print:text-gray-600">
          {FALL_VENUE}
        </p>

        <div className="mt-6 rounded-xl border border-ngpa-lime/40 print:border-gray-400 bg-ngpa-navy print:bg-white p-5">
          <p className="font-heading text-lg font-black text-ngpa-lime print:text-black">
            &ldquo;{COACHING_MANTRA}&rdquo;
          </p>
          <dl className="mt-4 grid gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-bold uppercase tracking-wider text-ngpa-teal print:text-black">
                Pillar 1 · Active Heart Rate
              </dt>
              <dd className="mt-1 text-sm text-ngpa-white/90 print:text-black leading-snug">
                {PILLAR_ACTIVE_HEART_RATE} Ideal ratio 1:{IDEAL_COACH_RATIO}.
              </dd>
            </div>
            <div>
              <dt className="text-xs font-bold uppercase tracking-wider text-ngpa-teal print:text-black">
                Pillar 2 · Feedback Density
              </dt>
              <dd className="mt-1 text-sm text-ngpa-white/90 print:text-black leading-snug">
                {PILLAR_FEEDBACK_DENSITY}
              </dd>
            </div>
          </dl>
        </div>

        <div className="mt-6 space-y-6">
          {/* ── 01 · Run of show ────────────────────────────────────────── */}
          <Section
            num={1}
            title="Run of show — every Sunday"
            subtitle="Same order, every week. Both groups run the same arc; only the clock and the dials differ."
          >
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-ngpa-slate/50 print:border-gray-400 text-left">
                    <th className="py-2 pr-3 font-mono text-xs text-ngpa-teal print:text-black">
                      Green
                    </th>
                    <th className="py-2 pr-3 font-mono text-xs text-ngpa-teal print:text-black">
                      Yellow
                    </th>
                    <th className="py-2 pr-3 text-ngpa-white print:text-black">
                      Phase
                    </th>
                    <th className="py-2 pr-3 text-ngpa-white print:text-black">
                      What happens
                    </th>
                    <th className="py-2 text-ngpa-white print:text-black">
                      Owner
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {SESSION_ARC_90.map((phase) => (
                    <tr
                      key={phase.name}
                      className="border-b border-ngpa-slate/30 print:border-gray-300 align-top"
                    >
                      <td className="py-2 pr-3 font-mono text-xs whitespace-nowrap text-ngpa-muted print:text-gray-700">
                        {phaseClock(phase, greenStart)}
                      </td>
                      <td className="py-2 pr-3 font-mono text-xs whitespace-nowrap text-ngpa-muted print:text-gray-700">
                        {phaseClock(phase, yellowStart)}
                      </td>
                      <td className="py-2 pr-3 font-bold text-ngpa-white print:text-black whitespace-nowrap">
                        {phase.name}
                      </td>
                      <td className="py-2 pr-3 text-ngpa-white/80 print:text-gray-800 leading-snug">
                        {phase.what}
                        <span className="block mt-1 text-xs text-ngpa-muted print:text-gray-600 italic">
                          {phase.why}
                        </span>
                      </td>
                      <td className="py-2 text-xs uppercase tracking-wide text-ngpa-teal print:text-black">
                        {phase.owner}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-4 text-sm text-ngpa-white/80 print:text-gray-800 leading-relaxed">
              <strong className="text-ngpa-lime print:text-black">
                Two rules that never bend:
              </strong>{" "}
              start the closing ritual when 5 minutes remain, and skip it under
              3 minutes or under 4 kids. Cut the ritual, never the cleanup.
            </p>
          </Section>

          {/* ── 02 · Skill Stack ────────────────────────────────────────── */}
          <Section
            num={2}
            title="The Skill Stack"
            subtitle="Six blocks, in this order, every session. Kitchen out to the baseline, then the serve — start where the ball is slowest and success is cheapest. Short on time? Cut block 5; it's the competitive extension of block 1, so its skill already got reps. Never cut block 6."
            breakBefore
          >
            <div className="space-y-5">
              {SKILL_STACK.map((block) => (
                <article
                  key={block.order}
                  className="rounded-lg border border-ngpa-slate/40 print:border-gray-300 p-4 print:break-inside-avoid"
                >
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <span className="font-mono text-xs font-bold text-ngpa-teal print:text-black">
                      BLOCK {block.order}
                    </span>
                    <h3 className="font-heading text-lg font-black text-ngpa-white print:text-black">
                      {block.name}
                    </h3>
                    <span className="text-sm text-ngpa-lime print:text-gray-700">
                      &ldquo;{block.alias}&rdquo;
                    </span>
                    {block.order === CUTTABLE_BLOCK_ORDER && (
                      <span className="text-[11px] uppercase tracking-wider font-bold text-ngpa-orange print:text-gray-600">
                        cut first if short
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-ngpa-white/80 print:text-gray-800">
                    {block.teaches}
                  </p>

                  <dl className="mt-3 grid gap-2 sm:grid-cols-2 text-sm">
                    <div>
                      <dt className="text-xs font-bold uppercase tracking-wider text-ngpa-muted print:text-gray-600">
                        Setup
                      </dt>
                      <dd className="text-ngpa-white/90 print:text-black leading-snug">
                        {block.setup}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs font-bold uppercase tracking-wider text-ngpa-muted print:text-gray-600">
                        Formation
                      </dt>
                      <dd className="text-ngpa-white/90 print:text-black leading-snug">
                        {block.formation}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs font-bold uppercase tracking-wider text-ngpa-muted print:text-gray-600">
                        Rotation
                      </dt>
                      <dd className="text-ngpa-white/90 print:text-black leading-snug">
                        {block.rotation}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs font-bold uppercase tracking-wider text-ngpa-muted print:text-gray-600">
                        By level
                      </dt>
                      <dd className="text-ngpa-white/90 print:text-black leading-snug">
                        {block.scaling}
                      </dd>
                    </div>
                  </dl>

                  <div className="mt-3">
                    <p className="text-xs font-bold uppercase tracking-wider text-ngpa-lime print:text-black">
                      Cues — say these, in this order
                    </p>
                    <ul className="mt-1 space-y-0.5">
                      {block.cues.map((cue) => (
                        <li
                          key={cue}
                          className="text-sm text-ngpa-white/90 print:text-black leading-snug"
                        >
                          &ldquo;{cue}&rdquo;
                        </li>
                      ))}
                    </ul>
                    <p className="mt-2 text-xs text-ngpa-muted print:text-gray-600">
                      Vocabulary: {block.vocabulary.join(" · ")}
                    </p>
                    <p className="mt-2 text-sm text-ngpa-teal print:text-gray-800">
                      <strong>Captain:</strong> {block.captainCue}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          </Section>

          {/* ── 03 · Ball rules ─────────────────────────────────────────── */}
          <Section
            num={3}
            title="Modified rules by ball"
            subtitle="Every level plays real pickleball; what changes is how much of the rulebook is switched on. Red gets one serve because at Red the rally is the point, not the serve — a miss doesn't end anything, the receiver feeds and play starts. Orange gets two because there the serve IS the skill being learned. Green and Yellow return to one: tournament standard."
            breakBefore
          >
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-ngpa-slate/50 print:border-gray-400 text-left">
                    <th className="py-2 pr-3 text-ngpa-white print:text-black">
                      Level
                    </th>
                    <th className="py-2 pr-3 text-ngpa-white print:text-black">
                      Serve
                    </th>
                    <th className="py-2 pr-3 text-ngpa-white print:text-black">
                      Kitchen
                    </th>
                    <th className="py-2 pr-3 text-ngpa-white print:text-black">
                      Two-bounce
                    </th>
                    <th className="py-2 pr-3 text-ngpa-white print:text-black">
                      Court
                    </th>
                    <th className="py-2 text-ngpa-white print:text-black">
                      Scoring
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {BALL_RULES.map((rule) => (
                    <tr
                      key={rule.color}
                      className="border-b border-ngpa-slate/30 print:border-gray-300 align-top"
                    >
                      <td className="py-2 pr-3 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center justify-center min-w-[64px] px-2.5 py-1 rounded-full text-xs font-bold ${levelChip(
                            rule.label.replace(" Ball", ""),
                          )}`}
                        >
                          {rule.label.replace(" Ball", "")}
                        </span>
                        <span className="block mt-1 text-[11px] text-ngpa-muted print:text-gray-600">
                          {rule.typicalAges}
                        </span>
                      </td>
                      <td className="py-2 pr-3 text-ngpa-white/90 print:text-black leading-snug">
                        {rule.serve}
                        <span className="block mt-1 text-xs text-ngpa-muted print:text-gray-600">
                          {rule.serveMiss}
                        </span>
                      </td>
                      <td className="py-2 pr-3 text-ngpa-white/90 print:text-black leading-snug">
                        {rule.kitchen}
                      </td>
                      <td className="py-2 pr-3 text-ngpa-white/90 print:text-black leading-snug">
                        {rule.twoBounce}
                      </td>
                      <td className="py-2 pr-3 text-ngpa-white/90 print:text-black leading-snug">
                        {rule.court}
                      </td>
                      <td className="py-2 text-ngpa-white/90 print:text-black leading-snug">
                        {rule.scoring}
                        <span className="block mt-1 text-xs text-ngpa-teal print:text-gray-700">
                          Captain watches: {rule.captainWatch}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-4 rounded-lg border border-ngpa-lime/40 print:border-gray-400 p-3 text-sm text-ngpa-white/90 print:text-black leading-relaxed">
              <strong className="text-ngpa-lime print:text-black">
                Outranks every rule above:
              </strong>{" "}
              {GENEROSITY_RULE}
            </p>
          </Section>

          {/* ── 04 · Age dials ──────────────────────────────────────────── */}
          <Section
            num={4}
            title="Age bands — the dials"
            subtitle="Ball color sets the RULES. Age band sets the DIALS. They're independent on purpose: a twelve-year-old on day one plays Orange rules at the 13U dial, and a strong nine-year-old plays Green rules at the 9U dial. Collapsing them into one ladder is how a kid ends up bored or drowning."
          >
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-ngpa-slate/50 print:border-gray-400 text-left">
                    <th className="py-2 pr-3 text-ngpa-white print:text-black">
                      Band
                    </th>
                    <th className="py-2 pr-3 text-ngpa-white print:text-black">
                      Block
                    </th>
                    <th className="py-2 pr-3 text-ngpa-white print:text-black">
                      Rally target
                    </th>
                    <th className="py-2 pr-3 text-ngpa-white print:text-black">
                      Game
                    </th>
                    <th className="py-2 pr-3 text-ngpa-white print:text-black">
                      Language
                    </th>
                    <th className="py-2 text-ngpa-white print:text-black">
                      Kid-coach
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {AGE_BANDS.map((band) => (
                    <tr
                      key={band.band}
                      className="border-b border-ngpa-slate/30 print:border-gray-300 align-top"
                    >
                      <td className="py-2 pr-3 whitespace-nowrap">
                        <span className="font-heading font-black text-ngpa-lime print:text-black">
                          {band.band}
                        </span>
                        <span className="block text-[11px] text-ngpa-muted print:text-gray-600">
                          ages {band.minAge}–{band.maxAge}
                        </span>
                        <span className="block mt-1 text-xs text-ngpa-white/70 print:text-gray-700 max-w-[13rem] leading-snug">
                          {band.stage}
                        </span>
                      </td>
                      <td className="py-2 pr-3 font-mono text-ngpa-white/90 print:text-black whitespace-nowrap">
                        {band.blockMinutes} min
                      </td>
                      <td className="py-2 pr-3 font-mono text-ngpa-white/90 print:text-black">
                        {band.rallyTarget}
                      </td>
                      <td className="py-2 pr-3 font-mono text-ngpa-white/90 print:text-black whitespace-nowrap">
                        {band.gameMinutes} min
                      </td>
                      <td className="py-2 pr-3 text-ngpa-white/90 print:text-black leading-snug">
                        {band.language}
                      </td>
                      <td className="py-2 text-ngpa-white/90 print:text-black leading-snug">
                        {band.kidCoach}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          {/* ── 05 · Games ──────────────────────────────────────────────── */}
          <Section
            num={5}
            title="Games — learning to competing"
            subtitle="The Skill Stack builds the shot; these make the kid choose it under pressure, which is the only way it survives into a real point. The game is the assessment — you never have to test anything, the constraint does it."
            breakBefore
          >
            <div className="grid gap-4 sm:grid-cols-2">
              {MODIFIED_GAMES.map((game) => (
                <article
                  key={game.slug}
                  className="rounded-lg border border-ngpa-slate/40 print:border-gray-300 p-4 print:break-inside-avoid"
                >
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <h3 className="font-heading text-base font-black text-ngpa-white print:text-black">
                      {game.name}
                    </h3>
                    <span className="text-[11px] uppercase tracking-wider font-bold text-ngpa-teal print:text-gray-600">
                      {game.purpose}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-ngpa-muted print:text-gray-600">
                    {game.players} · ages {game.minAge}+
                    {game.repsBlock > 0 && ` · reps block ${game.repsBlock}`}
                  </p>
                  <p className="mt-2 text-sm text-ngpa-white/90 print:text-black leading-snug">
                    <strong className="text-ngpa-lime print:text-black">
                      Setup.
                    </strong>{" "}
                    {game.setup}
                  </p>
                  <p className="mt-2 text-sm text-ngpa-white/90 print:text-black leading-snug">
                    <strong className="text-ngpa-lime print:text-black">
                      Rules.
                    </strong>{" "}
                    {game.rules}
                  </p>
                  <p className="mt-2 text-xs text-ngpa-white/70 print:text-gray-700 leading-snug">
                    <strong>Scaling.</strong> {game.scaling}
                  </p>
                  <p className="mt-2 text-xs text-ngpa-teal print:text-gray-800 leading-snug">
                    <strong>Captain.</strong> {game.captainRole}
                  </p>
                </article>
              ))}
            </div>
          </Section>

          {/* ── 06 · Season plan ────────────────────────────────────────── */}
          <Section
            num={6}
            title="The six weeks"
            subtitle="Each week adds one thing to the week before. That progression is what a family bought — six interchangeable sessions would be six drop-ins with a discount. If a Sunday washes out, the weeks slide; they never reorder."
            breakBefore
          >
            <div className="space-y-4">
              {FALL_SEASON_PLAN.map((week) => {
                const focus = focusBlockFor(week);
                const games = gamesFor(week);
                const ritual = ritualFor(week);
                return (
                  <article
                    key={week.week}
                    className="rounded-lg border border-ngpa-slate/40 print:border-gray-300 p-4 print:break-inside-avoid"
                  >
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <span className="font-mono text-xs font-bold text-ngpa-teal print:text-black">
                        WEEK {week.week}
                      </span>
                      <span className="font-mono text-xs text-ngpa-muted print:text-gray-600">
                        {formatSunday(week.date)}
                      </span>
                      <h3 className="font-heading text-lg font-black text-ngpa-white print:text-black">
                        {week.title}
                      </h3>
                      <span className="rounded-full bg-ngpa-navy print:bg-transparent border border-ngpa-lime/50 print:border-gray-400 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-ngpa-lime print:text-black">
                        {week.word}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-ngpa-white/90 print:text-black leading-snug">
                      <strong className="text-ngpa-lime print:text-black">
                        Deep on:
                      </strong>{" "}
                      Block {focus.order} · {focus.name} &mdash; &ldquo;
                      {focus.alias}&rdquo;
                    </p>
                    <p className="mt-1 text-sm text-ngpa-white/90 print:text-black leading-snug">
                      <strong className="text-ngpa-lime print:text-black">
                        Games:
                      </strong>{" "}
                      {games.map((g) => g.name).join(" → ")} → {ritual.name}
                    </p>
                    <p className="mt-1 text-sm text-ngpa-white/80 print:text-gray-800 leading-snug">
                      <strong>Looking for:</strong> {week.coachLooksFor}
                    </p>
                    <p className="mt-2 text-xs text-ngpa-muted print:text-gray-600 leading-snug">
                      Word framing: &ldquo;{week.wordFraming}&rdquo;
                    </p>
                    <p className="mt-1 text-xs text-ngpa-muted print:text-gray-600 leading-snug">
                      Parents hear: &ldquo;{week.parentLine}&rdquo; · Home rep:{" "}
                      {week.homeRep}
                    </p>
                  </article>
                );
              })}
            </div>
            <p className="mt-4 text-xs text-ngpa-muted print:text-gray-600">
              Season Sundays: {FALL_SUNDAYS.map(formatSunday).join(" · ")}.
              Rain dates held: {FALL_RAIN_DATES.map(formatSunday).join(" · ")}.
            </p>
          </Section>

          {/* ── 07 · Captain card ───────────────────────────────────────── */}
          <Section
            num={7}
            title="Court captain card"
            subtitle="Print this page and hand one to each captain. They run the clock, the rotation, the score, and the balls. They do not coach — a captain fixing a grip may be teaching against what the coach said sixty seconds ago."
            breakBefore
          >
            <div className="flex justify-end print:hidden mb-4">
              <PrintButton label="Print captain card" />
            </div>

            <div className="rounded-lg border border-ngpa-lime/40 print:border-gray-400 p-4 mb-5">
              <p className="text-xs font-bold uppercase tracking-wider text-ngpa-lime print:text-black">
                Safeguarding — operating rules, day one
              </p>
              <ul className="mt-2 space-y-1 text-sm text-ngpa-white/90 print:text-black leading-snug list-disc pl-5">
                <li>
                  Two-deep leadership. Never one adult alone with kids &mdash;
                  if the coach steps away, captains stay together or play
                  pauses.
                </li>
                <li>
                  No captain is ever alone with a child who isn&rsquo;t theirs.
                  Not in a car, not walking to a bathroom, not off the court.
                </li>
                <li>Captains do not discipline. Behaviour goes to the coach.</li>
                <li>No photographs of other families&rsquo; children.</li>
                <li>
                  Background check / SafeSport-equivalent vetting is a
                  requirement. Until it clears, that volunteer works only in the
                  coach&rsquo;s direct line of sight.
                </li>
              </ul>
            </div>

            <h3 className="font-heading text-base font-black text-ngpa-white print:text-black">
              Your run of show
            </h3>
            <ul className="mt-2 mb-5">
              {CAPTAIN_RUN_OF_SHOW.map((duty) => (
                <li
                  key={duty.phase}
                  className="flex items-start gap-3 py-2 border-b border-ngpa-slate/30 print:border-gray-300 last:border-b-0"
                >
                  <span className="mt-0.5 shrink-0 font-mono text-xs font-bold text-ngpa-teal print:text-black min-w-[7.5rem]">
                    {duty.phase}
                  </span>
                  <span className="text-sm text-ngpa-white/90 print:text-black leading-snug">
                    {duty.duty}
                  </span>
                </li>
              ))}
            </ul>

            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <h3 className="font-heading text-base font-black text-ngpa-lime print:text-black">
                  The five things you say
                </h3>
                <ul className="mt-2 space-y-1.5">
                  {CAPTAIN_SCRIPT.map((line) => (
                    <li
                      key={line}
                      className="text-sm text-ngpa-white/90 print:text-black leading-snug"
                    >
                      {line}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="font-heading text-base font-black text-ngpa-orange print:text-black">
                  Never
                </h3>
                <ul className="mt-2 space-y-1.5">
                  {CAPTAIN_NEVER.map((line) => (
                    <li
                      key={line}
                      className="text-sm text-ngpa-white/90 print:text-black leading-snug"
                    >
                      {line}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <h3 className="mt-5 font-heading text-base font-black text-ngpa-white print:text-black">
              Your kit, per court
            </h3>
            <ul className="mt-2">
              {CAPTAIN_KIT.map((item) => (
                <li
                  key={item}
                  className="flex items-start gap-3 py-2 border-b border-ngpa-slate/30 print:border-gray-300 last:border-b-0"
                >
                  <input
                    type="checkbox"
                    className="mt-1 h-5 w-5 shrink-0 accent-ngpa-teal"
                  />
                  <span className="text-sm text-ngpa-white/90 print:text-black leading-snug">
                    {item}
                  </span>
                </li>
              ))}
            </ul>
          </Section>

          {/* ── 08 · Post-session ───────────────────────────────────────── */}
          <Section
            num={8}
            title="Post-session self-check"
            subtitle="Six boxes, done within ten minutes of the session ending, while it's fresh. Three of six on one week is fine. Three of six for three weeks running is structural — something in the format is wrong."
          >
            <ul>
              {[
                "All kids hitting within the first 5 minutes",
                "Every kid got feedback every 2–5 minutes",
                "I knew and used every kid's name",
                "Skill Stack stayed within ±2 minutes of plan",
                "Talked with 3+ parents",
                "A random kid can verbalize what they learned",
              ].map((item) => (
                <li
                  key={item}
                  className="flex items-start gap-3 py-2 border-b border-ngpa-slate/30 print:border-gray-300 last:border-b-0"
                >
                  <input
                    type="checkbox"
                    className="mt-1 h-5 w-5 shrink-0 accent-ngpa-teal"
                  />
                  <span className="text-sm text-ngpa-white/90 print:text-black leading-snug">
                    {item}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-sm text-ngpa-muted print:text-gray-600 italic">
              The last box is the one that matters &mdash; it catches &ldquo;I
              was busy but didn&rsquo;t actually teach anything.&rdquo;
            </p>
          </Section>
        </div>

        <p className="mt-8 text-center font-heading text-sm font-black text-ngpa-lime print:text-black">
          {NGA_TAGLINE}
        </p>
      </div>
    </main>
  );
}
