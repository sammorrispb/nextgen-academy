import { LEVEL_COLOR } from "@/lib/level-colors";
import { LEAGUE_BANDS } from "@/data/leagues";
import { CREW_DAYS } from "@/lib/validate-crew-interest";
import {
  CALENDAR_LEVELS,
  type DayLevelCounts,
  type DemandMatrix,
} from "@/lib/coach-calendar";

interface Props {
  demand: DemandMatrix;
  supply: DayLevelCounts;
  crewOk: boolean;
  crewTruncated: boolean;
  fallOk: boolean;
  fallTruncated: boolean;
  fallSundayWorks: number;
  fallSundayDoesnt: number;
  fallSubList: number;
}

function cellTone(want: number, running: number): string {
  if (want === 0) return "text-ngpa-white/35";
  if (running === 0) return "bg-amber-400/15 text-amber-300";
  if (want > running * 4) return "bg-ngpa-teal/15 text-ngpa-teal";
  return "text-ngpa-white/75";
}

export default function DemandPanel({
  demand,
  supply,
  crewOk,
  crewTruncated,
  fallOk,
  fallTruncated,
  fallSundayWorks,
  fallSundayDoesnt,
  fallSubList,
}: Props) {
  const maxBand = Math.max(
    1,
    ...CALENDAR_LEVELS.flatMap((l) =>
      LEAGUE_BANDS.map((b) => demand.byLevel[l].bands[b.band]),
    ),
  );

  return (
    <section className="mt-10">
      <h2 className="font-heading text-xl font-black text-ngpa-white tracking-tight mb-1">
        Who&apos;s waiting, and where
      </h2>
      <p className="text-sm text-ngpa-white/65 mb-4 max-w-2xl">
        {demand.total} famil{demand.total === 1 ? "y" : "ies"} still looking for
        a crew, against what&apos;s actually running this month. Counts only —
        open the Inbox to see who they are.
      </p>

      {(!crewOk || !fallOk || crewTruncated || fallTruncated) && (
        <div className="mb-4 px-4 py-3 rounded-2xl border border-amber-400/40 bg-amber-400/10 text-sm text-amber-200 space-y-1">
          {!crewOk && <p>Crew Interest is unavailable right now — these numbers are missing it, not zero.</p>}
          {!fallOk && <p>Fall Interest is unavailable right now — these numbers are missing it, not zero.</p>}
          {crewTruncated && <p>Crew Interest hit the 1,000-row read cap; the tail isn&apos;t counted.</p>}
          {fallTruncated && <p>Fall Interest hit the 1,000-row read cap; the tail isn&apos;t counted.</p>}
        </div>
      )}

      <div className="overflow-x-auto rounded-2xl border border-ngpa-slate/60 bg-ngpa-panel/80 backdrop-blur-sm">
        <table className="w-full md:min-w-[30rem] text-sm">
          <thead>
            <tr className="border-b border-ngpa-slate/60">
              <th className="text-left px-4 py-3 text-xs font-bold tracking-wider uppercase text-ngpa-white/55">
                Day
              </th>
              {CALENDAR_LEVELS.map((level) => (
                <th key={level} className="px-2 py-3">
                  <span
                    className={`inline-block px-2 py-1 rounded text-xs font-bold ${LEVEL_COLOR[level]}`}
                  >
                    {level}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {CREW_DAYS.map((day) => (
              <tr key={day} className="border-b border-ngpa-slate/30 last:border-0">
                <th className="text-left px-4 py-3 font-bold text-ngpa-white/70">
                  {day}
                </th>
                {CALENDAR_LEVELS.map((level) => {
                  const want = demand.byDayLevel[day][level];
                  const running = supply[day][level];
                  return (
                    <td key={level} className="px-2 py-3 text-center">
                      <span
                        className={`inline-block px-2 py-1 rounded font-mono text-xs font-bold whitespace-nowrap ${cellTone(want, running)}`}
                      >
                        <span className="hidden md:inline">
                          {want} want · {running} running
                        </span>
                        <span className="md:hidden">
                          {want}·{running}
                        </span>
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-ngpa-white/55 mt-2">
        <span className="md:hidden">Each cell is waiting·running. </span>
        Amber = families waiting with nothing running that day. Teal = demand
        well past one court.
        {demand.dayless > 0 &&
          ` ${demand.dayless} famil${demand.dayless === 1 ? "y" : "ies"} named no preferred day, so they're counted by level below but not in this grid.`}
      </p>

      <div className="grid gap-4 sm:grid-cols-2 mt-6">
        {CALENDAR_LEVELS.map((level) => {
          const d = demand.byLevel[level];
          return (
            <div
              key={level}
              className="bg-ngpa-panel/80 backdrop-blur-sm rounded-2xl border border-ngpa-slate/60 px-5 py-5"
            >
              <div className="flex items-center gap-3 mb-3">
                <span
                  className={`px-2 py-1 rounded text-xs font-bold ${LEVEL_COLOR[level]}`}
                >
                  {level}
                </span>
                <span className="font-mono font-bold text-ngpa-white">
                  {d.total}
                </span>
                <span className="text-sm text-ngpa-white/65">
                  waiting
                  {d.minAge !== null &&
                    d.maxAge !== null &&
                    ` · ages ${d.minAge}–${d.maxAge}`}
                </span>
              </div>
              <div className="space-y-1.5">
                {LEAGUE_BANDS.map((band) => {
                  const n = d.bands[band.band];
                  return (
                    <div key={band.band} className="flex items-center gap-2">
                      <span className="w-10 shrink-0 font-mono text-xs font-bold text-ngpa-white/55">
                        {band.label}
                      </span>
                      <span className="w-14 shrink-0 text-xs text-ngpa-white/45">
                        {band.minAge}–{band.maxAge}
                      </span>
                      <span className="flex-1 h-2 rounded-full bg-ngpa-slate/40 overflow-hidden">
                        <span
                          className="block h-full rounded-full bg-ngpa-teal"
                          style={{ width: `${(n / maxBand) * 100}%` }}
                        />
                      </span>
                      <span className="w-6 shrink-0 text-right font-mono text-xs font-bold text-ngpa-white/70">
                        {n}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {demand.ageless > 0 && (
        <p className="text-xs text-ngpa-white/55 mt-3">
          {demand.ageless} famil{demand.ageless === 1 ? "y" : "ies"} had no
          usable age on file — counted in the level totals, absent from every
          band.
        </p>
      )}

      <div className="mt-6 bg-ngpa-panel/80 backdrop-blur-sm rounded-2xl border border-ngpa-slate/60 px-5 py-5">
        <h3 className="font-heading text-base font-black text-ngpa-white mb-2">
          Fall Sunday fit
        </h3>
        <p className="text-sm text-ngpa-white/70">
          <span className="font-mono font-bold text-ngpa-white">
            {fallSundayWorks}
          </span>{" "}
          say Sunday works ·{" "}
          <span className="font-mono font-bold text-ngpa-white">
            {fallSundayDoesnt}
          </span>{" "}
          say it doesn&apos;t ·{" "}
          <span className="font-mono font-bold text-ngpa-white">
            {fallSubList}
          </span>{" "}
          want the sub list.
        </p>
        <p className="text-xs text-ngpa-white/55 mt-2">
          Fall Interest only asks about Sunday, so it feeds the level and age
          counts above but never the weekday grid.
        </p>
      </div>
    </section>
  );
}
