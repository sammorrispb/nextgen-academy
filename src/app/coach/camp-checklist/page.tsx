import type { Metadata } from "next";
import { LEVEL_COLOR } from "@/lib/level-colors";
import { CAMP_OPTIONS, CAMP_AGE_MIN, CAMP_AGE_MAX } from "@/data/camps";
import PrintButton from "./PrintButton";

// Internal coach ops tool — not a marketing page. Kept out of search and not
// linked from public nav. NOTE: the camp's exact venue is child-safety
// restricted (see src/data/camps.ts), so it is deliberately absent here — this
// URL is publicly reachable.
export const metadata: Metadata = {
  title: "Camp Coach Checklist · NGA",
  description: "Daily supply and setup checklist for Next Gen camp coaches.",
  robots: { index: false, follow: false },
};

const LEVELS = ["Red", "Orange", "Green", "Yellow"] as const;

// Camp hours are identical across both SKUs (day / week) — read from the single
// source of truth so this copy can never drift from the registration flow.
const CAMP_HOURS = CAMP_OPTIONS[0].hours;

interface Item {
  label: string;
  /** Optional note rendered muted after the label. */
  note?: string;
}

const EQUIPMENT: Item[] = [
  { label: "Portable nets", note: "one per court" },
  { label: "Ball caddies / hoppers" },
  { label: "Loaner paddles", note: "a few spare sizes" },
  { label: "Cones & target markers" },
  { label: "Court tape / temporary lines" },
  { label: "Scoreboard or whiteboard + dry-erase markers" },
  { label: "Pop-up shade canopy + weights/stakes" },
  { label: "Water cooler + cups", note: "ice the morning of" },
  { label: "First-aid kit", note: "check it's stocked before each week" },
  { label: "Sunscreen" },
  { label: "Trash bags" },
  { label: "Wagon / cart", note: "the haul-everything kit" },
  { label: "Printed roster", note: "one copy per day" },
  { label: "Printed daily lesson plans" },
  { label: "Attendance clipboard + pen" },
];

const SETUP: Item[] = [
  { label: "Unload the wagon at the courts" },
  { label: "Set up nets — one per court" },
  { label: "Raise + anchor the shade canopy" },
  { label: "Fill and ice the water cooler, set out cups" },
  { label: "Stage caddies + loaner paddles courtside" },
  { label: "Lay out cones / targets for the first block" },
  { label: "Post the roster and the day's lesson plan" },
  { label: "Quick first-aid kit check" },
];

const DURING: Item[] = [
  { label: "Scheduled water breaks in the shade" },
  { label: "Headcount against the printed roster" },
  {
    label: "No early hand-off without a parent",
    note: "$25 admin fee for early drop-off / late pick-up",
  },
];

const TEARDOWN: Item[] = [
  { label: "Collect all balls back into caddies" },
  { label: "Break down and stow the nets" },
  { label: "Drop and pack the shade canopy" },
  { label: "Empty + dry the water cooler" },
  { label: "Final headcount-out against the roster" },
  { label: "Trash sweep of the court area" },
  { label: "Reload the wagon" },
];

const END_OF_WEEK: Item[] = [
  { label: "Restock consumables", note: "cups, sunscreen, first-aid, tape" },
  { label: "Flag any damaged or worn gear for replacement" },
  { label: "Collect and return all loaner paddles" },
  { label: "Archive signed rosters / attendance sheets" },
];

function CheckRow({ item }: { item: Item }) {
  return (
    <li className="flex items-start gap-3 py-2 border-b border-ngpa-slate/30 print:border-gray-300 last:border-b-0">
      <input
        type="checkbox"
        className="mt-1 h-5 w-5 shrink-0 accent-ngpa-teal"
      />
      <span className="text-base text-ngpa-white/90 print:text-black leading-snug">
        {item.label}
        {item.note && (
          <span className="text-ngpa-muted print:text-gray-600">
            {" "}
            — {item.note}
          </span>
        )}
      </span>
    </li>
  );
}

