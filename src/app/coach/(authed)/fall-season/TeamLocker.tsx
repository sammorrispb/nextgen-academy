"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { lockTeamsAction, previewTeamsAction } from "./actions";

interface RosterEntry {
  id: string;
  name: string;
}

interface Props {
  group: string;
  roster: RosterEntry[];
  initialPresent: string[];
}

interface TeamDraft {
  seed: number;
  members: string[];
}

// Week 6: attendance → snake-seeded teams from the standings → (optional
// swaps) → lock. Teams are shown as finished teams; there is no pick order
// and no "still unpicked" list on this screen.
export default function TeamLocker({ group, roster, initialPresent }: Props) {
  const router = useRouter();
  const [present, setPresent] = useState<Set<string>>(() => new Set(initialPresent));
  const [teams, setTeams] = useState<TeamDraft[] | null>(null);
  const [names, setNames] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const presentIds = roster.filter((r) => present.has(r.id)).map((r) => r.id);

  function toggle(id: string) {
    setTeams(null);
    setPresent((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function preview() {
    startTransition(async () => {
      setError(null);
      const result = await previewTeamsAction({ group, presentIds });
      if (!result.ok) {
        setTeams(null);
        setError(result.message);
        return;
      }
      setTeams(result.teams.map((t) => ({ seed: t.seed, members: [...t.members] })));
      setNames(result.names);
    });
  }

  function move(playerId: string, toSeed: number) {
    setTeams((prev) => {
      if (!prev) return prev;
      return prev.map((t) => ({
        seed: t.seed,
        members:
          t.seed === toSeed
            ? [...t.members.filter((m) => m !== playerId), playerId]
            : t.members.filter((m) => m !== playerId),
      }));
    });
  }

  function lock() {
    if (!teams) return;
    if (!window.confirm("Lock these teams and start the bracket?")) return;
    startTransition(async () => {
      setError(null);
      const result = await lockTeamsAction({ group, presentIds, teams });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      router.refresh();
    });
  }

  const sizesOk = teams ? teams.every((t) => t.members.length >= 2 && t.members.length <= 3) : false;

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-bold tracking-[0.2em] uppercase text-ngpa-teal mb-3">
          Who&rsquo;s here for the playoff
        </p>
        <ul className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {roster.map((r) => {
            const on = present.has(r.id);
            return (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => toggle(r.id)}
                  aria-pressed={on}
                  className={
                    on
                      ? "w-full text-left px-4 py-3 rounded-xl border border-emerald-500/50 bg-emerald-500/15 text-emerald-200 font-bold text-sm min-h-[48px] transition-colors"
                      : "w-full text-left px-4 py-3 rounded-xl border border-ngpa-slate/60 bg-ngpa-panel/50 text-ngpa-white/50 font-bold text-sm min-h-[48px] hover:border-ngpa-teal transition-colors line-through"
                  }
                >
                  {on ? "✓ " : ""}
                  {r.name}
                </button>
              </li>
            );
          })}
        </ul>
        <p className="text-xs text-ngpa-white/55 mt-2">{presentIds.length} of {roster.length} checked in</p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={preview}
          disabled={pending || presentIds.length < 4}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full border border-ngpa-teal/60 text-ngpa-teal font-bold text-sm hover:bg-ngpa-teal/15 transition-colors disabled:opacity-50 min-h-[44px]"
        >
          {pending && !teams ? "Working…" : "Seed the teams"}
        </button>
        {teams && (
          <button
            type="button"
            onClick={lock}
            disabled={pending || !sizesOk}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-ngpa-lime text-ngpa-deep font-bold text-sm hover:brightness-110 transition-all disabled:opacity-50 min-h-[44px]"
          >
            {pending ? "Locking…" : "Lock teams"}
          </button>
        )}
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}

      {teams && (
        <div className="rounded-2xl border border-ngpa-teal/40 bg-ngpa-panel/60 p-4 sm:p-5">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-ngpa-teal mb-1">
            Teams · seeded from the standings
          </p>
          <p className="text-xs text-ngpa-white/55 mb-3">
            1 with {teams.length > 1 ? "the last" : "—"}, 2 with the next, and so on. Move a kid with the
            dropdown if you need to; every team needs 2 or 3 players.
          </p>
          <ol className="space-y-3">
            {teams.map((t) => (
              <li key={t.seed} className="rounded-xl border border-ngpa-slate/60 bg-ngpa-deep/40 px-4 py-3">
                <p className="text-xs font-bold text-ngpa-white/60 mb-1">Team {t.seed}</p>
                {t.members.length === 0 && <p className="text-xs text-red-300">Empty — move someone here or lock fewer teams.</p>}
                <ul className="space-y-1">
                  {t.members.map((id) => (
                    <li key={id} className="flex items-center justify-between gap-3 text-sm">
                      <span className="font-bold text-ngpa-white">{names[id] ?? "Player"}</span>
                      <select
                        aria-label={`Team for ${names[id] ?? "player"}`}
                        value={t.seed}
                        onChange={(e) => move(id, Number(e.target.value))}
                        className="rounded-lg border border-ngpa-slate/60 bg-ngpa-deep/60 px-2 py-1 text-xs text-ngpa-white min-h-[32px]"
                      >
                        {teams.map((opt) => (
                          <option key={opt.seed} value={opt.seed}>
                            Team {opt.seed}
                          </option>
                        ))}
                      </select>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
