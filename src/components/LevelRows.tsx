import Link from "next/link";
import { levels, type BallColor } from "@/data/levels";

// Static class names so Tailwind keeps them.
const DOT: Record<BallColor, string> = {
  red: "bg-ngpa-skill-red",
  orange: "bg-ngpa-skill-orange",
  green: "bg-ngpa-skill-green",
  yellow: "bg-ngpa-skill-yellow",
};

/**
 * The four ball colors as the way in: one short row each, the whole row a
 * link to the levels page, which holds the detail the home page used to
 * repeat. No evaluation link here on purpose. The hero owns that ask.
 */
export default function LevelRows() {
  return (
    <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
      {levels.map((level) => (
        <li key={level.key}>
          <Link
            href="/levels"
            className="flex min-h-12 items-center gap-4 rounded-2xl border border-ngpa-slate/60 bg-ngpa-panel/80 p-4 sm:p-5 transition-colors hover:border-ngpa-teal/60 hover:bg-ngpa-panel focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ngpa-teal"
          >
            <span aria-hidden="true" className={`h-10 w-10 shrink-0 rounded-full ${DOT[level.key]}`} />
            <span className="min-w-0">
              <span className="flex flex-wrap items-baseline gap-x-3">
                <span className="font-heading text-lg font-black text-ngpa-white tracking-tight">
                  {level.label}
                </span>
                <span className="font-mono text-xs font-bold text-ngpa-teal">Ages {level.ages}</span>
              </span>
              <span className="mt-1 block text-sm leading-snug text-ngpa-white/70">{level.focus}</span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
