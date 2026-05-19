"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  cancelSessionAction,
  type SessionCancelActionResult,
} from "./actions";

type CancelReason = "weather" | "venue" | "low-enrollment" | "other";

interface Props {
  sessionRowId: string;
  sessionTitle: string;
  sessionDate: string;
  sessionStartTime: string;
  rosterSize: number;
}

const REASONS: Array<{ value: CancelReason; label: string }> = [
  { value: "weather", label: "Weather" },
  { value: "venue", label: "Venue issue" },
  { value: "low-enrollment", label: "Low enrollment" },
  { value: "other", label: "Other" },
];

export default function CancelSessionButton(props: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<CancelReason>("weather");
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<SessionCancelActionResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  function submit() {
    startTransition(async () => {
      setError(null);
      const r = await cancelSessionAction({
        sessionRowId: props.sessionRowId,
        sessionTitle: props.sessionTitle,
        sessionDate: props.sessionDate,
        sessionStartTime: props.sessionStartTime,
        reason,
        note: note.trim() || undefined,
      });
      setResult(r);
      if (!r.ok) {
        setError(r.message);
        return;
      }
      router.refresh();
    });
  }

  if (result?.ok) {
    return (
      <div className="rounded-2xl border border-ngpa-skill-green/50 bg-ngpa-skill-green/10 p-4 text-sm">
        <p className="font-bold text-ngpa-skill-green">{result.message}</p>
        <p className="text-ngpa-white/70 mt-1">
          {result.rosterSize ?? 0} parents notified. Refunds posted to cards;
          Stripe will deliver them in 5–10 business days. Session row flipped
          to Cancelled.
        </p>
      </div>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-red-500/40 text-red-300 hover:bg-red-500/15 text-xs font-bold transition-colors min-h-[36px]"
      >
        Cancel session, notify all
      </button>
    );
  }

  return (
    <div className="rounded-2xl border border-red-500/40 bg-red-500/5 p-4 mb-6 max-w-2xl">
      <p className="font-bold text-red-300 text-sm mb-1">
        Cancel session + refund all
      </p>
      <p className="text-ngpa-white/70 text-xs mb-4">
        This will refund <strong>{props.rosterSize}</strong> registration
        {props.rosterSize === 1 ? "" : "s"} (full amount to card on file), email
        each parent a Coach-voice cancellation, send opt-in SMS to anyone with
        consent, and flip the session row to Cancelled. Not undoable.
      </p>

      <label className="block text-xs font-bold text-ngpa-white/80 mb-1.5">
        Reason
      </label>
      <select
        value={reason}
        onChange={(e) => setReason(e.target.value as CancelReason)}
        disabled={pending}
        className="w-full sm:w-64 mb-3 px-3 py-2 rounded-lg bg-ngpa-deep border border-ngpa-slate/60 text-ngpa-white text-sm focus:outline-none focus:border-ngpa-teal"
      >
        {REASONS.map((r) => (
          <option key={r.value} value={r.value}>
            {r.label}
          </option>
        ))}
      </select>

      <label className="block text-xs font-bold text-ngpa-white/80 mb-1.5">
        Optional note (shown in email — Coach voice, keep it brief)
      </label>
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        disabled={pending}
        rows={2}
        maxLength={240}
        placeholder='e.g. "Lightning in the forecast. Next session is on the calendar — I&apos;ll see you there."'
        className="w-full mb-4 px-3 py-2 rounded-lg bg-ngpa-deep border border-ngpa-slate/60 text-ngpa-white text-sm placeholder:text-ngpa-white/30 focus:outline-none focus:border-ngpa-teal resize-none"
      />

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={submit}
          disabled={pending}
          className="px-5 py-2.5 rounded-full bg-red-500 text-ngpa-white font-bold text-sm hover:brightness-110 disabled:opacity-60 transition-all min-h-[40px]"
        >
          {pending
            ? "Sending…"
            : `Cancel + refund ${props.rosterSize} parent${props.rosterSize === 1 ? "" : "s"}`}
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setNote("");
            setError(null);
          }}
          disabled={pending}
          className="px-4 py-2 text-ngpa-white/70 hover:text-ngpa-white text-sm font-bold transition-colors"
        >
          Never mind
        </button>
        {error && (
          <span className="text-red-400 text-xs ml-2 break-words">{error}</span>
        )}
      </div>
    </div>
  );
}
