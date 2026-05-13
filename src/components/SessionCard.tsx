"use client";

import { useState } from "react";
import type { NgaSession } from "@/lib/notion-sessions";
import { sessionToSlug } from "@/lib/session-slug";
import ReserveButton from "./ReserveButton";
import ShareButton from "./ShareButton";
import SessionDetailsModal from "./SessionDetailsModal";

const LEVEL_COLOR: Record<string, string> = {
  Red: "bg-ngpa-skill-red text-white",
  Orange: "bg-ngpa-skill-orange text-white",
  Green: "bg-ngpa-skill-green text-white",
  Yellow: "bg-ngpa-skill-yellow text-ngpa-deep",
};

interface Props {
  session: NgaSession;
  siteOrigin: string;
}

export default function SessionCard({ session, siteOrigin }: Props) {
  const [detailsOpen, setDetailsOpen] = useState(false);

  const levelClass =
    (session.level && LEVEL_COLOR[session.level]) ??
    "bg-ngpa-slate text-ngpa-white";

  const seatsText =
    session.status === "Cancelled"
      ? "Cancelled"
      : session.spotsLeft === 0
        ? "Full"
        : `${session.spotsLeft} / ${session.capacity} seats left`;

  const seatsClass =
    session.status === "Cancelled" || session.spotsLeft === 0
      ? "text-red-400"
      : session.spotsLeft <= 2
        ? "text-ngpa-skill-orange"
        : "text-ngpa-white/65";

  const shareUrl = `${siteOrigin}/schedule/${sessionToSlug(session)}`;

  return (
    <>
      <div className="bg-ngpa-panel/80 backdrop-blur-sm rounded-2xl border border-ngpa-slate/60 p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center gap-4 transition-colors hover:border-ngpa-teal/40">
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
            <span className={`text-xs font-bold ${seatsClass}`}>
              {seatsText}
            </span>
          </div>
          <p className="text-base font-bold text-ngpa-white">
            <time dateTime={session.date}>
              {session.startTime}
              {session.endTime ? `–${session.endTime}` : ""}
            </time>
            <span className="text-ngpa-white/65 font-normal">
              {" "}
              · {session.location}
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
            text={`Reserve a $40 drop-in slot at NGA — ${session.title}`}
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
