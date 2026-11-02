import Link from "next/link";
import { notFound } from "next/navigation";
import {
  SEASON_LEAGUE_GAME_TARGET,
  SEASON_LEAGUE_GAME_TARGETS,
  SEASON_LEAGUE_GROUPS,
  SEASON_LEAGUE_PLAYOFF_WEEK,
  SEASON_LEAGUE_WIN_BY,
  parseSeasonLeagueWeek,
  seasonLeagueGroupFromSlug,
  seasonLeagueGroupSlug,
} from "@/data/season-league-2026";
import { formatLongDate } from "@/lib/format-date";
import { buildStandingsView, loadLeagueSnapshot } from "@/lib/season-league-view";
import { nameFor, sideLabel } from "@/lib/season-league/names";
import { RankingNote, StandingsTable } from "@/components/season-league/StandingsTable";
import AddRoundButton from "../../AddRoundButton";
import DayPlanner from "../../DayPlanner";
import FinalLocker from "../../FinalLocker";
import { GameTargetProvider } from "../../GameTarget";
import GameScoreForm from "../../GameScoreForm";
import PlayoffScoreForm from "../../PlayoffScoreForm";
import UnlockTeamsButton from "../../UnlockTeamsButton";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ group: string; week: string }>;
}

export default async function FallSeasonDayPage({ params }: PageProps) {
  const raw = await params;
  const group = seasonLeagueGroupFromSlug(raw.group);
  const week = parseSeasonLeagueWeek(raw.week);
  if (!group || !week) notFound();

  const option = SEASON_LEAGUE_GROUPS.find((g) => g.group === group)!;
  const snapshot = await loadLeagueSnapshot(group);
  const view = buildStandingsView(snapshot);
  const summary = snapshot.weeks.find((w) => w.week === week)!;
  const slug = seasonLeagueGroupSlug(group);
  const isFinale = week === SEASON_LEAGUE_PLAYOFF_WEEK;
  const finalGame = isFinale ? view.playoff?.games[0] ?? null : null;

  const roster = snapshot.confirmed.map((p) => ({ id: p.pageId, name: nameFor(snapshot.names, p.pageId) }));
  const initialPresent =
    summary.dayRow && summary.dayRow.present.length > 0
      ? summary.dayRow.present.filter((id) => roster.some((r) => r.id === id))
      : roster.map((r) => r.id);

  const dayGames = summary.games.filter((g) => g.phase === "League");
  const rounds = [...new Set(dayGames.map((g) => g.round))].sort((a, b) => a - b);
  const roundsPlayed = dayGames.filter((g) => g.status === "Played").reduce((m, g) => Math.max(m, g.round), 0);
  const presentSet = new Set(initialPresent);

  return (
    <>
      <Link
        href="/coach/fall-season"
        className="inline-flex items-center gap-1 text-sm text-ngpa-white/70 hover:text-ngpa-teal mb-6 transition-colors"
      >
        ← Season play
      </Link>
      <p className="text-xs font-bold tracking-[0.2em] uppercase text-ngpa-teal mb-3">
        Week {week} · <time dateTime={summary.date}>{formatLongDate(summary.date)}</time> · {option.timeLabel}
      </p>
      <h1 className="font-heading text-3xl sm:text-4xl font-black text-ngpa-white tracking-tight mb-2">
        {option.label} · {isFinale ? "Finale" : `Sunday ${week}`}
      </h1>
      <p className="text-sm text-ngpa-white/65 mb-8">
        Tick &ldquo;ended on time&rdquo; to record a game the clock stopped.
      </p>

      <GameTargetProvider
        group={group}
        week={week}
        targets={SEASON_LEAGUE_GAME_TARGETS}
        defaultTarget={SEASON_LEAGUE_GAME_TARGET}
        winBy={SEASON_LEAGUE_WIN_BY}
      >

      {snapshot.rowsStatus !== "ok" && (
        <div className="mb-8 rounded-2xl border border-amber-400/50 bg-amber-400/10 px-5 py-4 text-sm text-amber-100">
          {snapshot.rowsStatus === "config_missing"
            ? "NOTION_SEASON_LEAGUE_DB_ID is not set — you can preview, but nothing can be saved."
            : "Couldn't read the games database. Reload, or check the Notion share."}
        </div>
      )}
      {snapshot.rosterStatus !== "ok" && (
        <div className="mb-8 rounded-2xl border border-red-400/50 bg-red-400/10 px-5 py-4 text-sm text-red-100">
          The roster couldn&rsquo;t be read ({snapshot.rosterStatus}) — nobody can be checked in.
        </div>
      )}

        <div className="space-y-10">
          <section className="rounded-2xl border border-ngpa-slate/60 bg-ngpa-panel/40 p-4 sm:p-6">
            <DayPlanner
              group={group}
              week={week}
              roster={roster}
              initialPresent={initialPresent}
              hasSchedule={dayGames.some((g) => g.status === "Scheduled")}
              hasRounds={dayGames.length > 0}
              roundsPlayed={roundsPlayed}
            />
          </section>

          <section>
            <h2 className="font-heading text-2xl font-black text-ngpa-white tracking-tight mb-4">
              Today&rsquo;s games
            </h2>
            {rounds.length === 0 ? (
              <p className="text-sm text-ngpa-white/60">No schedule saved yet — preview and save above.</p>
            ) : (
              <ol className="space-y-5">
                {rounds.map((round) => {
                  const games = dayGames.filter((g) => g.round === round);
                  const onCourt = new Set(games.flatMap((g) => [...g.sideA, ...g.sideB]));
                  const sitting = [...presentSet].filter((id) => !onCourt.has(id));
                  return (
                    <li key={round} className="rounded-2xl border border-ngpa-slate/60 bg-ngpa-panel/60 overflow-hidden">
                      <p className="px-4 py-2 text-xs font-bold uppercase tracking-wider text-ngpa-white/60 bg-ngpa-deep/40">
                        Round {round}
                        {sitting.length > 0 && (
                          <span className="normal-case tracking-normal font-normal text-ngpa-white/45">
                            {" "}· sitting: {sitting.map((id) => nameFor(snapshot.names, id)).join(", ")}
                          </span>
                        )}
                      </p>
                      <ul className="divide-y divide-ngpa-slate/40">
                        {games.map((g) => (
                          <li key={g.key} className="px-4 py-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <div className="text-sm">
                              <span className="font-mono text-xs text-ngpa-white/50 mr-2">C{g.court}</span>
                              <span className="text-[10px] font-bold uppercase tracking-wider text-ngpa-teal mr-2">
                                {g.format === "singles" ? "Singles" : "Doubles"}
                              </span>
                              <span className="font-bold text-ngpa-white">{sideLabel(snapshot.names, g.sideA)}</span>
                              <span className="text-ngpa-white/45"> vs </span>
                              <span className="font-bold text-ngpa-white">{sideLabel(snapshot.names, g.sideB)}</span>
                            </div>
                            <GameScoreForm
                              group={group}
                              week={week}
                              gameKey={g.key}
                              scoreA={g.status === "Played" ? g.scoreA : null}
                              scoreB={g.status === "Played" ? g.scoreB : null}
                              timed={g.timed}
                              played={g.status === "Played"}
                            />
                          </li>
                        ))}
                      </ul>
                    </li>
                  );
                })}
              </ol>
            )}
            {rounds.length > 0 && (
              <AddRoundButton
                group={group}
                week={week}
                presentIds={initialPresent}
                nextRound={rounds[rounds.length - 1] + 1}
              />
            )}
          </section>

          <section>
            <h2 className="font-heading text-2xl font-black text-ngpa-white tracking-tight mb-4">Standings</h2>
            <StandingsTable rows={view.standings} />
            <div className="mt-2">
              <RankingNote />
            </div>
          </section>

          {isFinale && (
            <section className="rounded-2xl border border-ngpa-lime/40 bg-ngpa-lime/5 p-4 sm:p-6">
              <h2 className="font-heading text-xl font-black text-ngpa-white tracking-tight mb-2">The final</h2>
              <p className="text-sm text-ngpa-white/75 leading-relaxed mb-5">
                After the round robin, the top four kids checked in today play one game for 1st and
                2nd: #1 and #4 against #2 and #3, from the standings above. Everyone else cheers. If
                #4 and #5 are tied, settle it on court, then pick who plays.
              </p>
              {finalGame && view.playoff ? (
                <GameTargetProvider
                  group={group}
                  week={week}
                  scope="final"
                  label="Final to"
                  targets={SEASON_LEAGUE_GAME_TARGETS}
                  defaultTarget={SEASON_LEAGUE_GAME_TARGET}
                  winBy={SEASON_LEAGUE_WIN_BY}
                >
                  <div className="space-y-4">
                    {view.playoff.champion && (
                      <div className="rounded-2xl border border-ngpa-lime/50 bg-ngpa-lime/10 px-5 py-4">
                        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-ngpa-lime mb-1">1st place</p>
                        <p className="font-heading text-2xl font-black text-ngpa-white tracking-tight">{view.playoff.champion}</p>
                        {view.playoff.runnerUp && (
                          <p className="text-sm text-ngpa-white/70 mt-1">2nd place: {view.playoff.runnerUp}</p>
                        )}
                      </div>
                    )}
                    <div className="flex flex-col gap-2 rounded-xl border border-ngpa-slate/60 bg-ngpa-panel/60 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="text-sm">
                        <span className="font-bold text-ngpa-white">{finalGame.a}</span>
                        <span className="text-ngpa-white/45"> vs </span>
                        <span className="font-bold text-ngpa-white">{finalGame.b}</span>
                      </div>
                      <PlayoffScoreForm
                        group={group}
                        slot={finalGame.id}
                        scoreA={finalGame.scoreA}
                        scoreB={finalGame.scoreB}
                        timed={finalGame.timed}
                        played={finalGame.status === "played"}
                      />
                    </div>
                    {snapshot.playoff.results.length === 0 && <UnlockTeamsButton group={group} />}
                  </div>
                </GameTargetProvider>
              ) : (
                <FinalLocker group={group} />
              )}
            </section>
          )}
        </div>
      </GameTargetProvider>
      <p className="mt-10 text-xs text-ngpa-white/40">
        Other Sundays:{" "}
        {snapshot.weeks.map((w) => (
          <Link key={w.week} href={`/coach/fall-season/${slug}/${w.week}`} className="underline hover:text-ngpa-teal mr-2">
            W{w.week}
          </Link>
        ))}
      </p>
    </>
  );
}
