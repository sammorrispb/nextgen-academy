import type { Coach } from "@/data/coaches";

interface CoachCardProps {
  coach: Coach;
}

export default function CoachCard({ coach }: CoachCardProps) {
  return (
    <div className="bg-ngpa-panel rounded-2xl p-6 border border-ngpa-slate shadow-sm">
      {/* Photo placeholder (colored initials) */}
      <div
        className="w-20 h-20 rounded-full flex items-center justify-center text-ngpa-white font-heading text-2xl font-bold mb-4"
        style={{ backgroundColor: coach.initialsBg }}
      >
        {coach.initials}
      </div>

      <h3 className="font-heading text-xl font-bold text-ngpa-white">
        {coach.name}
      </h3>
      <p className="text-sm text-ngpa-lime font-medium mb-3">{coach.role}</p>

      <p className="text-sm text-ngpa-muted leading-relaxed mb-4">{coach.bio}</p>

      <ul className="space-y-1.5">
        {coach.highlights.map((h, i) => (
          <li key={i} className="flex items-start gap-2 text-sm text-ngpa-muted">
            <span className="text-ngpa-lime mt-0.5 shrink-0">&#10003;</span>
            {h}
          </li>
        ))}
      </ul>
    </div>
  );
}
