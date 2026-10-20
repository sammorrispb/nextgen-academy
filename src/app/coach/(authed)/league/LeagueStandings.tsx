import type { StandingRow } from "@/lib/rotation-league/view";

// Coach-only standings. Ranked on shrunk win % (W+2)/(GP+4), then point
// difference, then points for, by the Link & Dink engine.
export function LeagueStandings({ rows }: { rows: StandingRow[] }) {
  if (rows.length === 0) {
    return <p className="text-sm text-ngpa-white/60">No scored games yet.</p>;
  }
  return (
    <div className="overflow-x-auto rounded-2xl border border-ngpa-slate/40">
      <table className="w-full text-sm">
        <thead className="bg-ngpa-panel/60 text-ngpa-white/60 text-xs uppercase tracking-wider">
          <tr>
            <th className="px-3 py-2 text-left">#</th>
            <th className="px-3 py-2 text-left">Player</th>
            <th className="px-3 py-2 text-right">GP</th>
            <th className="px-3 py-2 text-right">W–L</th>
            <th className="px-3 py-2 text-right">+/−</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={`${r.rank}-${r.name}`} className="border-t border-ngpa-slate/30 text-ngpa-white">
              <td className="px-3 py-2 font-mono text-ngpa-white/60">{r.rank}</td>
              <td className="px-3 py-2 font-bold">{r.name}</td>
              <td className="px-3 py-2 text-right font-mono">{r.games}</td>
              <td className="px-3 py-2 text-right font-mono">
                {r.wins}–{r.losses}
              </td>
              <td className="px-3 py-2 text-right font-mono">
                {r.point_diff > 0 ? `+${r.point_diff}` : r.point_diff}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
