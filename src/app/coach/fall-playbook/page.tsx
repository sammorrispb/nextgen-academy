import type { Metadata } from "next";

import { LEVEL_COLOR, LEVEL_COLOR_FALLBACK } from "@/lib/level-colors";
import {
  AGE_BANDS,
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
  phaseClock,
  type BallRules,
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
  focusBlockFor,
  gamesFor,
  ritualFor,
} from "@/data/fall-season-plan-2026";
import { findDiagram } from "@/data/court-diagrams";
import { CURRICULUM_DEFAULTS, mergeCurriculum } from "@/lib/curriculum-merge";
import { fetchCurriculumOverrides } from "@/lib/notion-curriculum";
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

// Same 5-min ISR as /schedule. The page is otherwise static; this exists only
// so a curriculum override edited in Notion reaches the court without a deploy.
// With NOTION_CURRICULUM_DB_ID unset the read makes no network call at all, so
// the dark path is the static page it has always been.
export const revalidate = 300;

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


const DIAGRAM_CSS = `.c-surf{fill:#132038;stroke:#8A99C5}
.c-kitch{fill:#273D68}
.c-line,.c-linestroke{stroke:#8A99C5}
.c-net{stroke:#EEF2FF}
.c-netfill{fill:#EEF2FF}
.c-netband{fill:#EEF2FF;opacity:.13}
.c-bg{fill:#0B1424}
.c-inkstroke{stroke:#EEF2FF}
.c-inkfill{fill:#EEF2FF}
.c-mutedfill{fill:#8A99C5}
.c-mutedstroke{stroke:#8A99C5}
.c-chip{fill:#0B1424;opacity:.92}
.c-ball{stroke:#AADC00}
.c-ballfill{fill:#AADC00}
.c-move{stroke:#00D4FF}
.c-movefill{fill:#00D4FF}
@media print{
.c-surf{fill:#fff;stroke:#444}
.c-kitch{fill:#e6ecf5}
.c-line,.c-linestroke{stroke:#6b7a99}
.c-net{stroke:#111}.c-netfill{fill:#111}.c-netband{fill:#111;opacity:.10}
.c-bg{fill:#fff}.c-inkstroke{stroke:#111}.c-inkfill{fill:#111}
.c-mutedfill{fill:#555}.c-mutedstroke{stroke:#777}
.c-chip{fill:#fff;opacity:.94}
.c-ball{stroke:#5F7D00}.c-ballfill{fill:#5F7D00}
.c-move{stroke:#00688F}.c-movefill{fill:#00688F}
}`;

/** Skill Stack block order → its generated diagram. */
const BLOCK_DIAGRAM: Record<number, string> = {
  1: "k2k",
  2: "slinky",
  3: "drops",
  4: "volleys",
  5: "kitchen-play",
  6: "serve",
};

/** Game slug → its generated diagram. Games with no diagram render none. */
const GAME_DIAGRAM: Record<string, string> = {
  "kitchen-game": "kitchen-game",
  "seven-eleven": "seven-eleven",
  "skinny-singles": "skinny",
  "king-of-the-court": "king",
  squirrel: "squirrel",
  jailbreak: "jailbreak",
};

/**
 * A generated court diagram. `svg` is build-time constant from
 * scripts/build-court-diagrams.mjs — generated markup, never user input, and
 * pinned by e2e/court-diagrams.spec.ts to contain no script, no foreignObject
 * and no inline event handlers. It has to be injected as markup rather than
 * authored as JSX so one generator can own the court geometry for every figure.
 */
function Diagram({ id, wide = false }: { id: string; wide?: boolean }) {
  const d = findDiagram(id);
  if (!d) return null;
  return (
    <figure className={`m-0 ${wide ? "" : "mx-auto"}`}>
      <svg
        viewBox={d.viewBox}
        role="img"
        aria-label={d.aria}
        className={`block w-full h-auto mx-auto ${wide ? "max-w-[640px]" : "max-w-[320px]"}`}
        dangerouslySetInnerHTML={{ __html: d.svg }}
      />
      <figcaption className="mt-3 text-xs leading-snug text-ngpa-muted print:text-gray-600 text-center mx-auto max-w-[52ch]">
        {d.claim}
      </figcaption>
    </figure>
  );
}

