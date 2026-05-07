import Image from "next/image";
import type { Coach } from "@/data/coaches";

interface CoachCardProps {
  coach: Coach;
}

export default function CoachCard({ coach }: CoachCardProps) {
  return (
    <article className="group relative bg-ngpa-panel/80 backdrop-blur-sm rounded-2xl overflow-hidden border border-ngpa-slate/60 hover:border-ngpa-teal/50 transition-all duration-300">
      {/* Photo header — full bleed */}
      {coach.photo ? (
        <div className="relative aspect-[4/3] w-full overflow-hidden bg-ngpa-deep">
          <Image
            src={coach.photo}
            alt={`Coach ${coach.name}`}
            fill
            sizes="(max-width: 768px) 100vw, 50vw"
            className="object-cover object-top group-hover:scale-105 transition-transform duration-500"
          />
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-gradient-to-t from-ngpa-panel via-ngpa-panel/30 to-transparent"
          />
        </div>
      ) : (
        <div className="relative aspect-[4/3] w-full overflow-hidden bg-gradient-to-br from-ngpa-slate to-ngpa-deep flex items-center justify-center">
          <span className="text-ngpa-teal font-heading font-black text-6xl tracking-tighter">
            {coach.name
              .split(" ")
              .map((w) => w[0])
              .join("")}
          </span>
        </div>
      )}

      <div className="p-6 sm:p-7">
        <h3 className="font-heading text-2xl font-black text-ngpa-white tracking-tight">
          {coach.name}
        </h3>
        <p className="text-sm text-ngpa-teal font-bold uppercase tracking-wider mt-1 mb-4">
          {coach.role}
        </p>

        <p className="text-sm text-ngpa-white/75 leading-relaxed mb-5">
          {coach.bio}
        </p>

        <ul className="space-y-2">
          {coach.highlights.map((h, i) => (
            <li
              key={i}
              className="flex items-start gap-2.5 text-sm text-ngpa-white/85"
            >
              <svg
                className="w-4 h-4 text-ngpa-teal mt-0.5 shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={3}
                aria-hidden="true"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              {h}
            </li>
          ))}
        </ul>
      </div>
    </article>
  );
}
