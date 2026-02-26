import type { Coach } from "@/data/coaches";

interface CoachCardProps {
  coach: Coach;
}

export default function CoachCard({ coach }: CoachCardProps) {
  return (
    <div className="bg-ngpa-panel rounded-2xl p-6 border border-ngpa-slate shadow-sm">
      <div className="w-24 h-24 rounded-full bg-ngpa-slate flex items-center justify-center mb-4">
        <span className="text-ngpa-lime font-heading font-bold text-2xl">
          {coach.name.split(" ").map(w => w[0]).join("")}
        </span>
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