/**
 * Screen-only marker for a string currently overridden from Notion, so it is
 * always visible how far the live copy has drifted from what git has. It is
 * `print:hidden` on purpose: a volunteer captain reading the printed card has
 * no use for an internal versioning signal, and the drift is still visible to
 * a coach on any screen.
 */
function Edited({ on, id }: { on: ReadonlySet<string>; id: string }) {
  if (!on.has(id)) return null;
  return (
    <span
      title={`Edited in Notion (${id}). The tested default lives in git.`}
      className="print:hidden ml-1.5 inline-flex items-center gap-1 align-middle rounded-full border border-ngpa-lime/50 px-1.5 py-[1px] text-[10px] font-bold uppercase tracking-wider text-ngpa-lime"
    >
      <span aria-hidden className="inline-block h-1.5 w-1.5 rounded-full bg-ngpa-lime" />
      edited
    </span>
  );
}

/**
 * The ball-rules panel. Unlike every other diagram this one is NOT generated:
 * it reads BALL_RULES at render time, so the serve dots, the enforced-kitchen
 * band and the lane can never disagree with the rules the rest of the page
 * prints. A hardcoded serve count in a picture is drift with a delay on it.
 */
function BallRulesPanel({ rules }: { rules: readonly BallRules[] }) {
  const m = 4;
  const w = 20 * m;
  const h = 44 * m;
  const HUE: Record<string, string> = {
    red: "#FF4040",
    orange: "#FF8C00",
    green: "#00C853",
    yellow: "#FFD600",
  };
  return (
    <figure className="m-0">
      <svg
        viewBox="0 0 620 356"
        role="img"
        aria-label="Four small pickleball courts side by side labelled Red, Orange, Green and Yellow. A shaded band marks the kitchen wherever it is enforced, and lime dots below each court show how many serves that level gets."
        className="block w-full h-auto max-w-[640px] mx-auto"
      >
        {rules.map((rule, n) => {
          const ox = 26 + n * 148;
          const oy = 54;
          const net = oy + h / 2;
          const kf = net - 7 * m;
          const kitchenOn = rule.kitchen.trim().toUpperCase().startsWith("ON");
          const lanes = /half a court|short court/i.test(rule.court);
          const serves = /\btwo serves\b/i.test(rule.serve) ? 2 : 1;
          const name = rule.label.replace(" Ball", "");
          const firstClause = rule.scoring.split(";")[0];
          const kind = /side-?out/i.test(rule.scoring) ? "side-out" : "rally";
          const target = /\bto (\d+)/.exec(firstClause)?.[1];
          const byTwo = /win by 2/i.test(firstClause) ? " by 2" : "";
          const courtWord = /full court/i.test(rule.court) ? "full court" : "half court";
          const chipW = name.length * 8 + 26;
          const rows = [
            `${serves} serve${serves > 1 ? "s" : ""}`,
            rule.serveMiss.replace(/\.$/, ""),
            kitchenOn ? "kitchen ON" : "kitchen OFF",
            `${courtWord} · ${target ? `${kind} to ${target}${byTwo}` : kind}`,
          ];
          return (
            <g key={rule.color}>
              <rect x={ox} y={oy} width={w} height={h} className="c-surf" strokeWidth="1.6" />
              {kitchenOn && <rect x={ox} y={kf} width={w} height={14 * m} className="c-kitch" />}
              <line x1={ox} y1={kf} x2={ox + w} y2={kf} className="c-line" strokeWidth="1"
                    strokeDasharray={kitchenOn ? undefined : "3 4"} opacity={kitchenOn ? 1 : 0.45} />
              <line x1={ox} y1={net + 7 * m} x2={ox + w} y2={net + 7 * m} className="c-line" strokeWidth="1"
                    strokeDasharray={kitchenOn ? undefined : "3 4"} opacity={kitchenOn ? 1 : 0.45} />
              {lanes && (
                <line x1={ox + w / 2} y1={oy} x2={ox + w / 2} y2={oy + h} stroke="#AADC00"
                      strokeWidth="1.4" strokeDasharray="5 4" opacity="0.9" />
              )}
              <line x1={ox - 5} y1={net} x2={ox + w + 5} y2={net} className="c-net" strokeWidth="2.4" />
              <rect x={ox + 40 - chipW / 2} y={20} width={chipW} height={21} rx={10.5} fill={HUE[rule.color]} />
              <text x={ox + 40} y={35} textAnchor="middle" fontSize="12" fontWeight="800"
                    fill={rule.color === "yellow" || rule.color === "green" ? "#0B1424" : "#fff"}>
                {name}
              </text>
              {Array.from({ length: serves }, (_, d) => (
                <circle key={d} cx={ox + 40 + (d - (serves - 1) / 2) * 20} cy={oy + h + 13} r={4.5} fill="#AADC00" />
              ))}
              {rows.map((line, j) => (
                <text key={j} x={ox + 40} y={258 + j * 15} textAnchor="middle"
                      fontSize={j === 0 ? 10 : 9.5} fontWeight="600"
                      className={j === 0 ? "c-inkfill" : "c-mutedfill"}>
                  {line}
                </text>
              ))}
            </g>
          );
        })}
        <text x={300} y={336} textAnchor="middle" fontSize="10" fontWeight="600" className="c-mutedfill">
          shaded band = the kitchen is enforced · lime dots = serves you get
        </text>
      </svg>
      <figcaption className="mt-3 text-xs leading-snug text-ngpa-muted print:text-gray-600 text-center mx-auto max-w-[66ch]">
        Every level plays real pickleball; what changes is how much of the rulebook is switched on. Serves run
        two, two, one, one &mdash; and Red is the one level with no kitchen and no two-bounce at all.
      </figcaption>
    </figure>
  );
}

