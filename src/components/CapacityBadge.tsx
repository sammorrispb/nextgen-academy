interface CapacityBadgeProps {
  spotsFilled: number;
  spotsTotal: number;
}

export default function CapacityBadge({ spotsFilled, spotsTotal }: CapacityBadgeProps) {
  const remaining = Math.max(0, spotsTotal - spotsFilled);
  const ratio = spotsTotal > 0 ? remaining / spotsTotal : 0;

  if (remaining === 0) {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-ngpa-skill-red/15 text-ngpa-skill-red">
        FULL
      </span>
    );
  }

  const colorClass =
    ratio > 0.5
      ? "bg-ngpa-green/15 text-ngpa-green"
      : ratio > 0.25
        ? "bg-ngpa-lime/15 text-ngpa-lime"
        : "bg-ngpa-orange/15 text-ngpa-orange";

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-mono font-bold ${colorClass}`}>
      {spotsFilled}/{spotsTotal} spots
    </span>
  );
}
