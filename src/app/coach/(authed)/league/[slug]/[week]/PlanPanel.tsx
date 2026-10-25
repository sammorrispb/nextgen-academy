"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { planAction } from "../../actions";
import type { PlanRound } from "@/lib/rotation-league/view";
import PlanPreview from "./PlanPreview";

// Preview the next rounds for whoever is checked in, try another shuffle, then
// save. Preview and save send the same attempt number, and the engine is
// deterministic per attempt, so what was previewed is what gets saved.
export default function PlanPanel({ slug, week, hasGames }: { slug: string; week: number; hasGames: boolean }) {
  const router = useRouter();
  const [rounds, setRounds] = useState<string>("auto");
  const [attempt, setAttempt] = useState(1);
  const [preview, setPreview] = useState<PlanRound[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function run(save: boolean, nextAttempt = attempt) {
    startTransition(async () => {
      setError(null);
      const r = await planAction({
        slug,
        week,
        rounds: rounds === "auto" ? null : Number(rounds),
        attempt: nextAttempt,
        save,
      });
      if (!r.ok) {
        setError(r.message);
        return;
      }
      if (r.rounds.length === 0) {
        setPreview(null);
        setError("Not enough players checked in to make a game.");
        return;
      }
      if (save) {
        setPreview(null);
        setAttempt(1);
        router.refresh();
        return;
      }
      setAttempt(nextAttempt);
      setPreview(r.rounds);
    });
  }

  const button =
    "px-4 py-2 rounded-full text-sm font-bold transition-all disabled:opacity-50 min-h-[44px]";

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm text-ngpa-white/70 flex items-center gap-2">
          Rounds
          <select
            value={rounds}
            onChange={(e) => {
              setRounds(e.target.value);
              setPreview(null);
            }}
            className="rounded-lg border border-ngpa-slate/60 bg-ngpa-deep/60 px-2 py-2 text-ngpa-white min-h-[44px]"
          >
            <option value="auto">Automatic</option>
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          disabled={pending}
          onClick={() => run(false, 1)}
          className={`${button} border border-ngpa-slate/60 text-ngpa-white hover:border-ngpa-teal`}
        >
          {pending && !preview ? "Planning…" : hasGames ? "Preview more rounds" : "Preview rounds"}
        </button>
        {preview && (
          <>
            <button
              type="button"
              disabled={pending}
              onClick={() => run(false, attempt + 1)}
              className={`${button} border border-ngpa-slate/60 text-ngpa-white hover:border-ngpa-teal`}
            >
              Try another
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => run(true)}
              className={`${button} bg-ngpa-lime text-ngpa-deep hover:brightness-110`}
            >
              {pending ? "Saving…" : "Save these rounds"}
            </button>
          </>
        )}
      </div>
      {error && <p className="text-red-400 text-xs mt-2">{error}</p>}

      {preview && <PlanPreview rounds={preview} />}
    </div>
  );
}
