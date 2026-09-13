import { formatLongDate } from "@/lib/format-date";
import type {
  StandingsViewPlayoff,
  StandingsViewRow,
  StandingsViewWeek,
} from "@/lib/season-league-view";

// Shared display for the coach pages and the parent standings link. First
// names, records and scores only — the view layer never hands these
// components anything else (invariant-season-league-egress).

export function formatPct(winPct: number): string {
  return `${Math.round(winPct * 100)}%`;
}

function signed(n: number): string {
  return n > 0 ? `+${n}` : String(n);
}

export function StandingsTable({ rows }: { rows: StandingsViewRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="px-5 py-6 rounded-2xl border border-ngpa-slate/60 bg-ngpa-panel/60 text-ngpa-white/70 text-sm">
        No players on the roster yet.
      </div>
    );
  }
  return (
    <div className="bg-ngpa-panel/80 backdrop-blur-sm rounded-2xl border border-ngpa-slate/60 overflow-x-auto">
      <table className="w-full min-w-[30rem] text-sm">
        <thead className="text-xs uppercase tracking-wider text-ngpa-white/55 bg-ngpa-deep/40">
          <tr>
            <th className="text-left font-bold px-3 sm:px-4 py-3 w-10">#</th>
            <th className="text-left font-bold px-3 sm:px-4 py-3">Player</th>
            <th className="text-right font-bold px-3 sm:px-4 py-3">GP</th>
            <th className="text-right font-bold px-3 sm:px-4 py-3">W–L</th>
            <th className="text-right font-bold px-3 sm:px-4 py-3">Win %</th>
            <th className="text-right font-bold px-3 sm:px-4 py-3">+/−</th>
            <th className="text-right font-bold px-3 sm:px-4 py-3">Dbl</th>
            <th className="text-right font-bold px-3 sm:px-4 py-3">Sgl</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-ngpa-slate/40">
          {rows.map((r) => (
            <tr key={`${r.rank}-${r.name}`} className="hover:bg-ngpa-deep/30">
              <td className="px-3 sm:px-4 py-3 font-mono text-ngpa-white/70">{r.rank}</td>
              <td className="px-3 sm:px-4 py-3 font-bold text-ngpa-white">{r.name}</td>
              <td className="px-3 sm:px-4 py-3 text-right font-mono text-ngpa-white/85">{r.games}</td>
              <td className="px-3 sm:px-4 py-3 text-right font-mono text-ngpa-white/85">
                {r.wins}–{r.losses}
              </td>
              <td className="px-3 sm:px-4 py-3 text-right font-mono text-ngpa-teal font-bold">
                {r.games ? formatPct(r.winPct) : "—"}
              </td>
              <td className="px-3 sm:px-4 py-3 text-right font-mono text-ngpa-white/85">
                {r.games ? signed(r.pointDiff) : "—"}
              </td>
              <td className="px-3 sm:px-4 py-3 text-right font-mono text-ngpa-white/60">{r.doublesRecord}</td>
              <td className="px-3 sm:px-4 py-3 text-right font-mono text-ngpa-white/60">{r.singlesRecord}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function RankingNote() {
  return (
    <p className="text-xs text-ngpa-white/55 leading-relaxed">
      Ranked by win percentage, weighted toward games played — so one big Sunday
      can&rsquo;t leap a full season. Ties break on point differential, then
      points scored. Singles and doubles both count.
    </p>
  );
}

export function WeekResults({ weeks }: { weeks: StandingsViewWeek[] }) {
  if (weeks.length === 0) {
    return (
      <p className="text-sm text-ngpa-white/65">
        Results appear here after the first Sunday.
      </p>
    );
  }
  return (
    <div className="space-y-6">
      {[...weeks].reverse().map((w) => (
        <section key={w.week}>
          <h3 className="font-heading text-lg font-black text-ngpa-white tracking-tight mb-2">
            Week {w.week}{" "}
            <span className="text-ngpa-white/55 font-bold text-sm">
              · <time dateTime={w.date}>{formatLongDate(w.date)}</time>
            </span>
          </h3>
          <ul className="divide-y divide-ngpa-slate/40 rounded-2xl border border-ngpa-slate/60 bg-ngpa-panel/60">
            {w.games.map((g) => (
              <li
                key={`${w.week}-${g.round}-${g.court}`}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-sm"
              >
                <span className="font-mono text-xs text-ngpa-white/50 w-24 shrink-0">
                  R{g.round} · C{g.court}
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wider text-ngpa-teal w-14 shrink-0">
                  {g.format === "singles" ? "Singles" : "Doubles"}
                </span>
                <span className="flex-1 min-w-[10rem] text-ngpa-white/90">
                  {g.sideA} <span className="text-ngpa-white/45">vs</span> {g.sideB}
                </span>
                <span className="font-mono font-bold text-ngpa-white">
                  {g.status === "Played" ? (
                    <>
                      {g.scoreA}–{g.scoreB}
                      {g.timed && (
                        <span className="ml-1 text-[10px] font-bold uppercase text-ngpa-white/45">time</span>
                      )}
                    </>
                  ) : (
                    <span className="text-ngpa-white/45 font-normal">up next</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

export function PlayoffBoard({ playoff }: { playoff: StandingsViewPlayoff }) {
  return (
    <div className="space-y-5">
      {playoff.champion && (
        <div className="rounded-2xl border border-ngpa-lime/50 bg-ngpa-lime/10 px-5 py-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-ngpa-lime mb-1">Champions</p>
          <p className="font-heading text-2xl font-black text-ngpa-white tracking-tight">{playoff.champion}</p>
          {playoff.runnerUp && (
            <p className="text-sm text-ngpa-white/70 mt-1">Runners-up: {playoff.runnerUp}</p>
          )}
        </div>
      )}
      <div>
        <h3 className="font-heading text-lg font-black text-ngpa-white tracking-tight mb-2">Teams</h3>
        <ol className="grid gap-2 sm:grid-cols-2">
          {playoff.teams.map((t) => (
            <li
              key={t.seed}
              className="flex items-center gap-3 rounded-xl border border-ngpa-slate/60 bg-ngpa-panel/60 px-4 py-3 text-sm"
            >
              <span className="font-mono text-xs text-ngpa-white/50">#{t.seed}</span>
              <span className="font-bold text-ngpa-white">{t.name}</span>
            </li>
          ))}
        </ol>
      </div>
      <div>
        <h3 className="font-heading text-lg font-black text-ngpa-white tracking-tight mb-2">Bracket</h3>
        <ul className="divide-y divide-ngpa-slate/40 rounded-2xl border border-ngpa-slate/60 bg-ngpa-panel/60">
          {playoff.games.map((g) => (
            <li key={g.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-sm">
              <span className="text-xs text-ngpa-white/55 w-40 shrink-0">{g.label}</span>
              <span className="flex-1 min-w-[10rem] text-ngpa-white/90">
                {g.a ?? <span className="text-ngpa-white/40">TBD</span>}{" "}
                <span className="text-ngpa-white/45">vs</span>{" "}
                {g.b ?? <span className="text-ngpa-white/40">TBD</span>}
              </span>
              <span className="font-mono font-bold text-ngpa-white">
                {g.status === "played" ? (
                  `${g.scoreA}–${g.scoreB}`
                ) : g.status === "ready" ? (
                  <span className="text-ngpa-teal font-normal">on deck</span>
                ) : (
                  <span className="text-ngpa-white/40 font-normal">waiting</span>
                )}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
