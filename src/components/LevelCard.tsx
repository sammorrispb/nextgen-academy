import type { Level } from "@/data/levels";

interface LevelCardProps {
  level: Level;
}

export default function LevelCard({ level }: LevelCardProps) {
  const isYellow = level.key === "yellow";

  return (
    <article
      className="bg-ngpa-panel rounded-xl p-6 border border-ngpa-slate shadow-sm"
      style={{ borderLeftWidth: 4, borderLeftColor: level.color }}
      itemScope
      itemType="https://schema.org/SportsEvent"
      data-age-min={level.ages.replace("+", "")}
      data-age-max="16"
    >
      {/* Header */}
      <div className="flex items-center gap-3 mb-3">
        <div
          className="w-3.5 h-3.5 rounded-full shrink-0"
          style={{ backgroundColor: level.color }}
        />
        <span className="font-heading text-lg font-bold text-ngpa-white" itemProp="name">
          {level.label}
        </span>
        <span
          className="ml-auto text-xs font-bold px-2.5 py-1 rounded-md"
          style={{
            backgroundColor: level.color,
            color: '#000000',
          }}
        >
          Ages {level.ages}
        </span>
      </div>

      {/* Focus */}
      <p className="font-medium text-ngpa-white mb-1">{level.focus}</p>
      <p className="text-sm text-ngpa-muted leading-relaxed mb-4">{level.detail}</p>

      {/* Action */}
      <div className="pt-3 border-t border-ngpa-slate">
        {isYellow ? (
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-ngpa-skill-yellow italic">
              Invite Only
            </span>
            <a
              href="mailto:nextgenacademypb@gmail.com?subject=Yellow%20Ball%20Inquiry"
              className="text-sm font-bold transition-colors"
              style={{ color: level.color }}
            >
              Inquire &rarr;
            </a>
          </div>
        ) : (
          <a
            href="#contact-form"
            className="text-sm font-bold transition-colors"
            style={{ color: level.color }}
          >
            Get Started &rarr;
          </a>
        )}
      </div>
    </article>
  );
}
