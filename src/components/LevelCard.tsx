import type { Level } from "@/data/levels";

interface LevelCardProps {
  level: Level;
}

export default function LevelCard({ level }: LevelCardProps) {
  const isYellow = level.key === "yellow";

  return (
    <article
      className="group relative bg-ngpa-panel/80 backdrop-blur-sm rounded-2xl p-6 sm:p-7 border border-ngpa-slate/60 shadow-xl shadow-black/20 hover:border-ngpa-teal/50 hover:-translate-y-1 transition-all duration-300 overflow-hidden"
      itemScope
      itemType="https://schema.org/SportsEvent"
      data-age-min={level.ages.replace("+", "")}
      data-age-max="16"
    >
      {/* Color stripe top */}
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-1.5"
        style={{ backgroundColor: level.color }}
      />

      {/* Subtle radial accent bottom-right */}
      <div
        aria-hidden="true"
        className="absolute -bottom-12 -right-12 w-40 h-40 rounded-full opacity-10 group-hover:opacity-20 transition-opacity blur-2xl"
        style={{ backgroundColor: level.color }}
      />

      <div className="relative">
        {/* Header row */}
        <div className="flex items-center justify-between mb-5">
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center ring-2 shadow-lg"
            style={{
              backgroundColor: `${level.color}25`,
              boxShadow: `0 0 24px ${level.color}40`,
              borderColor: level.color,
            }}
          >
            <span
              className="w-6 h-6 rounded-full"
              style={{ backgroundColor: level.color }}
            />
          </div>
          <span
            className="text-xs font-bold px-3 py-1.5 rounded-full"
            style={{
              backgroundColor: level.color,
              color: "#000000",
            }}
          >
            Ages {level.ages}
          </span>
        </div>

        {/* Title */}
        <h3
          className="font-heading text-2xl font-black text-ngpa-white mb-1 tracking-tight"
          itemProp="name"
        >
          {level.label}
        </h3>
        <p
          className="font-medium text-base text-ngpa-white/95 mb-2"
          itemProp="description"
        >
          {level.focus}
        </p>
        <p className="text-sm text-ngpa-white/65 leading-relaxed mb-6">
          {level.detail}
        </p>

        {/* Action */}
        <div className="pt-5 border-t border-ngpa-slate/50">
          {isYellow ? (
            <div className="flex items-center justify-between gap-3">
              <span
                className="text-xs font-bold uppercase tracking-wider"
                style={{ color: level.color }}
              >
                Invite Only
              </span>
              <a
                href="/yellowball/inquiry"
                className="inline-flex items-center gap-1.5 text-sm font-bold transition-colors hover:gap-2"
                style={{ color: level.color }}
              >
                Request an eval
                <span aria-hidden="true">&rarr;</span>
              </a>
            </div>
          ) : (
            <a
              href="#contact-form"
              className="inline-flex items-center gap-1.5 text-sm font-bold text-ngpa-teal hover:text-ngpa-teal-bright transition-colors"
            >
              Get Started
              <span aria-hidden="true" className="transition-transform group-hover:translate-x-1">&rarr;</span>
            </a>
          )}
        </div>
      </div>
    </article>
  );
}
