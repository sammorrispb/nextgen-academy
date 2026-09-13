"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { recordScoreAction } from "./actions";

interface Props {
  group: string;
  week: number;
  gameKey: string;
  scoreA: number | null;
  scoreB: number | null;
  timed: boolean;
  played: boolean;
}

// One row's score entry. Mirrors AttendanceToggle: optimistic local state,
// useTransition for the action, router.refresh() so the standings panel and
// the parent page pick the result up.
export default function GameScoreForm({ group, week, gameKey, scoreA, scoreB, timed, played }: Props) {
  const router = useRouter();
  const [a, setA] = useState(scoreA === null ? "" : String(scoreA));
  const [b, setB] = useState(scoreB === null ? "" : String(scoreB));
  const [onTime, setOnTime] = useState(timed);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function save() {
    startTransition(async () => {
      setError(null);
      setMessage(null);
      const result = await recordScoreAction({
        group,
        week,
        key: gameKey,
        scoreA: Number(a),
        scoreB: Number(b),
        timed: onTime,
      });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setMessage(result.message);
      router.refresh();
    });
  }

  const input =
    "w-14 rounded-lg border border-ngpa-slate/60 bg-ngpa-deep/60 px-2 py-1.5 text-center font-mono text-sm text-ngpa-white focus:border-ngpa-teal focus:outline-none min-h-[36px]";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        type="number"
        inputMode="numeric"
        min={0}
        max={99}
        value={a}
        onChange={(e) => setA(e.target.value)}
        aria-label="Score, side A"
        className={input}
      />
      <span className="text-ngpa-white/45">–</span>
      <input
        type="number"
        inputMode="numeric"
        min={0}
        max={99}
        value={b}
        onChange={(e) => setB(e.target.value)}
        aria-label="Score, side B"
        className={input}
      />
      <label className="flex items-center gap-1.5 text-[11px] text-ngpa-white/65 select-none">
        <input
          type="checkbox"
          checked={onTime}
          onChange={(e) => setOnTime(e.target.checked)}
          className="accent-ngpa-teal"
        />
        ended on time
      </label>
      <button
        type="button"
        onClick={save}
        disabled={pending || a === "" || b === ""}
        className={
          played
            ? "px-3 py-1.5 rounded-full border border-ngpa-slate/60 text-xs font-bold hover:border-ngpa-teal hover:text-ngpa-teal transition-colors disabled:opacity-50 min-h-[36px]"
            : "px-3 py-1.5 rounded-full bg-ngpa-lime text-ngpa-deep text-xs font-bold hover:brightness-110 transition-all disabled:opacity-50 min-h-[36px]"
        }
      >
        {pending ? "Saving…" : played ? "Correct" : "Save score"}
      </button>
      {message && <span className="text-emerald-300 text-[11px]">{message}</span>}
      {error && <span className="text-red-400 text-[11px]">{error}</span>}
    </div>
  );
}
