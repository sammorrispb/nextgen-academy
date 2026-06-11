"use client";

import { useState } from "react";
import type { NgaSession } from "@/lib/notion-sessions";
import { publicLocation } from "@/lib/session-location";
import { sessionToSlug } from "@/lib/session-slug";
import ReserveButton from "./ReserveButton";
import ShareButton from "./ShareButton";
import SessionDetailsModal from "./SessionDetailsModal";
import FillMeter from "./FillMeter";
import { socialProofLine } from "./SessionInfoBlock";
import { LEVEL_COLOR } from "@/lib/level-colors";
import { fillGoal } from "@/lib/fill-meter";

interface Props {
  session: NgaSession;
  siteOrigin: string;
  highlighted?: boolean;
}

export default function SessionCard({
  session,
  siteOrigin,
  highlighted = false,
}: Props) {
  const [detailsOpen, setDetailsOpen] = useState(false);

  const levelClass =
    (session.level && LEVEL_COLOR[session.level]) ??
    "bg-ngpa-slate text-ngpa-white";

  const isEnded =
    session.status === "Completed" || session.status === "Passed";

  const shareUrl = `${siteOrigin}/schedule/${sessionToSlug(session)}`;
  const proof = socialProofLine(session);

  const cardClass = highlighted
    ? "relative bg-ngpa-panel rounded-2xl border-2 border-ngpa-teal p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center gap-4 shadow-[0_0_40px_-12px_rgba(0,180,216,0.55)] ring-1 ring-ngpa-teal/40 transition-colors"
    : "bg-ngpa-panel/80 backdrop-blur-sm rounded-2xl border border-ngpa-slate/60 p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center gap-4 transition-colors hover:border-ngpa-teal/40";

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
          onClick={() => setDetailsOpen(true)}
          className="flex-1 min-w-0 text-left rounded-lg -m-1 p-1 focus:outline-none focus:ring-2 focus:ring-ngpa-teal/60"
          aria-label={`View details for ${session.title} on ${session.date}`}
        >
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            {session.level && (
              <span
                className={`text-xs font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full ${levelClass}`}
              >
                {session.level} Ball
              </span>
            )}
            {session.status === "Cancelled" || isEnded ? (
              <span className="text-xs font-bold text-red-400">
                {session.status === "Cancelled" ? "Cancelled" : "Ended"}
              </span>
            ) : (
              <FillMeter
                registered={session.registeredCount}
                goal={fillGoal(session)}
              />
            )}
            {proof && (
              <span className="text-xs font-bold text-ngpa-teal">
                · {proof}
              </span>
            )}
          </div>
          <p className="text-base font-bold text-ngpa-white">
            <time dateTime={session.date}>
              {session.startTime}
              {session.endTime ? `–${session.endTime}` : ""}
            </time>
            <span className="text-ngpa-white/65 font-normal">
              {" "}
              · {publicLocation(session.location, session.publicArea)}
            </span>
          </p>
          {session.title && (
            <p className="text-sm text-ngpa-white/65 mt-0.5">{session.title}</p>
          )}
          <p className="mt-2 text-xs font-bold text-ngpa-teal inline-flex items-center gap-1">
            View details &amp; map
            <span aria-hidden="true">→</span>
          </p>
        </button>

        <div className="flex items-center gap-2 sm:flex-col sm:items-stretch">
          <ReserveButton session={session} />
          <ShareButton
            url={shareUrl}
            title={`${session.title} · ${session.startTime}`}
            text={`Reserve a $20 drop-in slot at NGA — ${session.title}`}
          />
        </div>
      </div>

      <SessionDetailsModal
        session={session}
        open={detailsOpen}
        onClose={() => setDetailsOpen(false)}
      />
    </>
  );
}
