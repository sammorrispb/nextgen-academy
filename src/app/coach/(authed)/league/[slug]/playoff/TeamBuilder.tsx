"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { lockPlayoffAction, previewPlayoffAction } from "../../actions";
import type { PlayoffPlayer } from "@/lib/rotation-league/view";
import { firstRound, type PlayoffPairing } from "@/lib/season-league/finals";

const RULES: { key: PlayoffPairing; label: string; blurb: string }[] = [
  {
    key: "halves",
    label: "Top half v bottom half",
    blurb:
      "Top half of the standings snakes into the top teams and the bottom half into the bottom teams (eight kids: 1 with 4, 2 with 3, then 5 with 8, 6 with 7). Round one sends each top team against a bottom team.",
  },
  { key: "snake", label: "Snake", blurb: "1 with the last, 2 with the next, and so on." },
];

// Teams seeded from the standings of the kids checked in, by the season's
// pairing rule (top half v bottom half since Sam's 2026-11-01 call; snake one
// tap away). Tap one player, then another, to swap them; then lock. Seeds stay
// in order, so a swap changes who is on a team, never which seed the team
// holds, and the round-one list below the teams updates with it. Nothing is
// saved until Lock.
export default function TeamBuilder({
  slug,
  teams,
  pairing,
  pairingApplied,
}: {
  slug: string;
  teams: PlayoffPlayer[][];
  pairing: PlayoffPairing;
  pairingApplied: boolean;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<PlayoffPlayer[][]>(teams);
  const [rule, setRule] = useState<PlayoffPairing>(pairing);
  const [applied, setApplied] = useState(pairingApplied);
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

  function reseed(next: PlayoffPairing) {
    if (next === rule && applied) return;
    startTransition(async () => {
      setError(null);
      const r = await previewPlayoffAction({ slug, pairing: next });
      if (!r.ok) {
        setError(r.message);
        return;
      }
      setDraft(r.teams.map((t) => t.players));
      setRule(r.pairing);
      setApplied(r.pairingApplied);
      setPicked(null);
    });
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

  const teamLabel = (seed: number) =>
    `Seed ${seed} (${(draft[seed - 1] ?? []).map((p) => p.name).join(" & ") || "empty"})`;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-2" role="group" aria-label="Pairing rule">
        {RULES.map((r) => (
          <button
            key={r.key}
            type="button"
            aria-pressed={rule === r.key}
            disabled={pending}
            onClick={() => reseed(r.key)}
            className={
              rule === r.key
                ? "px-3 py-2 rounded-full bg-ngpa-teal/20 border border-ngpa-teal text-ngpa-teal text-xs font-bold min-h-[44px]"
                : "px-3 py-2 rounded-full border border-ngpa-slate/60 text-xs font-bold text-ngpa-white/70 hover:border-ngpa-teal disabled:opacity-50 min-h-[44px]"
            }
          >
            {r.label}
          </button>
        ))}
      </div>
      <p className="text-sm text-ngpa-white/60 mb-3">
        {RULES.find((r) => r.key === rule)?.blurb} Tap a player, then another, to swap them between teams.
      </p>
      {!applied && (
        <p className="text-xs text-amber-200/80 border border-amber-300/30 bg-amber-300/5 rounded-xl px-3 py-2 mb-3">
          Link &amp; Dink doesn&rsquo;t know the top half v bottom half rule yet (deploy community-os first), so
          these are snake teams. Swap by hand, or try again after the deploy.
        </p>
      )}
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
      <p className="text-xs font-bold uppercase tracking-wider text-ngpa-teal mt-4 mb-1">Round one</p>
      <ul className="space-y-1 text-sm text-ngpa-white/80">
        {firstRound(draft.length).map((m) => (
          <li key={m.match}>
            {teamLabel(m.a)}
            {m.b === "bye" ? " has a bye" : ` vs ${teamLabel(m.b)}`}
          </li>
        ))}
      </ul>
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
