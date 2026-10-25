import type { PlanRound } from "@/lib/rotation-league/view";

// The planned rounds a coach is about to save: courts, sides and who sits.
export default function PlanPreview({ rounds }: { rounds: PlanRound[] }) {
  return (
    <div className="mt-4 grid gap-3 sm:grid-cols-2">
      {rounds.map((r) => (
        <div key={r.round} className="rounded-2xl border border-ngpa-slate/40 bg-ngpa-panel/40 p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-ngpa-teal mb-2">Round {r.round}</p>
          <ul className="space-y-1.5 text-sm text-ngpa-white">
            {r.games.map((g) => (
              <li key={g.court}>
                <span className="text-ngpa-white/50 text-xs mr-2">
                  Court {g.court} · {g.format}
                </span>
                {g.side_a.join(" & ")} <span className="text-ngpa-white/45">vs</span> {g.side_b.join(" & ")}
              </li>
            ))}
          </ul>
          {r.sitting.length > 0 && <p className="text-xs text-ngpa-white/55 mt-2">Sitting: {r.sitting.join(", ")}</p>}
        </div>
      ))}
    </div>
  );
}
