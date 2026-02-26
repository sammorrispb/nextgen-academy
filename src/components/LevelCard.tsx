import Link from "next/link";
import type { Level } from "@/data/levels";

interface LevelCardProps {
  level: Level;
  variant?: "compact" | "expanded";
}

export default function LevelCard({ level, variant = "compact" }: LevelCardProps) {
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
          Ages {level.ages} &middot; {level.tag}
        </span>
      </div>

      {/* Focus */}
      <p className="font-medium text-ngpa-white mb-1">{level.focus}</p>
      <p className="text-sm text-ngpa-muted leading-relaxed mb-4">{level.detail}</p>

      {/* Pricing + CTA (expanded only) */}
      {variant === "expanded" && (
        <div className="flex items-center justify-between pt-3 border-t border-ngpa-slate">
          {level.dropIn ? (
            <div className="text-sm font-bold text-ngpa-lime font-mono">
              <span itemProp="price" content={level.dropIn?.replace(/[^0-9]/g, "") ?? ""}>{level.dropIn}</span> &middot; {level.season}
            </div>
          ) : (
            <div className="text-sm font-bold italic text-ngpa-lime font-mono">
              Email for pricing
            </div>
          )}
          {level.dropIn ? (
            <Link
              href="/schedule"
              className="text-sm font-bold px-4 py-1.5 rounded-full transition-colors bg-ngpa-lime text-ngpa-black hover:bg-ngpa-cyan"
            >
              View Schedule
            </Link>
          ) : (
            <a
              href="mailto:nextgenacademypb@gmail.com?subject=Yellow%20Ball%20Inquiry"
              className="text-sm font-bold px-4 py-1.5 rounded-full transition-colors bg-ngpa-lime text-ngpa-black hover:bg-ngpa-cyan"
            >
              Contact Us
            </a>
          )}
        </div>
      )}
    </article>
  );
}
