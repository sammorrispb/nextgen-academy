"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { selfCancelAction } from "./actions";

interface Props {
  token: string;
  childFirstName: string;
  sessionTitle: string;
  sessionDateLong: string;
  sessionStart: string;
}

type Phase =
  | { kind: "idle" }
  | { kind: "done"; ok: boolean; message: string };

export default function CancelClient({
  token,
  childFirstName,
  sessionTitle,
  sessionDateLong,
  sessionStart,
}: Props) {
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [pending, startTransition] = useTransition();

  function onCancel() {
    startTransition(async () => {
      const result = await selfCancelAction(token);
      setPhase({ kind: "done", ok: result.ok, message: result.message });
    });
  }

  if (phase.kind === "done") {
    return (
      <div className="bg-ngpa-panel/80 backdrop-blur-sm rounded-2xl border border-ngpa-slate/60 p-6 sm:p-8">
        <p
          className={`text-sm font-bold uppercase tracking-[0.2em] mb-2 ${
            phase.ok ? "text-ngpa-skill-green" : "text-red-400"
          }`}
        >
          {phase.ok ? "Cancelled" : "Couldn't cancel"}
        </p>
        <p className="text-base text-ngpa-white/85 leading-relaxed mb-6">
          {phase.message}
        </p>
        <Link
          href="/schedule"
          className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full bg-ngpa-lime text-ngpa-deep font-bold text-sm hover:brightness-110 transition-all min-h-[44px]"
        >
          Back to schedule
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-ngpa-panel/80 backdrop-blur-sm rounded-2xl border border-ngpa-slate/60 p-6 sm:p-8">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-ngpa-teal mb-2">
        Reservation
      </p>
      <p className="font-heading text-xl sm:text-2xl font-black text-ngpa-white tracking-tight mb-1">
        {childFirstName ? `${childFirstName} · ` : ""}
        {sessionTitle}
      </p>
      <p className="text-sm text-ngpa-white/70 mb-6">
        {sessionDateLong} · {sessionStart}
      </p>

      <div className="rounded-xl bg-ngpa-deep/60 border border-ngpa-slate/40 px-4 py-3 mb-6">
        <p className="text-sm text-ngpa-white/85 leading-relaxed">
          <strong className="text-ngpa-white">Your $20 isn&rsquo;t refundable</strong>{" "}
          (per our drop-in policy), but cancelling now opens the seat for another
          player.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row-reverse gap-3">
        <button
          type="button"
          onClick={onCancel}
          disabled={pending}
          className="px-6 py-3.5 rounded-full bg-red-500/15 text-red-300 border border-red-500/40 font-bold hover:bg-red-500/25 disabled:opacity-60 transition-colors min-h-[48px]"
        >
          {pending ? "Cancelling…" : "Yes, cancel my reservation"}
        </button>
        <Link
          href="/schedule"
          className="px-6 py-3.5 rounded-full border border-ngpa-slate/60 text-ngpa-white/85 hover:border-ngpa-teal hover:text-ngpa-teal font-bold text-sm text-center transition-colors min-h-[48px] flex items-center justify-center"
        >
          Never mind, keep it
        </Link>
      </div>
    </div>
  );
}
