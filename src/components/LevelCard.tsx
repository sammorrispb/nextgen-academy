import Link from "next/link";
import type { Level } from "@/data/levels";

interface LevelCardProps {
  level: Level;
  variant?: "compact" | "expanded";
}

export default function LevelCard({ level, variant = "compact" }: LevelCardProps) {
  return (
    <div
      className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm"
      style={{ borderLeftWidth: 4, borderLeftColor: level.color }}
    >
      {/* Header */}
      <div className="flex items-center gap-3 mb-3">
        <div
          className="w-3.5 h-3.5 rounded-full shrink-0"
          style={{ backgroundColor: level.color }}
        />
        <span className="font-heading text-lg font-bold text-gray-900">
          {level.label}
        </span>
        <span
          className="ml-auto text-xs font-bold px-2.5 py-1 rounded-md"
          style={{
            backgroundColor: level.bgLight,
            color: level.color,
          }}
        >
          Ages {level.ages} &middot; {level.tag}
        </span>
      </div>

      {/* Focus */}
      <p className="font-medium text-gray-900 mb-1">{level.focus}</p>
      <p className="text-sm text-gray-600 leading-relaxed mb-4">{level.detail}</p>

      {/* Pricing + CTA (expanded only) */}
      {variant === "expanded" && (
        <div className="flex items-center justify-between pt-3 border-t border-gray-100">
          {level.dropIn ? (
            <div className="text-sm font-bold" style={{ color: level.color }}>
              {level.dropIn} &middot; {level.season}
            </div>
          ) : (
            <div className="text-sm font-bold italic" style={{ color: level.color }}>
              Email for pricing
            </div>
          )}
          {level.dropIn ? (
            <Link
              href="/schedule"
              className="text-sm font-bold px-4 py-1.5 rounded-full transition-colors text-white"
              style={{ backgroundColor: level.color }}
            >
              View Schedule
            </Link>
          ) : (
            <a
              href="mailto:nextgenacademypb@gmail.com?subject=Yellow%20Ball%20Inquiry"
              className="text-sm font-bold px-4 py-1.5 rounded-full transition-colors text-white"
              style={{ backgroundColor: level.color }}
            >
              Contact Us
            </a>
          )}
        </div>
      )}
    </div>
  );
}
