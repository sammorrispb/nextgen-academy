"use client";

import { useState } from "react";
import { levels } from "@/data/levels";
import type { LiveLocation, LiveSlot } from "@/types/schedule";
import CapacityBadge from "./CapacityBadge";

interface LiveScheduleCardProps {
  location: LiveLocation;
}

function SlotSection({ slot }: { slot: LiveSlot }) {
  const [expanded, setExpanded] = useState(false);

  // Show the nearest upcoming session as the summary
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = slot.sessions.filter((s) => s.date >= today);
  const nextSession = upcoming[0];

  // Group sessions by date for the expanded view
  const sessionsByDate = new Map<string, typeof slot.sessions>();
  for (const s of upcoming) {
    const existing = sessionsByDate.get(s.date);
    if (existing) {
      existing.push(s);
    } else {
      sessionsByDate.set(s.date, [s]);
    }
  }

  if (upcoming.length === 0) return null;

  return (
    <div>
      {/* Slot header */}
      <div className="font-mono text-sm font-bold text-ngpa-white mb-2">
        {slot.dayOfWeek} &middot; {slot.timeRange}
      </div>

      {/* Level dots */}
      <div className="flex flex-wrap gap-2 mb-3">
        {slot.levels.map((levelKey) => {
          const level = levels.find((l) => l.key === levelKey);
          if (!level) return null;
          return (
            <span key={levelKey} className="inline-flex items-center gap-1.5 text-xs text-ngpa-muted">
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: level.color }}
              />
              {level.label}
            </span>
          );
        })}
      </div>

      {/* Next session summary (always visible) */}
      {nextSession && !expanded && (
        <div className="flex items-center justify-between bg-ngpa-navy/50 rounded-lg px-3 py-2.5 mb-2">
          <a
            href={nextSession.registrationUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm text-ngpa-white hover:text-ngpa-lime transition-colors min-h-[44px]"
          >
            <span className="text-ngpa-muted">Next:</span>
            <span className="font-medium">{nextSession.displayDate}</span>
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: levels.find((l) => l.key === nextSession.level)?.color }}
            />
          </a>
          <CapacityBadge spotsFilled={nextSession.spotsFilled} spotsTotal={nextSession.spotsTotal} />
        </div>
      )}

      {/* Expanded individual sessions */}
      {expanded && (
        <div className="space-y-1 mb-2">
          {[...sessionsByDate.entries()].map(([date, dateSessions]) => (
            <div key={date} className="space-y-1">
              {dateSessions.map((session) => {
                const level = levels.find((l) => l.key === session.level);
                return (
                  <a
                    key={`${session.date}-${session.level}`}
                    href={session.registrationUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between bg-ngpa-navy/50 rounded-lg px-3 py-2.5 hover:bg-ngpa-slate/50 transition-colors min-h-[44px]"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium text-ngpa-white w-24">
                        {session.displayDate}
                      </span>
                      <span className="flex items-center gap-1.5 text-sm">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: level?.color }}
                        />
                        <span style={{ color: level?.color }}>{level?.label}</span>
                      </span>
                    </div>
                    <CapacityBadge spotsFilled={session.spotsFilled} spotsTotal={session.spotsTotal} />
                  </a>
                );
              })}
            </div>
          ))}
        </div>
      )}

      {/* Expand/collapse toggle — hide when only 1 date with same levels as summary */}
      {sessionsByDate.size > 1 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-xs text-ngpa-cyan hover:text-ngpa-lime transition-colors font-medium py-1"
        >
          {expanded ? "Hide dates" : `View all ${sessionsByDate.size} dates`}
        </button>
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
      <p className="text-sm text-ngpa-muted mb-6">
        {location.venue}, {location.address}
      </p>

      <div className="space-y-6">
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