export default async function FallPlaybookPage() {
  // ONE merge for the whole page. The ball rules render twice (the generated
  // SVG panel and the table below it), and BallRulesPanel derives its drawing
  // by reading the rule prose — so merging per render site would let the
  // picture disagree with the text it is supposed to be a picture of.
  //
  // Fail-soft is the whole contract here: a Notion outage, a slow query or an
  // unset env var all return no overrides, and the page renders the code
  // defaults. /api/cron/curriculum-health carries the loud half.
  const { overrides } = await fetchCurriculumOverrides();
  const c = mergeCurriculum(CURRICULUM_DEFAULTS, overrides);
  const edited = c.editedFieldIds;
  const greenStart = FALL_YOUTH_BLOCKS[0].startTime;
  const yellowStart = FALL_YOUTH_BLOCKS[1].startTime;

  return (
    <main className="min-h-screen bg-ngpa-deep print:bg-white px-4 sm:px-6 lg:px-10 py-12 sm:py-16">
      {/* Diagram theming. Every court part is a class rather than a literal fill
          so this block can flip the courts to paper for printing — a captain
          carries these to a court, and a dark ground prints badly. Scoped to
          this page rather than globals.css: nothing else renders court SVG. */}
      <style dangerouslySetInnerHTML={{ __html: DIAGRAM_CSS }} />
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

        <div className="mt-6 rounded-xl bg-ngpa-panel print:bg-white border border-ngpa-slate/40 print:border-gray-300 p-5 sm:p-6">
          <h2 className="font-heading text-base font-black text-ngpa-white print:text-black mb-1">
            How to read the diagrams
          </h2>
          <p className="text-sm text-ngpa-muted print:text-gray-600 mb-4">
            One encoding, used the same way in every diagram on this page.
          </p>
          <Diagram id="legend" wide />
        </div>

        <div className="mt-6 space-y-6">
          {/* ── 01 · Run of show ────────────────────────────────────────── */}
          <Section
            num={1}
            title="Run of show — every Sunday"
            subtitle="Same order, every week. Both groups run the same arc; only the clock and the dials differ."
          >
            <div className="mb-6">
              <Diagram id="arc" wide />
            </div>
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
              {c.skillStack.map((block) => (
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
                    <Edited on={edited} id={`block.${block.order}.teaches`} />
                  </p>

                  <div className="my-4">
                    <Diagram id={BLOCK_DIAGRAM[block.order]} />
                  </div>

                  <dl className="mt-3 grid gap-2 sm:grid-cols-2 text-sm">
                    <div>
                      <dt className="text-xs font-bold uppercase tracking-wider text-ngpa-muted print:text-gray-600">
                        Setup
                      </dt>
                      <dd className="text-ngpa-white/90 print:text-black leading-snug">
                        {block.setup}
                        <Edited on={edited} id={`block.${block.order}.setup`} />
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs font-bold uppercase tracking-wider text-ngpa-muted print:text-gray-600">
                        Formation
                      </dt>
                      <dd className="text-ngpa-white/90 print:text-black leading-snug">
                        {block.formation}
                        <Edited on={edited} id={`block.${block.order}.formation`} />
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs font-bold uppercase tracking-wider text-ngpa-muted print:text-gray-600">
                        Rotation
                      </dt>
                      <dd className="text-ngpa-white/90 print:text-black leading-snug">
                        {block.rotation}
                        <Edited on={edited} id={`block.${block.order}.rotation`} />
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs font-bold uppercase tracking-wider text-ngpa-muted print:text-gray-600">
                        By level
                      </dt>
                      <dd className="text-ngpa-white/90 print:text-black leading-snug">
                        {block.scaling}
                        <Edited on={edited} id={`block.${block.order}.scaling`} />
                      </dd>
                    </div>
                  </dl>

                  <div className="mt-3">
                    <p className="text-xs font-bold uppercase tracking-wider text-ngpa-lime print:text-black">
                      Cues — say these, in this order
                    </p>
                    <ul className="mt-1 space-y-0.5">
                      {block.cues.map((cue, i) => (
                        <li
                          key={i}
                          className="text-sm text-ngpa-white/90 print:text-black leading-snug"
                        >
                          &ldquo;{cue}&rdquo;
                          <Edited on={edited} id={`block.${block.order}.cue.${i}`} />
                        </li>
                      ))}
                    </ul>
                    <p className="mt-2 text-xs text-ngpa-muted print:text-gray-600">
                      Vocabulary: {block.vocabulary.join(" · ")}
                    </p>
                    <p className="mt-2 text-sm text-ngpa-teal print:text-gray-800">
                      <strong>Captain:</strong> {block.captainCue}
                      <Edited on={edited} id={`block.${block.order}.captainCue`} />
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
            subtitle="Every level plays real pickleball; what changes is how much of the rulebook is switched on. Serves go two, two, one, one — Red and Orange get a second swing because the serve is still a skill being built, and at Red that second one may be taken from anywhere so the rally still starts. Green and Yellow play tournament standard. Red is the one level with no kitchen and no two-bounce at all, which is what makes its full court a real format rather than a leftover."
            breakBefore
          >
            <div className="mb-6">
              <BallRulesPanel rules={c.ballRules} />
            </div>
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
                  {c.ballRules.map((rule) => (
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
                          <Edited on={edited} id={`rule.${rule.color}.typicalAges`} />
                        </span>
                      </td>
                      <td className="py-2 pr-3 text-ngpa-white/90 print:text-black leading-snug">
                        {rule.serve}
                        <Edited on={edited} id={`rule.${rule.color}.serve`} />
                        <span className="block mt-1 text-xs text-ngpa-muted print:text-gray-600">
                          {rule.serveMiss}
                          <Edited on={edited} id={`rule.${rule.color}.serveMiss`} />
                        </span>
                      </td>
                      <td className="py-2 pr-3 text-ngpa-white/90 print:text-black leading-snug">
                        {rule.kitchen}
                        <Edited on={edited} id={`rule.${rule.color}.kitchen`} />
                      </td>
                      <td className="py-2 pr-3 text-ngpa-white/90 print:text-black leading-snug">
                        {rule.twoBounce}
                        <Edited on={edited} id={`rule.${rule.color}.twoBounce`} />
                      </td>
                      <td className="py-2 pr-3 text-ngpa-white/90 print:text-black leading-snug">
                        {rule.court}
                        <Edited on={edited} id={`rule.${rule.color}.court`} />
                      </td>
                      <td className="py-2 text-ngpa-white/90 print:text-black leading-snug">
                        {rule.scoring}
                        <Edited on={edited} id={`rule.${rule.color}.scoring`} />
                        <span className="block mt-1 text-xs text-ngpa-teal print:text-gray-700">
                          Captain watches: {rule.captainWatch}
                          <Edited on={edited} id={`rule.${rule.color}.captainWatch`} />
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
                  <div className="my-4">
                    <Diagram id={GAME_DIAGRAM[game.slug]} />
                  </div>
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
              {c.seasonPlan.map((week) => {
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
                        <Edited on={edited} id={`week.${week.week}.title`} />
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
                      <Edited on={edited} id={`week.${week.week}.coachLooksFor`} />
                    </p>
                    <p className="mt-2 text-xs text-ngpa-muted print:text-gray-600 leading-snug">
                      Word framing: &ldquo;{week.wordFraming}&rdquo;
                      <Edited on={edited} id={`week.${week.week}.wordFraming`} />
                    </p>
                    <p className="mt-1 text-xs text-ngpa-muted print:text-gray-600 leading-snug">
                      Parents hear: &ldquo;{week.parentLine}&rdquo;
                      <Edited on={edited} id={`week.${week.week}.parentLine`} /> · Home rep: {week.homeRep}
                      <Edited on={edited} id={`week.${week.week}.homeRep`} />
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

            <div className="mb-6">
              <Diagram id="two-courts" wide />
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
              {c.captainRunOfShow.map((duty, i) => (
                <li
                  key={duty.phase}
                  className="flex items-start gap-3 py-2 border-b border-ngpa-slate/30 print:border-gray-300 last:border-b-0"
                >
                  <span className="mt-0.5 shrink-0 font-mono text-xs font-bold text-ngpa-teal print:text-black min-w-[7.5rem]">
                    {duty.phase}
                  </span>
                  <span className="text-sm text-ngpa-white/90 print:text-black leading-snug">
                    {duty.duty}
                    <Edited on={edited} id={`captain.duty.${i}`} />
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
                  {c.captainScript.map((line, i) => (
                    <li
                      key={i}
                      className="text-sm text-ngpa-white/90 print:text-black leading-snug"
                    >
                      {line}
                      <Edited on={edited} id={`captain.script.${i}`} />
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="font-heading text-base font-black text-ngpa-orange print:text-black">
                  Never
                </h3>
                <ul className="mt-2 space-y-1.5">
                  {c.captainNever.map((line, i) => (
                    <li
                      key={i}
                      className="text-sm text-ngpa-white/90 print:text-black leading-snug"
                    >
                      {line}
                      <Edited on={edited} id={`captain.never.${i}`} />
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <h3 className="mt-5 font-heading text-base font-black text-ngpa-white print:text-black">
              Your kit, per court
            </h3>
            <ul className="mt-2">
              {c.captainKit.map((item, i) => (
                <li
                  key={i}
                  className="flex items-start gap-3 py-2 border-b border-ngpa-slate/30 print:border-gray-300 last:border-b-0"
                >
                  <input
                    type="checkbox"
                    className="mt-1 h-5 w-5 shrink-0 accent-ngpa-teal"
                  />
                  <span className="text-sm text-ngpa-white/90 print:text-black leading-snug">
                    {item}
                      <Edited on={edited} id={`captain.kit.${i}`} />
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
