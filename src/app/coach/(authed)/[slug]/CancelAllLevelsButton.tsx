"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cancelAllLevelsAction } from "./actions";
import type { GroupCancelResult } from "@/lib/session-cancel-group";

type CancelReason = "weather" | "venue" | "low-enrollment" | "other";

interface Props {
  /** Session date (ISO YYYY-MM-DD). */
  date: string;
  /** Base title shared by every level row, e.g. "Redland Tuesday Evening". */
  baseTitle: string;
  /** Level rows currently open on this date (for the warning copy). */
  levelCount: number;
  /** Confirmed registrations summed across all those level rows. */
  rosterTotal: number;
}

const REASONS: Array<{ value: CancelReason; label: string }> = [
  { value: "weather", label: "Weather" },
  { value: "venue", label: "Venue issue" },
  { value: "low-enrollment", label: "Low enrollment" },
  { value: "other", label: "Other" },
];

export default function CancelAllLevelsButton(props: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<CancelReason>("venue");
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<GroupCancelResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  function submit() {
    startTransition(async () => {
      setError(null);
      const r = await cancelAllLevelsAction({
        date: props.date,
        baseTitle: props.baseTitle,
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
          Every level for {props.baseTitle} on this date is cancelled. Refunds
          posted to cards (Stripe delivers in 5–10 business days); each parent
          got a Coach-voice cancellation.
        </p>
      </div>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-red-500/60 text-red-200 bg-red-500/10 hover:bg-red-500/20 text-xs font-bold transition-colors min-h-[36px]"
      >
        Cancel ALL {props.levelCount} levels this day
      </button>
    );
  }

  return (
    <div className="rounded-2xl border border-red-500/50 bg-red-500/10 p-4 mb-6 max-w-2xl">
      <p className="font-bold text-red-200 text-sm mb-1">
        Cancel ALL levels + refund everyone
      </p>
      <p className="text-ngpa-white/70 text-xs mb-4">
        Cancels every <strong>{props.baseTitle}</strong> level row on this date (
        {props.levelCount} court{props.levelCount === 1 ? "" : "s"}), refunds all{" "}
        <strong>{props.rosterTotal}</strong> registration
        {props.rosterTotal === 1 ? "" : "s"} across them, emails each parent a
        Coach-voice cancellation, sends opt-in SMS where consented, and flips
        each row to Cancelled. Already-cancelled levels are skipped. Not
        undoable.
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
        Optional note (shown in every email — Coach voice, keep it brief)
      </label>
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        disabled={pending}
        rows={2}
        maxLength={240}
        placeholder='e.g. "Court permit fell through for tonight. Refunds are on the way — sorry for the short notice."'
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
            ? "Cancelling all levels…"
            : `Cancel all ${props.levelCount} levels + refund ${props.rosterTotal}`}
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
