import Link from "next/link";
import { notFound } from "next/navigation";
import { findRotationLeagueSeason, parsePlayWeek } from "@/data/rotation-league-seasons";
import { formatLongDate } from "@/lib/format-date";
import { readStandings, readWeek, type WeekGame } from "@/lib/rotation-league/view";
import { LeagueStandings } from "@/components/rotation-league/LeagueStandings";
import CheckInList from "./CheckInList";
import PlanPanel from "./PlanPanel";
import LeagueScoreForm from "./LeagueScoreForm";

export const dynamic = "force-dynamic";

// One league night on one page: who's here, plan the rounds, score every game,
// and the standings underneath. Everything is read live from Link & Dink.
export default async function LeagueWeekPage({ params }: { params: Promise<{ slug: string; week: string }> }) {
  const { slug, week: weekParam } = await params;
  const season = findRotationLeagueSeason(slug);
  if (!season) notFound();
  const week = parsePlayWeek(season, weekParam);
  if (week === null) notFound();

  const [data, standings] = await Promise.all([readWeek(season.slug, week), readStandings(season.slug)]);
  const games = data.ok ? data.games : [];
  const rounds = new Map<number, WeekGame[]>();
  for (const g of games) {
    const r = g.round ?? 0;
    rounds.set(r, [...(rounds.get(r) ?? []), g]);
  }
  const scored = games.filter((g) => g.status === "played").length;
  const date = season.weekDates[week];

  return (
    <>
      <Link
        href="/coach/league"
        className="inline-flex items-center gap-1 text-sm text-ngpa-white/70 hover:text-ngpa-teal mb-6 transition-colors"
      >
        ← All seasons
      </Link>
      <p className="text-xs font-bold tracking-[0.2em] uppercase text-ngpa-teal mb-3">{season.name}</p>
      <h1 className="font-heading text-3xl sm:text-4xl font-black text-ngpa-white tracking-tight mb-2">
        Week {week}
        {date && <span className="ml-3 text-xl font-bold text-ngpa-white/60">{formatLongDate(date)}</span>}
      </h1>
      {season.note && (
        <p className="text-xs text-amber-200/80 border border-amber-300/30 bg-amber-300/5 rounded-xl px-3 py-2 mb-6 max-w-2xl">
          {season.note}
        </p>
      )}

      {!data.ok ? (
        <p className="rounded-2xl border border-red-400/40 bg-red-400/5 px-4 py-3 text-sm text-red-200">{data.message}</p>
      ) : (
        <div className="space-y-10">
          <section>
            <h2 className="font-heading text-xl font-black text-ngpa-white mb-3">1. Who&rsquo;s here</h2>
            <CheckInList
              slug={season.slug}
              week={week}
              players={data.players
                .filter((p) => p.status === "active" || p.present)
                .map((p) => ({ external_ref: p.external_ref, name: p.name, present: p.present }))}
            />
          </section>

          <section>
            <h2 className="font-heading text-xl font-black text-ngpa-white mb-3">2. Plan the rounds</h2>
            <PlanPanel slug={season.slug} week={week} hasGames={games.length > 0} />
          </section>

          <section>
            <h2 className="font-heading text-xl font-black text-ngpa-white mb-1">3. Scores</h2>
            <p className="text-sm text-ngpa-white/60 mb-4">
              {games.length === 0 ? "No rounds saved yet." : `${scored} of ${games.length} games scored.`}
            </p>
            <div className="space-y-6">
              {[...rounds.entries()]
                .sort(([a], [b]) => a - b)
                .map(([round, roundGames]) => (
                  <div key={round}>
                    <p className="text-xs font-bold uppercase tracking-wider text-ngpa-teal mb-2">Round {round}</p>
                    <ul className="space-y-3">
                      {roundGames.map((g) => (
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
                            slug={season.slug}
                            week={week}
                            gameId={g.id}
                            scoreA={g.score_a}
                            scoreB={g.score_b}
                            timed={g.timed}
                            played={g.status === "played"}
                            gameTargets={[...season.gameTargets]}
                            defaultTarget={season.gameTarget}
                          />
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
            </div>
          </section>

          <section>
            <h2 className="font-heading text-xl font-black text-ngpa-white mb-3">Standings</h2>
            {standings.ok ? (
              <LeagueStandings rows={standings.standings} />
            ) : (
              <p className="text-sm text-ngpa-white/60">{standings.message}</p>
            )}
          </section>
        </div>
      )}
    </>
  );
}
