import Image from "next/image";
import { coaches } from "@/data/coaches";

export default function CoachStrip() {
  return (
    <section
      aria-labelledby="coach-strip-heading"
      className="relative bg-ngpa-navy py-12 sm:py-16 px-4 sm:px-6 lg:px-10 border-t border-ngpa-slate/40"
    >
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-8 sm:mb-10">
          <p className="font-heading text-xs font-bold text-ngpa-teal uppercase tracking-[0.2em] mb-3">
            Your coaches
          </p>
          <h2
            id="coach-strip-heading"
            className="font-heading text-2xl sm:text-3xl font-black text-ngpa-white tracking-tight"
          >
            Two dads who actually coach the sessions.
          </h2>
        </div>

        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 max-w-4xl mx-auto">
          {coaches.map((coach) => (
            <li
              key={coach.name}
              className="flex items-center gap-4 rounded-2xl bg-ngpa-panel/80 backdrop-blur-sm border border-ngpa-slate/60 p-4 sm:p-5"
            >
              <div className="relative w-20 h-20 sm:w-24 sm:h-24 shrink-0 rounded-full overflow-hidden bg-ngpa-deep ring-2 ring-ngpa-teal/30">
                {coach.photo ? (
                  <Image
                    src={coach.photo}
                    alt={`Coach ${coach.name}`}
                    fill
                    sizes="(max-width: 640px) 80px, 96px"
                    className="object-cover object-top"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-ngpa-slate to-ngpa-deep">
                    <span
                      className="text-ngpa-teal font-heading font-black text-2xl"
                      aria-hidden="true"
                    >
                      {coach.initials}
                    </span>
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <h3 className="font-heading text-lg sm:text-xl font-black text-ngpa-white tracking-tight truncate">
                  {coach.name}
                </h3>
                <p className="text-xs sm:text-sm text-ngpa-teal font-bold uppercase tracking-wider mt-0.5">
                  {coach.role}
                </p>
                <p className="text-sm text-ngpa-white/75 mt-2 leading-snug">
                  {coach.tagline}
                </p>
              </div>
            </li>
          ))}
        </ul>

        <p className="text-center text-sm text-ngpa-white/65 mt-8 max-w-2xl mx-auto">
          <span className="font-bold text-ngpa-white">
            Built by parents, for parents.
          </span>{" "}
          When you book a session, the coach on court is one of us &mdash; not a
          rotating roster.
        </p>
      </div>
    </section>
  );
}
