"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { previewDayAction, saveDayAction } from "./actions";
import type { DayPreview } from "@/lib/season-league-view";

interface RosterEntry {
  id: string;
  name: string;
}

interface Props {
  group: string;
  week: number;
  roster: RosterEntry[];
  /** From the Day row when one exists, else every Confirmed kid. */
  initialPresent: string[];
  hasSchedule: boolean;
  roundsPlayed: number;
}

// Attendance → preview → save. The plan is computed server-side both times
// (the same present list + attempt gives the same plan), so the client never
// sends games — only who is here and how many rounds to add.
export default function DayPlanner({ group, week, roster, initialPresent, hasSchedule, roundsPlayed }: Props) {
  const router = useRouter();
  const [present, setPresent] = useState<Set<string>>(() => new Set(initialPresent));
  const [rounds, setRounds] = useState("");
  const [preview, setPreview] = useState<DayPreview | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const presentIds = roster.filter((r) => present.has(r.id)).map((r) => r.id);
  const roundsValue = rounds.trim() === "" ? null : Number(rounds);

  function toggle(id: string) {
    setPreview(null);
    setPresent((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function runPreview() {
    startTransition(async () => {
      setError(null);
      setMessage(null);
      const result = await previewDayAction({ group, week, presentIds, rounds: roundsValue });
      if (!result.ok) {
        setPreview(null);
        setError(result.message);
        return;
      }
      setPreview(result);
    });
  }

  function save() {
    const label = hasSchedule
      ? "Replace the unplayed rounds with this plan? Played games are kept."
      : "Save this schedule?";
    if (!window.confirm(label)) return;
    startTransition(async () => {
      setError(null);
      setMessage(null);
      const result = await saveDayAction({ group, week, presentIds, rounds: roundsValue });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setPreview(null);
      setMessage(
        `${result.message} · ${result.created} new, ${result.updated} replaced, ${result.voided} cleared`,
      );
      router.refresh();
    });
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-bold tracking-[0.2em] uppercase text-ngpa-teal mb-3">
          Who&rsquo;s here today
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
        <p className="text-xs text-ngpa-white/55 mt-2">
          {presentIds.length} of {roster.length} checked in
          {roundsPlayed > 0 && ` · ${roundsPlayed} round${roundsPlayed === 1 ? "" : "s"} already played`}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-xs text-ngpa-white/70">
          Rounds to add
          <input
            type="number"
            inputMode="numeric"
            min={0}
            max={12}
            placeholder="auto"
            value={rounds}
            onChange={(e) => {
              setRounds(e.target.value);
              setPreview(null);
            }}
            className="w-16 rounded-lg border border-ngpa-slate/60 bg-ngpa-deep/60 px-2 py-1.5 text-center font-mono text-sm text-ngpa-white focus:border-ngpa-teal focus:outline-none min-h-[36px]"
          />
        </label>
        <button
          type="button"
          onClick={runPreview}
          disabled={pending || presentIds.length < 2}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full border border-ngpa-teal/60 text-ngpa-teal font-bold text-sm hover:bg-ngpa-teal/15 transition-colors disabled:opacity-50 min-h-[44px]"
        >
          {pending && !preview ? "Working…" : "Preview schedule"}
        </button>
        {preview?.ok && (
          <button
            type="button"
            onClick={save}
            disabled={pending}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-ngpa-lime text-ngpa-deep font-bold text-sm hover:brightness-110 transition-all disabled:opacity-50 min-h-[44px]"
          >
            {pending ? "Saving…" : hasSchedule ? "Save — replace unplayed rounds" : "Save schedule"}
          </button>
        )}
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}
      {message && <p className="text-sm text-emerald-300">{message}</p>}

      {preview?.ok && (
        <div className="rounded-2xl border border-ngpa-teal/40 bg-ngpa-panel/60 p-4 sm:p-5">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-ngpa-teal mb-2">
            Preview · attempt {preview.attempt}
          </p>
          <p className="text-sm text-ngpa-white/80 mb-3">
            {preview.present.length} kids · {preview.allocation.doubles} doubles court
            {preview.allocation.doubles === 1 ? "" : "s"}
            {preview.allocation.singles > 0 && ` + ${preview.allocation.singles} singles court${preview.allocation.singles === 1 ? "" : "s"}`}
            {preview.allocation.sitting > 0 && ` · ${preview.allocation.sitting} sit${preview.allocation.sitting === 1 ? "s" : ""} each round`}
            {" · "}
            {preview.rounds.length} new round{preview.rounds.length === 1 ? "" : "s"}
            {roundsValue === null && preview.defaultNewRounds !== preview.rounds.length ? "" : ""}
          </p>
          {preview.rounds.length === 0 ? (
            <p className="text-sm text-ngpa-white/60">Nothing to add — set a round count above.</p>
          ) : (
            <ol className="space-y-3">
              {preview.rounds.map((round) => (
                <li key={round.round} className="text-sm">
                  <p className="font-bold text-ngpa-white mb-1">Round {round.round}</p>
                  <ul className="space-y-1">
                    {round.games.map((g) => (
                      <li key={g.court} className="flex flex-wrap items-center gap-x-2 text-ngpa-white/85">
                        <span className="font-mono text-xs text-ngpa-white/50 w-10">C{g.court}</span>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-ngpa-teal w-14">
                          {g.format === "singles" ? "Singles" : "Doubles"}
                        </span>
                        <span>
                          {g.sideA.map((id) => preview.names[id] ?? "Player").join(" & ")}{" "}
                          <span className="text-ngpa-white/45">vs</span>{" "}
                          {g.sideB.map((id) => preview.names[id] ?? "Player").join(" & ")}
                        </span>
                      </li>
                    ))}
                    {round.sitting.length > 0 && (
                      <li className="text-xs text-ngpa-white/50">
                        Sitting: {round.sitting.map((id) => preview.names[id] ?? "Player").join(", ")}
                      </li>
                    )}
                  </ul>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </div>
  );
}
