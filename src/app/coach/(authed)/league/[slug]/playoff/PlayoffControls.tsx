"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { playoffScoreAction, unlockPlayoffAction } from "../../actions";

export function UnlockTeamsButton({ slug }: { slug: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <div className="flex flex-col items-start gap-1">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const r = await unlockPlayoffAction({ slug });
            if (!r.ok) setError(r.message);
            else router.refresh();
          })
        }
        className="px-3 py-2 rounded-full border border-ngpa-slate/60 text-xs font-bold text-ngpa-white/70 hover:border-ngpa-teal disabled:opacity-50 min-h-[44px]"
      >
        {pending ? "Unlocking…" : "Unlock teams"}
      </button>
      {error && <span className="text-red-400 text-xs">{error}</span>}
    </div>
  );
}

export function PlayoffScoreForm(props: {
  slug: string;
  slot: string;
  scoreA: number | null;
  scoreB: number | null;
  played: boolean;
  gameTargets: number[];
  defaultTarget: number;
}) {
  const router = useRouter();
  const [a, setA] = useState(props.scoreA === null ? "" : String(props.scoreA));
  const [b, setB] = useState(props.scoreB === null ? "" : String(props.scoreB));
  const [target, setTarget] = useState(props.defaultTarget);
  const [onTime, setOnTime] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function save() {
    startTransition(async () => {
      setError(null);
      const r = await playoffScoreAction({
        slug: props.slug,
        slot: props.slot,
        scoreA: Number(a),
        scoreB: Number(b),
        gameTarget: target,
        timed: onTime,
      });
      if (!r.ok) setError(r.message);
      else router.refresh();
    });
  }

  const input =
    "w-14 rounded-lg border border-ngpa-slate/60 bg-ngpa-deep/60 px-2 py-2 text-center font-mono text-sm text-ngpa-white focus:border-ngpa-teal focus:outline-none min-h-[44px]";

  return (
    <div className="flex flex-wrap items-center gap-2 mt-3">
      <input type="number" inputMode="numeric" min={0} max={99} value={a} onChange={(e) => setA(e.target.value)} aria-label="Score, first team" className={input} />
      <span className="text-ngpa-white/45">–</span>
      <input type="number" inputMode="numeric" min={0} max={99} value={b} onChange={(e) => setB(e.target.value)} aria-label="Score, second team" className={input} />
      {props.gameTargets.length > 1 && (
        <select
          value={target}
          onChange={(e) => setTarget(Number(e.target.value))}
          aria-label="Game to"
          className="rounded-lg border border-ngpa-slate/60 bg-ngpa-deep/60 px-2 py-2 text-xs text-ngpa-white min-h-[44px]"
        >
          {props.gameTargets.map((t) => (
            <option key={t} value={t}>
              to {t}
            </option>
          ))}
        </select>
      )}
      <label className="flex items-center gap-1.5 text-[11px] text-ngpa-white/65 select-none">
        <input type="checkbox" checked={onTime} onChange={(e) => setOnTime(e.target.checked)} className="accent-ngpa-teal" />
        ended on time
      </label>
      <button
        type="button"
        onClick={save}
        disabled={pending || a === "" || b === ""}
        className={
          props.played
            ? "px-3 py-2 rounded-full border border-ngpa-slate/60 text-xs font-bold hover:border-ngpa-teal disabled:opacity-50 min-h-[44px]"
            : "px-3 py-2 rounded-full bg-ngpa-lime text-ngpa-deep text-xs font-bold hover:brightness-110 disabled:opacity-50 min-h-[44px]"
        }
      >
        {pending ? "Saving…" : props.played ? "Correct" : "Save score"}
      </button>
      {error && <span className="text-red-400 text-[11px]">{error}</span>}
    </div>
  );
}