function Section({
  num,
  title,
  subtitle,
  items,
  children,
}: {
  num: number;
  title: string;
  subtitle?: string;
  items?: Item[];
  children?: React.ReactNode;
}) {
  return (
    <section className="checklist-group rounded-xl bg-ngpa-panel print:bg-white border border-ngpa-slate/40 print:border-gray-300 p-5 sm:p-6">
      <div className="flex items-baseline gap-3 mb-1">
        <span className="font-mono text-sm font-bold text-ngpa-teal print:text-black">
          {String(num).padStart(2, "0")}
        </span>
        <h2 className="font-heading text-xl sm:text-2xl font-black text-ngpa-white print:text-black tracking-tight">
          {title}
        </h2>
      </div>
      {subtitle && (
        <p className="text-sm text-ngpa-muted print:text-gray-600 mb-4 ml-8">
          {subtitle}
        </p>
      )}
      {children}
      {items && (
        <ul className="mt-2">
          {items.map((item) => (
            <CheckRow key={item.label} item={item} />
          ))}
        </ul>
      )}
    </section>
  );
}

export default function CampChecklistPage() {
  return (
    <main className="min-h-screen bg-ngpa-deep print:bg-white px-4 sm:px-6 lg:px-10 py-12 sm:py-16">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-start justify-between gap-4 mb-2">
          <p className="text-xs font-bold tracking-[0.2em] uppercase text-ngpa-teal print:text-black">
            Coach Operations
          </p>
          <PrintButton />
        </div>
        <h1 className="font-heading text-3xl sm:text-4xl font-black text-ngpa-white print:text-black tracking-tight">
          Camp supply &amp; daily checklist
        </h1>
        <p className="mt-3 text-base text-ngpa-white/70 print:text-gray-700 leading-relaxed">
          Coach-facing run-of-show for a Mon–Thu camp morning. Ages{" "}
          {CAMP_AGE_MIN}–{CAMP_AGE_MAX}, {CAMP_HOURS}, a court per level (capped
          at 4 players each), rain or shine. Load the wagon once at the start of
          the week, then run the daily lists each morning.
        </p>

        {/* Balls per level — a court per level, so pack all four. */}
        <section className="checklist-group mt-8 rounded-xl bg-ngpa-panel print:bg-white border border-ngpa-slate/40 print:border-gray-300 p-5 sm:p-6">
          <div className="flex items-baseline gap-3 mb-4">
            <span className="font-mono text-sm font-bold text-ngpa-teal print:text-black">
              01
            </span>
            <h2 className="font-heading text-xl sm:text-2xl font-black text-ngpa-white print:text-black tracking-tight">
              Balls — one bag per level
            </h2>
          </div>
          <ul>
            {LEVELS.map((level) => (
              <li
                key={level}
                className="flex items-center gap-3 py-2 border-b border-ngpa-slate/30 print:border-gray-300 last:border-b-0"
              >
                <input
                  type="checkbox"
                  className="h-5 w-5 shrink-0 accent-ngpa-teal"
                />
                <span
                  className={`inline-flex items-center justify-center min-w-[72px] px-3 py-1 rounded-full text-sm font-bold ${LEVEL_COLOR[level]}`}
                >
                  {level}
                </span>
                <span className="text-base text-ngpa-white/90 print:text-black">
                  Ball bag
                </span>
              </li>
            ))}
          </ul>
        </section>

        <div className="mt-6 space-y-6">
          <Section
            num={2}
            title="Weekly master equipment"
            subtitle="Load into the wagon once — store between days."
            items={EQUIPMENT}
          />
          <Section
            num={3}
            title="Daily setup"
            subtitle="Arrive ~30 minutes before drop-off."
            items={SETUP}
          />
          <Section num={4} title="During the session" items={DURING} />
          <Section
            num={5}
            title="Daily teardown / pack-down"
            items={TEARDOWN}
          />
          <Section num={6} title="End of week" items={END_OF_WEEK} />
        </div>
      </div>
    </main>
  );
}
