"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { lockPlayoffAction } from "../../actions";
import type { PlayoffPlayer } from "@/lib/rotation-league/view";

// Snake-seeded teams from the standings (1+N, 2+N-1, ...; an odd kid rides as a
// third on the last team). Tap one player, then another, to swap them; then
// lock. Seeds stay in order, so a swap changes who is on a team, never which
// seed the team holds. Nothing is saved until Lock.
export default function TeamBuilder({ slug, teams }: { slug: string; teams: PlayoffPlayer[][] }) {
  const router = useRouter();
  const [draft, setDraft] = useState<PlayoffPlayer[][]>(teams);
  const [picked, setPicked] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function tap(ref: string) {
    if (picked === null) {
      setPicked(ref);
      return;
    }
    if (picked === ref) {
      setPicked(null);
      return;
    }
    const where = (r: string) => {
      for (let t = 0; t < draft.length; t += 1) {
        const i = draft[t].findIndex((p) => p.external_ref === r);
        if (i >= 0) return [t, i] as const;
      }
      return null;
    };
    const a = where(picked);
    const b = where(ref);
    if (a && b) {
      const next = draft.map((team) => [...team]);
      const pa = next[a[0]][a[1]];
      next[a[0]][a[1]] = next[b[0]][b[1]];
      next[b[0]][b[1]] = pa;
      setDraft(next);
    }
    setPicked(null);
  }

  function lock() {
    startTransition(async () => {
      setError(null);
      const r = await lockPlayoffAction({ slug, teams: draft.map((t) => t.map((p) => p.external_ref)) });
      if (!r.ok) {
        setError(r.message);
        return;
      }
      router.refresh();
    });
  }

  if (teams.length < 2) {
    return <p className="text-sm text-ngpa-white/60">Check in at least four players to make two teams.</p>;
  }

  return (
    <div>
      <p className="text-sm text-ngpa-white/60 mb-3">
        Tap a player, then another, to swap them between teams.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {draft.map((team, t) => (
          <div key={t} className="rounded-2xl border border-ngpa-slate/40 bg-ngpa-panel/40 p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-ngpa-teal mb-2">Seed {t + 1}</p>
            <div className="flex flex-wrap gap-2">
              {team.map((p) => (
                <button
                  key={p.external_ref}
                  type="button"
                  aria-pressed={picked === p.external_ref}
                  onClick={() => tap(p.external_ref)}
                  className={
                    picked === p.external_ref
                      ? "px-3 py-2 rounded-full bg-ngpa-teal text-ngpa-deep text-sm font-bold min-h-[44px]"
                      : "px-3 py-2 rounded-full border border-ngpa-slate/60 text-sm text-ngpa-white hover:border-ngpa-teal min-h-[44px]"
                  }
                >
                  {p.name}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={lock}
        disabled={pending}
        className="mt-4 px-5 py-2 rounded-full bg-ngpa-lime text-ngpa-deep text-sm font-bold hover:brightness-110 disabled:opacity-50 min-h-[44px]"
      >
        {pending ? "Locking…" : "Lock teams and start the bracket"}
      </button>
      {error && <p className="text-red-400 text-xs mt-2">{error}</p>}
    </div>
  );
}
