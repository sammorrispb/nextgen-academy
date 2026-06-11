"use client";

import { useId, useState } from "react";
import type { NgaSession } from "@/lib/notion-sessions";
import { publicLocation } from "@/lib/session-location";
import { LEVEL_COLOR, LEVEL_COLOR_FALLBACK } from "@/lib/level-colors";
import { aggregateSeats } from "@/lib/schedule-grouping";
import { fillGoal } from "@/lib/fill-meter";
import FillMeter from "./FillMeter";
import ReserveButton from "./ReserveButton";
import SessionDetailsModal from "./SessionDetailsModal";

interface Props {
  sessions: NgaSession[];
  highlighted?: boolean;
}

function rowEndedText(s: NgaSession): string | null {
  if (s.status === "Cancelled") return "Cancelled";
  if (s.status === "Completed" || s.status === "Passed") return "Ended";
  return null;
}

export default function SessionGroupCard({
  sessions,
  highlighted = false,
}: Props) {
  const [open, setOpen] = useState(highlighted);
  const [detailsSession, setDetailsSession] = useState<NgaSession | null>(null);
  const panelId = useId();

  const first = sessions[0];
  const { registered, goal } = aggregateSeats(sessions);

  const cardClass = highlighted
    ? "relative bg-ngpa-panel rounded-2xl border-2 border-ngpa-teal shadow-[0_0_40px_-12px_rgba(0,180,216,0.55)] ring-1 ring-ngpa-teal/40 transition-colors"
    : `bg-ngpa-panel/80 backdrop-blur-sm rounded-2xl border transition-colors ${
        open ? "border-ngpa-teal/60" : "border-ngpa-slate/60 hover:border-ngpa-teal/40"
      }`;

  return (
    <>
      {highlighted && (
        <div className="flex items-center gap-2 mb-2 ml-1">
          <span className="inline-flex items-center gap-1.5 bg-ngpa-teal text-ngpa-deep text-[10px] font-black uppercase tracking-[0.18em] px-2.5 py-1 rounded-full shadow-md">
            <span
              className="w-1.5 h-1.5 rounded-full bg-ngpa-deep animate-pulse"
              aria-hidden="true"
            />
            Next Up
          </span>
        </div>
      )}
      <div className={cardClass} data-highlighted={highlighted || undefined}>
        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          aria-controls={panelId}
          className="w-full flex items-center justify-between gap-4 text-left p-5 sm:p-6 min-h-[48px] rounded-2xl focus:outline-none focus:ring-2 focus:ring-ngpa-teal/60"
        >
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              {sessions.map((s) => (
                <span
                  key={s.id}
                  className={`text-xs font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full ${
                    (s.level && LEVEL_COLOR[s.level]) ?? LEVEL_COLOR_FALLBACK
                  }`}
                >
                  {s.level ?? "All"}
                </span>
              ))}
              <FillMeter registered={registered} goal={goal} />
            </div>
            <p className="text-base font-bold text-ngpa-white">
              <time dateTime={first.date}>
                {first.startTime}
                {first.endTime ? `–${first.endTime}` : ""}
              </time>
              <span className="text-ngpa-white/65 font-normal">
                {" "}
                · {publicLocation(first.location, first.publicArea)}
              </span>
            </p>
            <p className="mt-2 text-xs font-bold text-ngpa-teal">
              {sessions.length} levels · pick your color
            </p>
          </div>
          <span
            className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center transition-colors ${
              open ? "bg-ngpa-teal text-ngpa-deep" : "bg-ngpa-slate/60 text-ngpa-teal"
            }`}
            aria-hidden="true"
          >
            <svg
              className={`w-4 h-4 transition-transform ${open ? "rotate-180" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </span>
        </button>

        <div
          id={panelId}
          role="region"
          className={`grid transition-[grid-template-rows] duration-300 ease-in-out ${
            open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
          }`}
        >
          <div className="overflow-hidden">
            <ul className="px-5 sm:px-6 pb-5 sm:pb-6 space-y-3">
              {sessions.map((s) => (
                <li
                  key={s.id}
                  className="flex flex-wrap items-center gap-3 rounded-xl bg-ngpa-deep/40 border border-ngpa-slate/40 p-3 min-h-[48px]"
                >
                  <span
                    className={`text-xs font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full ${
                      (s.level && LEVEL_COLOR[s.level]) ?? LEVEL_COLOR_FALLBACK
                    }`}
                  >
                    {s.level ? `${s.level} Ball` : "All levels"}
                  </span>
                  {rowEndedText(s) ? (
                    <span className="text-xs font-bold text-red-400">
                      {rowEndedText(s)}
                    </span>
                  ) : (
                    <FillMeter
                      registered={s.registeredCount}
                      goal={fillGoal(s)}
                    />
                  )}
                  <button
                    type="button"
                    onClick={() => setDetailsSession(s)}
                    className="text-xs font-bold text-ngpa-teal hover:text-ngpa-teal-bright transition-colors min-h-[48px] px-1"
                  >
                    Details →
                  </button>
                  <div className="ml-auto">
                    <ReserveButton session={s} />
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <SessionDetailsModal
        session={detailsSession ?? first}
        open={detailsSession !== null}
        onClose={() => setDetailsSession(null)}
      />
    </>
  );
}
