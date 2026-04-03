"use client";

import { useState } from "react";
import type { LiveLocation, LiveSlot } from "@/types/schedule";

interface LiveScheduleCardProps {
  location: LiveLocation;
}

function SlotSection({ slot }: { slot: LiveSlot }) {
  const [expanded, setExpanded] = useState(false);

  const today = new Date().toISOString().slice(0, 10);
  const upcoming = slot.sessions.filter((s) => s.date >= today);
  if (upcoming.length === 0) return null;

  const nextSession = upcoming[0];

  // Deduplicate dates for the expanded view
  const uniqueDates = [...new Map(upcoming.map((s) => [s.date, s])).values()];

  return (
    <div className="bg-ngpa-navy/50 rounded-xl p-4">
      {/* Day + register */}
      <div className="flex items-center justify-between mb-1">
        <h4 className="font-heading text-base font-bold text-ngpa-white">
          {slot.dayOfWeek}s
        </h4>
        <a
          href={nextSession.registrationUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center px-4 py-1.5 bg-ngpa-lime text-ngpa-black text-xs font-bold rounded-full hover:bg-ngpa-cyan transition-colors min-h-[36px]"
        >
          Register
        </a>
      </div>

      {/* Next date */}
      <p className="text-sm text-ngpa-muted">
        Next session: <span className="text-ngpa-white">{nextSession.displayDate}</span>
      </p>

      {/* Show more dates */}
      {uniqueDates.length > 1 && (
        <>
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-xs text-ngpa-cyan hover:text-ngpa-lime transition-colors font-medium mt-2"
          >
            {expanded ? "Hide dates" : `+${uniqueDates.length - 1} more date${uniqueDates.length - 1 > 1 ? "s" : ""}`}
          </button>
          {expanded && (
            <div className="mt-2 flex flex-wrap gap-2">
              {uniqueDates.slice(1).map((s) => (
                <a
                  key={s.date}
                  href={s.registrationUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-ngpa-muted hover:text-ngpa-lime transition-colors bg-ngpa-slate/50 px-2.5 py-1 rounded-md"
                >
                  {s.displayDate}
                </a>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function LiveScheduleCard({ location }: LiveScheduleCardProps) {
  return (
    <div className="bg-ngpa-panel rounded-2xl p-6 border border-ngpa-slate shadow-sm">
      <h3 className="font-heading text-xl font-bold text-ngpa-white mb-1">
        {location.location}
      </h3>
      <p className="text-sm text-ngpa-muted mb-5">
        {location.venue}, {location.address}
      </p>

      <div className="space-y-3">
        {location.slots.map((slot) => (
          <SlotSection key={`${slot.dayOfWeek}-${slot.timeRange}`} slot={slot} />
        ))}

        {location.slots.length === 0 && (
          <p className="text-sm text-ngpa-muted">No upcoming sessions at this location.</p>
        )}
      </div>
    </div>
  );
}
