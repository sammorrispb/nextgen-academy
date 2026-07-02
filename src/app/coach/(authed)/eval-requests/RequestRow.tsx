"use client";

import { useState, useTransition } from "react";
import type { RequestedEvalSlot } from "@/lib/notion-eval-slots";
import {
  confirmEvalRequestAction,
  releaseEvalRequestAction,
} from "./actions";

type RowState =
  | { phase: "idle" }
  | { phase: "working"; action: "confirm" | "release" }
  | { phase: "done"; ok: boolean; message: string };

export default function RequestRow({
  slot,
  dateLabel,
}: {
  slot: RequestedEvalSlot;
  /** Preformatted long date (server-side formatLongDate — UTC-anchored). */
  dateLabel: string;
}) {
  const [state, setState] = useState<RowState>({ phase: "idle" });
  const [isPending, startTransition] = useTransition();

  function run(action: "confirm" | "release") {
    if (
      action === "release" &&
      !window.confirm(
        "Reopen this slot? No email is sent — reach out to the family yourself to reschedule.",
      )
    ) {
      return;
    }
    setState({ phase: "working", action });
    startTransition(async () => {
      const fn =
        action === "confirm" ? confirmEvalRequestAction : releaseEvalRequestAction;
      const result = await fn(slot.id, slot.bookingId);
      setState({ phase: "done", ok: result.ok, message: result.message });
    });
  }

  const busy = isPending || state.phase === "working";
  const done = state.phase === "done" && state.ok;

  return (
    <div className="bg-ngpa-panel/80 rounded-2xl border border-ngpa-slate/60 p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-heading text-lg font-black text-ngpa-white tracking-tight">
            {slot.childFirst}
            {slot.level && (
              <span className="ml-2 text-xs font-bold uppercase tracking-wider text-ngpa-teal">
                {slot.level}
              </span>
            )}
          </p>
          <p className="text-ngpa-white/85 text-sm mt-1">
            {dateLabel} &middot; {slot.startTime}&ndash;{slot.endTime} &middot;{" "}
            {slot.location}
          </p>
          <p className="text-ngpa-white/65 text-sm mt-1">
            {slot.parentName}
            {slot.parentEmail && (
              <>
                {" · "}
                <a
                  href={`mailto:${slot.parentEmail}`}
                  className="text-ngpa-teal hover:underline underline-offset-4"
                >
                  {slot.parentEmail}
                </a>
              </>
            )}
            {slot.parentPhone && (
              <>
                {" · "}
                <a
                  href={`tel:${slot.parentPhone}`}
                  className="text-ngpa-teal hover:underline underline-offset-4"
                >
                  {slot.parentPhone}
                </a>
              </>
            )}
          </p>
        </div>

        {!done && (
          <div className="flex gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => run("confirm")}
              className="px-4 py-2 min-h-[40px] rounded-full bg-ngpa-teal text-ngpa-deep text-sm font-bold hover:bg-ngpa-teal-bright transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {state.phase === "working" && state.action === "confirm"
                ? "Confirming..."
                : "Confirm + send invite"}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => run("release")}
              className="px-4 py-2 min-h-[40px] rounded-full border border-ngpa-slate/60 text-ngpa-white/85 text-sm font-bold hover:border-ngpa-red hover:text-ngpa-red transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {state.phase === "working" && state.action === "release"
                ? "Releasing..."
                : "Release / reschedule"}
            </button>
          </div>
        )}
      </div>

      {state.phase === "done" && (
        <p
          className={`mt-3 text-sm font-medium ${state.ok ? "text-ngpa-green" : "text-ngpa-red"}`}
        >
          {state.message}
        </p>
      )}
    </div>
  );
}
