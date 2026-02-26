import type { Coach } from "@/data/coaches";

interface CoachCardProps {
  coach: Coach;
}

export default function CoachCard({ coach }: CoachCardProps) {
  return (
    <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
      {/* Photo placeholder (colored initials) */}
      <div
        className="w-20 h-20 rounded-full flex items-center justify-center text-white font-heading text-2xl font-bold mb-4"
        style={{ backgroundColor: coach.initialsBg }}
      >
        {coach.initials}
      </div>

      <h3 className="font-heading text-xl font-bold text-gray-900">
        {coach.name}
      </h3>
      <p className="text-sm text-gray-500 font-medium mb-3">{coach.role}</p>

      <p className="text-sm text-gray-600 leading-relaxed mb-4">{coach.bio}</p>

      <ul className="space-y-1.5">
        {coach.highlights.map((h, i) => (
          <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
            <span className="text-ball-red mt-0.5 shrink-0">&#10003;</span>
            {h}
          </li>
        ))}
      </ul>
    </div>
  );
}
