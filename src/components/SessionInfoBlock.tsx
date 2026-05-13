import type { NgaSession } from "@/lib/notion-sessions";

interface Props {
  session: NgaSession;
}

export default function SessionInfoBlock({ session }: Props) {
  const query = encodeURIComponent(session.location);
  const embedSrc = `https://maps.google.com/maps?q=${query}&t=&z=15&ie=UTF8&iwloc=&output=embed`;
  const directionsHref = `https://www.google.com/maps/dir/?api=1&destination=${query}`;

  const seatsText =
    session.status === "Cancelled"
      ? "Cancelled"
      : session.spotsLeft === 0
        ? "Full"
        : `${session.spotsLeft} of ${session.capacity} spots left`;

  const seatsClass =
    session.status === "Cancelled" || session.spotsLeft === 0
      ? "text-red-400"
      : session.spotsLeft <= 2
        ? "text-ngpa-skill-orange"
        : "text-ngpa-white";

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-ngpa-teal mb-1">
          Availability
        </p>
        <p className={`text-base font-bold ${seatsClass}`}>{seatsText}</p>
        <p className="text-xs text-ngpa-white/55 mt-1">
          Each pickleball court is capped at 4 players. Courts × 4 = total
          spots.
        </p>
      </div>

      <div>
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-ngpa-teal mb-2">
          How the hour runs
        </p>
        <ol className="space-y-2 text-sm text-ngpa-white/85 leading-relaxed">
          <li className="flex gap-3">
            <span
              className="shrink-0 inline-flex items-center justify-center w-6 h-6 rounded-full bg-ngpa-teal/15 text-ngpa-teal text-xs font-bold"
              aria-hidden="true"
            >
              1
            </span>
            <span>
              <strong className="text-ngpa-white">On arrival</strong> — coaches
              split kids into courts by age and skill so every group plays at
              the right level.
            </span>
          </li>
          <li className="flex gap-3">
            <span
              className="shrink-0 inline-flex items-center justify-center w-6 h-6 rounded-full bg-ngpa-teal/15 text-ngpa-teal text-xs font-bold"
              aria-hidden="true"
            >
              2
            </span>
            <span>
              <strong className="text-ngpa-white">First 30 minutes</strong> —
              skills development: dinks, drives, drops, serves and resets, with
              live feedback.
            </span>
          </li>
          <li className="flex gap-3">
            <span
              className="shrink-0 inline-flex items-center justify-center w-6 h-6 rounded-full bg-ngpa-teal/15 text-ngpa-teal text-xs font-bold"
              aria-hidden="true"
            >
              3
            </span>
            <span>
              <strong className="text-ngpa-white">Second 30 minutes</strong> —
              strategy and gameplay: rotation drills and short games so the
              skills click under pressure.
            </span>
          </li>
        </ol>
      </div>

      <div>
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-ngpa-teal mb-2">
          Location
        </p>
        <p className="text-sm text-ngpa-white/85 mb-3">{session.location}</p>
        <div className="rounded-xl overflow-hidden border border-ngpa-slate/60 bg-ngpa-deep">
          <iframe
            src={embedSrc}
            title={`Map of ${session.location}`}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            className="w-full h-56 sm:h-64 block"
          />
        </div>
        <a
          href={directionsHref}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex items-center gap-2 text-sm font-bold text-ngpa-teal hover:text-ngpa-teal-bright transition-colors min-h-[44px]"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
            />
          </svg>
          Open in Google Maps for directions
          <span aria-hidden="true">→</span>
        </a>
      </div>
    </div>
  );
}
