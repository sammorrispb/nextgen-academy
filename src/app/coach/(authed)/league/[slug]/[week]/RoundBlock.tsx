"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { editRoundAction, replanAfterAction } from "../../actions";
import type { PlanRound, WeekGame } from "@/lib/rotation-league/view";
import {
  assignSlot,
  lineupChanged,
  lineupFromGames,
  sittingFor,
  type LineupGame,
  type SlotRef,
} from "@/lib/rotation-league/round-edit";
import LeagueScoreForm from "./LeagueScoreForm";
import PlanPreview from "./PlanPreview";

interface Props {
  slug: string;
  week: number;
  round: number;
  games: WeekGame[];
  /** Everyone checked in tonight: the dropdown choices. */
  present: { external_ref: string; name: string }[];
  /** Every roster name, so a kid checked out since still shows by name. */
  names: Record<string, string>;
  gameTargets: number[];
  defaultTarget: number;
  /** Later rounds exist and none has a score yet. */
  canReplanAfter: boolean;
}

// One round: its games and score forms, "Change players" (a dropdown per spot;
// picking a kid who is elsewhere this round swaps the two), and "Re-plan rounds
// after this" so the singles and partner rules apply again around a change.
export default function RoundBlock(props: Props) {
  const { slug, week, round, games, present, names } = props;
  const router = useRouter();
  const original = lineupFromGames(games);
  const [lineup, setLineup] = useState<LineupGame[] | null>(null);
  const [replan, setReplan] = useState<{ attempt: number; rounds: PlanRound[] } | null>(null);
  const [edited, setEdited] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const presentRefs = present.map((p) => p.external_ref);
  const nameOf = (ref: string) => names[ref] ?? ref;
  const anyScored = games.some((g) => g.status === "played");

  function startEdit() {
    setError(null);
    setReplan(null);
    setLineup(original);
  }

  function pick(slot: SlotRef, ref: string) {
    if (lineup) setLineup(assignSlot(lineup, slot, ref));
  }

  function save() {
    if (!lineup || !original) return;
    if (!lineupChanged(lineup, original)) {
      setLineup(null);
      return;
    }
    if (anyScored && !window.confirm("A game in this round has a score. The score moves to the players you picked. Save?")) {
      return;
    }
    startTransition(async () => {
      setError(null);
      const r = await editRoundAction({ slug, week, round, games: lineup });
      if (!r.ok) {
        setError(r.message);
        return;
      }
      setLineup(null);
      setEdited(true);
      router.refresh();
    });
  }

  function runReplan(save: boolean, attempt: number) {
    startTransition(async () => {
      setError(null);
      const r = await replanAfterAction({ slug, week, afterRound: round, attempt, save });
      if (!r.ok) {
        setError(r.message);
        return;
      }
      if (save) {
        setReplan(null);
        setEdited(false);
        router.refresh();
        return;
      }
      setReplan({ attempt, rounds: r.rounds });
    });
  }

  const button = "px-3 py-2 rounded-full text-xs font-bold transition-all disabled:opacity-50 min-h-[44px]";
  const select =
    "rounded-lg border border-ngpa-slate/60 bg-ngpa-deep/60 px-2 py-2 text-sm text-ngpa-white min-h-[44px] max-w-[11rem]";

  const options = (current: string) => {
    const refs = presentRefs.includes(current) ? presentRefs : [current, ...presentRefs];
    return refs.map((ref) => (
      <option key={ref} value={ref}>
        {nameOf(ref)}
      </option>
    ));
  };

  const sideSelects = (gi: number, side: "A" | "B", refs: string[], label: string) =>
    refs.map((ref, index) => (
      <select
        key={`${side}${index}`}
        value={ref}
        onChange={(e) => pick({ game: gi, side, index }, e.target.value)}
        aria-label={`Court ${games[gi]?.court ?? gi + 1}, ${label} ${index + 1}`}
        className={select}
      >
        {options(ref)}
      </select>
    ));

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <p className="text-xs font-bold uppercase tracking-wider text-ngpa-teal mr-auto">Round {round}</p>
        {original && !lineup && (
          <button
            type="button"
            onClick={startEdit}
            disabled={pending}
            className={`${button} border border-ngpa-slate/60 text-ngpa-white hover:border-ngpa-teal`}
          >
            Change players
          </button>
        )}
        {props.canReplanAfter && !lineup && (
          <button
            type="button"
            onClick={() => runReplan(false, 1)}
            disabled={pending}
            className={`${button} border border-ngpa-slate/60 text-ngpa-white hover:border-ngpa-teal`}
          >
            {pending && !replan ? "Planning…" : "Re-plan rounds after this"}
          </button>
        )}
      </div>
      {edited && props.canReplanAfter && !replan && (
        <p className="text-xs text-amber-200/80 mb-2">
          Saved. Re-plan the rounds after this one to keep singles and partners balanced.
        </p>
      )}

      {lineup ? (
        <div className="rounded-2xl border border-ngpa-teal/50 bg-ngpa-panel/40 p-4 space-y-4">
          {lineup.map((g, gi) => (
            <div key={g.gameId}>
              <p className="text-ngpa-white/50 text-xs mb-1.5">
                Court {games[gi]?.court} · {games[gi]?.format}
                {games[gi]?.status === "played" && " · scored"}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                {sideSelects(gi, "A", g.sideA, "side 1 player")}
                <span className="text-ngpa-white/45 text-sm">vs</span>
                {sideSelects(gi, "B", g.sideB, "side 2 player")}
              </div>
            </div>
          ))}
          {sittingFor(lineup, presentRefs).length > 0 && (
            <p className="text-xs text-ngpa-white/55">
              Sitting: {sittingFor(lineup, presentRefs).map(nameOf).join(", ")}
            </p>
          )}
          {anyScored && (
            <p className="text-xs text-amber-200/80">
              This round has a score. Saving moves it to the players you pick.
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={save}
              disabled={pending}
              className={`${button} bg-ngpa-lime text-ngpa-deep hover:brightness-110`}
            >
              {pending ? "Saving…" : "Save players"}
            </button>
            <button
              type="button"
              onClick={() => setLineup(null)}
              disabled={pending}
              className={`${button} text-ngpa-white/65 hover:text-ngpa-white`}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <ul className="space-y-3">
          {games.map((g) => (
            <li key={g.id} className="rounded-2xl border border-ngpa-slate/40 bg-ngpa-panel/40 p-4">
              <p className="text-sm text-ngpa-white mb-3">
                <span className="text-ngpa-white/50 text-xs mr-2">
                  Court {g.court} · {g.format}
                </span>
                <span className="font-bold">{g.side_a.join(" & ")}</span>
                <span className="text-ngpa-white/45"> vs </span>
                <span className="font-bold">{g.side_b.join(" & ")}</span>
              </p>
              <LeagueScoreForm
                slug={slug}
                week={week}
                gameId={g.id}
                scoreA={g.score_a}
                scoreB={g.score_b}
                timed={g.timed}
                played={g.status === "played"}
                gameTargets={props.gameTargets}
                defaultTarget={props.defaultTarget}
              />
            </li>
          ))}
        </ul>
      )}

      {error && <p className="text-red-400 text-xs mt-2">{error}</p>}

      {replan && (
        <div className="mt-3 rounded-2xl border border-ngpa-teal/50 p-4">
          <p className="text-sm text-ngpa-white mb-1">
            New rounds after round {round}. Saving replaces the unscored rounds below.
          </p>
          <PlanPreview rounds={replan.rounds} />
          <div className="flex flex-wrap gap-2 mt-3">
            <button
              type="button"
              disabled={pending}
              onClick={() => runReplan(false, replan.attempt + 1)}
              className={`${button} border border-ngpa-slate/60 text-ngpa-white hover:border-ngpa-teal`}
            >
              Try another
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => runReplan(true, replan.attempt)}
              className={`${button} bg-ngpa-lime text-ngpa-deep hover:brightness-110`}
            >
              {pending ? "Saving…" : "Save these rounds"}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => setReplan(null)}
              className={`${button} text-ngpa-white/65 hover:text-ngpa-white`}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
