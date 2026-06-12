import { fillLabel } from "@/lib/fill-meter";

interface Props {
  registered: number;
  goal: number;
  size?: "sm" | "lg";
}

export default function FillMeter({ registered, goal, size = "sm" }: Props) {
  if (goal <= 0) return null;
  const r = Math.min(Math.max(0, registered), goal);
  const nearFull = goal - r <= 3;
  // Narrow segments past 16 so an aggregated meter (e.g. the 4-court Tuesday
  // group) still fits a 375px viewport.
  const seg =
    goal > 16 ? "h-1.5 w-1" : size === "lg" ? "h-2 w-5" : "h-1.5 w-3";

  return (
    <span className="inline-flex items-center gap-2 flex-wrap">
      <span className="inline-flex items-center gap-0.5" aria-hidden="true">
        {Array.from({ length: goal }, (_, i) => (
          <span
            key={i}
            className={`${seg} rounded-full ${i < r ? "bg-ngpa-lime" : "bg-ngpa-slate"}`}
          />
        ))}
      </span>
      <span
        className={`text-xs font-bold ${nearFull ? "text-ngpa-lime" : "text-ngpa-white/80"}`}
      >
        {fillLabel(r, goal)}
      </span>
    </span>
  );
}
