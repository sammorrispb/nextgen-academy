"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import type { NgaSession } from "@/lib/notion-sessions";
import SessionInfoBlock from "./SessionInfoBlock";
import ReserveButton from "./ReserveButton";

const LEVEL_COLOR: Record<string, string> = {
  Red: "bg-ngpa-skill-red text-white",
  Orange: "bg-ngpa-skill-orange text-white",
  Green: "bg-ngpa-skill-green text-white",
  Yellow: "bg-ngpa-skill-yellow text-ngpa-deep",
};

interface Props {
  session: NgaSession;
  open: boolean;
  onClose: () => void;
}

function formatLongDate(date: string): string {
  if (!date) return "";
  const d = new Date(`${date}T12:00:00Z`);
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

export default function SessionDetailsModal({ session, open, onClose }: Props) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  const levelClass =
    (session.level && LEVEL_COLOR[session.level]) ??
    "bg-ngpa-slate text-ngpa-white";

  return createPortal(
    <div
      className="fixed inset-0 z-40 bg-ngpa-deep/90 backdrop-blur-md overflow-y-auto overscroll-contain"
      role="dialog"
      aria-modal="true"
      aria-labelledby="session-details-title"
      onClick={onClose}
    >
      <div className="min-h-full flex items-end sm:items-center justify-center p-0 sm:p-4">
        <div
          onClick={(e) => e.stopPropagation()}
          className="relative bg-ngpa-panel w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl border border-ngpa-slate/60 shadow-2xl shadow-black/60"
        >
          <div className="flex items-start justify-between p-5 border-b border-ngpa-slate/60">
            <div className="min-w-0 pr-3">
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                {session.level && (
                  <span
                    className={`text-xs font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full ${levelClass}`}
                  >
                    {session.level} Ball
                  </span>
                )}
              </div>
              <h3
                id="session-details-title"
                className="font-heading text-lg font-black text-ngpa-white tracking-tight"
              >
                {session.title || `${session.level ?? ""} Ball`}
              </h3>
              <p className="text-sm text-ngpa-white/70 mt-1">
                {formatLongDate(session.date)} · {session.startTime}
                {session.endTime ? `–${session.endTime}` : ""}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="text-ngpa-white/60 hover:text-ngpa-white text-3xl leading-none -mt-1 shrink-0 min-w-[32px] min-h-[32px] flex items-center justify-center"
              aria-label="Close"
            >
              ×
            </button>
          </div>

          <div className="px-5 py-5">
            <SessionInfoBlock session={session} />
          </div>

          <div className="sticky bottom-0 px-5 py-4 border-t border-ngpa-slate/60 bg-ngpa-panel sm:rounded-b-2xl">
            <ReserveButton session={session} fullWidth />
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
