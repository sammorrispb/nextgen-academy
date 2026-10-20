"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { removeGameAction, scoreAction } from "../../actions";

interface Props {
  slug: string;
  week: number;
  gameId: string;
  scoreA: number | null;
  scoreB: number | null;
  timed: boolean;
  played: boolean;
  gameTargets: number[];
  defaultTarget: number;
}

// One game's score: save, then correct it any time. An unscored game can be
// removed (it was planned for someone who left); a scored one can't.
export default function LeagueScoreForm(props: Props) {
  const { slug, week, gameId, played } = props;
  const router = useRouter();
  const [a, setA] = useState(props.scoreA === null ? "" : String(props.scoreA));
  const [b, setB] = useState(props.scoreB === null ? "" : String(props.scoreB));
  const [target, setTarget] = useState(props.defaultTarget);
  const [onTime, setOnTime] = useState(props.timed);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function save() {
    startTransition(async () => {
      setError(null);
      setMessage(null);
      const r = await scoreAction({
        slug,
        week,
        gameId,
        scoreA: Number(a),
        scoreB: Number(b),
        gameTarget: target,
        timed: onTime,
      });
      if (!r.ok) {
        setError(r.message);
        return;
      }
      setMessage("Saved");
      router.refresh();
    });
  }

  function remove() {
    if (!window.confirm("Remove this game? Use this when a player left before it was played.")) return;
    startTransition(async () => {
      setError(null);
      const r = await removeGameAction({ slug, week, gameId });
      if (!r.ok) {
        setError(r.message);
        return;
      }
      router.refresh();
    });
  }

  const input =
    "w-14 rounded-lg border border-ngpa-slate/60 bg-ngpa-deep/60 px-2 py-2 text-center font-mono text-sm text-ngpa-white focus:border-ngpa-teal focus:outline-none min-h-[44px]";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input type="number" inputMode="numeric" min={0} max={99} value={a} onChange={(e) => setA(e.target.value)} aria-label="Score, first side" className={input} />
      <span className="text-ngpa-white/45">–</span>
      <input type="number" inputMode="numeric" min={0} max={99} value={b} onChange={(e) => setB(e.target.value)} aria-label="Score, second side" className={input} />
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
          played
            ? "px-3 py-2 rounded-full border border-ngpa-slate/60 text-xs font-bold hover:border-ngpa-teal hover:text-ngpa-teal transition-colors disabled:opacity-50 min-h-[44px]"
            : "px-3 py-2 rounded-full bg-ngpa-lime text-ngpa-deep text-xs font-bold hover:brightness-110 transition-all disabled:opacity-50 min-h-[44px]"
        }
      >
        {pending ? "Saving…" : played ? "Correct" : "Save score"}
      </button>
      {!played && (
        <button
          type="button"
          onClick={remove}
          disabled={pending}
          className="px-3 py-2 rounded-full text-xs text-ngpa-white/55 hover:text-red-300 transition-colors min-h-[44px]"
        >
          Remove
        </button>
      )}
      {message && <span className="text-emerald-300 text-[11px]">{message}</span>}
      {error && <span className="text-red-400 text-[11px]">{error}</span>}
    </div>
  );
}
