import type { ReactNode } from "react";
import type { BracketEntrant, BracketSlotView } from "@/lib/rotation-league/view";

// The double-elimination bracket, grouped winners -> losers -> final. Shared by
// the coach playoff page (which passes a score form per slot) and the parent
// standings link (which passes nothing).

const SIDES: { key: BracketSlotView["side"]; title: string }[] = [
  { key: "winners", title: "Winners bracket" },
  { key: "losers", title: "Second-chance bracket" },
  { key: "final", title: "Final" },
  { key: "reset", title: "Final, deciding game" },
];

export function entrantLabel(e: BracketEntrant): string {
  if (e === null) return "Winner to come";
  if (e === "bye") return "Bye";
  return `Seed ${e.seed}: ${e.players.join(" & ")}`;
}

export function Bracket({
  slots,
  renderAction,
}: {
  slots: BracketSlotView[];
  renderAction?: (slot: BracketSlotView) => ReactNode;
}) {
  return (
    <div className="space-y-6">
      {SIDES.map(({ key, title }) => {
        const inSide = slots.filter((s) => s.side === key);
        if (inSide.length === 0) return null;
        return (
          <div key={key}>
            <p className="text-xs font-bold uppercase tracking-wider text-ngpa-teal mb-2">{title}</p>
            <ul className="space-y-3">
              {inSide.map((s) => {
                const aWon = s.status === "played" && (s.score_a ?? 0) > (s.score_b ?? 0);
                const bWon = s.status === "played" && (s.score_b ?? 0) > (s.score_a ?? 0);
                return (
                  <li key={s.id} className="rounded-2xl border border-ngpa-slate/40 bg-ngpa-panel/40 p-4">
                    <p className="text-[11px] uppercase tracking-wider text-ngpa-white/50 mb-1">{s.label}</p>
                    <p className={`text-sm ${aWon ? "font-bold text-ngpa-white" : "text-ngpa-white/80"}`}>
                      {entrantLabel(s.a)}
                      {s.status === "played" && <span className="ml-2 font-mono">{s.score_a}</span>}
                    </p>
                    <p className={`text-sm ${bWon ? "font-bold text-ngpa-white" : "text-ngpa-white/80"}`}>
                      {entrantLabel(s.b)}
                      {s.status === "played" && <span className="ml-2 font-mono">{s.score_b}</span>}
                    </p>
                    {renderAction?.(s)}
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
