"use client";

import { useState, useTransition } from "react";
import { confirmSessionCancelAction } from "./actions";

interface Props {
  token: string;
  sessionTitle: string;
  rosterSize: number;
}

export default function ConfirmCancelClient({ token, sessionTitle, rosterSize }: Props) {
  const [done, setDone] = useState<{ ok: boolean; message: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function confirm() {
    startTransition(async () => {
      const r = await confirmSessionCancelAction(token);
      setDone({ ok: r.ok, message: r.message });
    });
  }

  if (done) {
    return (
      <div
        className={`rounded-2xl border px-5 py-4 ${
          done.ok
            ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
            : "border-red-500/40 bg-red-500/10 text-red-200"
        }`}
      >
        <p className="font-bold">{done.ok ? "Session cancelled" : "Couldn’t cancel"}</p>
        <p className="text-sm mt-1 text-ngpa-white/80">{done.message}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        onClick={confirm}
        disabled={pending}
        className="px-6 py-3 rounded-full bg-red-500/90 text-white font-bold hover:bg-red-500 disabled:opacity-60 transition-colors min-h-[48px]"
      >
        {pending
          ? "Cancelling…"
          : `Confirm: cancel & refund all ${rosterSize} registration${rosterSize === 1 ? "" : "s"}`}
      </button>
      <p className="text-xs text-ngpa-white/55">
        This cancels <span className="text-ngpa-white/80">{sessionTitle}</span>, refunds every
        registrant in full, and emails them the weather-cancellation notice. This can’t be undone.
      </p>
    </div>
  );
}
